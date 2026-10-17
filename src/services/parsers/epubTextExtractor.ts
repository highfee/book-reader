import { inflateSync } from 'fflate';
import { SAFStorageService } from '../storage/safStorage';

export interface EpubPage {
  text: string;
  chapterTitle: string;
  /** True on the first page of a chapter. */
  startsChapter: boolean;
}

interface ZipEntry {
  method: number;
  compressedSize: number;
  localOffset: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const WORDS_PER_PAGE = 260;
/** A zip's central directory sits just before its end-of-file record. */
const INDEX_TAIL_BYTES = 1024 * 1024;
/** Spine documents are fetched a few at a time to keep big books quick. */
const READ_BATCH = 8;

const pageCache = new Map<string, EpubPage[]>();

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  mdash: '—',
  ndash: '–',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  middot: '·',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  laquo: '«',
  raquo: '»',
};

function asView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function findEndOfCentralDirectory(view: DataView, length: number): number {
  // The trailing archive comment can be up to 65 535 bytes long.
  const earliest = Math.max(0, length - 22 - 0xffff);
  for (let cursor = length - 22; cursor >= earliest; cursor--) {
    if (view.getUint32(cursor, true) === EOCD_SIGNATURE) return cursor;
  }
  return -1;
}

/**
 * Reads only the archive index. EPUBs are ordinary zip files, and scanned ones
 * run to hundreds of megabytes, so the whole container is never loaded.
 */
