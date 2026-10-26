import { SAFStorageService, DiscoveredBookFile } from '../storage/safStorage';
import { BookRepository } from '../database/bookRepository';
import { inferBookMetadata } from '../parsers/titleInference';
import { EPUBTextExtractor } from '../parsers/epubTextExtractor';
import { PDFMetadataService } from '../parsers/pdfMetadata';
import { Book, BookWithProgress } from '@/types/book';

export interface ScanResult {
  totalScanned: number;
  newlyAdded: number;
  existing: number;
  missingPruned?: number;
  books: BookWithProgress[];
}

export class BookScannerService {
  /**
   * Deterministic ID generation based on canonical book metadata, ISBN, and publication identity.
   * Ensures identical books across devices or re-encodings share the exact same ID.
   */
  static generateDeterministicBookId(
    fileName: string,
    title?: string,
    author?: string,
    isbnOrIdentifier?: string,
    pageCount?: number
  ): string {
    // Priority 1: Direct ISBN or formal publication identifier when present
    if (isbnOrIdentifier && isbnOrIdentifier.trim().length >= 8) {
      const cleanIsbn = isbnOrIdentifier.replace(/[^0-9X]/gi, '').toLowerCase();
      if (cleanIsbn.length >= 8) {
        return `book_isbn_${cleanIsbn}`;
      }
    }

    // Priority 2: Canonical title + author + approximate page count bucket (tolerance for minor re-encodings)
    const normTitle = (title || '').toLowerCase().trim();
    const normAuthor = (author && author !== 'Unknown Author') ? author.toLowerCase().trim() : '';
    const pageBucket = pageCount && pageCount > 0 ? Math.round(pageCount / 10) * 10 : 0;

    let rawSeed = '';
    if (normTitle && normAuthor) {
      rawSeed = `${normTitle}:::${normAuthor}${pageBucket > 0 ? `:::${pageBucket}` : ''}`;
    } else if (normTitle) {
      rawSeed = `${normTitle}${pageBucket > 0 ? `:::${pageBucket}` : ''}`;
    } else {
      rawSeed = fileName.toLowerCase().trim();
    }

    let hash = 0;
    for (let i = 0; i < rawSeed.length; i++) {
      hash = ((hash << 5) - hash) + rawSeed.charCodeAt(i);
      hash |= 0;
    }
    const cleanPrefix = (normTitle || fileName)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 16)
      .toLowerCase();

    return `book_${cleanPrefix}_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Scans a target directory URI, parses filenames/metadata, and syncs newly discovered books into SQLite.
   */
  static async scanAndSyncDirectory(directoryUri: string): Promise<ScanResult> {
    try {
      const discoveredFiles = await SAFStorageService.scanDirectoryForBooks(directoryUri);
      return await this.syncFilesToDatabase(discoveredFiles);
    } catch (err: any) {
      console.warn('[BookScanner] Failed to scan directory, permission may have been revoked:', err);
      throw err;
    }
  }

  /**
   * Reconciles the local SQLite database against available files or directory.
   * If a book's fileUri cannot be found or read, it can be flagged or pruned.
   */
  static async reconcileMissingFiles(activeFileUris: Set<string>): Promise<number> {
    try {
      const allBooks = await BookRepository.getAllBooks();
      let prunedCount = 0;
      for (const book of allBooks) {
        if (!activeFileUris.has(book.fileUri)) {
          // If the book belongs to the scanned directory and is missing, prune it
          await BookRepository.deleteBook(book.id);
          prunedCount++;
        }
      }
      return prunedCount;
    } catch (err) {
      console.error('[BookScanner] Error reconciling missing files:', err);
      return 0;
    }
  }

  /**
   * Syncs an explicit list of discovered or picked files into the database.
   */
  static async syncFilesToDatabase(files: DiscoveredBookFile[]): Promise<ScanResult> {
    let newlyAdded = 0;
    let existing = 0;

    for (const file of files) {
      const existingBook = await BookRepository.getBookByFileUri(file.fileUri);
      if (existingBook) {
        existing++;
        continue;
      }

      // Prefer what the file says about itself; a filename only records what a downloader typed
      const container = await this.readContainer(file);
      const { title, author } = this.mergeWithFileName(file.fileName, container);
      const initialTotalPages = container.pageCount ?? 0;
      const now = new Date().toISOString();

      const deterministicId = this.generateDeterministicBookId(
        file.fileName,
        title,
        author,
        undefined,
        initialTotalPages
      );

      const newBook: Book = {
        id: deterministicId,
        fileUri: file.fileUri,
        fileName: file.fileName,
        format: file.format,
        title,
        author,
        totalPages: initialTotalPages,
        genreTags: [],
        addedAt: now,
        updatedAt: now,
      };

      await BookRepository.upsertBook(newBook);
      if (file.fileObj) {
        // Web blob: URLs die on reload — index the bytes under the book id so the
        // original-PDF view can revive them without guessing from the file name.
        await SAFStorageService.persistBookFile(file.fileName, file.fileObj, deterministicId);
      }
      newlyAdded++;
    }

    const allBooks = await BookRepository.getAllBooks();

    return {
      totalScanned: files.length,
      newlyAdded,
      existing,
      books: allBooks,
    };
  }

  /**
   * Helper to clean up filenames and extract exact title and author.
   */
  static parseFileName(fileName: string): { title: string; author: string } {
    return inferBookMetadata(fileName);
  }

  /**
   * Asks the container what the book is, and how long it is, in one read of the file.
   */
  static async readContainer(
    file: DiscoveredBookFile
  ): Promise<{ title?: string; author?: string; pageCount?: number }> {
    try {
      if (file.format === 'epub') {
        const meta = await EPUBTextExtractor.readMetadata(file.fileUri);
        return { title: meta.title, author: meta.author };
      }
      if (file.format === 'pdf') {
        const info = await PDFMetadataService.readPdfSelfDescription(file.fileUri, file.fileName);
        return { title: info.title, author: info.author, pageCount: info.pageCount };
      }
    } catch (err) {
      console.warn('[BookScanner] Could not read container metadata, using file name:', err);
    }
    return {};
  }

  /**
   * The publisher's own title beats any guess from a filename — the name only records what a
   * downloader typed — but it still passes through the cleaner, because release sites tag their
   * exports inside the metadata too.
   */
  static mergeWithFileName(
    fileName: string,
    container: { title?: string; author?: string }
  ): { title: string; author: string } {
    const fromName = this.parseFileName(fileName);
    if (!container.title) return fromName;

    return {
      title: inferBookMetadata({ title: container.title, fileName: '', author: container.author }).title || fromName.title,
      author: container.author || fromName.author,
    };
  }
}
