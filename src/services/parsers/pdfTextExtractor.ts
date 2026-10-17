import { Platform } from 'react-native';
import { SAFStorageService } from '../storage/safStorage';

// Cache for extracted page text: key is `${fileUri}_${pageNumber}`
const pageTextCache = new Map<string, string>();
// Cache for loaded PDF.js documents on web
const webPdfDocCache = new Map<string, any>();
// Container sniff results, so a file is never handed to the wrong parser
const containerKindCache = new Map<string, 'pdf' | 'zip' | 'text'>();

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF
const ZIP_MAGIC = [0x50, 0x4b]; // PK.. (EPUB, and every other zip container)

function matchesMagic(head: Uint8Array, magic: number[]): boolean {
  return magic.every((byte, i) => head[i] === byte);
}

let pdfjsLoadPromise: Promise<any> | null = null;

/**
 * Dynamically loads PDF.js on Web from CDN if not already loaded.
 */
function getWebPdfJs(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if ((window as any).pdfjsLib) return Promise.resolve((window as any).pdfjsLib);
  if (pdfjsLoadPromise) return pdfjsLoadPromise;

  pdfjsLoadPromise = new Promise((resolve) => {
    try {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib && lib.GlobalWorkerOptions) {
          // Use CDN worker if possible, or fake worker
          lib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        resolve(lib);
      };
      script.onerror = () => {
        console.warn('PDFTextExtractor: Failed to load pdfjs from CDN, falling back to stream decoder');
        resolve(null);
      };
      document.head.appendChild(script);
    } catch {
      resolve(null);
    }
  });

  return pdfjsLoadPromise;
}

export class PDFTextExtractor {
  /**
   * Reads the first bytes of a file so callers route it to the right parser
   * instead of guessing from a URI that has no extension. Returns 'unknown'
   * when the platform cannot expose the bytes, keeping previous behaviour.
   */
  static async detectContainer(fileUri: string): Promise<'pdf' | 'zip' | 'text' | 'unknown'> {
    const cached = containerKindCache.get(fileUri);
    if (cached) return cached;

    let head: Uint8Array | null = null;
    try {
      head = await SAFStorageService.readFileHead(fileUri, 4);
    } catch {
      return 'unknown';
    }

    if (!head || head.length < 4) return 'unknown';

    const kind: 'pdf' | 'zip' | 'text' = matchesMagic(head, PDF_MAGIC)
      ? 'pdf'
      : matchesMagic(head, ZIP_MAGIC)
      ? 'zip'
      : 'text';
    containerKindCache.set(fileUri, kind);
    return kind;
  }

