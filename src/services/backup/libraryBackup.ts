import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { DatabaseService } from '@/services/database/db';

/**
 * A backup is the local library as it actually stands: book records, progress,
 * notes, shelves, summaries, flashcards, sessions and settings. Book files stay
 * on the device — only what the app knows about them travels.
 */

export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_KIND = 'lumina-reader-library';

interface TableSpec {
  name: string;
  /** Schema order — the web storage shim maps positional inserts by it. */
  columns: string[];
  /** Column(s) that identify a row, for the skip/replace decision. */
  primaryKey: string[];
  /** Never written to the file. */
  redact?: (row: Record<string, any>) => boolean;
}

const SECRET_SETTING = /api_key|token|secret|password/i;

const TABLES: TableSpec[] = [
  {
    name: 'app_settings',
    columns: ['key', 'value'],
    primaryKey: ['key'],
    redact: (row) => SECRET_SETTING.test(String(row.key ?? '')),
  },
  { name: 'shelves', columns: ['id', 'name', 'icon', 'color', 'is_default', 'created_at'], primaryKey: ['id'] },
  {
    name: 'books',
    columns: ['id', 'user_id', 'file_uri', 'file_name', 'format', 'title', 'author', 'cover_uri', 'total_pages', 'genre_tags', 'added_at', 'updated_at'],
    primaryKey: ['id'],
  },
  {
    name: 'reading_progress',
    columns: ['book_id', 'user_id', 'current_page', 'current_location', 'percent_complete', 'last_read_at', 'total_time_read_seconds'],
    primaryKey: ['book_id'],
  },
  {
    name: 'reading_sessions',
    columns: ['id', 'book_id', 'user_id', 'started_at', 'ended_at', 'pages_read', 'duration_seconds'],
    primaryKey: ['id'],
  },
  {
    name: 'highlights_notes',
    columns: ['id', 'book_id', 'user_id', 'page_number', 'location', 'text', 'note', 'color', 'created_at'],
    primaryKey: ['id'],
  },
  { name: 'ai_summaries', columns: ['id', 'book_id', 'scope_type', 'scope_ref', 'content', 'generated_at'], primaryKey: ['id'] },
  { name: 'book_shelves', columns: ['book_id', 'shelf_id', 'added_at'], primaryKey: ['book_id', 'shelf_id'] },
  {
    name: 'flashcards',
    columns: ['id', 'book_id', 'book_title', 'note_id', 'front', 'back', 'context', 'interval_days', 'ease_factor', 'repetitions', 'due_date', 'last_reviewed_at', 'created_at'],
    primaryKey: ['id'],
  },
];

export type BackupRows = Record<string, Record<string, any>[]>;

export interface LibraryBackup {
  kind: typeof BACKUP_KIND;
  schemaVersion: number;
  exportedAt: string;
  redactedKeys: string[];
  counts: Record<string, number>;
  tables: BackupRows;
}

function snake(row: Record<string, any>, column: string): any {
  const value =
    row[column] !== undefined
      ? row[column]
      : row[column.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())];
  if (value !== undefined) return typeof value === 'boolean' ? Number(value) : value;
  if (column === 'genre_tags') return row.genreTagsJson ?? JSON.stringify(row.genreTags ?? []);
  return null;
}

function readValue(row: Record<string, any>, column: string): string {
  const raw = snake(row, column);
  if (raw === null || raw === undefined) return '';
  return typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
}

export function isLibraryBackup(payload: any): payload is LibraryBackup {
  return Boolean(payload && payload.kind === BACKUP_KIND && payload.tables && typeof payload.tables === 'object');
}

/**
 * Snapshot every table the app owns. Rows are keyed by schema column name so a
 * file written on web restores on Android and the other way round.
 */
