import { DatabaseService } from './db';
import { inferBookTitle, inferBookAuthor } from '../parsers/titleInference';
import {
  Book,
  BookWithProgress,
  LibraryFilter,
  ReadingProgress,
  ReadingSession,
  ReadingStats,
  AISummary,
  HighlightNote,
  DailyReadingActivity,
  ReadingGoals,
  Shelf,
} from '@/types/book';

export const DEFAULT_SHELVES: {
  id: string;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
}[] = [
  { id: 'shelf_favorites', name: 'Favorites', icon: 'heart', color: '#EF4444', isDefault: true },
  { id: 'shelf_want_to_read', name: 'Want to Read', icon: 'bookmark', color: '#F59E0B', isDefault: true },
  { id: 'shelf_philosophy', name: 'Philosophy', icon: 'compass', color: '#10B981', isDefault: false },
  { id: 'shelf_classics', name: 'Classics', icon: 'book', color: '#8B5CF6', isDefault: false },
];

let defaultShelvesSeeded = false;

export class BookRepository {
  /**
   * Fetch all books with their reading progress, optionally applying status, genre, and search filters.
   */
  static async getAllBooks(filter?: Partial<LibraryFilter>): Promise<BookWithProgress[]> {
    const db = await DatabaseService.getDatabase();

    let query = `
      SELECT 
        b.id, b.user_id as userId, b.file_uri as fileUri, b.file_name as fileName,
        b.format, b.title, b.author, b.cover_uri as coverUri, b.total_pages as totalPages,
        b.genre_tags as genreTagsJson, b.added_at as addedAt, b.updated_at as updatedAt,
        rp.current_page as currentPage, rp.current_location as currentLocation,
        rp.percent_complete as percentComplete, rp.last_read_at as lastReadAt,
        rp.total_time_read_seconds as totalTimeReadSeconds
      FROM books b
      LEFT JOIN reading_progress rp ON b.id = rp.book_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filter?.searchQuery && filter.searchQuery.trim().length > 0) {
      query += ` AND (b.title LIKE ? OR b.author LIKE ? OR b.file_name LIKE ?)`;
      const term = `%${filter.searchQuery.trim()}%`;
      params.push(term, term, term);
    }

    if (filter?.status && filter.status !== 'all') {
      if (filter.status === 'unread') {
        query += ` AND (rp.percent_complete IS NULL OR rp.percent_complete = 0)`;
      } else if (filter.status === 'reading') {
        query += ` AND (rp.percent_complete > 0 AND rp.percent_complete < 100)`;
      } else if (filter.status === 'finished') {
        query += ` AND (rp.percent_complete >= 100)`;
      }
    }

    query += ` ORDER BY COALESCE(rp.last_read_at, b.added_at) DESC`;

    const rows = await db.getAllAsync<any>(query, ...params);
    let shelfLinks: any[] = [];
    try {
      shelfLinks = await db.getAllAsync<any>('SELECT book_id, shelf_id FROM book_shelves');
    } catch {
      shelfLinks = [];
    }

    let books = rows.map((row) => {
      let genreTags: string[] = [];
      try {
        genreTags = JSON.parse(row.genreTagsJson || '[]');
      } catch {
        genreTags = [];
      }

      const cleanTitle = inferBookTitle({ title: row.title, fileName: row.fileName, author: row.author });
      const cleanAuthor = inferBookAuthor({ title: row.title, fileName: row.fileName, author: row.author });

      const book: BookWithProgress = {
        id: row.id,
        userId: row.userId || undefined,
        fileUri: row.fileUri,
        fileName: row.fileName,
        format: row.format,
        title: cleanTitle,
        author: cleanAuthor,
        coverUri: row.coverUri || undefined,
        totalPages: row.totalPages,
        genreTags,
        addedAt: row.addedAt,
        updatedAt: row.updatedAt,
        shelfIds: row.shelfIds || shelfLinks.filter((l) => l.book_id === row.id || l.bookId === row.id).map((l) => l.shelf_id || l.shelfId),
      };

      if (row.currentPage !== null && row.currentPage !== undefined) {
        book.progress = {
          bookId: row.id,
          userId: row.userId || undefined,
          currentPage: row.currentPage,
          currentLocation: row.currentLocation || undefined,
          percentComplete: row.percentComplete ?? 0,
          lastReadAt: row.lastReadAt,
          totalTimeReadSeconds: row.totalTimeReadSeconds ?? 0,
        };
      }

      return book;
    });

    if (filter?.shelfId && filter.shelfId !== 'all') {
      books = books.filter((b) => b.shelfIds?.includes(filter.shelfId!));
    }

    return books;
  }

  /**
   * Get a single book by ID, including its progress and latest AI summary if present.
   */
  static async getBookById(id: string): Promise<BookWithProgress | null> {
    const db = await DatabaseService.getDatabase();

    const query = `
      SELECT 
        b.id, b.user_id as userId, b.file_uri as fileUri, b.file_name as fileName,
        b.format, b.title, b.author, b.cover_uri as coverUri, b.total_pages as totalPages,
        b.genre_tags as genreTagsJson, b.added_at as addedAt, b.updated_at as updatedAt,
        rp.current_page as currentPage, rp.current_location as currentLocation,
        rp.percent_complete as percentComplete, rp.last_read_at as lastReadAt,
        rp.total_time_read_seconds as totalTimeReadSeconds
      FROM books b
      LEFT JOIN reading_progress rp ON b.id = rp.book_id
      WHERE b.id = ?
      LIMIT 1
    `;

    const row = await db.getFirstAsync<any>(query, [id]);
    if (!row) return null;

    let genreTags: string[] = [];
    try {
      genreTags = JSON.parse(row.genreTagsJson || '[]');
    } catch {
      genreTags = [];
    }

    const cleanTitle = inferBookTitle({ title: row.title, fileName: row.fileName, author: row.author });
    const cleanAuthor = inferBookAuthor({ title: row.title, fileName: row.fileName, author: row.author });

    const book: BookWithProgress = {
      id: row.id,
      userId: row.userId || undefined,
      fileUri: row.fileUri,
      fileName: row.fileName,
      format: row.format,
      title: cleanTitle,
      author: cleanAuthor,
      coverUri: row.coverUri || undefined,
      totalPages: row.totalPages,
      genreTags,
      addedAt: row.addedAt,
      updatedAt: row.updatedAt,
    };

    if (row.currentPage !== null && row.currentPage !== undefined) {
      book.progress = {
        bookId: row.id,
        userId: row.userId || undefined,
        currentPage: row.currentPage,
        currentLocation: row.currentLocation || undefined,
        percentComplete: row.percentComplete ?? 0,
        lastReadAt: row.lastReadAt,
        totalTimeReadSeconds: row.totalTimeReadSeconds ?? 0,
      };
    }

    return book;
  }

  /**
   * Find book by file URI (to check for existing indexed files).
   */
  static async getBookByFileUri(fileUri: string): Promise<Book | null> {
    const db = await DatabaseService.getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM books WHERE file_uri = ? LIMIT 1`,
      [fileUri]
    );
    if (!row) return null;

