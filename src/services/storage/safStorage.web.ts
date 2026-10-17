export interface PickedDirectoryResult {
  granted: boolean;
  directoryUri?: string;
  error?: string;
}

export interface DiscoveredBookFile {
  fileUri: string;
  fileName: string;
  format: 'pdf' | 'epub';
  sizeBytes?: number;
  lastModified?: number;
  fileObj?: File;
}

// In-memory web file cache to preserve File objects during the browser session
const webFileCache = new Map<string, File>();

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open('BookReaderWebStorage', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('book_files')) {
        db.createObjectStore('book_files', { keyPath: 'fileName' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveFileToIndexedDB(fileName: string, file: File, bookId?: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('book_files', 'readwrite');
      const store = tx.objectStore('book_files');
      const put = (key: string) => store.put({ fileName: key, file, size: file.size, lastModified: file.lastModified });

      // Store with raw original filename
      put(fileName);

      // Also save by clean base name without extension
      const baseName = fileName.replace(/\.[^/.]+$/, '').trim();
      if (baseName && baseName !== fileName) put(baseName);

      // Save with normalized lowercase alphanumeric key
      const normalizedKey = fileName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKey && normalizedKey !== fileName) put(normalizedKey);

      // Save with bookId if provided
      if (bookId) put(bookId);

      // Resolving before oncomplete would let a reload race the write and lose the bytes.
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not store file in IndexedDB:', err);
  }
}

async function putFileUnderKey(key: string, file: File): Promise<void> {
  if (!key) return;
  try {
    const db = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('book_files', 'readwrite');
      tx.objectStore('book_files').put({ fileName: key, file, size: file.size, lastModified: file.lastModified });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not index file in IndexedDB:', err);
  }
}

async function getFileFromIndexedDB(queryName: string): Promise<File | null> {
  if (!queryName) return null;
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction('book_files', 'readonly');
      const store = tx.objectStore('book_files');

      // 1. Direct exact match
      const req = store.get(queryName);
      req.onsuccess = () => {
        if (req.result && req.result.file) {
          resolve(req.result.file);
          return;
        }

        // 2. Try with .pdf extension
        const pdfReq = store.get(`${queryName}.pdf`);
        pdfReq.onsuccess = () => {
          if (pdfReq.result && pdfReq.result.file) {
            resolve(pdfReq.result.file);
            return;
          }

          // 3. Fallback: scan all entries for fuzzy, case-insensitive, or solitary match
          const allReq = store.getAll();
          allReq.onsuccess = () => {
            const list = allReq.result || [];
            if (list.length === 0) {
              resolve(null);
              return;
            }

            const cleanTarget = queryName.toLowerCase().replace(/[^a-z0-9]/g, '');

            // Exact case-insensitive match
            const exactCi = list.find((item: any) =>
              item.fileName && item.fileName.toLowerCase() === queryName.toLowerCase()
            );
            if (exactCi?.file) {
              resolve(exactCi.file);
              return;
            }

            // Substring or alphanumeric match
            const matched = list.find((item: any) => {
              if (!item.fileName) return false;
              const cleanItem = item.fileName.toLowerCase().replace(/[^a-z0-9]/g, '');
              return (
                cleanItem === cleanTarget ||
                cleanItem.includes(cleanTarget) ||
                cleanTarget.includes(cleanItem)
              );
            });

            if (matched?.file) {
              resolve(matched.file);
              return;
            }

            // Word overlap matching (e.g. "The Courage to Be Disliked" vs "courage_disliked.pdf")
            const queryWords = queryName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
            if (queryWords.length > 0) {
              const bestMatch = list.find((item: any) => {
                const itemLower = (item.fileName || '').toLowerCase();
                const matchedWords = queryWords.filter(w => itemLower.includes(w));
                return matchedWords.length >= Math.min(2, queryWords.length);
              });
              if (bestMatch?.file) {
                resolve(bestMatch.file);
                return;
              }
            }

            // If only 1 distinct file exists in the store, it is unambiguously the user's book!
            const distinctFiles = list.filter((item: any) => item.file instanceof File);
            if (distinctFiles.length === 1 && distinctFiles[0]?.file) {
              resolve(distinctFiles[0].file);
              return;
            }

            resolve(null);
          };
          allReq.onerror = () => resolve(null);
        };
        pdfReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Locates the File behind a URI: the live in-session map first, then the
 * durable IndexedDB mirror keyed by the name baked into the URI.
 *
 * Results are deliberately not written back to webFileCache: that map doubles
 * as the liveness list used by getLiveFileUri, and a dead URI must stay dead.
 */
async function resolveWebFile(fileUri: string): Promise<File | undefined> {
  if (!fileUri) return undefined;
  const cached = webFileCache.get(fileUri);
  if (cached) return cached;
  return (await getFileFromIndexedDB(SAFStorageService.extractFileName(fileUri))) ?? undefined;
}

export class SAFStorageService {
  /**
   * On Web, directory access uses either the File System Access API (showDirectoryPicker)
   * or a hidden folder input with webkitdirectory.
   */
  static async requestDirectoryAccess(): Promise<PickedDirectoryResult> {
    if (typeof window === 'undefined') {
      return { granted: false, error: 'Web window not available' };
    }

    try {
      // 1. Try modern File System Access API (Chrome, Edge, Opera)
      if ('showDirectoryPicker' in window) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker();
          const discovered: DiscoveredBookFile[] = [];

          await this.collectFilesRecursively(dirHandle, discovered, 0);

          // Cache discovered files for the upcoming scanDirectoryForBooks call
          (window as any).__lastWebPickedFiles = discovered;

          return {
            granted: true,
            directoryUri: `web-fs://${dirHandle.name}`,
          };
        } catch (pickerErr: any) {
          if (pickerErr.name === 'AbortError') {
            return { granted: false, error: 'Directory selection cancelled' };
          }
        }
      }

      // 2. Fallback: prompt for multiple files / folder via HTML input
      const files = await this.promptHtmlFileInput(true);
      (window as any).__lastWebPickedFiles = files;

      return {
        granted: files.length > 0,
        directoryUri: 'web-fs://selected-folder',
      };
    } catch (err: any) {
      return {
        granted: false,
        error: err?.message || 'Could not select folder on web',
      };
    }
  }

  /**
   * Recursively traverses FileSystemDirectoryHandle to find books inside subfolders.
   */
  private static async collectFilesRecursively(
    dirHandle: any,
    discovered: DiscoveredBookFile[],
    depth: number
  ): Promise<void> {
    if (depth > 6) return;
    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const lower = entry.name.toLowerCase();
          let format: 'pdf' | 'epub' | null = null;
          if (lower.endsWith('.pdf')) format = 'pdf';
          else if (lower.endsWith('.epub')) format = 'epub';

          if (format) {
            try {
              const file = await entry.getFile();
              const objectUrl = URL.createObjectURL(file);
              webFileCache.set(objectUrl, file);
              await saveFileToIndexedDB(entry.name, file);

              discovered.push({
                fileUri: objectUrl,
                fileName: entry.name,
                format,
                sizeBytes: file.size,
                lastModified: file.lastModified,
                fileObj: file,
              });
            } catch {
              // Ignore unreadable individual file
            }
          }
        } else if (entry.kind === 'directory') {
          await this.collectFilesRecursively(entry, discovered, depth + 1);
        }
      }
    } catch {
      // Permission or reading error in directory entry
    }
  }

  /**
   * Scans directory on Web: retrieves the files picked during the directory prompt.
   */
  static async scanDirectoryForBooks(directoryUri: string): Promise<DiscoveredBookFile[]> {
    if (typeof window !== 'undefined' && (window as any).__lastWebPickedFiles) {
      const files = (window as any).__lastWebPickedFiles as DiscoveredBookFile[];
      return files;
    }
    return [];
  }

  /**
   * Web file picker for picking one or more .epub / .pdf files directly.
   */
  static async pickBookFiles(): Promise<DiscoveredBookFile[]> {
    return await this.promptHtmlFileInput(false);
  }

  /**
   * Internal helper to open an HTML <input type="file"> dialog on web.
   */
  private static promptHtmlFileInput(isFolder: boolean): Promise<DiscoveredBookFile[]> {
    return new Promise((resolve) => {
      if (typeof document === 'undefined') {
        resolve([]);
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      if (!isFolder) {
        input.accept = '.pdf,.epub,application/pdf,application/epub+zip';
      }

      if (isFolder) {
        input.setAttribute('webkitdirectory', '');
        input.setAttribute('directory', '');
      }

      input.style.display = 'none';
      document.body.appendChild(input);

      input.onchange = async () => {
        const fileList = input.files;
        const discovered: DiscoveredBookFile[] = [];
        const pendingWrites: Promise<void>[] = [];

        if (fileList) {
          for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const lower = file.name.toLowerCase();
            let format: 'pdf' | 'epub' | null = null;
            if (lower.endsWith('.pdf')) format = 'pdf';
            else if (lower.endsWith('.epub')) format = 'epub';

            if (format) {
              const objectUrl = URL.createObjectURL(file);
              webFileCache.set(objectUrl, file);
              pendingWrites.push(saveFileToIndexedDB(file.name, file));

              discovered.push({
                fileUri: objectUrl,
                fileName: file.name,
                format,
                sizeBytes: file.size,
                lastModified: file.lastModified,
                fileObj: file,
              });
            }
          }
        }

        // The bytes must be durable before the caller stores this blob URL as the book's fileUri.
        await Promise.all(pendingWrites);

        try {
          document.body.removeChild(input);
        } catch {}
        resolve(discovered);
      };

      input.oncancel = () => {
        try {
          document.body.removeChild(input);
        } catch {}
        resolve([]);
      };

      input.click();
    });
  }

  static extractFileName(uri: string): string {
    const segments = uri.split('/');
    const raw = segments[segments.length - 1] || 'Unknown Book';
    const clean = raw.split('?')[0].split('%2F').pop() || raw;
    return decodeURIComponent(clean);
  }

  /**
   * Checks if a blob URL is still alive, and if expired, retrieves the file from IndexedDB.
   */
  static async getLiveFileUri(
    fileName: string,
    currentUri: string,
    bookTitle?: string,
    bookId?: string
  ): Promise<string> {
    if (currentUri && currentUri.startsWith('blob:')) {
      // Blob URLs only ever come from this module, so membership in the
      // in-memory map is the liveness test. A HEAD request cannot be used:
      // blob: URLs reject the method and the browser logs ERR_METHOD_NOT_SUPPORTED.
      if (webFileCache.has(currentUri)) return currentUri;
    }

    // Blob is dead across reload - look up in IndexedDB by bookId, fileName, bookTitle, or extracted URI
    let storedFile: File | null = null;
    if (bookId) {
      storedFile = await getFileFromIndexedDB(bookId);
    }
    if (!storedFile && fileName) {
      storedFile = await getFileFromIndexedDB(fileName);
    }
    if (!storedFile && bookTitle) {
      storedFile = await getFileFromIndexedDB(bookTitle);
    }
    if (!storedFile && currentUri) {
      const extracted = this.extractFileName(currentUri);
      if (extracted && extracted !== fileName) {
        storedFile = await getFileFromIndexedDB(extracted);
      }
    }

    if (storedFile) {
      // Backfill the id key so the next reload never depends on name heuristics.
      if (bookId) await putFileUnderKey(bookId, storedFile);
      const freshUrl = URL.createObjectURL(storedFile);
      webFileCache.set(freshUrl, storedFile);
      return freshUrl;
    }

    return currentUri;
  }

  /**
   * Directly associate a File in IndexedDB with a book ID and its fileName.
   */
  static async persistBookFile(fileName: string, file: File, bookId?: string): Promise<void> {
    await saveFileToIndexedDB(fileName, file, bookId);
  }

  /**
   * Whether a URI can still be read. Blob URLs exist only for the page session
   * that created them, so the in-memory map is the authority; no network probe
   * is possible because blob: URLs reject every method but GET.
   */
  static isLiveFileUri(fileUri: string): boolean {
    if (!fileUri) return false;
    if (fileUri.startsWith('blob:')) return webFileCache.has(fileUri);
    return true;
  }

  /**
   * Read file content on web via Blob/FileReader or fetch.
   */
  static async readFile(
    fileUri: string,
    encoding: 'utf8' | 'base64' = 'utf8'
  ): Promise<string> {
    const cachedFile = await resolveWebFile(fileUri);

    if (cachedFile) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        if (encoding === 'base64') {
          reader.readAsDataURL(cachedFile!);
          reader.onload = () => {
            const res = reader.result as string;
            // Strip data:...;base64, prefix
            resolve(res.split(',')[1] || res);
          };
        } else {
          reader.readAsText(cachedFile!);
          reader.onload = () => resolve(reader.result as string);
        }
        reader.onerror = () => reject(reader.error);
      });
    }

    // A blob URL missing from both caches died with an earlier page load;
    // fetching it only produces ERR_FILE_NOT_FOUND.
    if (fileUri.startsWith('blob:')) return '';

    try {
      const response = await fetch(fileUri);
      if (!response.ok) return '';
      return await response.text();
    } catch {
      return '';
    }
  }

  /**
   * Returns the first bytes of a file so callers can tell a PDF, an EPUB (zip)
   * and plain text apart without decoding the whole document.
   */
  static async readFileHead(fileUri: string, byteLength = 4): Promise<Uint8Array | null> {
    const cachedFile = await resolveWebFile(fileUri);
    if (!cachedFile) return null;
    try {
      const head = await cachedFile.slice(0, byteLength).arrayBuffer();
      return new Uint8Array(head);
    } catch {
      return null;
    }
  }

  /**
   * Retrieves the raw File or Blob object for a fileUri or fileName.
   */
  static async getFileObject(fileUri: string, fileName?: string): Promise<File | Blob | null> {
    const cached = webFileCache.get(fileUri);
    if (cached) return cached;

    const query = fileName || this.extractFileName(fileUri);
    const dbFile = await getFileFromIndexedDB(query);
    if (dbFile) return dbFile;

    if (fileUri.startsWith('http')) {
      try {
        const resp = await fetch(fileUri);
        if (resp.ok) {
          return await resp.blob();
        }
      } catch {}
    }
    return null;
  }
}
