import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INGREDIENTS } from '../src/data/ingredients.ts';
import { RECIPES } from '../src/data/recipes.ts';
import {
  calculateCauldron,
  checkBrew,
  createStock,
  RULES,
} from '../src/logic/brewing.ts';
import {
  addIngredient,
  brew,
  pauseGame,
  resumeGame,
  SHELF,
  startGame,
  updateTime,
} from '../src/state/game-state.ts';
import {
  LEADERBOARD_KEY,
  qualifies,
  rankEntries,
  readLeaderboard,
  validName,
  writeLeaderboard,
} from '../src/storage/leaderboard.ts';

void test('catalogue, recipe pool, signed sums and stock bounds', () => {
  assert.equal(INGREDIENTS.length, 8);
  assert.equal(RECIPES.length, 20);
  assert.equal(
    RECIPES.filter((item) => item.difficulty === 'medium').length,
    7,
  );
  assert.deepEqual(calculateCauldron(SHELF.slice(2, 4)), {
    temperature: -23,
    density: 24,
    magicPower: 22,
  });
  assert.ok(
    Object.values(createStock(SHELF, () => 0)).every((stock) => stock === 2),
  );
  assert.ok(
    Object.values(createStock(SHELF, () => 0.999)).every(
      (stock) => stock === 15,
    ),
  );
});
void test('capacity, ordered additions, depletion and invalid ids are guarded', () => {
  const state = startGame(1000, () => 0);
  [
    'dragon',
    'dragon',
    'dragon',
    'missing',
    'fairy',
    'frost',
    'mandrake',
  ].forEach((id) => {
    addIngredient(state, id, 1000);
  });
  assert.deepEqual(
    state.cauldron.map((item) => item.id),
    ['dragon', 'dragon', 'fairy', 'frost'],
  );
  assert.equal(state.stock['dragon'], 0);
  assert.equal(state.stock['mandrake'], 2);
});
void test('successful brew spends stock, scores and caps time; empty brew does nothing', () => {
  const state = startGame(1000, () => 0);
  addIngredient(state, 'fairy', 1000);
  addIngredient(state, 'acid', 1000);
  assert.ok(state.recipe);
  assert.equal(checkBrew(state.cauldron, state.recipe), true);
  brew(state, 2000, () => 0.5);
  assert.equal(state.score, 200);
  assert.equal(state.timeLeft, RULES.time);
  assert.equal(state.stock['fairy'], 1);
  assert.equal(state.stock['acid'], 1);
  assert.equal(state.cauldron.length, 0);
  brew(state, 2000);
  assert.equal(state.score, 200);
});
void test('tolerance includes both boundaries and rejects a value outside', () => {
  const item = INGREDIENTS[0];
  const recipe = RECIPES[0];
  assert.ok(item);
  assert.ok(recipe);
  const atEdge = {
    ...item,
    temperature: recipe.temperature.min - 8,
    density: recipe.density.max + 8,
    magicPower: recipe.magicPower.min,
  };
  assert.ok(checkBrew([atEdge], recipe));
  assert.equal(
    checkBrew([{ ...atEdge, temperature: atEdge.temperature - 1 }], recipe),
    false,
  );
});
void test('failure loses a life, retains recipe and ends at zero lives', () => {
  const state = startGame(0, () => 0.5);
  const recipe = state.recipe;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    addIngredient(state, 'void', 0);
    brew(state, 0);
  }
  assert.equal(state.lives, 0);
  assert.equal(state.reason, 'No lives left');
  assert.equal(state.recipe, recipe);
  assert.equal(state.status, 'game-over');
  addIngredient(state, 'dragon', 0);
  assert.equal(state.cauldron.length, 0);
});
void test('pause freezes remaining time and gameplay; resume uses a fresh deadline', () => {
  const state = startGame(1000);
  pauseGame(state, 3000);
  updateTime(state, 100_000);
  addIngredient(state, 'dragon', 100_000);
  assert.equal(state.timeLeft, 148_000);
  assert.equal(state.cauldron.length, 0);
  resumeGame(state, 100_000);
  updateTime(state, 101_000);
  assert.equal(state.timeLeft, 147_000);
  updateTime(state, 500_000);
  assert.equal(state.reason, 'Time is up');
});
void test('last portion can be brewed before out of ingredients; late actions cannot beat timeout', () => {
  const state = startGame(0, () => 0);
  state.stock = Object.fromEntries(SHELF.map((item) => [item.id, 0]));
  state.stock['dragon'] = 1;
  addIngredient(state, 'dragon', 0);
  assert.equal(state.status, 'playing');
  brew(state, 0);
  assert.equal(state.reason, 'Out of ingredients');
  const expired = startGame(0);
  addIngredient(expired, 'fairy', RULES.time);
  assert.equal(expired.status, 'game-over');
  assert.equal(expired.cauldron.length, 0);
});
void test('leaderboard sorts ties by time, limits to ten and validates names', () => {
  const entries = rankEntries(
    Array.from({ length: 12 }, (_, index) => ({
      name: 'Alchemist',
      score: 200,
      date: 100 - index,
    })),
  );
  assert.equal(entries.length, 10);
  assert.equal(entries[0]?.date, 89);
  assert.equal(qualifies(entries, 200), false);
  assert.equal(qualifies(entries, 400), true);
  assert.ok(validName('Алхимик_7'));
  assert.equal(validName('<script>'), false);
  assert.equal(validName('  '), false);
});
void test('storage handles malformed data, invalid entries and unavailable storage', () => {
  let raw = '{broken';
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => raw,
      setItem: (_key: string, value: string) => {
        raw = value;
      },
    },
  });
  assert.deepEqual(readLeaderboard(), []);
  raw = JSON.stringify([
    { name: 'Valid', score: 200, date: 1 },
    { name: 'Bad', score: -1, date: 1 },
    null,
  ]);
  assert.equal(readLeaderboard().length, 1);
  assert.equal(writeLeaderboard([]), true);
  assert.equal(raw, '[]');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
      throw new Error('Storage blocked');
    },
  });
  assert.deepEqual(readLeaderboard(), []);
  assert.equal(writeLeaderboard([]), false);
  assert.ok(LEADERBOARD_KEY.length > 0);
  Reflect.deleteProperty(globalThis, 'localStorage');
});