async function readZipIndex(fileUri: string, size: number): Promise<Map<string, ZipEntry>> {
  const entries = new Map<string, ZipEntry>();
  const tailLength = Math.min(size, INDEX_TAIL_BYTES);
  const tailBase = size - tailLength;
  let index = await SAFStorageService.readFileRange(fileUri, tailBase, tailLength);
  if (!index) return entries;

  const eocd = findEndOfCentralDirectory(asView(index), index.length);
  if (eocd < 0) return entries;

  const view = asView(index);
  const count = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);

  let base = tailBase;
  if (centralOffset < base) {
    index = await SAFStorageService.readFileRange(fileUri, centralOffset, centralSize);
    if (!index) return entries;
    base = centralOffset;
  }

  const directory = asView(index);
  let cursor = centralOffset - base;
  for (let i = 0; i < count && cursor + 46 <= index.length; i++) {
    if (directory.getUint32(cursor, true) !== CENTRAL_SIGNATURE) break;
    const method = directory.getUint16(cursor + 10, true);
    const compressedSize = directory.getUint32(cursor + 20, true);
    const nameLength = directory.getUint16(cursor + 28, true);
    const extraLength = directory.getUint16(cursor + 30, true);
    const commentLength = directory.getUint16(cursor + 32, true);
    const localOffset = directory.getUint32(cursor + 42, true);
    const name = decodeText(index.subarray(cursor + 46, cursor + 46 + nameLength));

    // Zip64 placeholders mean the real sizes live further away; archives that
    // large are outside anything an e-reader should hold open.
    if (compressedSize !== 0xffffffff && localOffset !== 0xffffffff) {
      entries.set(name, { method, compressedSize, localOffset });
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

async function readEntryBytes(fileUri: string, entry: ZipEntry): Promise<Uint8Array | null> {
  const header = await SAFStorageService.readFileRange(fileUri, entry.localOffset, 30);
  if (!header || asView(header).getUint32(0, true) !== LOCAL_SIGNATURE) return null;

  const nameLength = asView(header).getUint16(26, true);
  const extraLength = asView(header).getUint16(28, true);
  const dataStart = entry.localOffset + 30 + nameLength + extraLength;
  const data = await SAFStorageService.readFileRange(fileUri, dataStart, entry.compressedSize);
  if (!data) return null;

  if (entry.method === 0) return data;
  if (entry.method === 8) {
    try {
      return inflateSync(data);
    } catch {
      return null;
    }
  }
  // Any other compression (bzip2, lzma) is not supported.
  return null;
}

function normalizePath(segments: string[]): string {
  const stack: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') stack.pop();
    else stack.push(segment);
  }
  return stack.join('/');
}

function resolveEntryName(opfPath: string, href: string): string {
  const decoded = decodeURIComponent(href.split('#')[0]);
  if (decoded.startsWith('/')) return normalizePath(decoded.split('/'));
  return normalizePath([...opfPath.split('/').slice(0, -1), ...decoded.split('/')]);
}

function findEntry(entries: Map<string, ZipEntry>, wanted: string): ZipEntry | undefined {
  const direct = entries.get(wanted);
  if (direct) return direct;
  // Producers disagree about the case of the same path.
  const lower = wanted.toLowerCase();
  for (const [name, entry] of entries) {
    if (name.toLowerCase() === lower) return entry;
  }
  return undefined;
}

async function readTextEntry(
  fileUri: string,
  entries: Map<string, ZipEntry>,
  name: string
): Promise<string | null> {
  const entry = findEntry(entries, name);
  if (!entry) return null;
  const bytes = await readEntryBytes(fileUri, entry);
  return bytes ? decodeText(bytes) : null;
}

function decodeEntities(value: string): string {
  return value.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g, (match, token: string) => {
    if (token.startsWith('#')) {
      const code =
        token[1] === 'x' || token[1] === 'X'
          ? parseInt(token.slice(2), 16)
          : parseInt(token.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    const named = NAMED_ENTITIES[token.toLowerCase()];
    return named ?? match;
  });
}

function markupToText(html: string): string {
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  const body = bodyMatch ? bodyMatch[1] : html;
  const withoutMarkup = body
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(p|div|li|blockquote|h[1-6]|br|tr)\b[^>]*>/gi, '\n')
    .replace(/<\/(p|div|li|blockquote|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeEntities(withoutMarkup)
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n\n')
    .trim();
}

function titleFrom(html: string, fallback: string): string {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const fromHead = title ? markupToText(title[1]) : '';
  if (fromHead) return fromHead;
  const heading = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html);
  const fromHeading = heading ? markupToText(heading[1]) : '';
  return fromHeading || fallback;
}

function splitOversized(paragraph: string): string[] {
  const words = paragraph.split(' ');
  if (words.length <= WORDS_PER_PAGE * 2) return [paragraph];

  const chunks: string[] = [];
  let current: string[] = [];
  let count = 0;
  for (const sentence of paragraph.split(/(?<=[.!?…])\s+/)) {
    const size = sentence.split(' ').length;
    if (count + size > WORDS_PER_PAGE && current.length) {
      chunks.push(current.join(' '));
      current = [];
      count = 0;
    }
    current.push(sentence);
    count += size;
  }
  if (current.length) chunks.push(current.join(' '));
  return chunks;
}

interface Chapter {
  title: string;
  paragraphs: string[];
}

function paginate(chapters: Chapter[]): EpubPage[] {
  const pages: EpubPage[] = [];
  let buffer: string[] = [];
  let words = 0;
  let chapterTitle = '';
  let startsChapter = false;

  const flush = () => {
    if (!buffer.length) return;
    pages.push({ text: buffer.join('\n\n'), chapterTitle, startsChapter });
    buffer = [];
    words = 0;
    startsChapter = false;
  };

  for (const chapter of chapters) {
    chapterTitle = chapter.title;
    startsChapter = true;
    for (const paragraph of chapter.paragraphs) {
      for (const piece of splitOversized(paragraph)) {
        buffer.push(piece);
        words += piece.split(' ').length;
        if (words >= WORDS_PER_PAGE) flush();
      }
    }
    // A chapter never shares its final page with the next one.
    flush();
  }

  return pages;
}

async function readChapter(
  fileUri: string,
  entries: Map<string, ZipEntry>,
  opfPath: string,
  href: string,
  position: number
): Promise<Chapter | null> {
  const name = resolveEntryName(opfPath, href);
  const html = await readTextEntry(fileUri, entries, name);
  if (!html) return null;

  const paragraphs = markupToText(html)
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter((p) => p.length > 0);

  // Navigation pages and cover furniture hold no prose worth reading.
  if (paragraphs.join('').length < 20) return null;

  const fallbackTitle = (name.split('/').pop() ?? '').replace(/\.[^.]+$/, '') || `Section ${position}`;
  return { title: titleFrom(html, fallbackTitle), paragraphs };
}

export class EPUBTextExtractor {
  /**
   * Reads the real prose out of an EPUB: walk the zip index, follow the OPF
   * spine, and re-flow the XHTML documents it points at into reading pages.
   */
  static async extractPages(fileUri: string): Promise<EpubPage[]> {
    if (!fileUri) return [];
    const cached = pageCache.get(fileUri);
    if (cached) return cached;

    const pages = await this.buildPages(fileUri);
    if (pages.length) pageCache.set(fileUri, pages);
    return pages;
  }

  private static async buildPages(fileUri: string): Promise<EpubPage[]> {
    const size = await SAFStorageService.getFileSize(fileUri);
    if (!size) return [];

    const entries = await readZipIndex(fileUri, size);
    if (!entries.size) return [];

    const container = await readTextEntry(fileUri, entries, 'META-INF/container.xml');
    const rootfile = container && /full-path\s*=\s*["']([^"']+)["']/i.exec(container);
    const opfPath = rootfile
      ? normalizePath(rootfile[1].split('/'))
      : [...entries.keys()].find((name) => name.toLowerCase().endsWith('.opf'));
    if (!opfPath) return [];

    const opf = await readTextEntry(fileUri, entries, opfPath);
    if (!opf) return [];

    const manifest = new Map<string, string>();
    for (const tag of opf.match(/<item\b[^>]*>/gi) ?? []) {
      const id = /\bid\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      const mediaType = /\bmedia-type\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? '';
      const isDocument = /html|xml/i.test(mediaType) || (href ? /\.(x?html?|xml)$/i.test(href) : false);
      if (id && href && isDocument) manifest.set(id, href);
    }

    const spineHrefs = [...opf.matchAll(/<itemref\b[^>]*idref\s*=\s*["']([^"']+)["'][^>]*>/gi)]
      .filter((match) => !/linear\s*=\s*["']no["']/i.test(match[0]))
      .map((match) => manifest.get(match[1]))
      .filter((href): href is string => Boolean(href));

    const chapters: (Chapter | null)[] = [];
    for (let start = 0; start < spineHrefs.length; start += READ_BATCH) {
      const batch = spineHrefs.slice(start, start + READ_BATCH);
      const read = await Promise.all(
        batch.map((href, offset) => readChapter(fileUri, entries, opfPath, href, start + offset + 1))
      );
      chapters.push(...read);
    }

    const pages = paginate(chapters.filter((c): c is Chapter => c !== null));
    const words = pages.reduce((sum, page) => sum + page.text.split(' ').length, 0);
    // Guard against an archive that unpacks to metadata only.
    return words > 40 ? pages : [];
  }
}
