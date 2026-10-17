import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';

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
  /** Web only: the picked File, so its bytes can be cached in IndexedDB. */
  fileObj?: any;
}

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Hermes does not guarantee atob/Buffer, so decode by hand.
 */
function decodeBase64(value: string): Uint8Array | null {
  if (!value) return null;
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < value.length; i++) {
    const idx = B64_ALPHABET.indexOf(value[i]);
    if (idx < 0) continue;
    acc = (acc << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return bytes.length ? Uint8Array.from(bytes) : null;
}

export class SAFStorageService {
  /**
   * Request directory permissions from the user.
   * On Android, uses Storage Access Framework (SAF) to request access to an entire folder.
   * Permissions obtained via SAF are persistable across app restarts.
   */
  static async requestDirectoryAccess(): Promise<PickedDirectoryResult> {
    if (Platform.OS === 'android') {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          return {
            granted: true,
            directoryUri: permissions.directoryUri,
          };
        }
        return {
          granted: false,
          error: 'User denied directory access permission',
        };
      } catch (err: any) {
        return {
          granted: false,
          error: err?.message || 'Failed to request directory permissions',
        };
      }
    }

    // On iOS and web, full directory tree picking is sandboxed; fallback to DocumentPicker
    return {
      granted: true,
      directoryUri: 'document-picker://manual',
    };
  }

  /**
   * Read all files inside the given directory URI and return supported PDF and EPUB files.
   */
  static async scanDirectoryForBooks(directoryUri: string): Promise<DiscoveredBookFile[]> {
    if (Platform.OS === 'android' && directoryUri.startsWith('content://')) {
      try {
        const fileUris = await FileSystem.StorageAccessFramework.readDirectoryAsync(directoryUri);
        const discovered: DiscoveredBookFile[] = [];

        for (const uri of fileUris) {
          const decodedUri = decodeURIComponent(uri);
          const lower = decodedUri.toLowerCase();

          let format: 'pdf' | 'epub' | null = null;
          if (lower.endsWith('.pdf')) {
            format = 'pdf';
          } else if (lower.endsWith('.epub')) {
            format = 'epub';
          }

          if (format) {
            // Extract the human-readable filename from the URI
            const fileName = this.extractFileName(decodedUri);
            
            let sizeBytes: number | undefined;
            let lastModified: number | undefined;
            try {
              const info = await FileSystem.getInfoAsync(uri);
              if (info.exists) {
                sizeBytes = info.size;
                lastModified = info.modificationTime;
              }
            } catch {
              // Non-blocking: continue even if file size probe fails
            }

            discovered.push({
              fileUri: uri,
              fileName,
              format,
              sizeBytes,
              lastModified,
            });
          }
        }

        return discovered;
      } catch (err) {
        console.error('Failed to scan SAF directory:', err);
        throw err;
      }
    }

    // Fallback: if not an Android SAF URI, check if it's a standard file path or cache
    return [];
  }

  /**
   * Fallback for iOS / Web / single file import: pick one or more book files directly.
   */
  static async pickBookFiles(): Promise<DiscoveredBookFile[]> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/epub+zip', 'application/octet-stream'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets) {
        return [];
      }

      const discovered: DiscoveredBookFile[] = [];

      for (const asset of result.assets) {
        const lowerName = asset.name.toLowerCase();
        let format: 'pdf' | 'epub' | null = null;

        if (lowerName.endsWith('.pdf')) {
          format = 'pdf';
        } else if (lowerName.endsWith('.epub')) {
          format = 'epub';
        }

        if (format) {
          discovered.push({
            fileUri: asset.uri,
            fileName: asset.name,
            format,
            sizeBytes: asset.size,
          });
        }
      }

      return discovered;
    } catch (err) {
      console.error('Error picking document:', err);
      return [];
    }
  }

  /**
   * Helper to extract a friendly file name from a URI.
   */
  static extractFileName(uri: string): string {
    const segments = uri.split('/');
    const raw = segments[segments.length - 1] || 'Unknown Book';
    // Remove query params or content provider prefixes if present
    const clean = raw.split('?')[0].split('%2F').pop() || raw;
    return decodeURIComponent(clean);
  }

  /**
   * Helper to resolve live file URI (identity on native).
   */
  static async getLiveFileUri(
    _fileName: string,
    currentUri: string,
    _bookTitle?: string,
    _bookId?: string
  ): Promise<string> {
    return currentUri;
  }

  /**
   * Stub for web IndexedDB persistence on native.
   */
  static async persistBookFile(_fileName: string, _file: any, _bookId?: string): Promise<void> {
    // No-op on native platforms where URIs are persistent content:// or file://
  }

  /**
   * Retrieves file object (blob/file) on web; returns null on native.
   */
  static async getFileObject(_fileUri: string, _fileName?: string): Promise<any | null> {
    return null;
  }

  /**
   * Native URIs (file://, content://) outlive the screen that opened them.
   */
  static isLiveFileUri(fileUri: string): boolean {
    return Boolean(fileUri);
  }

  /**
   * Native callers identify a container by its extension, so no header probe
   * is needed.
   */
  static async readFileHead(_fileUri: string, _byteLength?: number): Promise<Uint8Array | null> {
    return null;
  }

  /**
   * Byte length of a file, or 0 when it cannot be found.
   */
  static async getFileSize(fileUri: string): Promise<number> {
    try {
      const info = await FileSystem.getInfoAsync(fileUri);
      return info.exists && !info.isDirectory ? info.size : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Reads one byte range, decoded from base64, so container readers never pull
   * a whole multi-hundred-megabyte archive into memory.
   */
  static async readFileRange(fileUri: string, position: number, length: number): Promise<Uint8Array | null> {
    try {
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
        position,
        length,
      });
      return decodeBase64(base64);
    } catch {
      return null;
    }
  }

  /**
   * Read raw text or base64 data from a file URI.
   */
  static async readFile(
    fileUri: string,
    encoding: 'utf8' | 'base64' = 'utf8'
  ): Promise<string> {
    return await FileSystem.readAsStringAsync(fileUri, {
      encoding:
        encoding === 'base64'
          ? FileSystem.EncodingType.Base64
          : FileSystem.EncodingType.UTF8,
    });
  }
}
