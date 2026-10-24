import { DIFFICULTY_SETTINGS } from '../src/data/difficulty.ts';
import { REACTIONS } from '../src/data/reactions.ts';
import { calculateMixture, activeReactions } from '../src/logic/brewing.ts';
import { getShelf, pourOut } from '../src/state/game-state.ts';
import {
  SAVE_KEY,
  saveGame,
  loadGame,
  restoreSave,
  clearSave,
} from '../src/storage/save.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INGREDIENTS } from '../src/data/ingredients.ts';
import { RECIPES } from '../src/data/recipes.ts';
import { parameterStatus } from '../src/ui/parameter-status.ts';
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

void test('parameter text distinguishes exact range, inclusive tolerance and direction', () => {
  const zone = { min: -13, max: -3 };
  assert.equal(parameterStatus(0), 'Awaiting recipe');
  assert.equal(parameterStatus(-22, zone), '↑ Below target');
  assert.equal(parameterStatus(-21, zone), '≈ Within ±8 tolerance');
  for (const value of [-13, -8, -3])
    assert.equal(parameterStatus(value, zone), '✓ In target range');
  assert.equal(parameterStatus(5, zone), '≈ Within ±8 tolerance');
  assert.equal(parameterStatus(6, zone), '↓ Above target');
});
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
  addIngredient(state, 'dragon', 1000);
  addIngredient(state, 'acid', 1000);
  assert.ok(state.recipe);
  assert.equal(checkBrew(state.cauldron, state.recipe), true);
  brew(state, 2000, () => 0.5);
  assert.equal(state.score, 200);
  assert.equal(state.timeLeft, RULES.time);
  assert.equal(state.stock['dragon'], 1);
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

