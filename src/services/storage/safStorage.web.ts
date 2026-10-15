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
    const tx = db.transaction('book_files', 'readwrite');
    const store = tx.objectStore('book_files');
    // Store with raw original filename
    store.put({ fileName, file, size: file.size, lastModified: file.lastModified });
    
    // Also save by clean base name without extension
    const baseName = fileName.replace(/\.[^/.]+$/, '').trim();
    if (baseName && baseName !== fileName) {
      store.put({ fileName: baseName, file, size: file.size, lastModified: file.lastModified });
    }

    // Save with normalized lowercase alphanumeric key
    const normalizedKey = fileName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedKey && normalizedKey !== fileName) {
      store.put({ fileName: normalizedKey, file, size: file.size, lastModified: file.lastModified });
    }

    // Save with bookId if provided
    if (bookId) {
      store.put({ fileName: bookId, file, size: file.size, lastModified: file.lastModified });
    }
  } catch (err) {
    console.warn('Could not store file in IndexedDB:', err);
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
              saveFileToIndexedDB(entry.name, file);

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

      input.onchange = () => {
        const fileList = input.files;
        const discovered: DiscoveredBookFile[] = [];

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
              saveFileToIndexedDB(file.name, file);

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
      try {
        const check = await fetch(currentUri, { method: 'HEAD' });
        if (check.ok) return currentUri;
      } catch {}
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
   * Read file content on web via Blob/FileReader or fetch.
   */
  static async readFile(
    fileUri: string,
    encoding: 'utf8' | 'base64' = 'utf8'
  ): Promise<string> {
    let cachedFile = webFileCache.get(fileUri);

    // If not in memory, attempt retrieval from IndexedDB using extracted filename
    if (!cachedFile) {
      const fileName = this.extractFileName(fileUri);
      cachedFile = (await getFileFromIndexedDB(fileName)) || undefined;
    }

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

    // Fallback: try fetching object URL or remote URL
    try {
      const response = await fetch(fileUri);
      if (!response.ok) return '';
      return await response.text();
    } catch {
      return '';
    }
  }

  /**
   * Retrieves the raw File or Blob object for a fileUri or fileName.
   */
  static async getFileObject(fileUri: string, fileName?: string): Promise<File | Blob | null> {
    let cached = webFileCache.get(fileUri);
    if (cached) return cached;

    const query = fileName || this.extractFileName(fileUri);
    const dbFile = await getFileFromIndexedDB(query);
    if (dbFile) return dbFile;

    if (fileUri.startsWith('blob:') || fileUri.startsWith('http')) {
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
