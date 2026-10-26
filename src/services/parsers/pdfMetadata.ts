import { Platform } from 'react-native';
import { SAFStorageService } from '../storage/safStorage';

/**
 * Generators that were never told the book's name still fill the Info dictionary, with placeholders:
 * ReportLab writes "\(anonymous\)", hyperref copies the field name. Passing those through would label
 * a real book "anonymous" in every header, so they count as no metadata at all.
 */
const PDF_INFO_PLACEHOLDER = /^(?:\(\s*(?:anonymous|unspecified|untitled|unknown)\s*\)|(anonymous|unspecified|untitled|unknown|title|author|subject|keywords|untitled document))$/i;

export class PDFMetadataService {
  private static pageCountCache = new Map<string, number>();

  /**
   * Reads the file once and returns both facts its own Info dictionary states.
   */
  static async readPdfSelfDescription(
    fileUri: string,
    fileName?: string
  ): Promise<{ title?: string; author?: string; pageCount: number }> {
    const empty = { pageCount: 1 };
    if (!fileUri) return empty;

    try {
      const rawText = await this.readPdfText(fileUri, fileName);
      if (!rawText) return empty;
      const pageCount = this.parsePageCountFromPdfString(rawText);
      if (pageCount > 1) {
        this.pageCountCache.set(fileUri, pageCount);
        if (fileName) this.pageCountCache.set(fileName, pageCount);
      }
      return { ...this.parseDocInfoFromPdfString(rawText), pageCount: Math.max(1, pageCount) };
    } catch (err) {
      console.warn('PDFMetadataService: Failed to read PDF self-description:', err);
      return empty;
    }
  }

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
      const rawText = await this.readPdfText(fileUri, fileName);
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
   * Decodes the raw bytes of a PDF as a byte-per-character string, so the plain-text
   * dictionaries can be matched with regular expressions.
   */
  private static async readPdfText(fileUri: string, fileName?: string): Promise<string> {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Resolve fresh live URI in case indexedDB has a revived object URL
      let resolvedUri = fileUri;
      try {
        resolvedUri = await SAFStorageService.getLiveFileUri(fileName || '', fileUri);
      } catch {
        // fallback to fileUri
      }

      if (resolvedUri.startsWith('blob:') || resolvedUri.startsWith('http')) {
        try {
          const resp = await fetch(resolvedUri);
          if (resp.ok) {
            return new TextDecoder('latin1').decode(await resp.arrayBuffer());
          }
        } catch {
          // Ignore fetch error, fallback to SAFStorageService
        }
      }

      return SAFStorageService.readFile(resolvedUri, 'utf8');
    }

    return SAFStorageService.readFile(fileUri, 'utf8');
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

  /**
   * Reads the document Information dictionary the publisher wrote: the trailer points at it with
   * `/Info 12 0 R`, and that object holds the real title and author the file carries. Without it a
   * PDF is only ever named by whatever a download site typed into the filename.
   */
  static parseDocInfoFromPdfString(text: string): { title?: string; author?: string } {
    const dict = this.findInfoDictionary(text);
    if (!dict) return {};

    const title = this.readPdfDictString(dict, 'Title');
    const author = this.readPdfDictString(dict, 'Author');
    return {
      ...(title ? { title } : {}),
      ...(author ? { author } : {}),
    };
  }

