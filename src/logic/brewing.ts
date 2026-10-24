import { DIFFICULTY_SETTINGS } from '../data/difficulty.ts';
import { getReactions } from '../data/reactions.ts';
import type { Difficulty } from '../data/types.ts';
import type { Ingredient, Parameter, Recipe, Values } from '../data/types.ts';

export const PARAMETERS: readonly Parameter[] = [
  'temperature',
  'density',
  'magicPower',
];
export const RULES = DIFFICULTY_SETTINGS.medium;

export function calculateCauldron(
  ingredients: readonly Ingredient[],
  difficulty: Difficulty = 'easy',
): Values {
  const base = ingredients.reduce<Values>(
    (total, item) => ({
      temperature: total.temperature + item.temperature,
      density: total.density + item.density,
      magicPower: total.magicPower + item.magicPower,
    }),
    { temperature: 0, density: 0, magicPower: 0 },
  );
  return getReactions(difficulty).reduce(
    (values, reaction) =>
      reaction.isActive(ingredients) ? reaction.apply(values) : values,
    base,
  );
}

export function checkBrew(
  ingredients: readonly Ingredient[],
  recipe: Recipe,
  tolerance: number = RULES.tolerance,
  difficulty: Difficulty = 'easy',
): boolean {
  const values = calculateCauldron(ingredients, difficulty);
  return (
    ingredients.length > 0 &&
    PARAMETERS.every(
      (key) =>
        values[key] >= recipe[key].min - tolerance &&
        values[key] <= recipe[key].max + tolerance,
    )
  );
}

export function createStock(
  ingredients: readonly Ingredient[],
  random: () => number = Math.random,
): Record<string, number> {
  return Object.fromEntries(
    ingredients.map((item) => [item.id, Math.floor(random() * 14) + 2]),
  );
}

export function formatTime(milliseconds: number): string {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
