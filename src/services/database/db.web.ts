interface WebStorageData {
  books: Record<string, any>;
  reading_progress: Record<string, any>;
  reading_sessions: Record<string, any>;
  ai_summaries: Record<string, any>;
  highlights_notes: Record<string, any>;
  shelves: Record<string, any>;
  book_shelves: Record<string, any>;
  flashcards: Record<string, any>;
  app_settings: Record<string, string>;
}

const STORAGE_KEY = 'book_reader_web_db_v1';

function getDefaultShelves(): Record<string, any> {
  const now = new Date().toISOString();
  return {
    shelf_favorites: { id: 'shelf_favorites', name: 'Favorites', icon: 'heart', color: '#EF4444', is_default: 1, created_at: now },
    shelf_want_to_read: { id: 'shelf_want_to_read', name: 'Want to Read', icon: 'bookmark', color: '#F59E0B', is_default: 1, created_at: now },
    shelf_philosophy: { id: 'shelf_philosophy', name: 'Philosophy', icon: 'compass', color: '#10B981', is_default: 0, created_at: now },
    shelf_classics: { id: 'shelf_classics', name: 'Classics', icon: 'book', color: '#8B5CF6', is_default: 0, created_at: now },
  };
}

function getWebData(): WebStorageData {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      books: {},
      reading_progress: {},
      reading_sessions: {},
      ai_summaries: {},
      highlights_notes: {},
      shelves: getDefaultShelves(),
      book_shelves: {},
      flashcards: {},
      app_settings: {},
    };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial: WebStorageData = {
      books: {},
      reading_progress: {},
      reading_sessions: {},
      ai_summaries: {},
      highlights_notes: {},
      shelves: getDefaultShelves(),
      book_shelves: {},
      flashcards: {},
      app_settings: {
        goal_daily_minutes: '20',
        goal_yearly_books: '12',
      },
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.shelves) parsed.shelves = getDefaultShelves();
    if (!parsed.book_shelves) parsed.book_shelves = {};
    if (!parsed.flashcards) parsed.flashcards = {};
    return parsed;
  } catch {
    return {
      books: {},
      reading_progress: {},
      reading_sessions: {},
      ai_summaries: {},
      highlights_notes: {},
      shelves: getDefaultShelves(),
      book_shelves: {},
      flashcards: {},
      app_settings: {},
    };
  }
}