    let genreTags: string[] = [];
    try {
      genreTags = JSON.parse(row.genre_tags || '[]');
    } catch {
      genreTags = [];
    }

    return {
      id: row.id,
      userId: row.user_id,
      fileUri: row.file_uri,
      fileName: row.file_name,
      format: row.format,
      title: inferBookTitle({ title: row.title, fileName: row.file_name, author: row.author }),
      author: inferBookAuthor({ title: row.title, fileName: row.file_name, author: row.author }),
      coverUri: row.cover_uri,
      totalPages: row.total_pages,
      genreTags,
      addedAt: row.added_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Insert or update a book record in SQLite.
   */
  static async upsertBook(book: Book): Promise<void> {
    const db = await DatabaseService.getDatabase();
    const cleanTitle = inferBookTitle({ title: book.title, fileName: book.fileName, author: book.author });
    const cleanAuthor = inferBookAuthor({ title: book.title, fileName: book.fileName, author: book.author });

    await db.runAsync(
      `
      INSERT INTO books (
        id, user_id, file_uri, file_name, format, title, author, cover_uri, total_pages, genre_tags, added_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        file_uri = excluded.file_uri,
        file_name = excluded.file_name,
        format = excluded.format,
        title = excluded.title,
        author = excluded.author,
        cover_uri = COALESCE(excluded.cover_uri, books.cover_uri),
        total_pages = CASE WHEN excluded.total_pages > 0 THEN excluded.total_pages ELSE books.total_pages END,
        genre_tags = excluded.genre_tags,
        updated_at = excluded.updated_at
      ON CONFLICT(file_uri) DO UPDATE SET
        file_name = excluded.file_name,
        title = excluded.title,
        author = excluded.author,
        updated_at = excluded.updated_at;
      `,
      [
        book.id,
        book.userId || null,
        book.fileUri,
        book.fileName,
        book.format,
        cleanTitle,
        cleanAuthor,
        book.coverUri || null,
        book.totalPages,
        JSON.stringify(book.genreTags),
        book.addedAt,
        book.updatedAt,
      ]
    );
  }

  /**
   * Updates fileUri and fileName for a book (e.g. after re-linking expired blob on web).
   */
  static async updateBookFileUri(bookId: string, newFileUri: string, newFileName?: string): Promise<void> {
    const db = await DatabaseService.getDatabase();
    if (newFileName) {
      await db.runAsync(`UPDATE books SET file_uri = ?, file_name = ?, updated_at = ? WHERE id = ?`, [
        newFileUri,
        newFileName,
        new Date().toISOString(),
        bookId,
      ]);
    } else {
      await db.runAsync(`UPDATE books SET file_uri = ?, updated_at = ? WHERE id = ?`, [
        newFileUri,
        new Date().toISOString(),
        bookId,
      ]);
    }
  }

  /**
   * Updates totalPages for a book (e.g. after determining exact PDF page count).
   */
  static async updateBookTotalPages(bookId: string, totalPages: number): Promise<void> {
    const db = await DatabaseService.getDatabase();
    await db.runAsync(`UPDATE books SET total_pages = ?, updated_at = ? WHERE id = ?`, [
      totalPages,
      new Date().toISOString(),
      bookId,
    ]);
  }

  /**
   * Delete a book and cascade delete its progress, sessions, summaries, and notes.
   */
  static async deleteBook(bookId: string): Promise<void> {
    const db = await DatabaseService.getDatabase();
    await db.runAsync(`DELETE FROM books WHERE id = ?`, [bookId]);
  }

  /**
   * Update or create reading progress for a book.
   */
  static async saveReadingProgress(progress: ReadingProgress): Promise<void> {
    const db = await DatabaseService.getDatabase();
    await db.runAsync(
      `
      INSERT INTO reading_progress (
        book_id, user_id, current_page, current_location, percent_complete, last_read_at, total_time_read_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(book_id) DO UPDATE SET
        current_page = excluded.current_page,
        current_location = COALESCE(excluded.current_location, reading_progress.current_location),
        percent_complete = excluded.percent_complete,
        last_read_at = excluded.last_read_at,
        total_time_read_seconds = excluded.total_time_read_seconds;
      `,
      [
        progress.bookId,
        progress.userId || null,
        progress.currentPage,
        progress.currentLocation || null,
        progress.percentComplete,
        progress.lastReadAt,
        progress.totalTimeReadSeconds,
      ]
    );
  }

  /**
   * Record a reading session.
   */
  static async recordReadingSession(session: ReadingSession): Promise<void> {
    const db = await DatabaseService.getDatabase();
    await db.runAsync(
      `
      INSERT INTO reading_sessions (
        id, book_id, user_id, started_at, ended_at, pages_read, duration_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        session.id,
        session.bookId,
        session.userId || null,
        session.startedAt,
        session.endedAt || null,
        session.pagesRead,
        session.durationSeconds,
      ]
    );
  }

  /**
   * Save an AI Summary (cached).
   */
  static async saveAISummary(summary: AISummary): Promise<void> {
    const db = await DatabaseService.getDatabase();
    await db.runAsync(
      `
      INSERT INTO ai_summaries (
        id, book_id, scope_type, scope_ref, content, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        generated_at = excluded.generated_at;
      `,
      [
        summary.id,
        summary.bookId,
        summary.scopeType,
        summary.scopeRef || null,
        summary.content,
        summary.generatedAt,
      ]
    );
  }

  /**
   * Retrieve cached AI summaries for a book.
   */
  static async getAISummaries(bookId: string): Promise<AISummary[]> {
    const db = await DatabaseService.getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM ai_summaries WHERE book_id = ? ORDER BY generated_at DESC`,
      [bookId]
    );
    return rows.map((r) => ({
      id: r.id,
      bookId: r.book_id,
      scopeType: r.scope_type,
      scopeRef: r.scope_ref || undefined,
      content: r.content,
      generatedAt: r.generated_at,
    }));
  }

  /**
   * Update book title and author in database.
   */
  static async updateBookTitleAndAuthor(bookId: string, title: string, author: string): Promise<void> {
    const db = await DatabaseService.getDatabase();
    await db.runAsync(
      `UPDATE books SET title = ?, author = ?, updated_at = ? WHERE id = ?`,
      [title, author, new Date().toISOString(), bookId]
    );
  }

  /**
   * Calculate overall reading statistics for dashboard.
   */
  static async getReadingStats(): Promise<ReadingStats> {
    const db = await DatabaseService.getDatabase();

    const bookCounts = await db.getFirstAsync<any>(`
      SELECT 
        COUNT(b.id) as totalBooks,
        SUM(CASE WHEN rp.percent_complete >= 100 THEN 1 ELSE 0 END) as completedBooks,
        SUM(CASE WHEN rp.percent_complete > 0 AND rp.percent_complete < 100 THEN 1 ELSE 0 END) as currentlyReading,
        COALESCE(SUM(rp.total_time_read_seconds), 0) as totalTimeReadSeconds
      FROM books b
      LEFT JOIN reading_progress rp ON b.id = rp.book_id
    `);

    const sessionStats = await db.getFirstAsync<any>(`
      SELECT COALESCE(SUM(pages_read), 0) as totalPagesRead FROM reading_sessions
    `);

    const progressStats = await db.getFirstAsync<any>(`
      SELECT COALESCE(SUM(CASE WHEN current_page > 1 THEN current_page - 1 ELSE 0 END), 0) as totalProgressPages FROM reading_progress
    `);

    const sessionTimeStats = await db.getFirstAsync<any>(`
      SELECT COALESCE(SUM(duration_seconds), 0) as totalSessionTime FROM reading_sessions
    `);

    // Calculate reading streak in days combining sessions and progress activity
    const recentDays = await db.getAllAsync<{ day: string }>(`
      SELECT DISTINCT day FROM (
        SELECT SUBSTR(started_at, 1, 10) as day FROM reading_sessions
        UNION
        SELECT SUBSTR(last_read_at, 1, 10) as day FROM reading_progress WHERE last_read_at IS NOT NULL
      ) WHERE day IS NOT NULL ORDER BY day DESC
    `);

    let streak = 0;
    const today = new Date().toISOString().substring(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);

    if (recentDays.length > 0) {
      if (recentDays[0].day !== today && recentDays[0].day !== yesterday) {
        streak = 0;
      } else {
        streak = 1;
        let expectedTime = new Date(recentDays[0].day).getTime();
        for (let i = 1; i < recentDays.length; i++) {
          const prevTime = new Date(recentDays[i].day).getTime();
          const diffDays = Math.round((expectedTime - prevTime) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            streak++;
            expectedTime = prevTime;
          } else {
            break;
          }
        }
      }
    }

    const calculatedPages = Math.max(sessionStats?.totalPagesRead ?? 0, progressStats?.totalProgressPages ?? 0);
    const calculatedTime = Math.max(bookCounts?.totalTimeReadSeconds ?? 0, sessionTimeStats?.totalSessionTime ?? 0);

    return {
      totalBooks: bookCounts?.totalBooks ?? 0,
      completedBooks: bookCounts?.completedBooks ?? 0,
      currentlyReading: bookCounts?.currentlyReading ?? 0,
      totalTimeReadSeconds: calculatedTime,
      totalPagesRead: calculatedPages,
      currentStreakDays: streak,
      genreBreakdown: {},
    };
  }

  /**
   * Retrieves aggregated reading activity per day (for GitHub-style heatmap).
   */
  static async getReadingActivityMap(daysCount: number = 365): Promise<Record<string, DailyReadingActivity>> {
    const db = await DatabaseService.getDatabase();
    const rows = await db.getAllAsync<any>(`
      SELECT 
        SUBSTR(started_at, 1, 10) as day,
        SUM(duration_seconds) as durationSeconds,
        SUM(pages_read) as pagesRead,
        COUNT(id) as sessionsCount
      FROM reading_sessions
      GROUP BY SUBSTR(started_at, 1, 10)
      ORDER BY day ASC
    `);

    const map: Record<string, DailyReadingActivity> = {};
    for (const r of rows) {
      if (r.day) {
        map[r.day] = {
          day: r.day,
          durationSeconds: r.durationSeconds || 0,
          pagesRead: r.pagesRead || 0,
          sessionsCount: r.sessionsCount || 0,
        };
      }
    }
    return map;
  }

  /**
   * Retrieves user reading goals (default: 20 mins/day, 12 books/year).
   */
  static async getReadingGoals(): Promise<ReadingGoals> {
    const dailyRaw = await this.getSetting('goal_daily_minutes');
    const yearlyRaw = await this.getSetting('goal_yearly_books');

    return {
      dailyMinutes: dailyRaw ? parseInt(dailyRaw, 10) : 20,
      yearlyBooks: yearlyRaw ? parseInt(yearlyRaw, 10) : 12,
    };
  }

  /**
   * Persists user reading goals.
   */
  static async saveReadingGoals(goals: ReadingGoals): Promise<void> {
    await this.setSetting('goal_daily_minutes', goals.dailyMinutes.toString());
    await this.setSetting('goal_yearly_books', goals.yearlyBooks.toString());
  }

  /**
   * App setting storage
   */
  static async getSetting(key: string): Promise<string | null> {
    const db = await DatabaseService.getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = ? LIMIT 1`,
      [key]
    );
    return row ? row.value : null;
  }

  static async setSetting(key: string, value: string): Promise<void> {
    const db = await DatabaseService.getDatabase();
    await db.runAsync(
      `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value]
    );
  }

