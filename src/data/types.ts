export type Difficulty = 'easy' | 'medium' | 'hard';
export type Parameter = 'temperature' | 'density' | 'magicPower';
export type Values = Record<Parameter, number>;
export interface Ingredient extends Values {
  id: string;
  name: string;
  icon: string;
}
export interface Range {
  min: number;
  max: number;
}
export interface Recipe {
  id: string;
  name: string;
  difficulty: Difficulty;
  temperature: Range;
  density: Range;
  magicPower: Range;
}
