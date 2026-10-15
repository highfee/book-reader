import { BookWithProgress } from '@/types/book';
import { inferBookTitle, inferBookAuthor } from '../parsers/titleInference';

export type RecommendationParameter =
  | 'for_you'
  | 'quick_reads'
  | 'unread_gems'
  | 'same_author'
  | 'deep_dives'
  | 'classics';

export interface LibraryRecommendation {
  book: BookWithProgress;
  reason: string;
  badge: string;
  parameter: RecommendationParameter;
}

export interface ParameterOption {
  id: RecommendationParameter;
  label: string;
  iconName: string;
  description: string;
}

export const RECOMMENDATION_PARAMETERS: ParameterOption[] = [
  {
    id: 'for_you',
    label: '✨ For You',
    iconName: 'sparkles',
    description: 'Blended from your reading history & preferences',
  },
  {
    id: 'quick_reads',
    label: '⚡ Quick Reads',
    iconName: 'zap',
    description: 'Books under 160 pages for rapid completion',
  },
  {
    id: 'unread_gems',
    label: '📖 Unread Gems',
    iconName: 'book-open',
    description: 'Untouched books waiting in your library',
  },
  {
    id: 'same_author',
    label: '✍️ Same Author',
    iconName: 'feather',
    description: 'More works from authors you have read',
  },
  {
    id: 'deep_dives',
    label: '📚 Deep Dives',
    iconName: 'layers',
    description: 'Comprehensive epics & extensive works',
  },
  {
    id: 'classics',
    label: '🏛️ Classics',
    iconName: 'landmark',
    description: 'Time-tested literary classics & philosophy',
  },
];