export async function collectBackup(): Promise<LibraryBackup> {
  const db = await DatabaseService.getDatabase();
  const tables: BackupRows = {};
  const counts: Record<string, number> = {};
  const redactedKeys: string[] = [];

  for (const spec of TABLES) {
    const rows = await db.getAllAsync<any>(`SELECT * FROM ${spec.name}`).catch(() => [] as any[]);
    const cleaned: Record<string, any>[] = [];
    for (const row of rows ?? []) {
      if (spec.redact?.(row)) {
        redactedKeys.push(String(snake(row, spec.primaryKey[0])));
        continue;
      }
      const out: Record<string, any> = {};
      for (const column of spec.columns) out[column] = snake(row, column);
      cleaned.push(out);
    }
    tables[spec.name] = cleaned;
    counts[spec.name] = cleaned.length;
  }

  return {
    kind: BACKUP_KIND,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    redactedKeys,
    counts,
    tables,
  };
}

export interface RestoreOptions {
  /** Replace rows that already exist locally instead of leaving them alone. */
  overwrite?: boolean;
}

export interface RestoreResult {
  restored: Record<string, number>;
  skipped: Record<string, number>;
}

/**
 * Merge a backup into the local library. Default is additive: a row already on
 * this device wins, so restoring a stale file onto a live library is harmless.
 */
export async function applyBackup(backup: LibraryBackup, options: RestoreOptions = {}): Promise<RestoreResult> {
  const overwrite = Boolean(options.overwrite);
  const db = await DatabaseService.getDatabase();
  const restored: Record<string, number> = {};
  const skipped: Record<string, number> = {};

  for (const spec of TABLES) {
    const incoming = backup.tables[spec.name] ?? [];
    const current = await db.getAllAsync<any>(`SELECT * FROM ${spec.name}`).catch(() => [] as any[]);
    const existing = new Set((current ?? []).map((row) => spec.primaryKey.map((c) => readValue(row, c)).join('|')));

    restored[spec.name] = 0;
    skipped[spec.name] = 0;

    const placeholders = spec.columns.map(() => '?').join(', ');
    const insert = `INSERT INTO ${spec.name} (${spec.columns.join(', ')}) VALUES (${placeholders})`;

    for (const row of incoming) {
      const key = spec.primaryKey.map((c) => row[c] ?? '').join('|');
      const conflict = existing.has(key);
      if (conflict && !overwrite) {
        skipped[spec.name]++;
        continue;
      }
      if (conflict) {
        // Best effort: unsupported on the web shim, whose positional insert
        // replaces the keyed row anyway.
        await db
          .runAsync(`DELETE FROM ${spec.name} WHERE ${spec.primaryKey.join(' = ? AND ')} = ?`, ...spec.primaryKey.map((c) => row[c] ?? null))
          .catch(() => {});
      }
      try {
        await db.runAsync(insert, spec.columns.map((column) => row[column] ?? null));
        restored[spec.name]++;
        existing.add(key);
      } catch (err) {
        console.warn(`[libraryBackup] Could not restore ${spec.name} row ${key}:`, err);
        skipped[spec.name]++;
      }
    }
  }

  return { restored, skipped };
}

/**
 * Hand the JSON to the platform's own save flow: a browser download on web, the
 * share sheet everywhere else.
 */
export async function deliverJson(fileName: string, json: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, json);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('This device has no way to share the exported file.');
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle: 'Save library backup',
    UTI: 'public.json',
  });
}

/**
 * Read a picked file back into a backup. Rejects anything that isn't ours
 * before a single row is touched.
 */
export async function readBackupFile(uri: string): Promise<LibraryBackup> {
  let text: string;
  if (Platform.OS === 'web' && uri.startsWith('blob:')) {
    const response = await fetch(uri);
    text = await response.text();
  } else {
    text = await FileSystem.readAsStringAsync(uri);
  }

  const parsed = JSON.parse(text);
  if (!isLibraryBackup(parsed)) {
    throw new Error('That file is not a Lumina Reader library backup.');
  }
  return parsed;
}
