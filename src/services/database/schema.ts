export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  file_uri TEXT UNIQUE NOT NULL,
  file_name TEXT NOT NULL,
  format TEXT NOT NULL CHECK(format IN ('pdf', 'epub')),
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'Unknown Author',
  cover_uri TEXT,
  total_pages INTEGER NOT NULL DEFAULT 0,
  genre_tags TEXT NOT NULL DEFAULT '[]',
  added_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reading_progress (
  book_id TEXT PRIMARY KEY,
  user_id TEXT,
  current_page INTEGER NOT NULL DEFAULT 0,
  current_location TEXT,
  percent_complete REAL NOT NULL DEFAULT 0.0,
  last_read_at TEXT NOT NULL,
  total_time_read_seconds INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reading_sessions (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  user_id TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  pages_read INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_summaries (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK(scope_type IN ('chapter', 'up-to-current-page', 'full')),
  scope_ref TEXT,
  content TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS highlights_notes (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  user_id TEXT,
  page_number INTEGER NOT NULL DEFAULT 1,
  location TEXT NOT NULL,
  text TEXT NOT NULL,
  note TEXT,
  color TEXT NOT NULL DEFAULT '#FEF08A',
  created_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shelves (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'bookmark',
  color TEXT NOT NULL DEFAULT '#D97706',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS book_shelves (
  book_id TEXT NOT NULL,
  shelf_id TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (book_id, shelf_id),
  FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE,
  FOREIGN KEY (shelf_id) REFERENCES shelves (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS flashcards (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  book_title TEXT,
  note_id TEXT,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  context TEXT,
  interval_days INTEGER NOT NULL DEFAULT 0,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  repetitions INTEGER NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL,
  last_reviewed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_books_format ON books(format);
CREATE INDEX IF NOT EXISTS idx_reading_progress_last_read ON reading_progress(last_read_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_book ON reading_sessions(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_started_at ON reading_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_highlights_notes_book ON highlights_notes(book_id);
CREATE INDEX IF NOT EXISTS idx_highlights_notes_page ON highlights_notes(book_id, page_number);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_book ON ai_summaries(book_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_due ON flashcards(due_date ASC);
CREATE INDEX IF NOT EXISTS idx_flashcards_book ON flashcards(book_id);
CREATE INDEX IF NOT EXISTS idx_book_shelves_shelf ON book_shelves(shelf_id);
`;
