import { Client, Account, Databases, ID, Query, Permission, Role } from 'react-native-appwrite';
import { BookWithProgress, ReadingProgress, AISummary } from '@/types/book';
import { BookRepository } from '../database/bookRepository';

export interface AppwriteConfig {
  endpoint: string;
  projectId: string;
  databaseId: string;
}

const DEFAULT_CONFIG: AppwriteConfig = {
  endpoint: 'https://cloud.appwrite.io/v1',
  projectId: 'book-reader-ai',
  databaseId: 'book_reader_db',
};

export class AppwriteService {
  private static client: Client = new Client();
  private static account: Account;
  private static databases: Databases;
  private static isConfigured = false;
  private static databaseId = DEFAULT_CONFIG.databaseId;

  static init(config?: Partial<AppwriteConfig>) {
    const endpoint = config?.endpoint || DEFAULT_CONFIG.endpoint;
    const projectId = config?.projectId || DEFAULT_CONFIG.projectId;
    this.databaseId = config?.databaseId || DEFAULT_CONFIG.databaseId;

    this.client
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setPlatform('com.luminareader.app');

    this.account = new Account(this.client);
    this.databases = new Databases(this.client);
    this.isConfigured = true;
  }

  static getClient(): Client {
    if (!this.isConfigured) {
      this.init();
    }
    return this.client;
  }

  static getAccount(): Account {
    if (!this.isConfigured) {
      this.init();
    }
    return this.account;
  }

  static getDatabases(): Databases {
    if (!this.isConfigured) {
      this.init();
    }
    return this.databases;
  }

  /**
   * Check if user is logged in
   */
  static async getCurrentUser() {
    try {
      const account = this.getAccount();
      return await account.get();
    } catch {
      return null;
    }
  }

  /**
   * Cloud sync: pushes local progress and summaries to Appwrite.
   * STRICT LEGAL COMPLIANCE: Book files remain on device.
   * Only metadata (title, author, genreTags) and reading progress are synced.
   * User-scoped permissions ensure zero cross-tenant data leakage.
   */
  static async syncLocalProgressToCloud(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        return { success: false, syncedCount: 0, error: 'Sign in to sync your progress across devices' };
      }

      const allBooks = await BookRepository.getAllBooks();
      let syncedCount = 0;

      const userPermissions = [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
      ];

      for (const book of allBooks) {
        if (!book.progress) continue;

        // Clean deterministic document ID per user and book
        const safeDocId = `${user.$id.slice(0, 14)}_${book.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20)}`;

        const payload = {
          userId: user.$id,
          bookId: book.id,
          title: book.title,
          author: book.author,
          fileName: book.fileName,
          currentPage: book.progress.currentPage,
          percentComplete: book.progress.percentComplete,
          lastReadAt: book.progress.lastReadAt,
          totalTimeReadSeconds: book.progress.totalTimeReadSeconds,
        };

        try {
          // Attempt document creation with explicit per-user permissions
          await this.getDatabases().createDocument(
            this.databaseId,
            'reading_progress',
            safeDocId,
            payload,
            userPermissions
          );
          syncedCount++;
        } catch {
          // Document exists, update it with latest progress
          try {
            await this.getDatabases().updateDocument(
              this.databaseId,
              'reading_progress',
              safeDocId,
              payload,
              userPermissions
            );
            syncedCount++;
          } catch {
            // Non-blocking sync error per document
          }
        }
      }

      return { success: true, syncedCount };
    } catch (err: any) {
      console.warn('Appwrite sync error:', err);
      return { success: false, syncedCount: 0, error: err?.message || 'Sync failed' };
    }
  }

  /**
   * Cloud pull: restores reading progress from Appwrite for books already on device.
   * Applies Last-Write-Wins (LWW) conflict resolution to prevent overwriting newer offline reads.
   */
  static async pullProgressFromCloud(): Promise<number> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return 0;

      const docs = await this.getDatabases().listDocuments(
        this.databaseId,
        'reading_progress',
        [Query.equal('userId', user.$id)]
      );

      const allLocalBooks = await BookRepository.getAllBooks();
      let restored = 0;

      for (const doc of docs.documents) {
        // 1. Direct ID match
        let localBook = allLocalBooks.find((b) => b.id === doc.bookId);

        // 2. Cross-device match by normalized title or filename
        if (!localBook) {
          const normCloudTitle = (doc.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const normCloudFile = (doc.fileName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          localBook = allLocalBooks.find((b) => {
            const normTitle = b.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normFile = b.fileName.toLowerCase().replace(/[^a-z0-9]/g, '');
            return (normCloudTitle && normTitle === normCloudTitle) || (normCloudFile && normFile === normCloudFile);
          });
        }

        if (localBook) {
          // Last-Write-Wins (LWW) conflict resolution
          const localTimestamp = localBook.progress?.lastReadAt
            ? new Date(localBook.progress.lastReadAt).getTime()
            : 0;
          const cloudTimestamp = doc.lastReadAt
            ? new Date(doc.lastReadAt).getTime()
            : 0;

          // Only apply cloud progress if cloud is newer or equal
          if (cloudTimestamp >= localTimestamp) {
            await BookRepository.saveReadingProgress({
              bookId: localBook.id,
              userId: user.$id,
              currentPage: doc.currentPage,
              percentComplete: doc.percentComplete,
              lastReadAt: doc.lastReadAt,
              totalTimeReadSeconds: doc.totalTimeReadSeconds,
            });
            restored++;
          }
        }
      }

      return restored;
    } catch {
      return 0;
    }
  }
}
