import { INGREDIENTS } from '../data/ingredients.ts';
import { pickRecipe } from '../data/recipes.ts';
import { DIFFICULTY_SETTINGS } from '../data/difficulty.ts';
import type { Difficulty, Ingredient, Recipe } from '../data/types.ts';
import {
  activeReactions,
  checkBrew,
  createStock,
  formatTime,
  RULES,
} from '../logic/brewing.ts';

export interface GameState {
  difficulty: Difficulty;
  lastReactionId: string | null;
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
export const getShelf = (difficulty: Difficulty): readonly Ingredient[] =>
  INGREDIENTS.slice(0, DIFFICULTY_SETTINGS[difficulty].shelfSize);
export function createMenu(difficulty: Difficulty = 'medium'): GameState {
  return {
    difficulty,
    lastReactionId: null,
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
  difficulty: Difficulty = 'medium',
): GameState {
  const rules = DIFFICULTY_SETTINGS[difficulty];
  return {
    ...createMenu(difficulty),
    status: 'playing',
    timeLeft: rules.time,
    endTime: now + rules.time,
    lives: rules.lives,
    recipe: pickRecipe(random, difficulty),
    stock: createStock(getShelf(difficulty), random),
    message: '',
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
    state.cauldron.length >= DIFFICULTY_SETTINGS[state.difficulty].capacity ||
    (state.stock[id] ?? 0) <= 0
  )
    return;
  const ingredient = getShelf(state.difficulty).find((item) => item.id === id);
  if (!ingredient) return;
  const before = activeReactions(state.cauldron, state.difficulty).map(
    (item) => item.id,
  );
  state.cauldron.push(ingredient);
  state.stock[id] = (state.stock[id] ?? 0) - 1;
  state.message =
    state.cauldron.length === DIFFICULTY_SETTINGS[state.difficulty].capacity
      ? 'Cauldron full. Time to brew!'
      : `${ingredient.name} added.`;
  const fired = activeReactions(state.cauldron, state.difficulty).filter(
    (item) => !before.includes(item.id),
  );
  state.lastReactionId = fired.at(-1)?.id ?? null;
  for (const reaction of fired) {
    if (reaction.timeCost) {
      state.timeLeft = Math.max(0, state.timeLeft - reaction.timeCost);
      state.endTime = now + state.timeLeft;
    }
    if (reaction.losesLife) state.lives -= 1;
    if (reaction.clearsCauldron) state.cauldron = [];
  }
  if (fired.length)
    state.message = `Reaction: ${fired.map((item) => item.name).join(' + ')}${fired.some((item) => item.losesLife) ? '. One life lost; cauldron cleared.' : fired.some((item) => item.timeCost) ? '. Time penalty applied once.' : '.'}`;
  finishIfNeeded(state);
}
export function brew(
  state: GameState,
  now = Date.now(),
  random: () => number = Math.random,
): void {
  updateTime(state, now);
  if (state.status !== 'playing' || !state.cauldron.length || !state.recipe)
    return;
  const rules = DIFFICULTY_SETTINGS[state.difficulty];
  if (checkBrew(state.cauldron, state.recipe, state.difficulty)) {
    state.score += rules.score;
    state.timeLeft = Math.min(rules.time, state.timeLeft + rules.bonus);
    state.endTime = now + state.timeLeft;
    state.recipe = pickRecipe(random, state.difficulty);
    state.message = `Potion brewed! +${String(rules.score)} points · +${String(rules.bonus / 1000)} seconds (max ${formatTime(rules.time)}).`;
  } else {
    state.lives -= 1;
    state.message = 'The mixture failed. One life lost. Try again!';
  }
  state.cauldron = [];
  state.lastReactionId = null;
  finishIfNeeded(state);
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

function finishIfNeeded(state: GameState): void {
  if (state.timeLeft <= 0) finishGame(state, 'Time is up');
  else if (state.lives <= 0) finishGame(state, 'No lives left');
  else if (
    !state.cauldron.length &&
    Object.values(state.stock).every((amount) => amount === 0)
  )
    finishGame(state, 'Out of ingredients');
}
export function pourOut(state: GameState, now = Date.now()): void {
  updateTime(state, now);
  if (state.status !== 'playing' || !state.cauldron.length) return;
  state.cauldron = [];
  state.lastReactionId = null;
  state.timeLeft = Math.max(0, state.timeLeft - 10_000);
  state.endTime = now + state.timeLeft;
  state.message = 'Cauldron poured out. −10 seconds; ingredients remain spent.';
  finishIfNeeded(state);
}
