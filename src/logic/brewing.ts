import type { Ingredient, Parameter, Recipe, Values } from '../data/types.ts';

export const PARAMETERS: readonly Parameter[] = [
  'temperature',
  'density',
  'magicPower',
];
export const RULES = {
  shelfSize: 6,
  capacity: 4,
  time: 150_000,
  lives: 3,
  tolerance: 8,
  score: 200,
  bonus: 10_000,
} as const;

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

export function checkBrew(
  ingredients: readonly Ingredient[],
  recipe: Recipe,
): boolean {
  const values = calculateCauldron(ingredients);
  return (
    ingredients.length > 0 &&
    PARAMETERS.every(
      (key) =>
        values[key] >= recipe[key].min - RULES.tolerance &&
        values[key] <= recipe[key].max + RULES.tolerance,
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
