/**
 * Title & Author Inference Engine
 * Intelligently cleans noisy filenames, strips release groups, ISBNs, web artifacts,
 * and extracts canonical book titles and authors across the entire app.
 */

// Common pirate / scan / web release tags and domains
const JUNK_BRACKET_PATTERNS = [
  /\[\s*(?:z-?lib(?:rary)?(?:\.org|\.is|\.to|\.io|\.sk)?)\s*\]/gi,
  /\[\s*oceanofpdf(?:\.com)?\s*\]/gi,
  /\[\s*libgen(?:\.li|\.rs|\.is|\.gs)?\s*\]/gi,
  /\[\s*(?:retail|epub|pdf|mobi|azw3|ebook|paperback|hardcover|scan|re-?pack|true pdf)\s*\]/gi,
  /\[\s*(?:en|eng|english|fr|es|de|ita|ru|pt)\s*\]/gi,
  /\[\s*v?\d+(?:\.\d+)?\s*\]/gi,
  /\[\s*(?:complete|edition|annotated|illustrated|unabridged|revised)\s*\]/gi,
  /\(\s*(?:z-?lib(?:rary)?(?:\.org|\.is|\.to|\.io|\.sk)?)\s*\)/gi,
  /\(\s*oceanofpdf(?:\.com)?\s*\)/gi,
  /\(\s*libgen(?:\.li|\.rs|\.is|\.gs)?\s*\)/gi,
  /\(\s*(?:retail|epub|pdf|mobi|azw3|ebook|paperback|hardcover|scan|re-?pack|true pdf)\s*\)/gi,
  /\(\s*v?\d+(?:\.\d+)?\s*\)/gi,
  /\(\s*(?:19\d\d|20\d\d)\s*\)/g, // (1998), (2024), etc.
  /\[\s*(?:19\d\d|20\d\d)\s*\]/g, // [1998], [2024], etc.
];

// File extensions to strip
const EXTENSION_REGEX = /\.(epub|pdf|mobi|azw3|azw|fb2|txt|djvu|cbr|cbz)$/i;

/**
 * Release sites name the file both wrapped — "(Pdfdrive.com)", "[z-library.sk]" — and bare, and new
 * mirrors appear constantly, so match the host shape against registry TLDs rather than enumerating
 * each site. Common English words that happen to be TLDs (.life, .shop, .me) are left out so a real
 * title never trips the rule.
 */
const HOST_SOURCE = String.raw`[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|is|to|sk|li|rs|gs|info|co|xyz|pw|cc|club|online|site|top|best|icu|one|space|website|download|search)`;
const WRAPPED_HOST_SOURCE = String.raw`[\[(][^\])]{0,40}(?:${HOST_SOURCE}|z-?lib(?:rary)?|oceanofpdf|libgen|annas?-?archive|pdfdrive)[^\])]{0,40}[\])]`;
const JUNK_HOST_PATTERNS = [
  new RegExp(WRAPPED_HOST_SOURCE, 'gi'),
  new RegExp(String.raw`\b(?:https?:\/\/|www\.)?${HOST_SOURCE}\b`, 'gi'),
];

const ALL_JUNK_PATTERNS = [...JUNK_BRACKET_PATTERNS, ...JUNK_HOST_PATTERNS];

/** Built once without /g so .test() stays stateless. */
const RELEASE_JUNK_REGEX = new RegExp(
  ALL_JUNK_PATTERNS.map((pattern) => pattern.source).join('|'),
  'i'
);

/** True when a string still reads like a download label rather than a book's own title. */
export function hasReleaseJunk(value: string): boolean {
  return Boolean(value) && RELEASE_JUNK_REGEX.test(value);
}

// Unbracketed pirate / web release tags at the end or preceded by separator
const UNBRACKETED_RELEASE_PATTERNS = [
  /[-_\s]+(?:z-?lib(?:rary)?|oceanofpdf|libgen|annas?-?archive|pdfdrive|vk)(?:[-_\.\s]*(?:org|is|to|io|sk|com|li|rs|gs|net))?(?:[-_\s]*(?:epub|pdf|mobi|azw3?|djvu|txt|retail|scan|repack|ebook|true\s*pdf|paperback|hardcover))*\s*$/gi,
  /\b(?:z-?lib(?:rary)?|oceanofpdf|libgen|annas?-?archive)(?:\.org|\.is|\.to|\.com|\.li|\.rs|\.gs|\.net)?\b/gi,
  /(?:[-_\s]+(?:retail|scan|repack|true\s*pdf|ebook|paperback|hardcover))+\s*$/gi,
  /(?:[-_\s]+(?:epub|pdf|mobi|azw3?|djvu|txt))+\s*$/gi,
];

