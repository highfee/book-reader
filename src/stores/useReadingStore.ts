import { create } from 'zustand';
import { BookWithProgress, ReadingProgress, ReadingSession } from '@/types/book';
import { BookRepository } from '@/services/database/bookRepository';

interface ReadingState {
  currentBook: BookWithProgress | null;
  currentPage: number;
  currentLocation?: string;
  totalPages: number;
  sessionStartTime: number | null;
  pagesReadInSession: number;
  activeReadingSeconds: number;
  lastInteractionTimestamp: number;
  lastPageTurnTimestamp: number;

  // Actions
  startReadingSession: (book: BookWithProgress) => void;
  recordUserInteraction: () => void;
  tickActiveReadingSecond: () => void;
  updatePageProgress: (page: number, location?: string, totalPagesOverride?: number) => Promise<void>;
  endReadingSession: () => Promise<void>;
  resetReadingState: () => void;
}

// Inactivity timeout: 3 minutes (180 seconds) without any touch or scroll pauses duration accumulation
const IDLE_TIMEOUT_MS = 180 * 1000;
// Minimum dwell time to credit a page turn as genuinely read: 12 seconds
const MIN_PAGE_DWELL_SECONDS = 12;
// Maximum credible dwell time on a single page before assuming distraction: 6 minutes (360 seconds)
const MAX_PAGE_DWELL_SECONDS = 360;

export const useReadingStore = create<ReadingState>((set, get) => ({
  currentBook: null,
  currentPage: 1,
  currentLocation: undefined,
  totalPages: 1,
  sessionStartTime: null,
  pagesReadInSession: 0,
  activeReadingSeconds: 0,
  lastInteractionTimestamp: Date.now(),
  lastPageTurnTimestamp: Date.now(),

  startReadingSession: (book: BookWithProgress) => {
    const now = Date.now();
    set({
      currentBook: book,
      currentPage: book.progress?.currentPage || 1,
      currentLocation: book.progress?.currentLocation,
      totalPages: book.totalPages || 1,
      sessionStartTime: now,
      pagesReadInSession: 0,
      activeReadingSeconds: 0,
      lastInteractionTimestamp: now,
      lastPageTurnTimestamp: now,
    });
  },

  recordUserInteraction: () => {
    set({ lastInteractionTimestamp: Date.now() });
  },

  tickActiveReadingSecond: () => {
    const { sessionStartTime, lastInteractionTimestamp, activeReadingSeconds } = get();
    if (!sessionStartTime) return;

    const now = Date.now();
    // Only accumulate reading time if the user interacted within the idle threshold
    if (now - lastInteractionTimestamp < IDLE_TIMEOUT_MS) {
      set({ activeReadingSeconds: activeReadingSeconds + 1 });
    }
  },

  updatePageProgress: async (page: number, location?: string, totalPagesOverride?: number) => {
    const {
      currentBook,
      pagesReadInSession,
      currentPage: previousPage,
      lastPageTurnTimestamp,
      activeReadingSeconds,
    } = get();
    if (!currentBook) return;

    const now = Date.now();
    const total = totalPagesOverride || currentBook.totalPages || 1;
    const clampedPage = Math.max(1, Math.min(page, total));
    const percent = Math.min(100, Math.round((clampedPage / total) * 100 * 10) / 10);

    // Pace Heuristic calculation:
    // Determine whether the transition from previousPage to clampedPage qualifies as an authentic read
    const dwellSeconds = Math.max(0, Math.floor((now - lastPageTurnTimestamp) / 1000));
    const isSequentialAdvance = clampedPage === previousPage + 1;
    const isCrediblePace = dwellSeconds >= MIN_PAGE_DWELL_SECONDS && dwellSeconds <= MAX_PAGE_DWELL_SECONDS;

    let creditedPagesDelta = 0;
    if (isSequentialAdvance && isCrediblePace) {
      // User spent enough time reading the page sequentially
      creditedPagesDelta = 1;
    } else if (clampedPage > previousPage && !isSequentialAdvance) {
      // Skim or jump: do not credit full delta to avoid inflating stats
      creditedPagesDelta = 0;
    }

    const prevTotalTime = currentBook.progress?.totalTimeReadSeconds || 0;
    const progress: ReadingProgress = {
      bookId: currentBook.id,
      userId: currentBook.userId,
      currentPage: clampedPage,
      currentLocation: location || currentBook.progress?.currentLocation,
      percentComplete: percent,
      lastReadAt: new Date(now).toISOString(),
      totalTimeReadSeconds: prevTotalTime + activeReadingSeconds,
    };

    set((state) => ({
      currentPage: clampedPage,
      currentLocation: location || state.currentLocation,
      totalPages: total,
      pagesReadInSession: pagesReadInSession + creditedPagesDelta,
      lastPageTurnTimestamp: now,
      lastInteractionTimestamp: now,
      currentBook: {
        ...currentBook,
        totalPages: total,
        progress,
      },
    }));

    // Persist immediately to SQLite
    await BookRepository.saveReadingProgress(progress);
  },

  endReadingSession: async () => {
    const { currentBook, sessionStartTime, pagesReadInSession, activeReadingSeconds } = get();
    if (!currentBook || !sessionStartTime) return;

    const endTime = Date.now();
    // Use activeReadingSeconds (ignoring idle time) as authentic duration
    const verifiedDurationSeconds = Math.max(1, activeReadingSeconds);

    const session: ReadingSession = {
      id: `session_${Date.now()}`,
      bookId: currentBook.id,
      userId: currentBook.userId,
      startedAt: new Date(sessionStartTime).toISOString(),
      endedAt: new Date(endTime).toISOString(),
      pagesRead: pagesReadInSession,
      durationSeconds: verifiedDurationSeconds,
    };

    await BookRepository.recordReadingSession(session);

    set({
      sessionStartTime: null,
      pagesReadInSession: 0,
      activeReadingSeconds: 0,
    });
  },

  resetReadingState: () => {
    set({
      currentBook: null,
      currentPage: 1,
      currentLocation: undefined,
      totalPages: 1,
      sessionStartTime: null,
      pagesReadInSession: 0,
      activeReadingSeconds: 0,
      lastInteractionTimestamp: Date.now(),
      lastPageTurnTimestamp: Date.now(),
    });
  },
}));
