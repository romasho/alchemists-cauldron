import type { Ingredient, Values } from './types.ts';

export interface Reaction {
  id: string;
  name: string;
  isActive: (ingredients: readonly Ingredient[], base: Values) => boolean;
  apply: (values: Values) => Values;
  timeCost?: number;
  losesLife?: boolean;
  clearsCauldron?: boolean;
}
const pair =
  (first: string, second: string) =>
  (items: readonly Ingredient[]): boolean =>
    items.some((item) => item.id === first) &&
    items.some((item) => item.id === second);
export const REACTIONS: readonly Reaction[] = [
  {
    id: 'bubbling',
    name: 'Bubbling',
    isActive: pair('fairy', 'acid'),
    apply: (v) => ({ ...v, magicPower: v.magicPower * 1.5 }),
    timeCost: 10_000,
  },
  {
    id: 'volatile-mix',
    name: 'Volatile Mix',
    isActive: pair('phoenix', 'void'),
    apply: (v) => v,
    losesLife: true,
    clearsCauldron: true,
  },
  {
    id: 'solar-frost',
    name: 'Solar Frost',
    isActive: pair('dragon', 'frost'),
    apply: (v) => ({ ...v, temperature: 0, density: v.density * 1.2 }),
  },
  {
    id: 'rooted-steam',
    name: 'Rooted Steam',
    isActive: pair('mandrake', 'slime'),
    apply: (v) => ({
      ...v,
      density: v.density * 1.25,
      magicPower: v.magicPower * 0.9,
    }),
  },
  {
    id: 'ashen-bloom',
    name: 'Ashen Bloom',
    isActive: pair('phoenix', 'fairy'),
    apply: (v) => ({
      ...v,
      temperature: v.temperature + 10,
      magicPower: v.magicPower * 1.25,
    }),
  },
  {
    id: 'annihilation',
    name: 'Annihilation',
    isActive: (items) =>
      items.some((i) => i.temperature > 15) &&
      items.some((i) => i.temperature < -15),
    apply: (v) => ({ ...v, temperature: 0, density: v.density * 2 }),
  },
  {
    id: 'pressure-spike',
    name: 'Pressure Spike',
    isActive: (_, v) => v.density >= 70,
    apply: (v) => ({ ...v, density: 70, magicPower: v.magicPower * 1.1 }),
  },
  {
    id: 'magma-flux',
    name: 'Magma Flux',
    isActive: (_, v) => v.temperature >= 60,
    apply: (v) => ({
      ...v,
      magicPower: v.magicPower * 1.2,
      density: v.density * 0.9,
    }),
  },
  {
    id: 'deep-freeze',
    name: 'Deep Freeze',
    isActive: (_, v) => v.temperature <= -20,
    apply: (v) => ({
      ...v,
      density: v.density * 1.15,
      magicPower: v.magicPower * 0.85,
    }),
  },
  {
    id: 'arcane-saturation',
    name: 'Arcane Saturation',
    isActive: (_, v) => v.magicPower >= 80,
    apply: (v) => ({ ...v, magicPower: 80, temperature: v.temperature + 5 }),
  },
  {
    id: 'steam-burst',
    name: 'Steam Burst',
    isActive: (items, v) =>
      pair('dragon', 'acid')(items) && v.temperature >= 35,
    apply: (v) => ({ ...v, temperature: v.temperature + 10 }),
    timeCost: 5_000,
  },
  {
    id: 'black-ice',
    name: 'Black Ice',
    isActive: (items, v) => pair('frost', 'void')(items) && v.density <= 0,
    apply: (v) => ({
      ...v,
      temperature: v.temperature - 10,
      magicPower: v.magicPower * 1.2,
    }),
  },
  {
    id: 'heavy-spark',
    name: 'Heavy Spark',
    isActive: (items, v) => pair('fairy', 'slime')(items) && v.density >= 40,
    apply: (v) => ({
      ...v,
      density: v.density * 1.2,
      magicPower: v.magicPower * 1.1,
    }),
  },
  {
    id: 'burning-root',
    name: 'Burning Root',
    isActive: (items, v) =>
      pair('mandrake', 'phoenix')(items) && v.temperature >= 40,
    apply: (v) => ({
      ...v,
      temperature: v.temperature + 15,
      density: v.density * 0.9,
    }),
  },
  {
    id: 'void-resonance',
    name: 'Void Resonance',
    isActive: (items, v) => pair('void', 'dragon')(items) && v.magicPower >= 50,
    apply: (v) => ({
      ...v,
      magicPower: v.magicPower * 1.3,
      temperature: v.temperature - 5,
    }),
  },
];