  /**
   * Extracts clean, readable text from a specific page of a PDF document.
   */
  static async extractPageText(
    fileUri: string,
    pageNumber: number,
    fileName?: string
  ): Promise<string | null> {
    if (!fileUri || pageNumber < 1) return null;

    const container = await this.detectContainer(fileUri);
    if (container === 'zip' || container === 'text') return null;

    const cacheKey = `${fileUri}#${pageNumber}`;
    if (pageTextCache.has(cacheKey)) {
      return pageTextCache.get(cacheKey)!;
    }

    // 1. On Web: Attempt high-fidelity extraction via PDF.js first
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const textFromPdfJs = await this.extractWithPdfJs(fileUri, pageNumber, fileName);
        if (textFromPdfJs && textFromPdfJs.trim().length > 10) {
          pageTextCache.set(cacheKey, textFromPdfJs);
          return textFromPdfJs;
        }
      } catch (e) {
        console.warn(`PDFTextExtractor: PDF.js extraction failed for page ${pageNumber}:`, e);
      }
    }

    // 2. Fallback: Parse FlateDecode / uncompressed streams directly from PDF binary
    try {
      const textFromStreams = await this.extractFromStreams(fileUri, pageNumber, fileName);
      if (textFromStreams && textFromStreams.trim().length > 10) {
        pageTextCache.set(cacheKey, textFromStreams);
        return textFromStreams;
      }
    } catch (e) {
      console.warn(`PDFTextExtractor: Stream extraction failed for page ${pageNumber}:`, e);
    }

    return null;
  }

  /**
   * PDF.js-based extractor for Web browsers.
   */
  private static async extractWithPdfJs(
    fileUri: string,
    pageNumber: number,
    fileName?: string
  ): Promise<string | null> {
    const pdfjs = await getWebPdfJs();
    if (!pdfjs) return null;

    let doc = webPdfDocCache.get(fileUri);
    if (!doc) {
      let resolvedUri = fileUri;
      try {
        resolvedUri = await SAFStorageService.getLiveFileUri(fileName || '', fileUri);
      } catch {}

      let arrayBuffer: ArrayBuffer | null = null;
      if (resolvedUri.startsWith('blob:') || resolvedUri.startsWith('http')) {
        try {
          const resp = await fetch(resolvedUri);
          if (resp.ok) {
            arrayBuffer = await resp.arrayBuffer();
          }
        } catch {}
      }

      if (arrayBuffer) {
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        doc = await loadingTask.promise;
      } else if (!resolvedUri.startsWith('blob:')) {
        // A blob URL that produced no bytes is a file lost with a previous page
        // load; handing it to PDF.js only raises a misleading InvalidPDFException.
        const loadingTask = pdfjs.getDocument(resolvedUri);
        doc = await loadingTask.promise;
      } else {
        return null;
      }

      if (doc) {
        webPdfDocCache.set(fileUri, doc);
      }
    }

    if (!doc) return null;

    const numPages = doc.numPages || 1;
    if (pageNumber > numPages) return null;

    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    if (!content || !content.items || content.items.length === 0) return null;

    const lines: string[] = [];
    let currentLine = '';
    let lastY: number | null = null;

    for (const item of content.items) {
      if (!item || typeof item.str !== 'string') continue;
      const str = item.str;
      if (!str.trim() && !currentLine) continue;

      const y = item.transform && item.transform.length >= 6 ? item.transform[5] : null;
      const isNewLine = lastY !== null && y !== null && Math.abs(y - lastY) > 5;

      if (isNewLine) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = str;
      } else {
        currentLine = currentLine ? `${currentLine} ${str}` : str;
      }
      lastY = y;
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    if (lines.length === 0) return null;

    // Structure into coherent paragraphs
    const paragraphs: string[] = [];
    let currentPara = '';

    for (const line of lines) {
      if (!currentPara) {
        currentPara = line;
      } else {
        // Break paragraph on sentence boundary followed by capitalized word or short heading
        const endsSentence = /[.!?]['"]?$/.test(currentPara);
        const isHeading = line.length < 45 && !/[.!?]$/.test(line);

        if ((endsSentence && line.length < 50) || isHeading) {
          paragraphs.push(currentPara);
          currentPara = line;
        } else {
          currentPara += ' ' + line;
        }
      }
    }

    if (currentPara.trim()) {
      paragraphs.push(currentPara.trim());
    }

    return paragraphs.join('\n\n');
  }

  /**
   * Pure JS FlateDecode stream extractor using native DecompressionStream.
   * Works offline with zero dependencies.
   */
  private static async extractFromStreams(
    fileUri: string,
    pageNumber: number,
    fileName?: string
  ): Promise<string | null> {
    let rawText = '';
    let buffer: ArrayBuffer | null = null;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      let resolvedUri = fileUri;
      try {
        resolvedUri = await SAFStorageService.getLiveFileUri(fileName || '', fileUri);
      } catch {}

      if (resolvedUri.startsWith('blob:') || resolvedUri.startsWith('http')) {
        try {
          const resp = await fetch(resolvedUri);
          if (resp.ok) {
            buffer = await resp.arrayBuffer();
          }
        } catch {}
      }

      if (buffer) {
        rawText = new TextDecoder('latin1').decode(buffer);
      } else {
        rawText = await SAFStorageService.readFile(resolvedUri, 'utf8');
      }
    } else {
      rawText = await SAFStorageService.readFile(fileUri, 'utf8');
    }

    if (!rawText || rawText.length < 50) return null;

    // 1. Locate all /Type /Page objects
    const pageObjRegex = /(\d+)\s+0\s+obj\s*<<([\s\S]*?\/Type\s*\/Page\b[\s\S]*?)>>/g;
    const pageMatches: { objId: string; dict: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = pageObjRegex.exec(rawText)) !== null) {
      pageMatches.push({ objId: match[1], dict: match[2] });
    }

    if (pageMatches.length === 0) {
      // Fallback: search general stream content in the document
      return this.extractTokensFromEntireDoc(rawText, pageNumber);
    }

    const targetIndex = pageNumber - 1;
    if (targetIndex < 0 || targetIndex >= pageMatches.length) {
      return null;
    }

    const targetPage = pageMatches[targetIndex];

    // 2. Extract /Contents object IDs for this specific page
    const contentIds: string[] = [];
    const singleContentMatch = targetPage.dict.match(/\/Contents\s+(\d+)\s+0\s+R/);
    if (singleContentMatch) {
      contentIds.push(singleContentMatch[1]);
    } else {
      const arrayContentMatch = targetPage.dict.match(/\/Contents\s*\[\s*([\d\sR]+)\s*\]/);
      if (arrayContentMatch) {
        const idMatches = arrayContentMatch[1].matchAll(/(\d+)\s+0\s+R/g);
        for (const im of idMatches) {
          contentIds.push(im[1]);
        }
      }
    }

    if (contentIds.length === 0) {
      return null;
    }

    // 3. Decompress each stream object for this page
    const pageWords: string[] = [];

    for (const cid of contentIds) {
      const objHeader = `${cid} 0 obj`;
      const objIdx = rawText.indexOf(objHeader);
      if (objIdx === -1) continue;

      const streamIdx = rawText.indexOf('stream', objIdx);
      if (streamIdx === -1) continue;

      let streamStart = streamIdx + 6;
      if (rawText.charCodeAt(streamStart) === 13) streamStart++;
      if (rawText.charCodeAt(streamStart) === 10) streamStart++;

      const endStreamIdx = rawText.indexOf('endstream', streamStart);
      if (endStreamIdx === -1) continue;

      const rawStream = rawText.substring(streamStart, endStreamIdx);
      let decompressed = '';

      if (typeof DecompressionStream !== 'undefined') {
        try {
          const bytes = Uint8Array.from(rawStream, (c) => c.charCodeAt(0));
          const ds = new DecompressionStream('deflate');
          const stream = new Response(bytes).body?.pipeThrough(ds);
          if (stream) {
            decompressed = await new Response(stream).text();
          }
        } catch {
          // Stream might be uncompressed
          decompressed = rawStream;
        }
      } else {
        decompressed = rawStream;
      }

      if (decompressed) {
        // Extract text from (text) Tj
        const tjMatches = decompressed.matchAll(/\(([^)]+)\)\s*Tj/g);
        for (const m of tjMatches) {
          const cleaned = m[1].replace(/\\([()\\])/g, '$1').trim();
          if (cleaned) pageWords.push(cleaned);
        }

        // Extract text from [(text1) 12 (text2)] TJ
        const tjArrayMatches = decompressed.matchAll(/\[([^\]]+)\]\s*TJ/g);
        for (const m of tjArrayMatches) {
          const innerMatches = m[1].matchAll(/\(([^)]+)\)/g);
          for (const im of innerMatches) {
            const cleaned = im[1].replace(/\\([()\\])/g, '$1').trim();
            if (cleaned) pageWords.push(cleaned);
          }
        }
      }
    }

    if (pageWords.length < 5) return null;

    const fullText = pageWords.join(' ').replace(/\s+/g, ' ').trim();
    // Verify readable human text ratio
    const printableCount = (fullText.match(/[a-zA-Z0-9\s.,!?'"()-]/g) || []).length;
    if (printableCount / fullText.length < 0.65) return null;

    return this.chunkWordsIntoParagraphs(pageWords);
  }

  /**
   * Fallback for PDFs without clear page-object streams: extracts overall tokens
   * and maps to the requested page offset.
   */
  private static extractTokensFromEntireDoc(rawText: string, pageNumber: number): string | null {
    const tokens: string[] = [];
    const tjMatches = rawText.matchAll(/\(([^)]+)\)\s*Tj/g);
    for (const m of tjMatches) {
      tokens.push(m[1].replace(/\\([()\\])/g, '$1'));
    }
    const tjArrayMatches = rawText.matchAll(/\[([^\]]+)\]\s*TJ/g);
    for (const m of tjArrayMatches) {
      const innerMatches = m[1].matchAll(/\(([^)]+)\)/g);
      for (const im of innerMatches) {
        tokens.push(im[1].replace(/\\([()\\])/g, '$1'));
      }
    }

    if (tokens.length < 20) return null;

    const wordsPerPage = 260;
    const startIndex = (pageNumber - 1) * wordsPerPage;
    if (startIndex >= tokens.length) return null;

    const pageWords = tokens.slice(startIndex, startIndex + wordsPerPage);
    return this.chunkWordsIntoParagraphs(pageWords);
  }

  /**
   * Helper to format word tokens into readable, natural paragraphs.
   */
  private static chunkWordsIntoParagraphs(words: string[]): string {
    const fullText = words.join(' ');
    // Split on existing newline markers if present
    if (fullText.includes('\n\n')) {
      return fullText;
    }

    const paragraphs: string[] = [];
    const chunkSize = Math.max(40, Math.floor(words.length / 3));

    for (let i = 0; i < words.length; i += chunkSize) {
      paragraphs.push(words.slice(i, i + chunkSize).join(' '));
    }

    return paragraphs.join('\n\n');
  }

  /**
   * Converts a block of page text into an array of paragraphs for TTS narration.
   */
  static splitIntoNarrationParagraphs(pageText: string): string[] {
    if (!pageText || !pageText.trim()) return [];
    return pageText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }
}
