import { DIFFICULTY_SETTINGS, isDifficulty } from '../data/difficulty.ts';
import { RECIPES } from '../data/recipes.ts';
import { createMenu, getShelf } from '../state/game-state.ts';
import type { GameState } from '../state/game-state.ts';

export const SAVE_KEY = 'alchemists-cauldron-save-v1';
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;

export function restoreSave(value: unknown): GameState | null {
  if (!record(value) || !isDifficulty(value['difficulty'])) return null;
  const difficulty = value['difficulty'];
  const rules = DIFFICULTY_SETTINGS[difficulty];
  if (value['status'] !== 'playing' && value['status'] !== 'paused')
    return null;
  if (
    !integer(value['score'], 0, Number.MAX_SAFE_INTEGER) ||
    !integer(value['timeLeft'], 1, rules.time) ||
    !integer(value['lives'], 1, rules.lives)
  )
    return null;
  const recipeValue = value['recipe'];
  if (!record(recipeValue)) return null;
  const recipe = RECIPES.find(
    (item) => item.id === recipeValue['id'] && item.difficulty === difficulty,
  );
  if (!recipe) return null;
  const items = value['cauldron'];
  const stockValue = value['stock'];
  if (
    !Array.isArray(items) ||
    items.length > rules.capacity ||
    !record(stockValue)
  )
    return null;
  const shelf = getShelf(difficulty);
  if (
    Object.keys(stockValue).length !== shelf.length ||
    shelf.some((item) => !integer(stockValue[item.id], 0, 15))
  )
    return null;
  const cauldron = [];
  for (const item of items) {
    if (!record(item)) return null;
    const ingredient = shelf.find((known) => known.id === item['id']);
    if (!ingredient) return null;
    cauldron.push(ingredient);
  }
  const stock: Record<string, number> = {};
  for (const item of shelf) {
    const amount = stockValue[item.id];
    if (
      !integer(amount, 0, 15) ||
      amount + cauldron.filter((added) => added.id === item.id).length > 15
    )
      return null;
    stock[item.id] = amount;
  }
  if (!cauldron.length && Object.values(stock).every((amount) => amount === 0))
    return null;
  return {
    ...createMenu(difficulty),
    score: value['score'],
    timeLeft: value['timeLeft'],
    lives: value['lives'],
    recipe,
    cauldron,
    stock,
    status: 'paused',
    message: 'Saved game restored. Resume when ready.',
  };
}
export function clearSave(): boolean {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}
export function saveGame(state: GameState): boolean {
  if (state.status !== 'playing' && state.status !== 'paused')
    return clearSave();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const result = restoreSave(JSON.parse(raw) as unknown);
    if (!result) clearSave();
    return result;
  } catch {
    clearSave();
    return null;
  }
}