function saveWebData(data: WebStorageData) {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

class WebSQLiteMock {
  async execAsync(sql: string): Promise<void> {
    // No-op on web: schema is simulated in memory/localStorage
  }

  async runAsync(sql: string, ...params: any[]): Promise<any> {
    const data = getWebData();
    const cleanSql = sql.trim().toUpperCase();

    // 1. App settings upsert
    if (cleanSql.includes('INSERT INTO APP_SETTINGS')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const key = flatParams[0];
      const val = flatParams[1];
      data.app_settings[key] = val;
      saveWebData(data);
      return { changes: 1 };
    }

    // 2. Books upsert
    if (cleanSql.includes('INSERT INTO BOOKS')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const id = flatParams[0];
      const bookObj = {
        id,
        userId: flatParams[1],
        user_id: flatParams[1],
        fileUri: flatParams[2],
        file_uri: flatParams[2],
        fileName: flatParams[3],
        file_name: flatParams[3],
        format: flatParams[4],
        title: flatParams[5],
        author: flatParams[6],
        coverUri: flatParams[7],
        cover_uri: flatParams[7],
        totalPages: flatParams[8] || 0,
        total_pages: flatParams[8] || 0,
        genre_tags: flatParams[9],
        genreTagsJson: flatParams[9],
        addedAt: flatParams[10],
        added_at: flatParams[10],
        updatedAt: flatParams[11],
        updated_at: flatParams[11],
      };
      data.books[id] = bookObj;
      saveWebData(data);
      return { changes: 1 };
    }

    // 3. Reading progress upsert
    if (cleanSql.includes('INSERT INTO READING_PROGRESS')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const bookId = flatParams[0];
      data.reading_progress[bookId] = {
        bookId,
        userId: flatParams[1],
        currentPage: flatParams[2],
        currentLocation: flatParams[3],
        percentComplete: flatParams[4],
        lastReadAt: flatParams[5],
        totalTimeReadSeconds: flatParams[6],
      };
      saveWebData(data);
      return { changes: 1 };
    }

    // 4. Reading session insert
    if (cleanSql.includes('INSERT INTO READING_SESSIONS')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const id = flatParams[0];
      data.reading_sessions[id] = {
        id,
        bookId: flatParams[1],
        userId: flatParams[2],
        startedAt: flatParams[3],
        endedAt: flatParams[4],
        pagesRead: flatParams[5],
        durationSeconds: flatParams[6],
      };
      saveWebData(data);
      return { changes: 1 };
    }

    // 5. AI Summary insert
    if (cleanSql.includes('INSERT INTO AI_SUMMARIES')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const id = flatParams[0];
      data.ai_summaries[id] = {
        id,
        book_id: flatParams[1],
        scope_type: flatParams[2],
        scope_ref: flatParams[3],
        content: flatParams[4],
        generated_at: flatParams[5],
      };
      saveWebData(data);
      return { changes: 1 };
    }

    // 6. Highlight / Note insert
    if (cleanSql.includes('INSERT INTO HIGHLIGHTS_NOTES')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const id = flatParams[0];
      if (!data.highlights_notes) data.highlights_notes = {};
      data.highlights_notes[id] = {
        id,
        book_id: flatParams[1],
        user_id: flatParams[2],
        page_number: flatParams[3],
        location: flatParams[4],
        text: flatParams[5],
        note: flatParams[6],
        color: flatParams[7],
        created_at: flatParams[8],
      };
      saveWebData(data);
      return { changes: 1 };
    }

    // 6b. Update book file_uri
    if (cleanSql.includes('UPDATE BOOKS SET FILE_URI = ?')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const bookId = flatParams[flatParams.length - 1];
      if (data.books && data.books[bookId]) {
        data.books[bookId].fileUri = flatParams[0];
        data.books[bookId].file_uri = flatParams[0];
        if (flatParams.length === 4) {
          data.books[bookId].fileName = flatParams[1];
          data.books[bookId].file_name = flatParams[1];
        }
        saveWebData(data);
      }
      return { changes: 1 };
    }

    // 6c. Update book total_pages
    if (cleanSql.includes('UPDATE BOOKS SET TOTAL_PAGES = ?')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const totalPages = Number(flatParams[0]) || 1;
      const bookId = flatParams[flatParams.length - 1];
      if (data.books && data.books[bookId]) {
        data.books[bookId].totalPages = totalPages;
        data.books[bookId].total_pages = totalPages;
        saveWebData(data);
      }
      return { changes: 1 };
    }

    // 7. Delete note
    if (cleanSql.includes('DELETE FROM HIGHLIGHTS_NOTES WHERE ID = ?')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const id = flatParams[0];
      if (data.highlights_notes) {
        delete data.highlights_notes[id];
        saveWebData(data);
      }
      return { changes: 1 };
    }

    // 8. App settings insert / update
    if (cleanSql.includes('INSERT INTO APP_SETTINGS')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const key = flatParams[0];
      const val = flatParams[1];
      if (!data.app_settings) data.app_settings = {};
      data.app_settings[key] = String(val);
      saveWebData(data);
      return { changes: 1 };
    }

    // 9. Shelves insert (also matches INSERT OR IGNORE INTO shelves)
    if (cleanSql.includes('INTO SHELVES')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const id = flatParams[0];
      if (!data.shelves) data.shelves = getDefaultShelves();
      if (!data.shelves[id]) {
        data.shelves[id] = {
          id,
          name: flatParams[1],
          icon: flatParams[2],
          color: flatParams[3],
          is_default: flatParams[4] ? 1 : 0,
          created_at: flatParams[5],
        };
        saveWebData(data);
      }
      return { changes: 1 };
    }

    // 10. Shelves delete
    if (cleanSql.includes('DELETE FROM SHELVES WHERE ID = ?')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const id = flatParams[0];
      if (data.shelves) {
        delete data.shelves[id];
      }
      if (data.book_shelves) {
        for (const key of Object.keys(data.book_shelves)) {
          if (data.book_shelves[key].shelf_id === id) {
            delete data.book_shelves[key];
          }
        }
      }
      saveWebData(data);
      return { changes: 1 };
    }

    // 11. Book-shelf link insert
    if (cleanSql.includes('INSERT OR REPLACE INTO BOOK_SHELVES') || cleanSql.includes('INSERT INTO BOOK_SHELVES')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const bookId = flatParams[0];
      const shelfId = flatParams[1];
      const addedAt = flatParams[2];
      if (!data.book_shelves) data.book_shelves = {};
      const key = `${bookId}_${shelfId}`;
      data.book_shelves[key] = {
        book_id: bookId,
        shelf_id: shelfId,
        added_at: addedAt,
      };
      saveWebData(data);
      return { changes: 1 };
    }

    // 12. Book-shelf link delete
    if (cleanSql.includes('DELETE FROM BOOK_SHELVES WHERE BOOK_ID = ? AND SHELF_ID = ?')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const key = `${flatParams[0]}_${flatParams[1]}`;
      if (data.book_shelves) {
        delete data.book_shelves[key];
        saveWebData(data);
      }
      return { changes: 1 };
    }

    // 13. Book-shelf clear for book
    if (cleanSql.includes('DELETE FROM BOOK_SHELVES WHERE BOOK_ID = ?')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const bookId = flatParams[0];
      if (data.book_shelves) {
        for (const key of Object.keys(data.book_shelves)) {
          if (data.book_shelves[key].book_id === bookId) {
            delete data.book_shelves[key];
          }
        }
        saveWebData(data);
      }
      return { changes: 1 };
    }

    // 14. Flashcard insert
    if (cleanSql.includes('INSERT INTO FLASHCARDS')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const id = flatParams[0];
      if (!data.flashcards) data.flashcards = {};
      data.flashcards[id] = {
        id,
        book_id: flatParams[1],
        book_title: flatParams[2],
        note_id: flatParams[3],
        front: flatParams[4],
        back: flatParams[5],
        context: flatParams[6],
        interval_days: flatParams[7],
        ease_factor: flatParams[8],
        repetitions: flatParams[9],
        due_date: flatParams[10],
        last_reviewed_at: flatParams[11],
        created_at: flatParams[12],
      };
      saveWebData(data);
      return { changes: 1 };
    }

    // 15. Flashcard review update
    if (cleanSql.includes('UPDATE FLASHCARDS SET INTERVAL_DAYS = ?')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const cardId = flatParams[6];
      if (data.flashcards && data.flashcards[cardId]) {
        data.flashcards[cardId].interval_days = flatParams[0];
        data.flashcards[cardId].ease_factor = flatParams[1];
        data.flashcards[cardId].repetitions = flatParams[2];
        data.flashcards[cardId].due_date = flatParams[3];
        data.flashcards[cardId].last_reviewed_at = flatParams[4];
        saveWebData(data);
      }
      return { changes: 1 };
    }

    // 16. Flashcard delete
    if (cleanSql.includes('DELETE FROM FLASHCARDS WHERE ID = ?')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const id = flatParams[0];
      if (data.flashcards) {
        delete data.flashcards[id];
        saveWebData(data);
      }
      return { changes: 1 };
    }

    // 17. Book title and author update
    if (cleanSql.includes('UPDATE BOOKS SET TITLE = ?')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const title = flatParams[0];
      const author = flatParams[1];
      const updatedAt = flatParams[2];
      const bookId = flatParams[3];
      const target = data.books?.[bookId] || Object.values(data.books || {}).find((b: any) => b.id === bookId);
      if (target) {
        target.title = title;
        target.author = author;
        target.updatedAt = updatedAt;
        target.updated_at = updatedAt;
        saveWebData(data);
      }
      return { changes: 1 };
    }

    return { changes: 1 };
  }

  async getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]> {
    const data = getWebData();
    const cleanSql = sql.trim().toUpperCase();

    // Notes list query (all books when no id is bound, for backup export)
    if (cleanSql.includes('FROM HIGHLIGHTS_NOTES')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : [];
      const bookId = flatParams[0];
      const notes = Object.values(data.highlights_notes || {}).filter(
        (n: any) => !bookId || n.book_id === bookId
      );
      return notes as unknown as T[];
    }

    // Settings map, needed by library backup export
    if (cleanSql.includes('SELECT * FROM APP_SETTINGS')) {
      return Object.entries(data.app_settings || {}).map(([key, value]) => ({ key, value })) as unknown as T[];
    }

    // Progress rows, needed by library backup export. Gated on `SELECT *` so the
    // streak query, which unions this table, keeps its own branch.
    if (cleanSql.includes('SELECT * FROM READING_PROGRESS')) {
      return Object.values(data.reading_progress || {}).map((p: any) => ({
        book_id: p.bookId,
        user_id: p.userId ?? null,
        current_page: p.currentPage,
        current_location: p.currentLocation ?? null,
        percent_complete: p.percentComplete,
        last_read_at: p.lastReadAt,
        total_time_read_seconds: p.totalTimeReadSeconds,
      })) as unknown as T[];
    }

    // Shelves list query
    if (cleanSql.includes('FROM SHELVES')) {
      const shelves = Object.values(data.shelves || {});
      const bookShelves = Object.values(data.book_shelves || {});
      const result = shelves.map((s: any) => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
        color: s.color,
        isDefault: Boolean(s.is_default),
        bookCount: bookShelves.filter((bs: any) => bs.shelf_id === s.id).length,
        createdAt: s.created_at,
      }));
      return result as unknown as T[];
    }

    // Shelves for book query
    if (cleanSql.includes('FROM BOOK_SHELVES WHERE BOOK_ID = ?')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const bookId = flatParams[0];
      const links = Object.values(data.book_shelves || {})
        .filter((bs: any) => bs.book_id === bookId);
      return links as unknown as T[];
    }

    // Books in shelf query
    if (cleanSql.includes('FROM BOOK_SHELVES WHERE SHELF_ID = ?')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const shelfId = flatParams[0];
      const links = Object.values(data.book_shelves || {})
        .filter((bs: any) => bs.shelf_id === shelfId);
      return links as unknown as T[];
    }

    // Flashcards list query
    if (cleanSql.includes('FROM FLASHCARDS')) {
      let cards = Object.values(data.flashcards || {});
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      if (cleanSql.includes('WHERE BOOK_ID = ?')) {
        const bookId = flatParams[0];
        cards = cards.filter((c: any) => c.book_id === bookId);
      }
      if (cleanSql.includes('DUE_DATE <=')) {
        const nowIso = flatParams[cleanSql.includes('WHERE BOOK_ID = ?') ? 1 : 0] || new Date().toISOString();
        cards = cards.filter((c: any) => c.due_date <= nowIso);
      }
      const mapped = cards.map((c: any) => ({
        id: c.id,
        bookId: c.book_id,
        bookTitle: c.book_title,
        noteId: c.note_id,
        front: c.front,
        back: c.back,
        context: c.context,
        intervalDays: c.interval_days ?? 0,
        easeFactor: c.ease_factor ?? 2.5,
        repetitions: c.repetitions ?? 0,
        dueDate: c.due_date,
        lastReviewedAt: c.last_reviewed_at,
        createdAt: c.created_at,
      }));
      return mapped as unknown as T[];
    }

    // Books list query
    if (cleanSql.includes('FROM BOOKS')) {
      const booksList = Object.values(data.books).map((b: any) => {
        const prog = data.reading_progress[b.id];
        const bShelves = Object.values(data.book_shelves || {})
          .filter((bs: any) => bs.book_id === b.id)
          .map((bs: any) => bs.shelf_id);

        return {
          id: b.id,
          userId: b.userId,
          fileUri: b.fileUri,
          fileName: b.fileName,
          format: b.format,
          title: b.title,
          author: b.author,
          coverUri: b.coverUri,
          totalPages: b.totalPages,
          genreTagsJson: typeof b.genre_tags === 'string' ? b.genre_tags : JSON.stringify(b.genreTags || []),
          addedAt: b.addedAt,
          updatedAt: b.updatedAt,
          currentPage: prog?.currentPage ?? null,
          currentLocation: prog?.currentLocation ?? null,
          percentComplete: prog?.percentComplete ?? 0,
          lastReadAt: prog?.lastReadAt ?? null,
          totalTimeReadSeconds: prog?.totalTimeReadSeconds ?? 0,
          shelfIds: bShelves,
        };
      });

      return booksList as unknown as T[];
    }

    // AI summaries query (all books when no id is bound, for backup export)
    if (cleanSql.includes('FROM AI_SUMMARIES')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : [];
      const bookId = flatParams[0];
      const filtered = Object.values(data.ai_summaries).filter((s: any) => !bookId || s.book_id === bookId);
      return filtered as unknown as T[];
    }

    // Shelf links, all of them for backup export
    if (cleanSql.includes('FROM BOOK_SHELVES')) {
      return Object.values(data.book_shelves || {}) as unknown as T[];
    }

    // Daily Reading Activity map query (aggregated per day)
    if (cleanSql.includes('FROM READING_SESSIONS') && (cleanSql.includes('SUM(DURATION_SECONDS)') || cleanSql.includes('GROUP BY'))) {
      const dayMap: Record<string, { day: string; durationSeconds: number; pagesRead: number; sessionsCount: number }> = {};
      const sessions = Object.values(data.reading_sessions || {});
      for (const s of sessions as any[]) {
        const day = s.startedAt ? s.startedAt.substring(0, 10) : '';
        if (!day) continue;
        if (!dayMap[day]) {
          dayMap[day] = { day, durationSeconds: 0, pagesRead: 0, sessionsCount: 0 };
        }
        dayMap[day].durationSeconds += (s.durationSeconds || 0);
        dayMap[day].pagesRead += (s.pagesRead || 0);
        dayMap[day].sessionsCount += 1;
      }
      return Object.values(dayMap) as unknown as T[];
    }

    // Distinct session days query (for streak calculation)
    if (cleanSql.includes('DISTINCT DAY FROM') || cleanSql.includes('SUBSTR(STARTED_AT, 1, 10) AS DAY')) {
      const daySet = new Set<string>();
      for (const s of Object.values(data.reading_sessions || {})) {
        if ((s as any).startedAt) daySet.add((s as any).startedAt.substring(0, 10));
      }
      for (const p of Object.values(data.reading_progress || {})) {
        if ((p as any).lastReadAt) daySet.add((p as any).lastReadAt.substring(0, 10));
      }
      const sorted = Array.from(daySet).sort().reverse().map((d) => ({ day: d }));
      return sorted as unknown as T[];
    }

    // Plain session rows (library backup) — kept last so the aggregate
    // queries above win.
    if (cleanSql.includes('SELECT * FROM READING_SESSIONS')) {
      return Object.values(data.reading_sessions || {}).map((s: any) => ({
        id: s.id,
        book_id: s.bookId,
        user_id: s.userId ?? null,
        started_at: s.startedAt,
        ended_at: s.endedAt ?? null,
        pages_read: s.pagesRead,
        duration_seconds: s.durationSeconds,
      })) as unknown as T[];
    }

    return [] as T[];
  }

  async getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null> {
    const data = getWebData();
    const cleanSql = sql.trim().toUpperCase();

    // App settings query
    if (cleanSql.includes('FROM APP_SETTINGS')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const key = flatParams[0];
      const val = data.app_settings[key];
      return val ? ({ value: val } as unknown as T) : null;
    }

    // Book by ID
    if (cleanSql.includes('FROM BOOKS') && cleanSql.includes('B.ID = ?')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const id = flatParams[0];
      const b = data.books[id];
      if (!b) return null;
      const prog = data.reading_progress[id];
      return {
        id: b.id,
        userId: b.userId,
        fileUri: b.fileUri,
        fileName: b.fileName,
        format: b.format,
        title: b.title,
        author: b.author,
        coverUri: b.coverUri,
        totalPages: b.totalPages,
        genreTagsJson: typeof b.genre_tags === 'string' ? b.genre_tags : JSON.stringify(b.genreTags || []),
        addedAt: b.addedAt,
        updatedAt: b.updatedAt,
        currentPage: prog?.currentPage ?? 1,
        currentLocation: prog?.currentLocation ?? null,
        percentComplete: prog?.percentComplete ?? 0,
        lastReadAt: prog?.lastReadAt ?? null,
        totalTimeReadSeconds: prog?.totalTimeReadSeconds ?? 0,
      } as unknown as T;
    }

    // Book by file URI
    if (cleanSql.includes('FROM BOOKS WHERE FILE_URI = ?')) {
      const flatParams = Array.isArray(params[0]) ? params[0] : params;
      const uri = flatParams[0];
      const b = Object.values(data.books).find((item: any) => item.fileUri === uri || item.file_uri === uri);
      return (b as unknown as T) || null;
    }

    // Stats aggregates
    if (cleanSql.includes('COUNT(B.ID) AS TOTALBOOKS')) {
      const booksList = Object.values(data.books);
      let completed = 0;
      let inProgress = 0;
      let totalTime = 0;

      for (const b of booksList as any[]) {
        const prog = data.reading_progress[b.id];
        if (prog) {
          if (prog.percentComplete >= 100) completed++;
          else if (prog.percentComplete > 0) inProgress++;
          totalTime += prog.totalTimeReadSeconds || 0;
        }
      }

      return {
        totalBooks: booksList.length,
        completedBooks: completed,
        currentlyReading: inProgress,
        totalTimeReadSeconds: totalTime,
      } as unknown as T;
    }

    if (cleanSql.includes('SUM(PAGES_READ) AS TOTALPAGESREAD')) {
      const sessions = Object.values(data.reading_sessions || {});
      const totalPages = sessions.reduce((acc: number, s: any) => acc + (s.pagesRead || 0), 0);
      return { totalPagesRead: totalPages } as unknown as T;
    }

    if (cleanSql.includes('TOTALPROGRESSPAGES')) {
      const progressList = Object.values(data.reading_progress || {});
      const total = progressList.reduce((acc: number, p: any) => {
        const pNum = p.currentPage && p.currentPage > 1 ? p.currentPage - 1 : 0;
        return acc + pNum;
      }, 0);
      return { totalProgressPages: total } as unknown as T;
    }

    if (cleanSql.includes('TOTALSESSIONTIME')) {
      const sessions = Object.values(data.reading_sessions || {});
      const total = sessions.reduce((acc: number, s: any) => acc + (s.durationSeconds || 0), 0);
      return { totalSessionTime: total } as unknown as T;
    }

    return null;
  }
}

const webMockInstance = new WebSQLiteMock();

export class DatabaseService {
  static async getDatabase(): Promise<any> {
    return webMockInstance;
  }

  static async resetDatabase(): Promise<void> {
    if (typeof window !== 'undefined') {
      try {
        if (window.localStorage) {
          const freshData: WebStorageData = {
            books: {},
            reading_progress: {},
            reading_sessions: {},
            ai_summaries: {},
            highlights_notes: {},
            shelves: getDefaultShelves(),
            book_shelves: {},
            flashcards: {},
            app_settings: {
              goal_daily_minutes: '20',
              goal_yearly_books: '12',
            },
          };
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
          window.localStorage.removeItem('reading_directory_uri');
        }
        // Try clearing IndexedDB for stored book blob files if available
        if (window.indexedDB && window.indexedDB.databases) {
          const dbs = await window.indexedDB.databases();
          for (const d of dbs) {
            if (d.name && (d.name.includes('book') || d.name.includes('reader') || d.name.includes('saf'))) {
              window.indexedDB.deleteDatabase(d.name);
            }
          }
        }
      } catch (e) {
        console.warn('Error during web resetDatabase:', e);
      }
    }
  }
}
