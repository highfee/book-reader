export type BookFormat = 'pdf' | 'epub';

export type ReadingStatus = 'unread' | 'reading' | 'finished';

export interface Book {
  id: string;
  userId?: string;
  fileUri: string;
  fileName: string;
  format: BookFormat;
  title: string;
  author: string;
  coverUri?: string;
  totalPages: number;
  genreTags: string[];
  addedAt: string;
  updatedAt: string;
}

export interface ReadingProgress {
  bookId: string;
  userId?: string;
  currentPage: number;
  currentLocation?: string; // CFI for EPUB
  percentComplete: number; // 0 to 100
  lastReadAt: string;
  totalTimeReadSeconds: number;
}

export interface ReadingSession {
  id: string;
  bookId: string;
  userId?: string;
  startedAt: string;
  endedAt?: string;
  pagesRead: number;
  durationSeconds: number;
}

export interface AISummary {
  id: string;
  bookId: string;
  scopeType: 'chapter' | 'up-to-current-page' | 'full';
  scopeRef?: string;
  content: string;
  generatedAt: string;
}

export interface HighlightNote {
  id: string;
  bookId: string;
  userId?: string;
  pageNumber?: number;
  location: string;
  text: string;
  note?: string;
  color?: string;
  createdAt: string;
}

export interface BookWithProgress extends Book {
  progress?: ReadingProgress;
  shelfIds?: string[];
}

export interface LibraryFilter {
  status: 'all' | ReadingStatus;
  genre?: string;
  shelfId?: string;
  searchQuery: string;
}

export interface Shelf {
  id: string;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
  bookCount?: number;
  createdAt: string;
}

export interface BookShelf {
  bookId: string;
  shelfId: string;
  addedAt: string;
}

export type FlashcardReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface Flashcard {
  id: string;
  bookId: string;
  bookTitle?: string;
  noteId?: string;
  front: string;
  back: string;
  context?: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  dueDate: string;
  lastReviewedAt?: string;
  createdAt: string;
}

export interface ReadingStats {
  totalBooks: number;
  completedBooks: number;
  currentlyReading: number;
  totalTimeReadSeconds: number;
  totalPagesRead: number;
  currentStreakDays: number;
  genreBreakdown: Record<string, number>;
}

export interface DailyReadingActivity {
  day: string; // YYYY-MM-DD
  durationSeconds: number;
  pagesRead: number;
  sessionsCount: number;
}

export interface ReadingGoals {
  dailyMinutes: number;
  yearlyBooks: number;
}
