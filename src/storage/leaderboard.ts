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
export function readLeaderboard(): Entry[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(LEADERBOARD_KEY) ?? '[]',
    );
    return Array.isArray(value) ? rankEntries(value.filter(isEntry)) : [];
  } catch {
    return [];
  }
}
export function writeLeaderboard(entries: readonly Entry[]): boolean {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(rankEntries(entries)));
    return true;
  } catch {
    return false;
  }
}
export function qualifies(entries: readonly Entry[], score: number): boolean {
  return entries.length < 10 || score > (entries.at(-1)?.score ?? 0);
}
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
