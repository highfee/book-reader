import { SAFStorageService, DiscoveredBookFile } from '../storage/safStorage';
import { BookRepository } from '../database/bookRepository';
import { inferBookMetadata } from '../parsers/titleInference';
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

      // Parse metadata from file name
      const { title, author } = this.parseFileName(file.fileName);
      const now = new Date().toISOString();
      let initialTotalPages = 0;
      if (file.format === 'pdf') {
        try {
          initialTotalPages = await PDFMetadataService.getPdfPageCount(file.fileUri, file.fileName);
        } catch {
          initialTotalPages = 0;
        }
      }

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
}