void test('difficulty config controls shelf, capacity, lives, timer and recipe pool', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const rules = DIFFICULTY_SETTINGS[difficulty];
    const state = startGame(1000, () => 0.5, difficulty);
    assert.equal(state.difficulty, difficulty);
    assert.equal(state.timeLeft, rules.time);
    assert.equal(state.lives, rules.lives);
    assert.equal(state.recipe?.difficulty, difficulty);
    assert.equal(Object.keys(state.stock).length, rules.shelfSize);
    for (let count = 0; count <= rules.capacity; count++)
      addIngredient(state, 'fairy', 1000);
    assert.equal(state.cauldron.length, rules.capacity);
    assert.equal(state.stock['fairy'], 9 - rules.capacity);
    if (difficulty !== 'hard') {
      const before = state.stock['phoenix'];
      addIngredient(state, 'phoenix', 1000);
      assert.equal(state.stock['phoenix'], before);
    }
  }
});
void test('difficulty tolerance and successful rewards follow the selected table', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const rules = DIFFICULTY_SETTINGS[difficulty];
    const state = startGame(0, () => 0.5, difficulty);
    const base = getShelf(difficulty)[0];
    assert.ok(base);
    state.cauldron = [base];
    state.recipe = {
      id: 'test',
      difficulty,
      name: 'Test',
      temperature: { min: 25, max: 25 },
      density: { min: 8, max: 8 },
      magicPower: { min: 10, max: 10 },
    };
    brew(state, 20_000, () => 0.5);
    assert.equal(state.score, rules.score);
    assert.equal(state.timeLeft, rules.time - 20_000 + rules.bonus);
    assert.equal(state.recipe.difficulty, difficulty);
    const edge = { ...base, temperature: 25 - rules.tolerance };
    assert.equal(
      checkBrew(
        [edge],
        {
          ...state.recipe,
          temperature: { min: 25, max: 25 },
          density: { min: 8, max: 8 },
          magicPower: { min: 10, max: 10 },
        },
        difficulty,
      ),
      true,
    );
  }
});
void test('Bubbling applies to recomputed values and charges time only on activation', () => {
  const state = startGame(0, () => 0.5);
  addIngredient(state, 'fairy', 0);
  addIngredient(state, 'acid', 0);
  assert.equal(state.timeLeft, 140_000);
  assert.equal(calculateMixture(state.cauldron, 'medium').magicPower, 51);
  addIngredient(state, 'dragon', 0);
  assert.equal(state.timeLeft, 140_000);
  assert.equal(calculateMixture(state.cauldron, 'medium').magicPower, 66);
  assert.equal(REACTIONS.length, 15);
  assert.equal(activeReactions(state.cauldron, 'easy').length, 0);
  pourOut(state, 0);
  addIngredient(state, 'fairy', 0);
  addIngredient(state, 'acid', 0);
  assert.equal(state.timeLeft, 120_000);
});
void test('Solar Frost transforms values; Volatile Mix spends portions, loses life and clears', () => {
  const state = startGame(0, () => 0.5, 'hard');
  addIngredient(state, 'dragon', 0);
  addIngredient(state, 'frost', 0);
  assert.deepEqual(calculateMixture(state.cauldron, 'hard'), {
    temperature: 0,
    density: 14.4,
    magicPower: 24,
  });
  addIngredient(state, 'void', 0);
  addIngredient(state, 'phoenix', 0);
  assert.equal(state.cauldron.length, 0);
  assert.equal(state.lives, 2);
  assert.equal(state.stock['void'], 8);
  assert.equal(state.stock['phoenix'], 8);
  assert.equal(state.lastReactionId, 'volatile-mix');
});
void test('Pour Out charges ten seconds once, preserves lives and does not refund stock', () => {
  const state = startGame(0, () => 0.5);
  addIngredient(state, 'fairy', 0);
  const recipe = state.recipe;
  pourOut(state, 1000);
  assert.equal(state.timeLeft, 139_000);
  assert.equal(state.lives, 3);
  assert.equal(state.stock['fairy'], 8);
  assert.equal(state.cauldron.length, 0);
  assert.equal(state.recipe, recipe);
  pourOut(state, 1000);
  assert.equal(state.timeLeft, 139_000);
  addIngredient(state, 'fairy', 1000);
  state.endTime = 2000;
  pourOut(state, 1000);
  assert.equal(state.reason, 'Time is up');
});
void test('save validation restores canonical data paused and rejects finished or malformed runs', () => {
  const state = startGame(0, () => 0.5, 'hard');
  addIngredient(state, 'fairy', 0);
  pauseGame(state, 1234);
  const restored = restoreSave(JSON.parse(JSON.stringify(state)) as unknown);
  assert.ok(restored);
  assert.equal(restored.status, 'paused');
  assert.equal(restored.difficulty, 'hard');
  assert.equal(restored.timeLeft, 148_766);
  assert.deepEqual(restored.stock, state.stock);
  assert.equal(restored.cauldron[0], INGREDIENTS[1]);
  for (const invalid of [
    null,
    {},
    { ...state, status: 'game-over' },
    { ...state, timeLeft: -1 },
    { ...state, difficulty: 'other' },
    { ...state, stock: { fairy: 500 } },
    { ...state, cauldron: [{ id: 'missing' }] },
    { ...state, recipe: { id: '1' } },
  ])
    assert.equal(restoreSave(invalid), null);
});
void test('save storage tolerates corruption and keeps difficulty leaderboards isolated', () => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    },
  });
  const state = startGame(0, () => 0.5, 'easy');
  addIngredient(state, 'fairy', 0);
  assert.equal(saveGame(state), true);
  assert.equal(loadGame()?.difficulty, 'easy');
  data.set(SAVE_KEY, '{broken');
  assert.equal(loadGame(), null);
  assert.equal(data.has(SAVE_KEY), false);
  for (const difficulty of ['easy', 'medium', 'hard'] as const)
    writeLeaderboard(
      [
        {
          name: difficulty,
          score: DIFFICULTY_SETTINGS[difficulty].score,
          date: 1,
        },
      ],
      difficulty,
    );
  for (const difficulty of ['easy', 'medium', 'hard'] as const)
    assert.equal(readLeaderboard(difficulty)[0]?.name, difficulty);
  assert.equal(clearSave(), true);
  Reflect.deleteProperty(globalThis, 'localStorage');
});