  /**
   * Locates the Info dictionary body. Most PDFs keep it as a plain indirect object; when the trailer
   * itself is unreadable, any dictionary that carries generator dates is the Info dictionary.
   */
  private static findInfoDictionary(text: string): string | null {
    let ref: RegExpExecArray | null = null;
    const refRegex = /\/Info\s+(\d+)\s+(\d+)\s+R/g;
    while ((ref = refRegex.exec(text)) !== null) {
      const body = this.findObjectBody(text, parseInt(ref[1], 10));
      if (body) return body;
    }

    const fallback = /\/(?:Producer|CreationDate|ModDate)\s*[<(]/g;
    let marker: RegExpExecArray | null;
    while ((marker = fallback.exec(text)) !== null) {
      const open = text.lastIndexOf('<<', marker.index);
      if (open < 0) continue;
      const close = text.indexOf('>>', marker.index);
      if (close < 0) continue;
      const body = text.slice(open + 2, close);
      if (body.length < 20000 && /\/Title/.test(body)) return body;
    }

    return null;
  }

  /**
   * Returns the contents of `N 0 obj … endobj`, or the dictionary inside it.
   */
  private static findObjectBody(text: string, objectNumber: number): string | null {
    const start = text.search(new RegExp(`\\b${objectNumber}\\s+0\\s+obj\\b`));
    if (start < 0) return null;
    const end = text.indexOf('endobj', start);
    const body = text.slice(start, end < 0 ? start + 8000 : Math.min(end, start + 20000));
    const open = body.indexOf('<<');
    return open < 0 ? null : body.slice(open);
  }

  /**
   * Pulls one string value out of a dictionary, taking the last occurrence PDF revision writers use.
   */
  private static readPdfDictString(dict: string, key: string): string | undefined {
    const finder = new RegExp(`\\/${key}\\s*[<(]`, 'g');
    let match: RegExpExecArray | null = null;
    while ((match = finder.exec(dict)) !== null) {
      const delimiter = dict[match.index + match[0].length - 1];
      const raw =
        delimiter === '('
          ? this.readPdfLiteralString(dict, match.index + match[0].length - 1)
          : this.readPdfHexString(dict, match.index + match[0].length - 1);
      const value = (raw || '').replace(/\s+/g, ' ').trim();
      if (value && !PDF_INFO_PLACEHOLDER.test(value)) return value;
    }
    return undefined;
  }

  /** Reads a `(literal string)` that starts at `open`, honouring escapes and nested parentheses. */
  private static readPdfLiteralString(text: string, open: number): string | null {
    const bytes: number[] = [];
    let depth = 1;
    let i = open + 1;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === '\\') {
        const next = text[i + 1];
        if (next === undefined) break;
        if (/[0-7]/.test(next)) {
          const octal = /^[0-7]{1,3}/.exec(text.slice(i + 1))![0];
          bytes.push(parseInt(octal, 8));
          i += octal.length + 1;
          continue;
        }
        if (next === '\n' || next === '\r') {
          i += next === '\r' && text[i + 2] === '\n' ? 2 : 1;
          continue;
        }
        bytes.push(this.escapeChar(next));
        i += 2;
        continue;
      }
      if (ch === '(') depth++;
      if (ch === ')') {
        depth--;
        if (depth === 0) break;
      }
      bytes.push(ch.charCodeAt(0) & 0xff);
      i++;
    }
    return this.decodePdfBytes(bytes);
  }

  private static escapeChar(escaped: string): number {
    const map: Record<string, number> = {
      n: 0x0a, r: 0x0d, t: 0x09, b: 0x08, f: 0x0c, '(': 0x28, ')': 0x29, '\\': 0x5c,
    };
    return map[escaped] ?? escaped.charCodeAt(0);
  }

  /** Reads a `<hex string>` that starts at `open`. */
  private static readPdfHexString(text: string, open: number): string | null {
    const close = text.indexOf('>', open);
    if (close < 0) return null;
    const hex = text.slice(open + 1, close).replace(/[^0-9a-fA-F]/g, '');
    const bytes: number[] = [];
    for (let i = 0; i + 1 < hex.length; i += 2) {
      bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }
    return this.decodePdfBytes(bytes);
  }

  /**
   * PDF strings are either UTF-16BE with a BOM, UTF-8 from modern writers, or legacy single-byte
   * codes — the last decodes to replacement characters, which is how the flavour is told apart.
   */
  private static decodePdfBytes(input: number[]): string {
    const bytes = Uint8Array.from(input);
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      let out = '';
      for (let i = 2; i + 1 < bytes.length; i += 2) {
        out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
      }
      return out;
    }

    let utf8 = '';
    try {
      utf8 = new TextDecoder('utf-8').decode(bytes);
    } catch {
      utf8 = '';
    }
    if (utf8 && !utf8.includes('\uFFFD')) return utf8;

    try {
      // Legacy PDFs use Windows-1252, where 0x93 is a real opening quote rather than a control code
      return new TextDecoder('windows-1252').decode(bytes);
    } catch {
      let out = '';
      for (const b of bytes) out += String.fromCharCode(b);
      return out;
    }
  }
}
