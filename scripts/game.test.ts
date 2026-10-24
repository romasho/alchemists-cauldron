import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INGREDIENTS } from '../src/data/ingredients.ts';
import { RECIPES } from '../src/data/recipes.ts';
import { DIFFICULTIES, DIFFICULTY_SETTINGS } from '../src/data/difficulty.ts';
import { getReactions } from '../src/data/reactions.ts';
import {
  clearSave,
  loadGame,
  saveGame,
  SAVE_KEY,
} from '../src/storage/save.ts';
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
  pourOut,
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
  addIngredient(state, 'fairy', 1000);
  assert.ok(state.recipe);
  assert.equal(checkBrew(state.cauldron, state.recipe), true);
  brew(state, 2000, () => 0.5);
  assert.equal(state.score, 200);
  assert.equal(state.timeLeft, RULES.time);
  assert.equal(state.stock['fairy'], 0);
  assert.equal(state.stock['acid'], 2);
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

void test('each difficulty sets stock, limits, recipe pool, tolerance and rewards', () => {
  for (const difficulty of DIFFICULTIES) {
    const rules = DIFFICULTY_SETTINGS[difficulty];
    const state = startGame(0, () => 0.5, difficulty);
    assert.equal(state.difficulty, difficulty);
    assert.equal(state.timeLeft, rules.time);
    assert.equal(state.lives, rules.lives);
    assert.equal(Object.keys(state.stock).length, rules.shelfSize);
    assert.equal(state.recipe?.difficulty, difficulty);
    for (let index = 0; index < rules.capacity + 1; index += 1) {
      addIngredient(state, 'dragon', 0);
    }
    assert.equal(state.cauldron.length, rules.capacity);
    const first = INGREDIENTS[0];
    const recipe = state.recipe;
    assert.ok(first && recipe);
    const edge = {
      ...first,
      temperature: recipe.temperature.min - rules.tolerance,
      density: recipe.density.max + rules.tolerance,
      magicPower: recipe.magicPower.min,
    };
    assert.ok(checkBrew([edge], recipe, rules.tolerance));
    assert.equal(
      checkBrew(
        [{ ...edge, temperature: edge.temperature - 1 }],
        recipe,
        rules.tolerance,
      ),
      false,
    );

    const success = startGame(0, () => 0, difficulty);
    addIngredient(success, difficulty === 'hard' ? 'phoenix' : 'fairy', 0);
    addIngredient(
      success,
      difficulty === 'easy'
        ? 'dragon'
        : difficulty === 'medium'
          ? 'fairy'
          : 'fairy',
      0,
    );
    brew(success, 30_000, () => 0.999);
    assert.equal(success.score, rules.score);
    assert.equal(success.timeLeft, rules.time - 30_000 + rules.bonus);
    assert.equal(success.recipe?.difficulty, difficulty);
    const wrong = startGame(0, () => 0, 'easy');
    addIngredient(wrong, 'phoenix', 0);
    assert.equal(wrong.cauldron.length, 0);
  }
});

