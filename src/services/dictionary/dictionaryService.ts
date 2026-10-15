/**
 * Dictionary Service
 * Provides word definitions, phonetics, part of speech, and literary meanings
 * using the Free Dictionary API with AI fallback for multi-word phrases.
 */

import { GeminiAICompanionService } from '../ai/geminiProxy';

export interface DefinitionMeaning {
  partOfSpeech: string;
  definitions: {
    definition: string;
    example?: string;
    synonyms?: string[];
  }[];
}

export interface WordDefinition {
  word: string;
  phonetic?: string;
  meanings: DefinitionMeaning[];
  source: 'dictionary' | 'ai';
}

const definitionCache = new Map<string, WordDefinition>();

export class DictionaryService {
  /**
   * Look up definition for a word or short phrase.
   */
  static async lookup(term: string, bookTitle?: string, bookContext?: string): Promise<WordDefinition | null> {
    const cleanTerm = term.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’“”]/g, '');
    if (!cleanTerm || cleanTerm.length > 60) return null;

    const cacheKey = cleanTerm.toLowerCase();
    if (definitionCache.has(cacheKey)) {
      return definitionCache.get(cacheKey)!;
    }

    // 1. If it's a single word, try Free Dictionary API first
    const isSingleWord = !cleanTerm.includes(' ');
    if (isSingleWord) {
      try {
        const response = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanTerm.toLowerCase())}`
        );

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            const entry = data[0];
            const phonetic =
              entry.phonetic ||
              (entry.phonetics && entry.phonetics.find((p: any) => p.text)?.text);

            const meanings: DefinitionMeaning[] = (entry.meanings || []).map((m: any) => ({
              partOfSpeech: m.partOfSpeech || 'definition',
              definitions: (m.definitions || []).slice(0, 3).map((d: any) => ({
                definition: d.definition,
                example: d.example,
                synonyms: d.synonyms ? d.synonyms.slice(0, 4) : undefined,
              })),
            }));

            const result: WordDefinition = {
              word: entry.word || cleanTerm,
              phonetic,
              meanings,
              source: 'dictionary',
            };

            definitionCache.set(cacheKey, result);
            return result;
          }
        }
      } catch (err) {
        console.warn('Free Dictionary API fetch failed, falling back to AI:', err);
      }
    }

    // 2. AI Companion definition fallback (for phrases, archaic / literary terms, or offline)
    try {
      const aiPrompt = `Define the word or phrase "${cleanTerm}" clearly for a reader. Provide its part of speech, a concise 1-2 sentence definition, and a sample sentence in literary context. Keep it direct and formatted like a dictionary entry.`;

      const aiResponse = await GeminiAICompanionService.sendChatMessage({
        bookTitle: bookTitle || 'Literature',
        author: 'Author',
        currentPage: 1,
        totalPages: 100,
        extractedContextSoFar: bookContext || cleanTerm,
        userPrompt: aiPrompt,
        history: [],
      });

      const result: WordDefinition = {
        word: cleanTerm,
        meanings: [
          {
            partOfSpeech: isSingleWord ? 'literary term' : 'phrase',
            definitions: [
              {
                definition: aiResponse.trim(),
              },
            ],
          },
        ],
        source: 'ai',
      };

      definitionCache.set(cacheKey, result);
      return result;
    } catch {
      // Offline fallback dictionary
      return {
        word: cleanTerm,
        meanings: [
          {
            partOfSpeech: 'phrase',
            definitions: [
              {
                definition: `A notable expression or passage selected from "${bookTitle || 'the text'}".`,
              },
            ],
          },
        ],
        source: 'dictionary',
      };
    }
  }
}
