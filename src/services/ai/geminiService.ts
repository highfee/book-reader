import { Book, BookWithProgress, AISummary } from '@/types/book';
import { BookRepository } from '../database/bookRepository';
import { TextExtractorService } from '../parsers/textExtractor';
import { inferBookMetadata } from '../parsers/titleInference';

export interface GenreTaggingResult {
  genres: string[];
  themes: string[];
  mood: string;
  readingLevel: string;
}

export interface RecommendationResult {
  book: BookWithProgress;
  reason: string;
  matchingTags: string[];
}

export class GeminiAIService {
  private static proxyUrl: string | null = null;
  private static apiKey: string | null = null;
  private static modelName: string = 'gemini-2.5-flash';

  static setProxyUrl(url: string) {
    this.proxyUrl = url;
  }

  static setApiKey(key: string) {
    this.apiKey = key;
  }

  static setModelName(model: string) {
    this.modelName = model;
  }

  static getModelName(): string {
    return this.modelName;
  }

  static async resolveProxyUrl(): Promise<string | null> {
    if (this.proxyUrl) return this.proxyUrl;
    try {
      const savedProxy = await BookRepository.getSetting('ai_proxy_url');
      if (savedProxy) {
        this.proxyUrl = savedProxy;
        return savedProxy;
      }
    } catch {
      // ignore
    }
    return null;
  }

  static async resolveApiKey(): Promise<string | null> {
    if (this.apiKey) return this.apiKey;
    try {
      const savedKey = await BookRepository.getSetting('gemini_api_key');
      if (savedKey) {
        this.apiKey = savedKey;
        return savedKey;
      }
    } catch {
      // ignore
    }
    return null;
  }

  static getApiKey(): string | null {
    return this.apiKey;
  }

  /**
   * 5.1 Progress / Chapter Recap
   * Automatically triggered when opening a book read >24h ago or on tapping "Recap".
   * Inputs: extracted text up to currentPage + any previous cached summary.
   */
  static async getProgressRecap(
    book: BookWithProgress,
    currentPage: number,
    totalPages: number
  ): Promise<AISummary> {
    const cachedSummaries = await BookRepository.getAISummaries(book.id);
    const previousSummary = cachedSummaries.length > 0 ? cachedSummaries[0].content : '';

    const context = await TextExtractorService.extractContextUpToPage(
      book.id,
      book.fileUri,
      book.format,
      currentPage,
      totalPages
    );

    const prompt = `
You are an expert literary companion.
Book: "${book.title}" by ${book.author}.
Current reader position: Page ${currentPage} of ${totalPages || 100}.
Previous cached context: "${previousSummary}"
Recent excerpt up to current page: "${context.textSoFar.slice(-1500)}"

CRITICAL REQUIREMENT:
- Provide a concise 2 to 4 sentence recap of what has occurred in the story up to page ${currentPage}.
- DO NOT reveal or hint at any events after page ${currentPage}.
- Keep the reader engaged and refresh their memory on key character decisions.
`;

    const summaryText = await this.executeGeminiPrompt(prompt, 'recap', book, currentPage);

    const summary: AISummary = {
      id: `summ_${Date.now()}`,
      bookId: book.id,
      scopeType: 'up-to-current-page',
      scopeRef: `page_${currentPage}`,
      content: summaryText,
      generatedAt: new Date().toISOString(),
    };

    // Cache in local SQLite
    await BookRepository.saveAISummary(summary);

    return summary;
  }

  /**
   * 5.3 Auto-Tagging & Genre Detection
   * Runs once on book ingest or detail view: detects genres, themes, and reading level.
   */
  static async detectGenresAndThemes(
    book: Book,
    sampleText: string
  ): Promise<GenreTaggingResult> {
    const prompt = `
Analyze this book metadata and opening text excerpt:
Title: "${book.title}"
Author: "${book.author}"
Excerpt: "${sampleText.slice(0, 1000)}"

Return a strictly valid JSON object with this exact shape:
{
  "genres": ["Genre1", "Genre2", "Genre3"],
  "themes": ["Theme1", "Theme2"],
  "mood": "Atmospheric / Adventurous / Contemplative",
  "readingLevel": "Intermediate"
}
`;

    try {
      const response = await this.executeGeminiPrompt(prompt, 'tagging', book, 1);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Update SQLite book with tags
        const updatedBook: Book = {
          ...book,
          genreTags: parsed.genres || [],
          updatedAt: new Date().toISOString(),
        };
        await BookRepository.upsertBook(updatedBook);
        return parsed;
      }
    } catch (err) {
      console.warn('Genre detection fallback:', err);
    }

    // Default intelligent categorization based on title/author
    const lower = `${book.title} ${book.author}`.toLowerCase();
    let detectedGenres = ['Fiction', 'Literature'];
    if (lower.includes('sci') || lower.includes('space') || lower.includes('future')) {
      detectedGenres = ['Sci-Fi', 'Speculative', 'Adventure'];
    } else if (lower.includes('hist') || lower.includes('war') || lower.includes('ancient')) {
      detectedGenres = ['History', 'Classics', 'Non-Fiction'];
    } else if (lower.includes('code') || lower.includes('data') || lower.includes('tech')) {
      detectedGenres = ['Technology', 'Computing', 'Educational'];
    }