void test('save round trips preserve every run field and restore on pause without a deadline', () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  try {
    for (const difficulty of DIFFICULTIES) {
      const state = startGame(0, () => 0, difficulty);
      state.score = DIFFICULTY_SETTINGS[difficulty].score;
      state.lives -= 1;
      addIngredient(state, 'dragon', 1000);
      assert.ok(saveGame(state));
      const restored = loadGame();
      assert.ok(restored);
      assert.equal(restored.status, 'paused');
      assert.equal(restored.endTime, 0);
      for (const key of [
        'difficulty',
        'score',
        'timeLeft',
        'lives',
        'recipe',
        'cauldron',
        'stock',
      ] as const) {
        assert.deepEqual(restored[key], state[key]);
      }
      updateTime(restored, 1_000_000);
      assert.equal(restored.timeLeft, state.timeLeft);
      resumeGame(restored, 1_000_000);
      updateTime(restored, 1_001_000);
      assert.equal(restored.timeLeft, state.timeLeft - 1000);
      pauseGame(restored, 1_001_000);
      assert.ok(saveGame(restored));
      assert.equal(loadGame()?.status, 'paused');
    }
    const fresh = startGame(0, () => 0, 'easy');
    assert.ok(saveGame(fresh));
    assert.equal(loadGame()?.difficulty, 'easy');
    updateTime(fresh, 180_000);
    assert.equal(saveGame(fresh), false);
    assert.equal(loadGame(), null);
    saveGame(startGame());
    clearSave();
    assert.equal(storage.has(SAVE_KEY), false);
    assert.equal(loadGame(), null);
  } finally {
    Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

void test('invalid saves are discarded and unavailable storage never throws', () => {
  let raw: string | null = null;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => raw,
      setItem: (_key: string, value: string) => {
        raw = value;
      },
      removeItem: () => {
        raw = null;
      },
    },
  });
  try {
    const state = startGame(0, () => 0, 'hard');
    saveGame(state);
    const valid = raw;
    const invalid = [
      null,
      [],
      { score: undefined },
      { status: 'game-over' },
      { difficulty: 'unknown' },
      { timeLeft: 0 },
      { timeLeft: 150_001 },
      { lives: 0 },
      { lives: 4 },
      { score: -1 },
      { score: 1 },
      { activeRecipe: RECIPES[0] },
      { shelfStock: {} },
      { shelfStock: { ...state.stock, dragon: -1 } },
      { shelfStock: { ...state.stock, dragon: 16 } },
      { cauldronIngredients: [null] },
      { cauldronIngredients: [{ ...INGREDIENTS[0], temperature: 999 }] },
      { cauldronIngredients: Array.from({ length: 6 }, () => INGREDIENTS[0]) },
      {
        shelfStock: Object.fromEntries(INGREDIENTS.map((item) => [item.id, 0])),
      },
    ];
    assert.ok(valid);
    for (const patch of invalid) {
      const original: unknown = JSON.parse(valid);
      raw = JSON.stringify(
        patch && typeof patch === 'object' && !Array.isArray(patch)
          ? { ...(original as object), ...patch }
          : patch,
      );
      assert.equal(loadGame(), null);
      assert.equal(raw, null);
    }
    raw = '{}';
    assert.equal(loadGame(), null);
    raw = '{broken';
    assert.equal(loadGame(), null);
    assert.equal(raw, null);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    assert.equal(loadGame(), null);
    assert.equal(saveGame(state), false);
    assert.doesNotThrow(clearSave);
  } finally {
    Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

void test('leaderboards keep separate Top-10 lists and clearing affects only one difficulty', () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  try {
    for (const difficulty of DIFFICULTIES) {
      assert.ok(
        writeLeaderboard(
          Array.from({ length: 12 }, (_, index) => ({
            name: difficulty,
            score: (index + 1) * DIFFICULTY_SETTINGS[difficulty].score,
            date: index,
          })),
          difficulty,
        ),
      );
      assert.equal(readLeaderboard(difficulty).length, 10);
      assert.ok(
        readLeaderboard(difficulty).every((entry) => entry.name === difficulty),
      );
    }
    assert.ok(storage.has(LEADERBOARD_KEY));
    writeLeaderboard([], 'hard');
    assert.deepEqual(readLeaderboard('hard'), []);
    assert.equal(readLeaderboard('easy').length, 10);
    assert.equal(readLeaderboard('medium').length, 10);
  } finally {
    Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

void test('difficulty enables 0/2/3 reactions and recomputes current values without stacking', () => {
  assert.deepEqual(
    DIFFICULTIES.map((difficulty) => getReactions(difficulty).length),
    [0, 2, 3],
  );
  const state = startGame(0, () => 0.5);
  addIngredient(state, 'fairy', 0);
  addIngredient(state, 'acid', 0);
  assert.equal(state.timeLeft, 140_000);
  assert.deepEqual(calculateCauldron(state.cauldron, 'medium'), {
    temperature: 22,
    density: 23,
    magicPower: 51,
  });
  addIngredient(state, 'fairy', 0);
  assert.equal(state.timeLeft, 140_000);
  assert.equal(calculateCauldron(state.cauldron, 'medium').magicPower, 69);
  assert.equal(calculateCauldron(state.cauldron, 'medium').magicPower, 69);
  assert.equal(calculateCauldron(state.cauldron, 'easy').magicPower, 46);
  pourOut(state, 0);
  addIngredient(state, 'acid', 0);
  addIngredient(state, 'fairy', 0);
  assert.equal(state.timeLeft, 120_000);
});

void test('solar frost and overlapping reactions use raw ingredient sums for each calculation', () => {
  const state = startGame(0, () => 0.5);
  for (const id of ['dragon', 'frost', 'fairy', 'acid'])
    addIngredient(state, id, 0);
  assert.deepEqual(calculateCauldron(state.cauldron, 'medium'), {
    temperature: 0,
    density: 42,
    magicPower: 87,
  });
  const values = calculateCauldron(state.cauldron, 'medium');
  assert.ok(state.recipe);
  state.recipe = {
    ...state.recipe,
    temperature: { min: values.temperature, max: values.temperature },
    density: { min: values.density, max: values.density },
    magicPower: { min: values.magicPower, max: values.magicPower },
  };
  brew(state, 0);
  assert.equal(state.score, 200);
  assert.equal(state.effect, 'success');
});

void test('volatile mix clears spent portions and can end the game on last life', () => {
  const state = startGame(0, () => 0.5, 'hard');
  state.lives = 1;
  addIngredient(state, 'phoenix', 0);
  addIngredient(state, 'void', 0);
  assert.equal(state.lives, 0);
  assert.equal(state.cauldron.length, 0);
  assert.equal(state.stock['phoenix'], 8);
  assert.equal(state.status, 'game-over');
  assert.equal(state.reason, 'No lives left');
  assert.equal(state.effect, 'failure');
});

void test('pour out costs exactly 10 seconds, preserves recipe/score/lives and respects state guards', () => {
  const state = startGame(0, () => 0.5);
  const recipe = state.recipe;
  pourOut(state, 0);
  assert.equal(state.timeLeft, 150_000);
  addIngredient(state, 'dragon', 0);
  const stock = { ...state.stock };
  pauseGame(state, 0);
  pourOut(state, 0);
  assert.equal(state.cauldron.length, 1);
  resumeGame(state, 0);
  pourOut(state, 1000);
  assert.equal(state.timeLeft, 139_000);
  assert.equal(state.endTime, 140_000);
  assert.equal(state.cauldron.length, 0);
  assert.equal(state.lives, 3);
  assert.equal(state.score, 0);
  assert.equal(state.recipe, recipe);
  assert.deepEqual(state.stock, stock);
  addIngredient(state, 'dragon', 1000);
  pourOut(state, 135_000);
  assert.equal(state.timeLeft, 0);
  assert.equal(state.reason, 'Time is up');
});

void test('reaction timeout and pouring the last stock end the run immediately', () => {
  const state = startGame(0, () => 0.5);
  addIngredient(state, 'acid', 0);
  addIngredient(state, 'fairy', 145_000);
  assert.equal(state.timeLeft, 0);
  assert.equal(state.status, 'game-over');
  const last = startGame(0, () => 0.5);
  last.stock = Object.fromEntries(SHELF.map((item) => [item.id, 0]));
  last.stock['dragon'] = 1;
  addIngredient(last, 'dragon', 0);
  pourOut(last, 0);
  assert.equal(last.reason, 'Out of ingredients');
});

void test('saved active reactions restore values and never charge their penalty twice', () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  try {
    const state = startGame(0, () => 0.5);
    addIngredient(state, 'fairy', 0);
    addIngredient(state, 'acid', 0);
    assert.ok(saveGame(state));
    const restored = loadGame();
    assert.ok(restored);
    assert.equal(
      calculateCauldron(restored.cauldron, restored.difficulty).magicPower,
      51,
    );
    resumeGame(restored, 1000);
    addIngredient(restored, 'fairy', 1000);
    assert.equal(restored.timeLeft, 140_000);
    assert.equal(
      calculateCauldron(restored.cauldron, restored.difficulty).magicPower,
      69,
    );
  } finally {
    Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
