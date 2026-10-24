import { DIFFICULTY_SETTINGS } from '../data/difficulty.ts';
import { INGREDIENTS } from '../data/ingredients.ts';
import { pickRecipe } from '../data/recipes.ts';
import { getReactions } from '../data/reactions.ts';
import type { Difficulty, Ingredient, Recipe } from '../data/types.ts';
import { checkBrew, createStock, formatTime, RULES } from '../logic/brewing.ts';

export interface GameState {
  difficulty: Difficulty;
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
  effect: 'success' | 'failure' | 'reaction' | 'pour' | null;
}
export const SHELF = INGREDIENTS.slice(0, RULES.shelfSize);
export function createMenu(difficulty: Difficulty = 'medium'): GameState {
  return {
    difficulty,
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
    effect: null,
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
    message: 'Choose your ingredients. Find the balance.',
  };
}
export function getShelf(difficulty: Difficulty): readonly Ingredient[] {
  return INGREDIENTS.slice(0, DIFFICULTY_SETTINGS[difficulty].shelfSize);
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
  const before = [...state.cauldron];
  state.cauldron.push(ingredient);
  state.effect = null;
  state.stock[id] = (state.stock[id] ?? 0) - 1;
  state.message =
    state.cauldron.length === DIFFICULTY_SETTINGS[state.difficulty].capacity
      ? 'Cauldron full. Time to brew!'
      : `${ingredient.name} added.`;
  const fired = getReactions(state.difficulty).filter(
    (reaction) =>
      !reaction.isActive(before) && reaction.isActive(state.cauldron),
  );
  for (const reaction of fired) {
    state.endTime -= reaction.secondsLost * 1000;
    state.lives -= reaction.livesLost;
    if (reaction.clearsCauldron) clearCauldron(state);
  }
  if (fired.length) {
    state.message = fired
      .map((reaction) => `${reaction.name}! ${reaction.description}`)
      .join(' ');
    state.effect = fired.some((reaction) => reaction.livesLost > 0)
      ? 'failure'
      : 'reaction';
  }
  updateTime(state, now);
  checkEnd(state);
}
function clearCauldron(state: GameState): void {
  state.cauldron = [];
}
function checkEnd(state: GameState): void {
  if (state.status !== 'playing') return;
  if (state.lives <= 0) finishGame(state, 'No lives left');
  else if (
    !state.cauldron.length &&
    Object.values(state.stock).every((amount) => amount === 0)
  )
    finishGame(state, 'Out of ingredients');
}
export function pourOut(state: GameState, now = Date.now()): void {
  updateTime(state, now);
  if (state.status !== 'playing' || !state.cauldron.length) return;
  clearCauldron(state);
  state.endTime -= 10_000;
  state.effect = 'pour';
  state.message = 'Mixture poured out. −10 seconds. Ingredients are spent.';
  updateTime(state, now);
  checkEnd(state);
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
  if (
    checkBrew(state.cauldron, state.recipe, rules.tolerance, state.difficulty)
  ) {
    state.effect = 'success';
    state.score += rules.score;
    state.timeLeft = Math.min(rules.time, state.timeLeft + rules.bonus);
    state.endTime = now + state.timeLeft;
    state.recipe = pickRecipe(random, state.difficulty);
    state.message = `Potion brewed! +${String(rules.score)} points · +${String(rules.bonus / 1000)} seconds (max ${formatTime(rules.time)}).`;
  } else {
    state.effect = 'failure';
    state.lives -= 1;
    state.message = 'The mixture failed. One life lost. Try again!';
  }
  clearCauldron(state);
  checkEnd(state);
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
