import type { Difficulty } from './types.ts';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];
export const DIFFICULTY_SETTINGS = {
  easy: {
    label: 'Easy',
    shelfSize: 4,
    capacity: 4,
    time: 180_000,
    lives: 5,
    tolerance: 12,
    score: 100,
    bonus: 15_000,
    reactions: 0,
  },
  medium: {
    label: 'Medium',
    shelfSize: 6,
    capacity: 4,
    time: 150_000,
    lives: 3,
    tolerance: 8,
    score: 200,
    bonus: 10_000,
    reactions: 2,
  },
  hard: {
    label: 'Hard',
    shelfSize: 8,
    capacity: 5,
    time: 150_000,
    lives: 3,
    tolerance: 5,
    score: 300,
    bonus: 5_000,
    reactions: 3,
  },
} as const;

export function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}