// ISBN patterns (ISBN-10, ISBN-13, with or without hyphens)
const ISBN_REGEX = /(?:isbn(?:-?1[03])?:?\s*)?(?:97[89][-\s]?)?[0-9]{1,5}[-\s]?[0-9]+[-\s]?[0-9]+[-\s]?[0-9xX]/gi;

// UUID pattern (8-4-4-4-12 hex chars)
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// Long hex or numeric timestamp hash prefix e.g. "1727584930219_" or "a9f830d12849_"
const HASH_PREFIX_REGEX = /^[0-9a-f]{10,}_+/i;

// Common title keywords that strongly signal a title (not a person's name)
const TITLE_INDICATORS = new Set([
  'the', 'a', 'an', 'how', 'why', 'what', 'guide', 'handbook', 'manual',
  'principles', 'patterns', 'habits', 'startup', 'history', 'subtle', 'art',
  'psychology', 'programming', 'code', 'design', 'money', 'power', 'edition',
  'vol', 'volume', 'part', 'chapter', 'rules', 'thinking', 'clean', 'deep',
  'atomic', 'lean', 'rich', 'poor', 'dad', 'smart', 'secrets', 'science',
  'story', 'stories', 'tale', 'tales', 'chronicles', 'journey', 'life',
  'mastery', 'war', 'peace', 'world', 'century', 'future', 'brief', 'essential'
]);

// Small lowercase words in English titles (unless first or last word)
const MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'en', 'for', 'if', 'in',
  'of', 'on', 'or', 'the', 'to', 'v', 'via', 'vs', 'with', 'nor', 'yet', 'so'
]);

// Known acronyms to keep in ALL CAPS
const PRESERVE_ACRONYMS = new Set([
  'ai', 'dna', 'rna', 'usa', 'uk', 'fbi', 'cia', 'nasa', 'mit', 'ibm', 'api', 'ui', 'ux',
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'
]);

/**
 * Standardize capitalization to proper Title Case.
 */
