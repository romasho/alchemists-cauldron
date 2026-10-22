import { DIFFICULTY_SETTINGS, isDifficulty } from '../data/difficulty.ts';
import { RECIPES } from '../data/recipes.ts';
import { PARAMETERS } from '../logic/brewing.ts';
import { createMenu, getShelf, type GameState } from '../state/game-state.ts';

export const SAVE_KEY = 'alchemists-cauldron-save';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
  );
}

interface SavedGame {
  difficulty: GameState['difficulty'];
  status: 'playing' | 'paused';
  score: number;
  timeLeft: number;
  lives: number;
  activeRecipe: NonNullable<GameState['recipe']>;
  cauldronIngredients: GameState['cauldron'];
  shelfStock: GameState['stock'];
}

export function isValidSave(data: unknown): data is SavedGame {
  if (!isRecord(data) || !isDifficulty(data['difficulty'])) return false;
  const difficulty = data['difficulty'];
  const rules = DIFFICULTY_SETTINGS[difficulty];
  const shelf = getShelf(difficulty);
  const recipe = data['activeRecipe'];
  const stock = data['shelfStock'];
  const cauldron = data['cauldronIngredients'];
  if (
    (data['status'] !== 'playing' && data['status'] !== 'paused') ||
    !isInteger(data['score'], 0, Number.MAX_SAFE_INTEGER) ||
    data['score'] % rules.score !== 0 ||
    !isInteger(data['timeLeft'], 1, rules.time) ||
    !isInteger(data['lives'], 1, rules.lives) ||
    !isRecord(recipe) ||
    !isRecord(stock) ||
    !Array.isArray(cauldron) ||
    cauldron.length > rules.capacity ||
    Object.keys(stock).length !== shelf.length
  )
    return false;
  const canonical = RECIPES.find(
    (item) => item.id === recipe['id'] && item.difficulty === difficulty,
  );
  if (
    !canonical ||
    recipe['name'] !== canonical.name ||
    recipe['difficulty'] !== difficulty ||
    !PARAMETERS.every((key) => {
      const range = recipe[key];
      return (
        isRecord(range) &&
        range['min'] === canonical[key].min &&
        range['max'] === canonical[key].max
      );
    })
  )
    return false;
  if (
    !cauldron.every((item: unknown) => {
      if (!isRecord(item)) return false;
      const ingredient = shelf.find((candidate) => candidate.id === item['id']);
      return (
        ingredient &&
        item['name'] === ingredient.name &&
        item['icon'] === ingredient.icon &&
        PARAMETERS.every((key) => item[key] === ingredient[key])
      );
    })
  )
    return false;
  return (
    shelf.every(
      (item) =>
        isInteger(stock[item.id], 0, 15) &&
        Number(stock[item.id]) +
          cauldron.filter(
            (portion: unknown) =>
              isRecord(portion) && portion['id'] === item.id,
          ).length <=
          15,
    ) &&
    (cauldron.length > 0 ||
      Object.values(stock).some((amount) => Number(amount) > 0))
  );
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* Storage may be blocked. */
  }
}

export function saveGame(state: GameState): boolean {
  if (state.status !== 'playing' && state.status !== 'paused') {
    if (state.status === 'game-over') clearSave();
    return false;
  }
  if (!state.recipe) {
    clearSave();
    return false;
  }
  try {
    const data: SavedGame = {
      difficulty: state.difficulty,
      status: state.status,
      score: state.score,
      timeLeft: state.timeLeft,
      lives: state.lives,
      activeRecipe: state.recipe,
      cauldronIngredients: state.cauldron,
      shelfStock: state.stock,
    };
    if (!isValidSave(data)) {
      clearSave();
      return false;
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw === null) return null;
    const data: unknown = JSON.parse(raw);
    if (!isValidSave(data)) {
      clearSave();
      return null;
    }
    return {
      ...createMenu(data.difficulty),
      status: 'paused',
      score: data.score,
      timeLeft: data.timeLeft,
      lives: data.lives,
      recipe: data.activeRecipe,
      cauldron: data.cauldronIngredients,
      stock: data.shelfStock,
      message: 'Your saved game is ready. Resume when you are.',
    };
  } catch {
    clearSave();
    return null;
  }
}