export class RecommendationEngine {
  /**
   * Generates smart recommendations from the user's local library based on the selected parameter.
   */
  static getRecommendations(
    allBooks: BookWithProgress[],
    parameter: RecommendationParameter = 'for_you',
    limit: number = 6
  ): LibraryRecommendation[] {
    if (!allBooks || allBooks.length === 0) return [];

    // Ensure all books have clean inferred title and author
    const normalizedBooks = allBooks.map((b) => ({
      ...b,
      title: inferBookTitle({ title: b.title, fileName: b.fileName }),
      author: inferBookAuthor({ title: b.title, fileName: b.fileName, author: b.author }),
    }));

    // Find books the user has engaged with (progress > 0 or finished)
    const engagedBooks = normalizedBooks.filter(
      (b) => (b.progress?.percentComplete ?? 0) > 0
    );

    const unreadBooks = normalizedBooks.filter(
      (b) => (b.progress?.percentComplete ?? 0) === 0
    );

    // Collect engaged authors & tags
    const engagedAuthors = new Set(
      engagedBooks.map((b) => b.author.toLowerCase()).filter((a) => a !== 'unknown author')
    );

    const engagedTags = new Set(
      engagedBooks.flatMap((b) => b.genreTags?.map((t) => t.toLowerCase()) || [])
    );

    switch (parameter) {
      case 'quick_reads': {
        // Books with lowest total pages (or under 160 pages)
        const candidates = [...normalizedBooks]
          .filter((b) => (b.progress?.percentComplete ?? 0) < 100)
          .sort((a, b) => {
            const pagesA = a.totalPages > 0 ? a.totalPages : 120;
            const pagesB = b.totalPages > 0 ? b.totalPages : 120;
            return pagesA - pagesB;
          });

        return candidates.slice(0, limit).map((b) => ({
          book: b,
          reason: b.totalPages > 0
            ? `${b.totalPages} pages • Perfect for an afternoon reading session`
            : 'Fast & focused reading length',
          badge: '⚡ Quick Read',
          parameter,
        }));
      }

      case 'unread_gems': {
        const pool = unreadBooks.length > 0 ? unreadBooks : normalizedBooks;
        return pool.slice(0, limit).map((b) => ({
          book: b,
          reason: 'Waiting unread in your library • 0% started',
          badge: '📖 Unread Gem',
          parameter,
        }));
      }

      case 'same_author': {
        const matches: LibraryRecommendation[] = [];
        for (const candidate of normalizedBooks) {
          if (engagedAuthors.has(candidate.author.toLowerCase())) {
            const prior = engagedBooks.find(
              (eb) => eb.author.toLowerCase() === candidate.author.toLowerCase() && eb.id !== candidate.id
            );
            if (prior) {
              matches.push({
                book: candidate,
                reason: `By ${candidate.author} • You also read "${prior.title}"`,
                badge: '✍️ Same Author',
                parameter,
              });
            }
          }
        }

        if (matches.length > 0) {
          return matches.slice(0, limit);
        }

        // Fallback: suggest by author with multiple books in library
        const authorCounts: Record<string, BookWithProgress[]> = {};
        for (const b of normalizedBooks) {
          if (b.author && b.author !== 'Unknown Author') {
            authorCounts[b.author] = authorCounts[b.author] || [];
            authorCounts[b.author].push(b);
          }
        }
        for (const [author, bList] of Object.entries(authorCounts)) {
          if (bList.length >= 2) {
            for (const b of bList) {
              matches.push({
                book: b,
                reason: `Part of ${bList.length} books by ${author} in your library`,
                badge: '✍️ Author Series',
                parameter,
              });
            }
          }
        }
        return matches.length > 0 ? matches.slice(0, limit) : this.getRecommendations(allBooks, 'for_you', limit);
      }

      case 'deep_dives': {
        const candidates = [...normalizedBooks]
          .sort((a, b) => (b.totalPages || 150) - (a.totalPages || 150));
        return candidates.slice(0, limit).map((b) => ({
          book: b,
          reason: b.totalPages > 200
            ? `${b.totalPages} pages • Expansive epic for deep focus`
            : 'Substantial literary work with intricate depth',
          badge: '📚 Deep Dive',
          parameter,
        }));
      }

      case 'classics': {
        const classicCandidates = normalizedBooks.filter((b) => {
          const tags = (b.genreTags || []).map((t) => t.toLowerCase());
          return (
            tags.some((t) =>
              t.includes('classic') ||
              t.includes('philosophy') ||
              t.includes('mythology') ||
              t.includes('epic') ||
              t.includes('literature') ||
              t.includes('history')
            ) ||
            b.title.toLowerCase().includes('odyssey') ||
            b.title.toLowerCase().includes('frankenstein') ||
            b.title.toLowerCase().includes('pride and prejudice')
          );
        });

        const pool = classicCandidates.length > 0 ? classicCandidates : normalizedBooks;
        return pool.slice(0, limit).map((b) => ({
          book: b,
          reason: 'Timeless masterpiece of classical literature',
          badge: '🏛️ Classic',
          parameter,
        }));
      }

      case 'for_you':
      default: {
        // High-relevance hybrid scoring
        const scored = normalizedBooks.map((candidate) => {
          let score = 0;
          let reasons: string[] = [];

          const pct = candidate.progress?.percentComplete ?? 0;
          if (pct === 0) {
            score += 15; // prioritize discovering unread
          } else if (pct > 0 && pct < 100) {
            score += 10; // in progress
          }

          // Author affinity
          if (engagedAuthors.has(candidate.author.toLowerCase())) {
            score += 30;
            reasons.push(`from ${candidate.author}`);
          }

          // Genre affinity
          const candidateTags = (candidate.genreTags || []).map((t) => t.toLowerCase());
          let sharedTags = 0;
          for (const t of candidateTags) {
            if (engagedTags.has(t)) {
              sharedTags++;
            }
          }
          if (sharedTags > 0) {
            score += sharedTags * 20;
            reasons.push(`matches your interests`);
          }

          const primaryReason =
            reasons.length > 0
              ? `Recommended because it ${reasons.join(' & ')}`
              : candidate.progress && candidate.progress.percentComplete > 0
              ? `Continue reading • ${candidate.progress.percentComplete}% complete`
              : 'Handpicked from your library for your next journey';

          return {
            book: candidate,
            score,
            reason: primaryReason,
            badge: sharedTags > 0 ? '✨ High Affinity' : '✨ Recommended',
            parameter: 'for_you' as RecommendationParameter,
          };
        });

        // Sort descending by score
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, limit);
      }
    }
  }
}