export function toTitleCase(input: string): string {
  if (!input) return '';
  const words = input.trim().split(/\s+/);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      // Roman numerals or uppercase acronyms
      if (PRESERVE_ACRONYMS.has(lower)) {
        return lower.toUpperCase();
      }
      // A lone capital letter is a middle initial ("Thomas A. Bass"), not the article "a"
      if (word.length === 1 && word >= 'A' && word <= 'Z') {
        return word;
      }
      // The word after a colon or dash opens a subtitle, so it is never a minor word
      const previous = index > 0 ? words[index - 1] : '';
      const startsClause = /[:;—–]$/.test(previous);
      // Minor words NOT at the start or end
      if (!startsClause && index > 0 && index < words.length - 1 && MINOR_WORDS.has(lower)) {
        return lower;
      }
      // Capitalize first letter, keep rest lower
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Strips path prefixes (Windows, Unix, content URIs, web blobs).
 */
export function stripPathPrefix(raw: string): string {
  if (!raw) return '';
  let cleaned = raw;
  try {
    cleaned = decodeURIComponent(cleaned);
  } catch {
    // ignore
  }
  cleaned = cleaned.split('?')[0].split('#')[0];
  const parts = cleaned.split(/[/\\]/);
  return parts[parts.length - 1] || cleaned;
}

/**
 * A name with no readable title in it: a UUID, a long hex dump, or pure digits.
 * Anchored and stateless, unlike a /g test that advances lastIndex between calls.
 */
function isOpaqueName(value: string): boolean {
  if (!value) return true;
  const bare = value.replace(EXTENSION_REGEX, '');
  return /^[0-9a-f][0-9a-f-]{18,}$/i.test(bare) || /^[\d_.\s-]+$/.test(bare);
}

/**
 * Words that make a segment a description rather than a person: "(Revised and Updated)",
 * "(A Memoir)". Without this the parenthetical is read as the author and shows up in "by …".
 */
const NON_NAME_WORDS = new Set([
  ...MINOR_WORDS,
  'abridged', 'adapted', 'afterword', 'annotated', 'appendix', 'audiobook', 'centenary', 'chart',
  'classic', 'classics', 'collection', 'commentary', 'complete', 'custom', 'deluxe', 'digest',
  'edition', 'editions', 'ebook', 'essay', 'essays', 'expanded', 'foreword', 'illustrated',
  'insights', 'introduction', 'library', 'memoir', 'modern', 'notes', 'novel', 'part', 'poems',
  'poetry', 'preface', 'retail', 'revised', 'scan', 'series', 'study', 'summary', 'tales',
  'translated', 'unabridged', 'updated', 'vol', 'volume',
]);

/**
 * Checks whether a text segment looks like a person's name (2-4 words, no title stop words).
 */
function isLikelyPersonName(segment: string): boolean {
  if (!segment) return false;
  const cleaned = segment.replace(/[^a-zA-Z\s\.]/g, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;

  // If any word signals a title or a descriptor, it is not a person's name
  for (const w of words) {
    const lower = w.toLowerCase().replace(/\.$/, '');
    if (TITLE_INDICATORS.has(lower) || NON_NAME_WORDS.has(lower)) return false;
  }
  return true;
}

/**
 * Checks whether a text segment looks like a book title.
 */
function isLikelyTitle(segment: string): boolean {
  if (!segment) return false;
  const lower = segment.toLowerCase();
  for (const ind of TITLE_INDICATORS) {
    if (lower.includes(ind)) return true;
  }
  if (segment.includes(':') || segment.includes(',') || segment.includes('?')) return true;
  const words = segment.trim().split(/\s+/);
  return words.length >= 4;
}

/**
 * Infers both clean Title and Author from raw strings or Book-like objects.
 */
export function inferBookMetadata(
  bookOrName: {
    title?: string;
    fileName?: string;
    author?: string;
  } | string,
  sampleContent?: string
): { title: string; author: string } {
  let rawString = '';
  let existingAuthor = '';

  if (typeof bookOrName === 'string') {
    rawString = bookOrName;
  } else if (bookOrName) {
    const fn = bookOrName.fileName || '';
    const t = bookOrName.title || '';
    const aut = bookOrName.author && bookOrName.author !== 'Unknown Author' ? bookOrName.author : '';
    existingAuthor = aut;

    // A stored title is the curated value — the import pass or a later AI/manual rewrite — so it
    // wins once it reads like a title. The filename is only consulted while the row still carries
    // a download label, or when the title is missing entirely.
    const titleIsCurated = Boolean(t) && t !== 'Untitled Book' && !isOpaqueName(t) && !hasReleaseJunk(t);

    if (titleIsCurated) {
      rawString = t;
    } else if (!isOpaqueName(fn)) {
      rawString = fn;
    } else {
      rawString = fn || t;
    }
  }

  // 1. Strip path and file extension
  let clean = stripPathPrefix(rawString).replace(EXTENSION_REGEX, '').trim();

  // 2. Remove UUIDs and hash prefixes
  clean = clean.replace(UUID_REGEX, ' ');
  clean = clean.replace(HASH_PREFIX_REGEX, ' ');

  // 3. Remove known junk tags
  for (const pattern of ALL_JUNK_PATTERNS) {
    clean = clean.replace(pattern, ' ');
  }

  // 4. Remove ISBN strings
  clean = clean.replace(ISBN_REGEX, ' ');

  // 4b. Remove unbracketed release tags & web domains
  for (const pattern of UNBRACKETED_RELEASE_PATTERNS) {
    clean = clean.replace(pattern, ' ');
  }

  // 4c. Normalize kebab-case and snake_case slugs
  clean = clean.replace(/[-_]by[-_]/gi, ' by ');
  const hyphenCount = (clean.match(/-/g) || []).length;
  const spaceCount = (clean.match(/\s/g) || []).length;
  if (hyphenCount >= 2 && hyphenCount > spaceCount) {
    clean = clean.replace(/([a-zA-Z0-9])-([a-zA-Z0-9])/g, '$1 $2');
  }
  const underCount = (clean.match(/_/g) || []).length;
  if (underCount >= 2) {
    clean = clean.replace(/([a-zA-Z0-9])_([a-zA-Z0-9])/g, '$1 $2');
  }

  let extractedAuthor = existingAuthor;
  let extractedTitle = clean.replace(/\s+/g, ' ').trim();

  // 5. Detect parenthesized author: e.g. "Thinking, Fast and Slow (Daniel Kahneman)"
  const parenAuthorMatch = clean.match(/^([^(]+?)\s*\(([^)]+)\)\s*$/);
  if (parenAuthorMatch) {
    const inside = parenAuthorMatch[2].trim();
    if (isLikelyPersonName(inside) && !extractedAuthor) {
      extractedTitle = parenAuthorMatch[1].trim();
      extractedAuthor = inside;
    }
  }

  // 6. Detect bracketed author: e.g. "[Walter Isaacson] Steve Jobs" or "Steve Jobs [Walter Isaacson]"
  const bracketAuthorMatch = clean.match(/^\[([^\]]+)\]\s*([^\[]+)$/);
  if (bracketAuthorMatch && !extractedAuthor) {
    const inside = bracketAuthorMatch[1].trim();
    if (isLikelyPersonName(inside)) {
      extractedAuthor = inside;
      extractedTitle = bracketAuthorMatch[2].trim();
    }
  }

  // 7. Remove remaining bracketed metadata e.g. [some release tag]
  extractedTitle = extractedTitle.replace(/\[[^\]]{1,40}\]/g, ' ');
  extractedTitle = extractedTitle.replace(/\((?:v\d+|edition|vol\b|scan|web|ebook|retail)[^)]*\)/gi, ' ');
  extractedTitle = extractedTitle.replace(/\(\s*\d+(?:st|nd|rd|th)?\s*(?:edition|ed\.?)\s*\)/gi, ' ');
  // A parenthesis made only of labels — "(A Memoir)", "(Revised and Updated)" — describes the file,
  // not the book, so it never belongs in a header or a narrator's opening line.
  extractedTitle = extractedTitle.replace(/\(([^)]{1,60})\)/g, (group, inner: string) =>
    inner
      .toLowerCase()
      .split(/[^a-z']+/)
      .filter(Boolean)
      .every((word) => NON_NAME_WORDS.has(word))
      ? ' '
      : group
  );

  // 8. Separate CamelCase or PascalCase if the string is stuck together
  if (!extractedTitle.includes(' ') && !extractedTitle.includes('_') && !extractedTitle.includes('-')) {
    extractedTitle = extractedTitle.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  }

  // 9. Handle dots and underscores
  if (extractedTitle.includes('.') && !extractedTitle.includes(' ')) {
    extractedTitle = extractedTitle.replace(/\./g, ' ');
  }
  extractedTitle = extractedTitle.replace(/[_\~]+/g, ' ');

  // 9b. Format subtitles separated by colon or dash
  // e.g. "The Courage to Be Disliked: How to Change Your Life"
  if (extractedTitle.includes(': ') || extractedTitle.includes(':')) {
    const colonParts = extractedTitle.split(/:\s*/);
    if (colonParts.length >= 2 && colonParts[0].length >= 3) {
      // Retain standard "Title: Subtitle" punctuation
      extractedTitle = `${colonParts[0].trim()}: ${colonParts.slice(1).join(': ').trim()}`;
    }
  }

  // 10. Extract author if formatted with " by "
  if (extractedTitle.toLowerCase().includes(' by ')) {
    const parts = extractedTitle.split(/ by /i);
    extractedTitle = parts[0].trim();
    if (!extractedAuthor) {
      extractedAuthor = parts.slice(1).join(' ').trim();
    }
  }
  // 11. Extract author with " - " or " — "
  else if (extractedTitle.includes(' - ') || extractedTitle.includes(' — ')) {
    const separator = extractedTitle.includes(' — ') ? ' — ' : ' - ';
    const parts = extractedTitle.split(separator);
    if (parts.length >= 2) {
      const partA = parts[0].trim();
      const partB = parts.slice(1).join(' - ').trim();

      if (extractedAuthor) {
        // If author was already known, pick whichever part doesn't equal author
        if (partA.toLowerCase().includes(extractedAuthor.toLowerCase())) {
          extractedTitle = partB;
        } else {
          extractedTitle = partA;
        }
      } else {
        // Disambiguate: Is it Title - Author or Author - Title?
        const aIsTitle = isLikelyTitle(partA);
        const bIsTitle = isLikelyTitle(partB);
        const aIsPerson = isLikelyPersonName(partA);
        const bIsPerson = isLikelyPersonName(partB);

        if (aIsTitle && !bIsTitle) {
          // "Atomic Habits - James Clear" -> Title: Atomic Habits, Author: James Clear
          extractedTitle = partA;
          extractedAuthor = partB;
        } else if (bIsTitle && !aIsTitle) {
          // "James Clear - Atomic Habits" -> Title: Atomic Habits, Author: James Clear
          extractedTitle = partB;
          extractedAuthor = partA;
        } else if (bIsPerson && !aIsPerson) {
          extractedTitle = partA;
          extractedAuthor = partB;
        } else if (aIsPerson && !bIsPerson) {
          extractedTitle = partB;
          extractedAuthor = partA;
        } else {
          // Default convention: Title - Author
          extractedTitle = partA;
          extractedAuthor = partB;
        }
      }
    }
  }
  // 12. Check trailing person name in space-delimited string: e.g. "The Lean Startup Eric Ries"
  else if (!extractedAuthor && extractedTitle.includes(' ')) {
    const words = extractedTitle.trim().split(/\s+/);
    // Only trust the tail as an author when it is not a subtitle ("Peak: From One Million to One Hour")
    const tailStart = words.slice(0, -2).join(' ').length;
    const colonBeforeTail = extractedTitle.lastIndexOf(':');
    if (words.length >= 4 && (colonBeforeTail < 0 || colonBeforeTail >= tailStart)) {
      const lastTwo = words.slice(-2).join(' ');
      if (isLikelyPersonName(lastTwo)) {
        extractedTitle = words.slice(0, -2).join(' ');
        extractedAuthor = lastTwo;
      }
    }
  }

  // 12b. An author carried twice: the row already says "Homer", so "The Odyssey Homer" is one
  // field wearing two hats, and the header reads like a search query.
  if (extractedAuthor && extractedAuthor !== 'Unknown Author') {
    const titleWords = extractedTitle.trim().split(/\s+/);
    const authorWords = extractedAuthor.trim().split(/\s+/);
    if (titleWords.length > authorWords.length) {
      const tail = titleWords.slice(-authorWords.length).join(' ');
      if (tail.toLowerCase() === extractedAuthor.trim().toLowerCase()) {
        extractedTitle = titleWords.slice(0, -authorWords.length).join(' ');
      }
    }
  }

  // 13. Clean punctuation and spaces
  extractedTitle = extractedTitle.replace(/\s+/g, ' ').trim();
  extractedTitle = extractedTitle.replace(/^[-–—:,.\s]+|[-–—:,.\s]+$/g, '').trim();

  // 14. If title ended up empty or purely numbers, try sample content
  if ((!extractedTitle || /^\d+$/.test(extractedTitle) || extractedTitle === 'Untitled Book') && sampleContent) {
    const lines = sampleContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 2 && l.length < 80);

    if (lines.length > 0) {
      extractedTitle = lines[0];
      if (lines.length > 1 && !extractedAuthor) {
        const line2 = lines[1];
        if (line2.toLowerCase().startsWith('by ')) {
          extractedAuthor = line2.slice(3).trim();
        } else if (isLikelyPersonName(line2)) {
          extractedAuthor = line2;
        }
      }
    }
  }

  // Fallback if still empty
  if (!extractedTitle || /^\d+$/.test(extractedTitle)) {
    extractedTitle = rawString.replace(EXTENSION_REGEX, '').replace(/[_\-\.]+/g, ' ').trim() || 'Untitled Book';
  }

  // Format with Title Case
  extractedTitle = toTitleCase(extractedTitle);
  if (extractedAuthor && extractedAuthor !== 'Unknown Author') {
    let autClean = extractedAuthor.replace(/[_\-\.]+/g, ' ').replace(/\s+/g, ' ').trim();
    const autWords = autClean.split(' ');
    // If author has 4 words without separators (e.g., "Ichiro Kishimi Fumitake Koga"), separate with comma
    if (
      autWords.length === 4 &&
      !autClean.includes(',') &&
      !autClean.toLowerCase().includes(' and ') &&
      !autClean.includes('&')
    ) {
      autClean = `${autWords[0]} ${autWords[1]}, ${autWords[2]} ${autWords[3]}`;
    }
    extractedAuthor = toTitleCase(autClean);
  } else {
    extractedAuthor = 'Unknown Author';
  }

  return { title: extractedTitle, author: extractedAuthor };
}

/**
 * Convenience helper to return ONLY the inferred canonical title.
 */
export function inferBookTitle(
  bookOrName?: { title?: string; fileName?: string; author?: string } | string,
  sampleContent?: string
): string {
  if (!bookOrName) return 'Untitled Book';
  return inferBookMetadata(bookOrName, sampleContent).title;
}

/**
 * Convenience helper to return ONLY the inferred author.
 */
export function inferBookAuthor(
  bookOrName?: { title?: string; fileName?: string; author?: string } | string,
  fallbackAuthor?: string,
  sampleContent?: string
): string {
  if (!bookOrName) return fallbackAuthor || 'Unknown Author';
  const meta = inferBookMetadata(bookOrName, sampleContent);
  return meta.author !== 'Unknown Author' ? meta.author : (fallbackAuthor || 'Unknown Author');
}