  static async saveSetting(key: string, value: string): Promise<void> {
    return this.setSetting(key, value);
  }

  /**
   * Notes and Highlights
   */
  static async getNotesForBook(bookId: string): Promise<HighlightNote[]> {
    const db = await DatabaseService.getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM highlights_notes WHERE book_id = ? ORDER BY page_number ASC, created_at DESC`,
      [bookId]
    );
    return rows.map((r) => ({
      id: r.id,
      bookId: r.book_id,
      userId: r.user_id || undefined,
      pageNumber: r.page_number,
      location: r.location,
      text: r.text,
      note: r.note || undefined,
      color: r.color || '#FEF08A',
      createdAt: r.created_at,
    }));
  }

  static async saveNote(note: HighlightNote): Promise<void> {
    const db = await DatabaseService.getDatabase();
    await db.runAsync(
      `
      INSERT INTO highlights_notes (id, book_id, user_id, page_number, location, text, note, color, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        text = excluded.text,
        note = excluded.note,
        color = excluded.color,
        page_number = excluded.page_number;
      `,
      [
        note.id,
        note.bookId,
        note.userId || null,
        note.pageNumber || 1,
        note.location,
        note.text,
        note.note || null,
        note.color || '#FEF08A',
        note.createdAt,
      ]
    );
  }

  static async deleteNote(id: string): Promise<void> {
    const db = await DatabaseService.getDatabase();
    await db.runAsync(`DELETE FROM highlights_notes WHERE id = ?`, [id]);
  }

  // ==========================================
  // SHELVES & COLLECTIONS
  // ==========================================

  static async getShelves(): Promise<Shelf[]> {
    const db = await DatabaseService.getDatabase();
    await this.seedDefaultShelves();

    let rows: any[] = [];
    try {
      rows = await db.getAllAsync<any>(
        `SELECT s.id, s.name, s.icon, s.color, s.is_default, s.created_at, COUNT(bs.book_id) as book_count
         FROM shelves s
         LEFT JOIN book_shelves bs ON s.id = bs.shelf_id
         GROUP BY s.id
         ORDER BY s.is_default DESC, s.name ASC`
      );
    } catch {
      rows = await db.getAllAsync<any>('SELECT * FROM shelves ORDER BY is_default DESC, name ASC').catch(() => []);
    }

    if (!rows || rows.length === 0) {
      return DEFAULT_SHELVES.map((s) => ({
        ...s,
        isDefault: true,
        bookCount: 0,
        createdAt: new Date().toISOString(),
      }));
    }
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      color: r.color,
      isDefault: Boolean(r.isDefault ?? r.is_default),
      bookCount: Number(r.bookCount ?? r.book_count ?? 0),
      createdAt: r.createdAt ?? r.created_at,
    }));
  }

  /**
   * The built-in shelves must be real rows, otherwise assigning a book to them
   * violates the book_shelves foreign key and the write fails silently.
   */
  static async seedDefaultShelves(): Promise<void> {
    if (defaultShelvesSeeded) return;
    const db = await DatabaseService.getDatabase();
    const now = new Date().toISOString();
    for (const shelf of DEFAULT_SHELVES) {
      await db
        .runAsync(
          `INSERT OR IGNORE INTO shelves (id, name, icon, color, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [shelf.id, shelf.name, shelf.icon, shelf.color, shelf.isDefault ? 1 : 0, now]
        )
        .catch(() => {});
    }
    defaultShelvesSeeded = true;
  }

