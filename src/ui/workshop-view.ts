import type { Ingredient, Parameter } from '../data/types.ts';
import { PARAMETERS, RULES } from '../logic/brewing.ts';
import cauldron from '../assets/layers/cauldron-body.webp';
import liquid from '../assets/layers/potion-liquid.webp';
import dragon from '../assets/layers/dragon.webp';
import fairy from '../assets/layers/fairy.webp';
import frost from '../assets/layers/frost.webp';
import mandrake from '../assets/layers/mandrake.webp';
import acid from '../assets/layers/acid.webp';
import voidEssence from '../assets/layers/void.webp';
import phoenix from '../assets/layers/phoenix.webp';
import slime from '../assets/layers/slime.webp';
import { DIFFICULTY_SETTINGS } from '../data/difficulty.ts';
import type { Difficulty } from '../data/types.ts';

export const LABELS: Record<Parameter, string> = {
  temperature: 'Temperature',
  density: 'Density',
  magicPower: 'Magic Power',
};
const images: Record<string, string> = {
  dragon,
  fairy,
  frost,
  mandrake,
  acid,
  void: voidEssence,
  phoenix,
  slime,
};
export const ingredientImage = (id: string): string => images[id] ?? '';
const descriptions: Record<string, string> = {
  phoenix:
    'A fiery feather. Raises temperature and magic while reducing density.',
  slime: 'A viscous reagent. Adds considerable density and a little warmth.',
  dragon:
    'A concentrated drop of dragon fire. Warms the mixture and adds a little density and magic.',
  fairy: 'A sparkling pinch of fairy dust. Gently raises all three parameters.',
  frost: 'An icy blossom. Lowers temperature while adding density and magic.',
  mandrake:
    'An ancient root. Cools the mixture slightly and makes it much denser.',
  acid: 'A volatile green reagent. Raises temperature, density and magical power.',
  void: 'A fragment of the night. Strong magic that lowers both temperature and density.',
};
export const signed = (value: number): string =>
  value > 0
    ? `+${String(value)}`
    : value < 0
      ? `−${String(Math.abs(value))}`
      : String(value);

