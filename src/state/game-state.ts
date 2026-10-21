import { INGREDIENTS } from '../data/ingredients.ts';
import { pickRecipe } from '../data/recipes.ts';
import type { Ingredient, Recipe } from '../data/types.ts';
import { checkBrew, createStock, RULES } from '../logic/brewing.ts';

export interface GameState {
  status: 'menu' | 'playing' | 'paused' | 'game-over';
  score: number;
  timeLeft: number;
  endTime: number;
  lives: number;
  recipe: Recipe | null;
  cauldron: Ingredient[];
  stock: Record<string, number>;
  reason: string;
  message: string;
}
export const SHELF = INGREDIENTS.slice(0, RULES.shelfSize);
export function createMenu(): GameState {
  return {
    status: 'menu',
    score: 0,
    timeLeft: 0,
    endTime: 0,
    lives: 0,
    recipe: null,
    cauldron: [],
    stock: {},
    reason: '',
    message: 'Your next discovery starts with a single drop.',
  };
}
export function startGame(
  now = Date.now(),
  random: () => number = Math.random,
): GameState {
  return {
    ...createMenu(),
    status: 'playing',
    timeLeft: RULES.time,
    endTime: now + RULES.time,
    lives: RULES.lives,
    recipe: pickRecipe(random),
    stock: createStock(SHELF, random),
    message: 'Choose your ingredients. Find the balance.',
  };
}
export function updateTime(state: GameState, now = Date.now()): void {
  if (state.status !== 'playing') return;
  state.timeLeft = Math.max(0, state.endTime - now);
  if (state.timeLeft === 0) finishGame(state, 'Time is up');
}
function finishGame(state: GameState, reason: string): void {
  state.status = 'game-over';
  state.reason = reason;
}
export function addIngredient(
  state: GameState,
  id: string,
  now = Date.now(),
): void {
  updateTime(state, now);
  if (
    state.status !== 'playing' ||
    state.cauldron.length >= RULES.capacity ||
    (state.stock[id] ?? 0) <= 0
  )
    return;
  const ingredient = SHELF.find((item) => item.id === id);
  if (!ingredient) return;
  state.cauldron.push(ingredient);
  state.stock[id] = (state.stock[id] ?? 0) - 1;
  state.message =
    state.cauldron.length === RULES.capacity
      ? 'Cauldron full. Time to brew!'
      : `${ingredient.name} added.`;
}
export function brew(
  state: GameState,
  now = Date.now(),
  random: () => number = Math.random,
): void {
  updateTime(state, now);
  if (state.status !== 'playing' || !state.cauldron.length || !state.recipe)
    return;
  if (checkBrew(state.cauldron, state.recipe)) {
    state.score += RULES.score;
    state.timeLeft = Math.min(RULES.time, state.timeLeft + RULES.bonus);
    state.endTime = now + state.timeLeft;
    state.recipe = pickRecipe(random);
    state.message = 'Potion brewed! +200 points · +10 seconds (max 02:30).';
  } else {
    state.lives -= 1;
    state.message = 'The mixture failed. One life lost. Try again!';
  }
  state.cauldron = [];
  if (state.lives === 0) finishGame(state, 'No lives left');
  else if (Object.values(state.stock).every((amount) => amount === 0))
    finishGame(state, 'Out of ingredients');
}
export function pauseGame(state: GameState, now = Date.now()): void {
  updateTime(state, now);
  if (state.status === 'playing') state.status = 'paused';
}
export function resumeGame(state: GameState, now = Date.now()): void {
  if (state.status !== 'paused') return;
  state.endTime = now + state.timeLeft;
  state.status = 'playing';
}
