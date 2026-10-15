import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';

let databaseInstance: SQLite.SQLiteDatabase | null = null;

export class DatabaseService {
  /**
   * Returns a singleton SQLiteDatabase instance, initializing tables if not already done.
   */
  static async getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (databaseInstance) {
      return databaseInstance;
    }

    databaseInstance = await SQLite.openDatabaseAsync('book_reader.db');

    // Enable WAL mode for high performance concurrent reads and writes
    await databaseInstance.execAsync('PRAGMA journal_mode = WAL;');
    await databaseInstance.execAsync('PRAGMA foreign_keys = ON;');

    // Execute schema migrations / table creations
    await databaseInstance.execAsync(SCHEMA_SQL);

    return databaseInstance;
  }

  /**
   * Resets the entire local database (useful for testing or full re-scan).
   */
  static async resetDatabase(): Promise<void> {
    const db = await this.getDatabase();
    await db.execAsync(`
      DROP TABLE IF EXISTS flashcards;
      DROP TABLE IF EXISTS book_shelves;
      DROP TABLE IF EXISTS shelves;
      DROP TABLE IF EXISTS highlights_notes;
      DROP TABLE IF EXISTS ai_summaries;
      DROP TABLE IF EXISTS reading_sessions;
      DROP TABLE IF EXISTS reading_progress;
      DROP TABLE IF EXISTS books;
      DROP TABLE IF EXISTS app_settings;
    `);
    await db.execAsync(SCHEMA_SQL);
  }
}
