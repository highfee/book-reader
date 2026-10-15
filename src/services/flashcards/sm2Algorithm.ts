import { FlashcardReviewRating } from '@/types/book';

export interface SM2Result {
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
  dueDate: string;
}

/**
 * SuperMemo SM-2 Spaced Repetition Algorithm Implementation.
 * Calculates next review interval, updated ease factor, and due date
 * based on user active-recall feedback rating.
 */
export function calculateSM2(
  rating: FlashcardReviewRating,
  prevRepetitions: number = 0,
  prevIntervalDays: number = 0,
  prevEaseFactor: number = 2.5
): SM2Result {
  // Map rating to 0-5 quality score
  let quality = 3;
  switch (rating) {
    case 'again':
      quality = 1; // Complete blackout or fail
      break;
    case 'hard':
      quality = 2; // Correct response with significant hesitation
      break;
    case 'good':
      quality = 4; // Correct response with reasonable effort
      break;
    case 'easy':
      quality = 5; // Instant, effortless recall
      break;
  }

  let repetitions = prevRepetitions;
  let intervalDays = prevIntervalDays;
  let easeFactor = prevEaseFactor;

  if (quality < 3) {
    // Failed: reset repetition streak to 0, schedule for next day (1 day)
    repetitions = 0;
    intervalDays = 1;
  } else {
    // Passed recall
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(prevIntervalDays * easeFactor);
      if (rating === 'easy') {
        // Bonus for effortless recall
        intervalDays = Math.round(intervalDays * 1.3);
      }
    }
    repetitions += 1;
  }

  // Update Ease Factor (EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) {
    easeFactor = 1.3; // Hard floor to prevent card getting stuck
  }

  // Calculate new due date (now + interval in days)
  const now = new Date();
  const due = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    intervalDays,
    repetitions,
    easeFactor: Number(easeFactor.toFixed(2)),
    dueDate: due.toISOString(),
  };
}