const paths = {
  temperature:
    '<path d="M10 4a2 2 0 0 1 4 0v10a5 5 0 1 1-4 0Z"/><path d="M12 8v10"/>',
  density:
    '<path d="M12 2C10 7 5 12 5 16a7 7 0 0 0 14 0C19 12 14 7 12 2Z"/><path d="M8 16q0 4 4 4"/>',
  magicPower:
    '<path d="m12 1 3 7 8-1-5 6 4 7-8-2-5 5-1-8-7-3 7-4Z"/><circle cx="12" cy="12" r="3"/>',
  heart: '<path d="M12 21 3 12C-3 5 6-2 12 5 18-2 27 5 21 12Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  help: '<path d="M3 4q5-2 9 1 4-3 9-1v15q-5-2-9 1-4-3-9-1Z"/><path d="M12 5v15M6 8h3M15 8h3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v7h5"/>',
  score:
    '<path d="m12 1 3 7 8 4-8 3-3 8-3-8-8-3 8-4Z"/><circle cx="12" cy="12" r="3"/>',
} as const;
export function icon(name: keyof typeof paths): string {
  return `<svg class="ui-icon icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}
export function topPanel(): string {
  return `
  <section class="dashboard" aria-label="Run statistics"><div class="score-stat">${icon('score')}<span class="eyebrow">SCORE</span><strong id="score">0</strong></div><div class="timer">${icon('clock')}<span class="eyebrow">TIME</span><strong id="time">00:00</strong><progress id="time-bar" max="${String(RULES.time)}" value="0" aria-label="Time remaining"></progress></div><div class="life-stat"><span class="eyebrow">LIVES</span><strong id="lives" aria-label="0 lives">—</strong><button data-action="pause" disabled>${icon('pause')} Pause</button></div></section>`;
}
function shelfPanel(): string {
  return '<section class="panel shelf-panel"><div class="section-title"><h2>Ingredients</h2><span>Click or drag · ⓘ for details</span></div><div class="shelf"></div><p class="shelf-status" role="status">Start a game to open the shelf.</p></section>';
}
function cauldronPanel(): string {
  return `<section class="cauldron-panel" aria-label="Your cauldron" data-state="empty"><div class="cauldron-art"><div class="cauldron-glow"></div><img class="cauldron-body" src="${cauldron}" alt="An ornate iron cauldron" width="640" height="560"><img class="potion-liquid" src="${liquid}" alt="" width="520" height="240"><div class="floating-ingredients" aria-hidden="true"></div><div class="explosion" aria-hidden="true"></div><div class="steam" aria-hidden="true"><i></i><i></i><i></i></div><div class="bubbles" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div><div class="mixture-panel"><p class="eyebrow">IN THE CAULDRON <span class="portion-count">0 / 4</span></p><ol class="mixture" aria-label="Added ingredients" tabindex="0"></ol><p class="empty-mix">The cauldron is empty</p><p class="reaction-label" role="status"></p><p class="cauldron-state" role="status">Choose an ingredient to begin.</p></div></section>`;
}
function recipePanel(): string {
  return '<section class="panel recipe-panel"><div class="book-page"><p class="eyebrow">CURRENT RECIPE</p><span class="book-divider" aria-hidden="true">✦</span><h2 id="recipe-name">A recipe awaits</h2><p class="recipe-copy">Bring all three parameters into balance.</p><dl class="recipe-ranges"></dl><p id="counter">Ingredients: 0 / 4</p><p class="footnote">Every range allows a tolerance of <strong class="tolerance-value">±8</strong>.</p></div><span class="bookmark" aria-hidden="true">✧</span></section>';
}
function scalesPanel(): string {
  return '<section class="scales-panel" aria-label="Potion parameters"><div class="bars"></div><p class="scale-legend"><span class="legend-target"></span> Recipe range <span class="legend-tolerance"></span> <span class="tolerance-value">±8</span> tolerance <span class="legend-marker">◆</span> Current value</p></section>';
}
function brewPanel(): string {
  return `<section class="workshop-controls" aria-label="Game controls"><button class="workshop-control" data-action="help">${icon('help')}<span>Help</span></button><section class="brew-actions" aria-label="Brewing"><span class="brew-flourish" aria-hidden="true">✧ ── ◆ ── ✧</span><button class="primary brew" data-action="brew" disabled>Brew <span>potion</span></button><button class="pour" data-action="pour" disabled>Pour Out <span>−10s</span></button><button class="primary start" data-action="start">Start Game</button><p class="brew-hint" hidden></p><span class="brew-flourish" aria-hidden="true">✧ ── ◆ ── ✧</span></section><button class="workshop-control" data-action="menu">${icon('menu')}<span>Menu</span></button></section>`;
}
export function workshopView(): string {
  return `<main class="workshop">${topPanel()}<div class="playfield"><div class="scene"><div class="title-sign"><p class="eyebrow">THE ART OF FINDING BALANCE</p><h1>Alchemist’s Cauldron</h1><span aria-hidden="true">◆</span></div>${recipePanel()}${scalesPanel()}${shelfPanel()}${cauldronPanel()}</div>${brewPanel()}</div><p class="feedback" role="status"></p></main><dialog aria-labelledby="dialog-title"><div class="dialog-content"></div></dialog>`;
}
export function ingredientView(ingredient: Ingredient): string {
  return `<button class="ingredient" data-add="${ingredient.id}" aria-describedby="tip-${ingredient.id}"><span class="stock" title="Portions remaining"></span><img class="ingredient-art" src="${ingredientImage(ingredient.id)}" alt="" width="80" height="80" draggable="false"><span class="ingredient-name">${ingredient.name}</span></button><button class="ingredient-info" data-action="ingredient-info" data-id="${ingredient.id}" aria-label="About ${ingredient.name}">i</button><div class="ingredient-tooltip" id="tip-${ingredient.id}" role="tooltip" hidden><strong>${ingredient.name}</strong><p>${descriptions[ingredient.id] ?? ''}</p><dl>${PARAMETERS.map((key) => `<div class="${key}"><dt>${icon(key)} ${LABELS[key]}</dt><dd>${signed(ingredient[key])}</dd></div>`).join('')}</dl><span class="tooltip-stock"></span></div>`;
}
export function ingredientDetails(
  ingredient: Ingredient,
  stock: number,
): string {
  return `<img class="detail-art" src="${images[ingredient.id] ?? ''}" alt="" width="120" height="120"><p>${descriptions[ingredient.id] ?? ''}</p><dl class="detail-values">${PARAMETERS.map((key) => `<div class="${key}"><dt>${icon(key)} ${LABELS[key]}</dt><dd>${signed(ingredient[key])}</dd></div>`).join('')}</dl><p>Remaining portions: <strong>${String(stock)}</strong>. Adding one portion spends one from the shelf.</p><button data-action="detail-close">Back to workshop</button>`;
}
export function parameterView(key: Parameter): string {
  return `<div class="bar-label"><span>${icon(key)}${LABELS[key]}</span><strong>0</strong></div><div class="track" role="meter" aria-label="${LABELS[key]}" aria-valuemin="-160" aria-valuemax="160" aria-valuenow="0"><span class="zero"></span><span class="tolerance"></span><span class="target"></span><span class="marker"></span></div><div class="bar-scale"><span class="scale-min">−160</span><span class="range-label">Target: —</span><span class="scale-max">160</span></div><p class="parameter-status">Awaiting recipe</p>`;
}

export function difficultyMenu(
  selected: Difficulty,
  canContinue: boolean,
): string {
  const selectedRules = DIFFICULTY_SETTINGS[selected];
  return `<p>Your next discovery starts with a single drop.</p><p class="menu-summary">${String(selectedRules.time / 1000)} seconds · ${String(selectedRules.lives)} lives · ±${String(selectedRules.tolerance)} tolerance<br>${String(selectedRules.shelfSize)} ingredients · ${String(selectedRules.capacity)} portions · ${selected.toUpperCase()}</p><p>Choose a difficulty before starting a run.</p><div class="difficulty-options">${(
    ['easy', 'medium', 'hard'] as const
  )
    .map((difficulty) => {
      const r = DIFFICULTY_SETTINGS[difficulty];
      return `<button data-action="difficulty" data-difficulty="${difficulty}" aria-pressed="${String(selected === difficulty)}"><strong>${difficulty}</strong><span>${String(r.shelfSize)} ingredients · ${String(r.capacity)} portions · ±${String(r.tolerance)}</span><span>${String(r.time / 1000)}s · ${String(r.lives)} lives · ${String(r.score)} points</span><span>+${String(r.bonus / 1000)}s per brew · ${String(r.reactions.length)} reactions</span></button>`;
    })
    .join(
      '',
    )}</div><div class="dialog-actions">${canContinue ? '<button class="primary" data-action="continue">Continue Game</button>' : ''}<button class="${canContinue ? '' : 'primary'}" data-action="start">Start new game</button><button data-action="leaderboard">Leaderboard</button><button data-action="close">Back</button></div>`;
}
