import type { Difficulty, Ingredient, Values } from './types.ts';
import { DIFFICULTY_SETTINGS } from './difficulty.ts';

export interface IReaction {
  id: string;
  name: string;
  description: string;
  isActive: (ingredients: readonly Ingredient[]) => boolean;
  apply: (values: Values) => Values;
  secondsLost: number;
  livesLost: number;
  clearsCauldron: boolean;
}

const contains = (
  ingredients: readonly Ingredient[],
  ...ids: string[]
): boolean => ids.every((id) => ingredients.some((item) => item.id === id));

// The order also defines the order of value transformations.
export const REACTIONS: readonly IReaction[] = [
  {
    id: 'bubbling',
    name: 'Bubbling',
    description: 'Fairy Dust + Caustic Acid: magic +50%, lose 10s once.',
    isActive: (items) => contains(items, 'fairy', 'acid'),
    apply: (values) => ({ ...values, magicPower: values.magicPower * 1.5 }),
    secondsLost: 10,
    livesLost: 0,
    clearsCauldron: false,
  },
  {
    id: 'solar-frost',
    name: 'Solar Frost',
    description: 'Dragon Tears + Frost Lotus: temperature 0, density +20%.',
    isActive: (items) => contains(items, 'dragon', 'frost'),
    apply: (values) => ({
      ...values,
      temperature: 0,
      density: values.density * 1.2,
    }),
    secondsLost: 0,
    livesLost: 0,
    clearsCauldron: false,
  },
  {
    id: 'volatile-mix',
    name: 'Volatile Mix',
    description:
      'Phoenix Feather + Essence of the Void: lose 1 life and clear the cauldron.',
    isActive: (items) => contains(items, 'phoenix', 'void'),
    apply: () => ({ temperature: 0, density: 0, magicPower: 0 }),
    secondsLost: 0,
    livesLost: 1,
    clearsCauldron: true,
  },
];

export function getReactions(difficulty: Difficulty): readonly IReaction[] {
  return REACTIONS.slice(0, DIFFICULTY_SETTINGS[difficulty].reactions);
}
