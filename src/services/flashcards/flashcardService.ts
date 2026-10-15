import { DatabaseService } from '@/services/database/db';
import { BookRepository } from '@/services/database/bookRepository';
import { Flashcard, FlashcardReviewRating } from '@/types/book';
import { calculateSM2 } from './sm2Algorithm';

export class FlashcardService {
  /**
   * Fetch all flashcards, optionally filtered by book.
   */
  static async getFlashcards(bookId?: string): Promise<Flashcard[]> {
    const db = await DatabaseService.getDatabase();
    let query = `SELECT * FROM flashcards`;
    const params: any[] = [];

    if (bookId) {
      query += ` WHERE book_id = ?`;
      params.push(bookId);
    }

    query += ` ORDER BY due_date ASC`;

    const rows = await db.getAllAsync<any>(query, ...params).catch(() => []);
    return rows.map((r: any) => ({
      id: r.id,
      bookId: r.book_id || r.bookId,
      bookTitle: r.book_title || r.bookTitle || undefined,
      noteId: r.note_id || r.noteId || undefined,
      front: r.front,
      back: r.back,
      context: r.context || undefined,
      intervalDays: r.interval_days ?? r.intervalDays ?? 0,
      easeFactor: r.ease_factor ?? r.easeFactor ?? 2.5,
      repetitions: r.repetitions ?? 0,
      dueDate: r.due_date || r.dueDate,
      lastReviewedAt: r.last_reviewed_at || r.lastReviewedAt || undefined,
      createdAt: r.created_at || r.createdAt,
    }));
  }

  /**
   * Fetch flashcards that are due for review (dueDate <= now).
   */
  static async getDueFlashcards(bookId?: string): Promise<Flashcard[]> {
    const nowIso = new Date().toISOString();
    const all = await this.getFlashcards(bookId);
    return all.filter((c) => c.dueDate <= nowIso);
  }

  /**
   * Create a new flashcard with initial SM-2 state.
   */
  static async createFlashcard(data: {
    bookId: string;
    bookTitle?: string;
    noteId?: string;
    front: string;
    back: string;
    context?: string;
  }): Promise<Flashcard> {
    const db = await DatabaseService.getDatabase();
    const id = `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const card: Flashcard = {
      id,
      bookId: data.bookId,
      bookTitle: data.bookTitle,
      noteId: data.noteId,
      front: data.front.trim(),
      back: data.back.trim(),
      context: data.context?.trim(),
      intervalDays: 0,
      easeFactor: 2.5,
      repetitions: 0,
      dueDate: now, // immediately available for first study
      createdAt: now,
    };

    await db.runAsync(
      `INSERT INTO flashcards (
        id, book_id, book_title, note_id, front, back, context,
        interval_days, ease_factor, repetitions, due_date, last_reviewed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        card.id,
        card.bookId,
        card.bookTitle || null,
        card.noteId || null,
        card.front,
        card.back,
        card.context || null,
        card.intervalDays,
        card.easeFactor,
        card.repetitions,
        card.dueDate,
        null,
        card.createdAt,
      ]
    );

    return card;
  }

  /**
   * Record a review rating for a flashcard using the SuperMemo SM-2 algorithm.
   */
  static async recordReview(cardId: string, rating: FlashcardReviewRating): Promise<Flashcard | null> {
    const db = await DatabaseService.getDatabase();
    const cards = await this.getFlashcards();
    const current = cards.find((c) => c.id === cardId);
    if (!current) return null;

    const sm2Result = calculateSM2(
      rating,
      current.repetitions,
      current.intervalDays,
      current.easeFactor
    );

    const now = new Date().toISOString();

    await db.runAsync(
      `UPDATE flashcards SET
        interval_days = ?,
        ease_factor = ?,
        repetitions = ?,
        due_date = ?,
        last_reviewed_at = ?
      WHERE id = ?`,
      [
        sm2Result.intervalDays,
        sm2Result.easeFactor,
        sm2Result.repetitions,
        sm2Result.dueDate,
        now,
        cardId,
      ]
    );

    return {
      ...current,
      intervalDays: sm2Result.intervalDays,
      easeFactor: sm2Result.easeFactor,
      repetitions: sm2Result.repetitions,
      dueDate: sm2Result.dueDate,
      lastReviewedAt: now,
    };
  }

  /**
   * Delete a flashcard by ID.
   */
  static async deleteFlashcard(cardId: string): Promise<void> {
    const db = await DatabaseService.getDatabase();
    await db.runAsync(`DELETE FROM flashcards WHERE id = ?`, [cardId]);
  }

  /**
   * Auto-generate flashcards for a book from its notes, quotes, and highlights.
   */
  static async generateFlashcardsFromNotes(bookId: string): Promise<Flashcard[]> {
    const [book, notes] = await Promise.all([
      BookRepository.getBookById(bookId),
      BookRepository.getNotesForBook(bookId),
    ]);

    if (!book) return [];

    const existingCards = await this.getFlashcards(bookId);
    const existingFronts = new Set(existingCards.map((c) => c.front.toLowerCase()));
    const created: Flashcard[] = [];

    // 1. Generate active recall cards from highlights & annotations
    for (const n of notes) {
      const excerpt = n.text.trim();
      const annotation = n.note ? n.note.trim() : '';

      if (excerpt.length > 5) {
        let front = '';
        let back = '';

        if (annotation.length > 0) {
          front = `What key concept or reflection does this passage convey?\n\n"${excerpt}"`;
          back = annotation;
        } else {
          // Cloze-style or comprehension question
          front = `Recall the context and meaning of this excerpt from "${book.title}":\n\n"${excerpt}"`;
          back = `Excerpt from Page ${n.pageNumber || 1} in "${book.title}". A memorable passage highlighting the central narrative theme.`;
        }

        if (!existingFronts.has(front.toLowerCase())) {
          const card = await this.createFlashcard({
            bookId,
            bookTitle: book.title,
            noteId: n.id,
            front,
            back,
            context: `Page ${n.pageNumber || 1} • Highlight`,
          });
          created.push(card);
          existingFronts.add(front.toLowerCase());
        }
      }
    }

    // 2. If no notes exist yet, generate foundational comprehension cards for the book
    if (created.length === 0 && existingCards.length === 0) {
      const defaultCards = [
        {
          front: `What is the central theme of "${book.title}" by ${book.author}?`,
          back: `The narrative explores overarching philosophical and human struggles, navigating identity, choices, and destiny through the journey of its protagonists.`,
          context: 'Core Theme',
        },
        {
          front: `Who is the primary protagonist in "${book.title}"?`,
          back: `The central character whose personal convictions and choices drive the story forward across each chapter.`,
          context: 'Character Profile',
        },
      ];

      for (const dc of defaultCards) {
        const card = await this.createFlashcard({
          bookId,
          bookTitle: book.title,
          front: dc.front,
          back: dc.back,
          context: dc.context,
        });
        created.push(card);
      }
    }

    return created;
  }
}
