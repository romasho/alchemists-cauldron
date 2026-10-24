import type { Difficulty, Recipe } from './types.ts';

function recipe(
  id: number,
  difficulty: Difficulty,
  name: string,
  t: number,
  d: number,
  m: number,
): Recipe {
  return {
    id: String(id),
    difficulty,
    name,
    temperature: { min: t, max: t + 10 },
    density: { min: d, max: d + 10 },
    magicPower: { min: m, max: m + 10 },
  };
}
export const RECIPES: readonly Recipe[] = [
  recipe(1, 'easy', 'Moon Mist', 32, 12, 17),
  recipe(2, 'easy', 'Root Bloom', 2, 24, 15),
  recipe(3, 'easy', 'Frost Steam', 2, 7, 19),
  recipe(4, 'easy', 'Quiet Swirl', -28, 19, 17),
  recipe(5, 'easy', 'Bright Dew', 27, 32, 25),
  recipe(6, 'easy', 'Snow Dust', -16, 28, 29),
  recipe(7, 'medium', 'Acid Spark', 17, 18, 29),
  recipe(8, 'medium', 'Void Ember', 0, 0, 45),
  recipe(9, 'medium', 'Heavy Acid', 0, 29, 25),
  recipe(10, 'medium', 'Frost Acid', -13, 13, 31),
  recipe(11, 'medium', 'Dusty Void', -13, 0, 47),
  recipe(12, 'medium', 'Dragon Void', 25, 1, 55),
  recipe(13, 'medium', 'Rooted Night', -18, 14, 55),
  recipe(14, 'hard', 'Phoenix Pulse', 57, 0, 37),
  recipe(15, 'hard', 'Slime Crown', -5, 45, 3),
  recipe(16, 'hard', 'Void Flame', 25, 0, 60),
  recipe(17, 'hard', 'Acid Bog', 10, 39, 17),
  recipe(18, 'hard', 'Frozen Ash', 27, 0, 39),
  recipe(19, 'hard', 'Triple Eclipse', -20, 19, 60),
  recipe(20, 'hard', 'Ember Soup', 62, 24, 37),
];

export function pickRecipe(
  random: () => number = Math.random,
  difficulty: Difficulty = 'medium',
): Recipe {
  const pool = RECIPES.filter((item) => item.difficulty === difficulty);
  const selected = pool[Math.floor(random() * pool.length)];
  if (!selected) throw new Error('Recipe pool is empty.');
  return selected;
}
