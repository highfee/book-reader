import { Platform } from 'react-native';
import { SAFStorageService } from '../storage/safStorage';

export class PDFMetadataService {
  private static pageCountCache = new Map<string, number>();

  /**
   * Retrieves the exact page count of a PDF file.
   * Works on web (blobs, IndexedDB, remote URLs) and native platforms.
   */
  static async getPdfPageCount(fileUri: string, fileName?: string): Promise<number> {
    if (!fileUri) return 1;

    // 1. Check in-memory cache
    if (this.pageCountCache.has(fileUri)) {
      return this.pageCountCache.get(fileUri)!;
    }
    if (fileName && this.pageCountCache.has(fileName)) {
      return this.pageCountCache.get(fileName)!;
    }

    try {
      let rawText = '';

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Resolve fresh live URI in case indexedDB has a revived object URL
        let resolvedUri = fileUri;
        try {
          resolvedUri = await SAFStorageService.getLiveFileUri(fileName || '', fileUri);
        } catch {
          // fallback to fileUri
        }

        // Attempt fast binary retrieval on web
        let buffer: ArrayBuffer | null = null;
        if (resolvedUri.startsWith('blob:') || resolvedUri.startsWith('http')) {
          try {
            const resp = await fetch(resolvedUri);
            if (resp.ok) {
              buffer = await resp.arrayBuffer();
            }
          } catch {
            // Ignore fetch error, fallback to SAFStorageService
          }
        }

        if (buffer) {
          rawText = new TextDecoder('latin1').decode(buffer);
        } else {
          rawText = await SAFStorageService.readFile(resolvedUri, 'utf8');
        }
      } else {
        // Native (Android/iOS)
        rawText = await SAFStorageService.readFile(fileUri, 'utf8');
      }

      if (rawText && rawText.length > 0) {
        const parsed = this.parsePageCountFromPdfString(rawText);
        if (parsed > 0) {
          this.pageCountCache.set(fileUri, parsed);
          if (fileName) this.pageCountCache.set(fileName, parsed);
          return parsed;
        }
      }
    } catch (err) {
      console.warn('PDFMetadataService: Failed to extract PDF page count:', err);
    }

    return 1;
  }

  /**
   * Parses the page count directly from decoded PDF file contents.
   * Scans PDF Document Catalog, Page Tree /Type /Pages /Count N, and individual page objects.
   */
  static parsePageCountFromPdfString(text: string): number {
    let maxCount = 0;

    // Pattern 1: Dictionary blocks << ... >> containing /Type /Pages and /Count N
    const dictRegex = /<<([^>]+(?:\>[^>]+)*)>>/g;
    let match: RegExpExecArray | null;
    while ((match = dictRegex.exec(text)) !== null) {
      const block = match[1];
      if (/\/Type\s*\/Pages\b/.test(block)) {
        const countMatch = block.match(/\/Count\s+(\d+)/);
        if (countMatch) {
          const count = parseInt(countMatch[1], 10);
          if (count > maxCount) maxCount = count;
        }
      }
    }

    // Pattern 2: Dictionaries where /Count and /Type /Pages are in proximity (up to 3000 chars)
    if (maxCount === 0) {
      const p1 = /\/Type\s*\/Pages[\s\S]{1,3000}?\/Count\s+(\d+)/g;
      while ((match = p1.exec(text)) !== null) {
        const count = parseInt(match[1], 10);
        if (count > maxCount) maxCount = count;
      }
      const p2 = /\/Count\s+(\d+)[\s\S]{1,3000}?\/Type\s*\/Pages/g;
      while ((match = p2.exec(text)) !== null) {
        const count = parseInt(match[1], 10);
        if (count > maxCount) maxCount = count;
      }
    }

    // Pattern 3: Any valid /Count N integer in the PDF object tables
    if (maxCount === 0) {
      const countMatches = text.matchAll(/\/Count\s+(\d+)/g);
      for (const cm of countMatches) {
        const val = parseInt(cm[1], 10);
        if (val > maxCount && val <= 50000) {
          maxCount = val;
        }
      }
    }

    // Pattern 4: Fallback count instances of individual page descriptors (/Type /Page not /Pages)
    if (maxCount === 0) {
      const pageMatches = text.match(/\/Type\s*\/Page[\s\/>]/g);
      if (pageMatches && pageMatches.length > 0) {
        maxCount = pageMatches.length;
      }
    }

    return Math.max(1, maxCount);
  }

  /**
   * Sets or overrides a known page count in cache.
   */
  static setKnownPageCount(uriOrName: string, count: number): void {
    if (count > 0) {
      this.pageCountCache.set(uriOrName, count);
    }
  }
}