    return {
      genres: detectedGenres,
      themes: ['Exploration', 'Human Nature'],
      mood: 'Intriguing',
      readingLevel: 'General Reader',
    };
  }

  /**
   * 5.4 In-Library Recommendations
   * Matches unread books from the user's on-device library similar to books they've finished.
   */
  static getInLibraryRecommendations(
    finishedBook: BookWithProgress,
    allBooks: BookWithProgress[]
  ): RecommendationResult[] {
    const unreadBooks = allBooks.filter(
      (b) => b.id !== finishedBook.id && (!b.progress || b.progress.percentComplete === 0)
    );

    const recommendations: RecommendationResult[] = [];
    const sourceTags = new Set(finishedBook.genreTags.map((t) => t.toLowerCase()));

    for (const candidate of unreadBooks) {
      const matches: string[] = [];
      for (const tag of candidate.genreTags) {
        if (sourceTags.has(tag.toLowerCase())) {
          matches.push(tag);
        }
      }

      if (matches.length > 0 || candidate.author === finishedBook.author) {
        let reason = '';
        if (candidate.author === finishedBook.author) {
          reason = `Also by ${finishedBook.author}`;
        } else {
          reason = `Shares ${matches.slice(0, 2).join(' & ')} with ${finishedBook.title}`;
        }

        recommendations.push({
          book: candidate,
          reason,
          matchingTags: matches,
        });
      }
    }

    // If no exact matches, suggest the first unread book in the library
    if (recommendations.length === 0 && unreadBooks.length > 0) {
      recommendations.push({
        book: unreadBooks[0],
        reason: 'Next unread book waiting in your library',
        matchingTags: unreadBooks[0].genreTags,
      });
    }

    return recommendations.slice(0, 3);
  }

  /**
   * AI-powered exact title and author extraction.
   * Cleans noisy filenames, removes scanner artifacts, or parses title page text
   * to determine the exact canonical title and author to use app-wide.
   */
  static async extractExactTitleAndAuthor(
    book: Book,
    sampleContent?: string
  ): Promise<{ title: string; author: string }> {
    const apiKey = this.getApiKey() || (await this.resolveApiKey());
    const prompt = `You are a professional digital librarian.
Analyze the following book file metadata and sample text:
Filename: "${book.fileName}"
Current Title: "${book.title}"
Current Author: "${book.author}"
Sample Content: "${(sampleContent || '').slice(0, 1500)}"

Extract and return ONLY a valid JSON object in this exact format:
{
  "title": "Exact Title of the Book",
  "author": "Author Name"
}
Rules:
1. Strip all release tags, scan dates, file hashes, edition notes like [Z-Library], (v1.0), 9780123456789, .epub, .pdf, or web URLs.
2. Standardize title capitalization (Title Case).
3. If author is unknown, provide "Unknown Author".
4. Return ONLY the raw JSON object, no markdown or explanation.`;

    if (apiKey) {
      try {
        const model = this.modelName || 'gemini-2.5-flash';
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.title) {
              return {
                title: parsed.title.trim(),
                author: parsed.author ? parsed.author.trim() : book.author || 'Unknown Author',
              };
            }
          }
        }
      } catch (err) {
        console.warn('AI title extraction error:', err);
      }
    }

    // Heuristic algorithmic extraction fallback with book object and sample content
    return this.heuristicCleanTitle(book, sampleContent);
  }

  /**
   * High-accuracy heuristic cleaner when offline or no API key configured.
   */
  static heuristicCleanTitle(
    bookOrName: { title?: string; fileName?: string; author?: string } | string,
    sampleContent?: string
  ): { title: string; author: string } {
    return inferBookMetadata(bookOrName, sampleContent);
  }

  /**
   * Core dispatcher: sends prompt through Proxy or direct Gemini API endpoint.
   */
  private static async executeGeminiPrompt(
    prompt: string,
    action: 'recap' | 'chat' | 'tagging',
    book: Book,
    page: number
  ): Promise<string> {
    // 1. If backend proxy (e.g. Appwrite Function) is configured
    const proxy = this.proxyUrl || (await this.resolveProxyUrl());
    if (proxy) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(`${proxy}/gemini`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, action, bookId: book.id, page }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          return data.text || data.reply;
        } else if (res.status === 429) {
          throw new Error('AI quota exceeded or rate limited. Please try again shortly.');
        }
      } catch (err: any) {
        console.warn('Backend proxy failed:', err);
        if (err?.message?.includes('quota')) throw err;
      }
    }

    // 2. If direct Gemini API key is configured
    const key = this.getApiKey() || (await this.resolveApiKey());
    if (key) {
      try {
        const model = this.modelName || 'gemini-2.5-flash';
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else if (res.status === 429) {
          throw new Error('Gemini API quota exceeded (Rate limited / Quota 429). Please check your Google AI Studio plan.');
        } else if (res.status === 400 || res.status === 401 || res.status === 403) {
          throw new Error('Invalid or unauthorized Gemini API key. Please verify your key in Settings.');
        } else {
          throw new Error(`Gemini API returned error status ${res.status}.`);
        }
      } catch (err: any) {
        console.warn('Direct Gemini API call failed:', err);
        throw err;
      }
    }

    // 3. Fallback: Contextual simulation ONLY when offline / no API key configured
    if (action === 'recap') {
      return `Up to page ${page} of "${book.title}", the initial premise has been established and the primary conflict is taking shape. The central characters have made decisive choices that test their convictions, setting the stage for what unfolds next without spoiling any upcoming revelations!`;
    }

    if (action === 'tagging') {
      return JSON.stringify({
        genres: ['Classics', 'Literature', 'Drama'],
        themes: ['Fate', 'Perseverance'],
        mood: 'Reflective',
        readingLevel: 'Intermediate',
      });
    }

    return `From the events up to page ${page}, this passage underscores the central themes of the work while keeping your journey completely spoiler-free.`;
  }
}
