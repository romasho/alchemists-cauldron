import type { Difficulty } from './types.ts';

export interface DifficultySettings {
  shelfSize: number;
  capacity: number;
  time: number;
  lives: number;
  tolerance: number;
  score: number;
  bonus: number;
  reactions: readonly string[];
}
export const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultySettings> = {
  easy: {
    shelfSize: 4,
    capacity: 4,
    time: 180_000,
    lives: 5,
    tolerance: 12,
    score: 100,
    bonus: 15_000,
    reactions: [],
  },
  medium: {
    shelfSize: 6,
    capacity: 4,
    time: 150_000,
    lives: 3,
    tolerance: 8,
    score: 200,
    bonus: 10_000,
    reactions: ['bubbling', 'solar-frost'],
  },
  hard: {
    shelfSize: 8,
    capacity: 5,
    time: 150_000,
    lives: 3,
    tolerance: 5,
    score: 300,
    bonus: 5_000,
    reactions: ['bubbling', 'volatile-mix', 'solar-frost'],
  },
};
export function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}
