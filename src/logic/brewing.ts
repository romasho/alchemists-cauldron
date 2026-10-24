import { DIFFICULTY_SETTINGS } from '../data/difficulty.ts';
import { REACTIONS } from '../data/reactions.ts';
import type {
  Difficulty,
  Ingredient,
  Parameter,
  Recipe,
  Values,
} from '../data/types.ts';

export const PARAMETERS: readonly Parameter[] = [
  'temperature',
  'density',
  'magicPower',
];
export const RULES = DIFFICULTY_SETTINGS.medium;

export function calculateCauldron(ingredients: readonly Ingredient[]): Values {
  return ingredients.reduce<Values>(
    (total, item) => ({
      temperature: total.temperature + item.temperature,
      density: total.density + item.density,
      magicPower: total.magicPower + item.magicPower,
    }),
    { temperature: 0, density: 0, magicPower: 0 },
  );
}

export function activeReactions(
  ingredients: readonly Ingredient[],
  difficulty: Difficulty,
) {
  const base = calculateCauldron(ingredients);
  return REACTIONS.filter(
    (reaction) =>
      DIFFICULTY_SETTINGS[difficulty].reactions.includes(reaction.id) &&
      reaction.isActive(ingredients, base),
  );
}
export function calculateMixture(
  ingredients: readonly Ingredient[],
  difficulty: Difficulty,
): Values {
  const result = activeReactions(ingredients, difficulty).reduce(
    (values, reaction) => reaction.apply(values),
    calculateCauldron(ingredients),
  );
  return {
    temperature: Math.round(result.temperature * 100) / 100,
    density: Math.round(result.density * 100) / 100,
    magicPower: Math.round(result.magicPower * 100) / 100,
  };
}
export function checkBrew(
  ingredients: readonly Ingredient[],
  recipe: Recipe,
  difficulty: Difficulty = 'medium',
): boolean {
  const values = calculateMixture(ingredients, difficulty);
  const rules = DIFFICULTY_SETTINGS[difficulty];
  return (
    ingredients.length > 0 &&
    PARAMETERS.every(
      (key) =>
        values[key] >= recipe[key].min - rules.tolerance &&
        values[key] <= recipe[key].max + rules.tolerance,
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
