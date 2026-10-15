import { BookRepository } from '@/services/database/bookRepository';
import { BookScannerService } from '@/services/scanner/bookScanner';
import { SAFStorageService } from '@/services/storage/safStorage';
import { GeminiAIService } from '@/services/ai/geminiService';
import { TextExtractorService } from '@/services/parsers/textExtractor';
import { BookWithProgress, LibraryFilter } from '@/types/book';
import { create } from 'zustand';

interface LibraryState {
  books: BookWithProgress[];
  directoryUri: string | null;
  filter: LibraryFilter;
  isScanning: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  setFilter: (newFilter: Partial<LibraryFilter>) => void;
  loadBooks: () => Promise<void>;
  selectDirectoryAndScan: () => Promise<{ success: boolean; error?: string }>;
  rescanDirectory: () => Promise<void>;
  importFilesManually: () => Promise<void>;
  addSampleBooks: () => Promise<void>;
  refreshBook: (bookId: string) => Promise<void>;
  updateBookTitleAndAuthor: (bookId: string, title: string, author: string) => Promise<void>;
  refineAllBookTitlesWithAI: () => Promise<{ updatedCount: number }>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  books: [],
  directoryUri: null,
  filter: {
    status: 'all',
    searchQuery: '',
  },
  isScanning: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });
      const savedDir = await BookRepository.getSetting('reading_directory_uri');
      const books = await BookRepository.getAllBooks(get().filter);
      set({ directoryUri: savedDir, books, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err?.message || 'Failed to initialize library' });
    }
  },

  setFilter: (newFilter: Partial<LibraryFilter>) => {
    set((state) => ({
      filter: { ...state.filter, ...newFilter },
    }));
    get().loadBooks();
  },

  loadBooks: async () => {
    try {
      const books = await BookRepository.getAllBooks(get().filter);
      set({ books });
    } catch (err: any) {
      console.error('Failed to load books:', err);
    }
  },

  selectDirectoryAndScan: async () => {
    try {
      set({ isScanning: true, error: null });
      const result = await SAFStorageService.requestDirectoryAccess();

      if (!result.granted || !result.directoryUri) {
        set({ isScanning: false });
        return { success: false, error: result.error || 'Access not granted' };
      }

      await BookRepository.setSetting('reading_directory_uri', result.directoryUri);
      set({ directoryUri: result.directoryUri });

      const scanResult = await BookScannerService.scanAndSyncDirectory(result.directoryUri);
      set({ books: scanResult.books, isScanning: false });
      return { success: true };
    } catch (err: any) {
      set({ isScanning: false, error: err?.message || 'Scanning failed' });
      return { success: false, error: err?.message };
    }
  },

  rescanDirectory: async () => {
    const { directoryUri } = get();
    if (!directoryUri) return;

    try {
      set({ isScanning: true, error: null });
      const scanResult = await BookScannerService.scanAndSyncDirectory(directoryUri);
      set({ books: scanResult.books, isScanning: false });
    } catch (err: any) {
      set({ isScanning: false, error: err?.message || 'Failed to rescan directory' });
    }
  },

  importFilesManually: async () => {
    try {
      set({ isScanning: true, error: null });
      const pickedFiles = await SAFStorageService.pickBookFiles();
      if (pickedFiles.length > 0) {
        const scanResult = await BookScannerService.syncFilesToDatabase(pickedFiles);
        set({ books: scanResult.books, isScanning: false });
      } else {
        set({ isScanning: false });
      }
    } catch (err: any) {
      set({ isScanning: false, error: err?.message || 'Failed to import files' });
    }
  },

  addSampleBooks: async () => {
    try {
      set({ isLoading: true });
      const now = new Date().toISOString();
      const samples: any[] = [
        {
          id: `book_sample_odyssey_${Date.now()}`,
          fileName: 'The_Odyssey_Homer.epub',
          fileUri: 'https://raw.githubusercontent.com/IDPF/epub3-samples/master/30/moby-dick/OPS/package.opf',
          format: 'epub',
          title: 'The Odyssey',
          author: 'Homer',
          totalPages: 120,
          genreTags: ['Classics', 'Epic', 'Mythology'],
          addedAt: now,
          updatedAt: now,
        },
        {
          id: `book_sample_frankenstein_${Date.now()}`,
          fileName: 'Frankenstein_Mary_Shelley.pdf',
          fileUri: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          format: 'pdf',
          title: 'Frankenstein',
          author: 'Mary Shelley',
          totalPages: 85,
          genreTags: ['Gothic', 'Sci-Fi', 'Horror'],
          addedAt: now,
          updatedAt: now,
        },
        {
          id: `book_sample_pride_${Date.now()}`,
          fileName: 'Pride_and_Prejudice_Jane_Austen.epub',
          fileUri: 'https://raw.githubusercontent.com/IDPF/epub3-samples/master/30/wasteland/EPUB/wasteland.opf',
          format: 'epub',
          title: 'Pride and Prejudice',
          author: 'Jane Austen',
          totalPages: 160,
          genreTags: ['Romance', 'Classics', 'Drama'],
          addedAt: now,
          updatedAt: now,
        },
      ];

      for (const sample of samples) {
        await BookRepository.upsertBook(sample);
      }

      await get().loadBooks();
      set({ isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err?.message });
    }
  },

  refreshBook: async (bookId: string) => {
    const updated = await BookRepository.getBookById(bookId);
    if (!updated) return;
    set((state) => ({
      books: state.books.map((b) => (b.id === bookId ? updated : b)),
    }));
  },

  updateBookTitleAndAuthor: async (bookId: string, title: string, author: string) => {
    await BookRepository.updateBookTitleAndAuthor(bookId, title, author);
    set((state) => ({
      books: state.books.map((b) =>
        b.id === bookId ? { ...b, title, author, updatedAt: new Date().toISOString() } : b
      ),
    }));
  },

  refineAllBookTitlesWithAI: async () => {
    const books = get().books;
    let updatedCount = 0;
    for (const b of books) {
      try {
        let sampleContent = '';
        try {
          const ctx = await TextExtractorService.extractContextUpToPage(
            b.id,
            b.fileUri,
            b.format,
            1,
            b.totalPages || 10
          );
          sampleContent = ctx.textSoFar;
        } catch {
          // ignore extraction error
        }

        const extracted = await GeminiAIService.extractExactTitleAndAuthor(b, sampleContent);
        if (extracted.title && (extracted.title !== b.title || extracted.author !== b.author)) {
          await BookRepository.updateBookTitleAndAuthor(b.id, extracted.title, extracted.author);
          updatedCount++;
        }
      } catch (e) {
        console.warn('Failed to refine title for book', b.id, e);
      }
    }
    if (updatedCount > 0) {
      await get().loadBooks();
    }
    return { updatedCount };
  },
}));
