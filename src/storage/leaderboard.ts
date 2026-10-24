import type { Difficulty } from '../data/types.ts';
export interface Entry {
  name: string;
  score: number;
  date: number;
}
export const LEADERBOARD_KEY = 'alchemists-cauldron-leaderboard';
export function validName(name: string): boolean {
  return /^[\p{L}\p{N} _-]{2,15}$/u.test(name) && name.trim().length >= 2;
}
function isEntry(value: unknown): value is Entry {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'name' in value &&
    typeof value.name === 'string' &&
    validName(value.name) &&
    'score' in value &&
    typeof value.score === 'number' &&
    Number.isSafeInteger(value.score) &&
    value.score >= 0 &&
    'date' in value &&
    typeof value.date === 'number' &&
    Number.isSafeInteger(value.date) &&
    value.date >= 0 &&
    value.date <= 8.64e15
  );
}
export function rankEntries(entries: readonly Entry[]): Entry[] {
  return [...entries]
    .sort((a, b) => b.score - a.score || a.date - b.date)
    .slice(0, 10);
}
const boardKey = (difficulty: Difficulty): string =>
  difficulty === 'medium'
    ? LEADERBOARD_KEY
    : `${LEADERBOARD_KEY}-${difficulty}`;
export function readLeaderboard(difficulty: Difficulty = 'medium'): Entry[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(boardKey(difficulty)) ?? '[]',
    );
    return Array.isArray(value) ? rankEntries(value.filter(isEntry)) : [];
  } catch {
    return [];
  }
}
export function writeLeaderboard(
  entries: readonly Entry[],
  difficulty: Difficulty = 'medium',
): boolean {
  try {
    localStorage.setItem(
      boardKey(difficulty),
      JSON.stringify(rankEntries(entries)),
    );
    return true;
  } catch {
    return false;
  }
}
export function qualifies(entries: readonly Entry[], score: number): boolean {
  return entries.length < 10 || score > (entries.at(-1)?.score ?? 0);
}
export function recordResult(
  entry: Entry,
  difficulty: Difficulty,
): 'saved' | 'not-qualified' | 'unavailable' {
  const current = readLeaderboard(difficulty);
  if (!qualifies(current, entry.score)) return 'not-qualified';
  return writeLeaderboard([...current, entry], difficulty)
    ? 'saved'
    : 'unavailable';
}
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