  static async createShelf(shelf: { name: string; icon?: string; color?: string }): Promise<Shelf> {
    const db = await DatabaseService.getDatabase();
    const id = `shelf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newShelf: Shelf = {
      id,
      name: shelf.name.trim(),
      icon: shelf.icon || 'bookmark',
      color: shelf.color || '#D97706',
      isDefault: false,
      bookCount: 0,
      createdAt: new Date().toISOString(),
    };
    await db.runAsync(
      `INSERT INTO shelves (id, name, icon, color, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [newShelf.id, newShelf.name, newShelf.icon, newShelf.color, 0, newShelf.createdAt]
    );
    return newShelf;
  }

  static async deleteShelf(shelfId: string): Promise<void> {
    const db = await DatabaseService.getDatabase();
    await db.runAsync(`DELETE FROM shelves WHERE id = ?`, [shelfId]);
  }

  static async getShelvesForBook(bookId: string): Promise<string[]> {
    const db = await DatabaseService.getDatabase();
    const rows = await db.getAllAsync<any>(`SELECT shelf_id FROM book_shelves WHERE book_id = ?`, [bookId]).catch(() => []);
    return rows.map((r: any) => r.shelf_id || r.shelfId);
  }

  static async setBookShelves(bookId: string, shelfIds: string[]): Promise<void> {
    const db = await DatabaseService.getDatabase();
    await this.seedDefaultShelves();
    await db.runAsync(`DELETE FROM book_shelves WHERE book_id = ?`, [bookId]);
    const now = new Date().toISOString();
    for (const sId of shelfIds) {
      await db.runAsync(
        `INSERT OR REPLACE INTO book_shelves (book_id, shelf_id, added_at) VALUES (?, ?, ?)`,
        [bookId, sId, now]
      );
    }
  }

  static async toggleBookShelf(bookId: string, shelfId: string): Promise<boolean> {
    const current = await this.getShelvesForBook(bookId);
    let updated: string[];
    let isAdded = false;
    if (current.includes(shelfId)) {
      updated = current.filter((id) => id !== shelfId);
    } else {
      updated = [...current, shelfId];
      isAdded = true;
    }
    await this.setBookShelves(bookId, updated);
    return isAdded;
  }
}
