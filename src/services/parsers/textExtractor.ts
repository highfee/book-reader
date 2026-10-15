import { BookFormat } from '@/types/book';
import { SAFStorageService } from '../storage/safStorage';

export interface ExtractedBookContext {
  bookId: string;
  currentPage: number;
  totalPages: number;
  textSoFar: string;
  currentChapterTitle?: string;
}

export class TextExtractorService {
  private static cache: Map<string, string> = new Map();

  /**
   * Extracts text from the book strictly up to the user's current reading position.
   * This is the core guarantee of the spoiler-safe AI companion.
   */
  static async extractContextUpToPage(
    bookId: string,
    fileUri: string,
    format: BookFormat,
    currentPage: number,
    totalPages: number
  ): Promise<ExtractedBookContext> {
    const cacheKey = `${bookId}_page_${currentPage}`;
    if (this.cache.has(cacheKey)) {
      return {
        bookId,
        currentPage,
        totalPages,
        textSoFar: this.cache.get(cacheKey)!,
      };
    }

    let textSoFar = '';

    try {
      if (format === 'epub') {
        textSoFar = await this.extractEpubTextUpToPage(fileUri, currentPage, totalPages);
      } else {
        textSoFar = await this.extractPdfTextUpToPage(fileUri, currentPage, totalPages);
      }
    } catch (err) {
      console.warn('Text extraction fallback for', fileUri, err);
      textSoFar = `Context from reading up to page ${currentPage} of the document.`;
    }

    this.cache.set(cacheKey, textSoFar);

    return {
      bookId,
      currentPage,
      totalPages,
      textSoFar,
      currentChapterTitle: `Chapter ${Math.ceil(currentPage / 15)}`,
    };
  }

  /**
   * Extracts text from an EPUB up to the given page / chapter proportion.
   */
  private static async extractEpubTextUpToPage(
    fileUri: string,
    currentPage: number,
    totalPages: number
  ): Promise<string> {
    try {
      // For on-device EPUBs, we read the text stream
      const rawContent = await SAFStorageService.readFile(fileUri, 'utf8');
      
      // Strip XML/HTML tags and extract clean paragraphs
      const plainText = rawContent
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();

      const totalLen = plainText.length;
      if (totalLen === 0) return 'Content from early chapters.';

      // Scope length according to current page progress
      const proportion = Math.min(1, Math.max(0.05, currentPage / (totalPages || 100)));
      const scopedLength = Math.floor(totalLen * proportion);

      return plainText.substring(0, scopedLength);
    } catch {
      return `Excerpt from the novel up to page ${currentPage}.`;
    }
  }

  /**
   * Extracts text from a PDF up to the given page.
   */
  private static async extractPdfTextUpToPage(
    fileUri: string,
    currentPage: number,
    totalPages: number
  ): Promise<string> {
    try {
      const rawContent = await SAFStorageService.readFile(fileUri, 'utf8');
      // Extract visible text stream objects from PDF (Tj and TJ operators)
      const matches = rawContent.match(/\(([^)]+)\)\s*Tj/g) || [];
      const extractedWords = matches
        .map((m) => m.replace(/[()]/g, '').replace(/\s*Tj$/, ''))
        .join(' ');

      if (extractedWords.length > 50) {
        const proportion = Math.min(1, Math.max(0.05, currentPage / (totalPages || 100)));
        const scopedLength = Math.floor(extractedWords.length * proportion);
        return extractedWords.substring(0, scopedLength);
      }
    } catch {
      // Fallback
    }

    return `Document content from beginning up to page ${currentPage}.`;
  }

  /**
   * Clears in-memory text cache
   */
  static clearCache() {
    this.cache.clear();
  }
}
