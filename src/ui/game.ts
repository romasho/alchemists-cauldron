import {
  DIFFICULTIES,
  DIFFICULTY_SETTINGS,
  isDifficulty,
} from '../data/difficulty.ts';
import { INGREDIENTS } from '../data/ingredients.ts';
import { clearSave, loadGame, saveGame } from '../storage/save.ts';
import cauldronIcon from '../assets/cauldron.svg';
import { calculateCauldron, formatTime, PARAMETERS } from '../logic/brewing.ts';
import {
  addIngredient,
  brew,
  createMenu,
  pauseGame,
  resumeGame,
  startGame,
  updateTime,
} from '../state/game-state.ts';
import {
  formatDate,
  qualifies,
  rankEntries,
  readLeaderboard,
  validName,
  writeLeaderboard,
} from '../storage/leaderboard.ts';
import type { Difficulty, Parameter } from '../data/types.ts';

const LABELS: Record<Parameter, string> = {
  temperature: 'Temperature',
  density: 'Density',
  magicPower: 'Magic Power',
};
const signed = (value: number): string =>
  value > 0 ? `+${String(value)}` : String(value);

export function mountGame(root: HTMLElement): void {
  let state = createMenu();
  let savedGame = loadGame();
  let boardDifficulty: Difficulty = state.difficulty;
  let entries = readLeaderboard(boardDifficulty);
  let saved = false;
  let endedAt = 0;
  let returnTo: 'menu' | 'game-over' = 'menu';
  let opener: HTMLElement | null = null;
  root.innerHTML = `
    <main class="workshop">
      <header class="header"><div><p class="eyebrow">THE WORKSHOP · LEVEL 2</p><h1>Alchemist's Cauldron</h1></div>
        <nav aria-label="Game controls"><button data-action="help">Help</button><button data-action="menu">Menu</button><button data-action="pause" disabled>Pause</button></nav></header>
      <section class="dashboard" aria-label="Run statistics"><div><span class="eyebrow">SCORE</span><strong id="score">0</strong></div><div class="timer"><span class="eyebrow">TIME REMAINING</span><strong id="time">00:00</strong><progress id="time-bar" max="150000" value="0" aria-label="Time remaining"></progress></div><div><span class="eyebrow">LIVES</span><strong id="lives" aria-label="0 lives">—</strong></div></section>
      <div class="playfield">
        <section class="panel shelf-panel"><div class="section-title"><h2>Ingredient shelf</h2><span>Click to add</span></div><div class="shelf"></div><p class="footnote">A little heat. A little magic. Every portion counts.</p></section>
        <section class="panel cauldron-panel"><p class="eyebrow">THE MIXING ROOM</p><h2>Your cauldron</h2><div class="cauldron-art"><img src="${cauldronIcon}" width="180" height="180" alt="Alchemist’s cauldron"></div><ol class="mixture" aria-label="Added ingredients"></ol><p class="empty-mix">The cauldron is empty</p><button class="primary brew" data-action="brew" disabled>Brew potion</button><button class="continue" data-action="continue" hidden>Continue Game</button><button class="primary start" data-action="start">Start Game</button></section>
        <section class="panel recipe-panel"><p class="eyebrow">TODAY'S DISCOVERY</p><h2 id="recipe-name">A recipe awaits</h2><p class="recipe-copy">Bring all three parameters into balance.</p><p id="counter">Ingredients: 0 / 4</p><div class="bars"></div><p class="footnote" id="tolerance">The shaded zones are recipe targets.<br>Brewing allows a tolerance of ±8.</p></section>
      </div><p class="feedback" role="status"></p><footer>ALCHEMY IS THE ART OF FINDING BALANCE</footer>
    </main><dialog aria-labelledby="dialog-title"><div class="dialog-content"></div></dialog>`;
  // The selector determines the DOM subtype required by the caller.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  function element<T extends HTMLElement>(selector: string): T {
    const found = root.querySelector<T>(selector);
    if (!found) throw new Error(`Missing game element: ${selector}`);
    return found;
  }
  const dialog = element<HTMLDialogElement>('dialog');
  const content = element('.dialog-content');
  const field = element('.playfield');
  const shelf = element('.shelf');
  const cards = INGREDIENTS.map((ingredient, index) => {
    const button = document.createElement('button');
    button.className = `ingredient ingredient-${String(index)}`;
    button.innerHTML = `<span class="stock"></span><span class="ingredient-icon" aria-hidden="true">${ingredient.icon}</span><span class="ingredient-name">${ingredient.name}</span><span class="ingredient-values">T ${signed(ingredient.temperature)} · D ${signed(ingredient.density)} · M ${signed(ingredient.magicPower)}</span>`;
    button.addEventListener('click', () => {
      addIngredient(state, ingredient.id);
      render();
    });
    shelf.append(button);
    return button;
  });
  const bars = PARAMETERS.map((key) => {
    const container = document.createElement('div');
    container.className = 'parameter';
    container.innerHTML = `<div class="bar-label"><span>${LABELS[key]}</span><strong>0</strong></div><div class="track"><span class="zero"></span><span class="target"></span><span class="marker"></span></div><div class="bar-scale"><span>−160</span><span class="range-label">Target: —</span><span>160</span></div>`;
    element('.bars').append(container);
    return {
      key,
      container,
      value: container.querySelector('strong'),
      target: container.querySelector<HTMLElement>('.target'),
      marker: container.querySelector<HTMLElement>('.marker'),
      range: container.querySelector('.range-label'),
    };
  });
  function showDialog(title: string, body: string): void {
    if (!dialog.open)
      opener =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    content.innerHTML = `<p class="eyebrow">THE WORKSHOP</p><h2 id="dialog-title">${title}</h2>${body}`;
    if (!dialog.open) dialog.showModal();
    content.querySelector<HTMLElement>('input, button')?.focus();
  }
  function closeDialog(): void {
    dialog.close();
    opener?.focus();
  }
  function updateClock(): void {
    element<HTMLProgressElement>('#time-bar').max =
      DIFFICULTY_SETTINGS[state.difficulty].time;
    element('#score').textContent = String(state.score);
    element('#time').textContent = formatTime(state.timeLeft);
    element<HTMLProgressElement>('#time-bar').value = state.timeLeft;
    element('.timer').classList.toggle(
      'urgent',
      state.timeLeft > 0 && state.timeLeft < 15_000,
    );
    element('#lives').textContent =
      state.lives > 0 ? '♥'.repeat(state.lives) : '—';
    element('#lives').setAttribute(
      'aria-label',
      `${String(state.lives)} lives`,
    );
  }
  function gameOver(): void {
    const canSave =
      !saved && qualifies(readLeaderboard(state.difficulty), state.score);
    showDialog(
      'Game Over',
      `<p>${state.reason}</p><p class="final-score">${String(state.score)} <small>points</small></p>${canSave ? '<form id="score-form"><label for="player-name">You made the Top-10! Your name</label><input id="player-name" name="name" minlength="2" maxlength="15" required autocomplete="nickname" aria-describedby="name-hint"><p id="name-hint" class="footnote">2–15 characters: letters, digits, spaces, _ or -.</p><button class="primary" type="submit">Save result</button><p id="save-message" role="status"></p></form>' : '<p>Your run is complete.</p>'}<div class="dialog-actions"><button class="primary" data-action="start">Play again</button><button data-action="leaderboard">Leaderboard</button><button data-action="exit">Exit to Menu</button></div>`,
    );
  }
  function render(): void {
    if (state.status !== 'menu') {
      saveGame(state);
      savedGame = state.status === 'game-over' ? null : savedGame;
    }
    const rules = DIFFICULTY_SETTINGS[state.difficulty];
    updateClock();
    element('.header .eyebrow').textContent =
      `THE WORKSHOP · LEVEL 2 · ${rules.label.toUpperCase()}`;
    element('#tolerance').textContent =
      `The shaded zones are recipe targets. Brewing allows a tolerance of ±${String(rules.tolerance)}.`;
    element('.continue').hidden = state.status !== 'menu' || !savedGame;
    const playing = state.status === 'playing';
    const menu = state.status === 'menu';
    field.classList.toggle('obscured', state.status === 'paused');
    field.inert = state.status === 'paused' || state.status === 'game-over';
    element<HTMLButtonElement>('[data-action="pause"]').disabled = !playing;
    element<HTMLButtonElement>('.brew').disabled =
      !playing || !state.cauldron.length;
    element('.brew').hidden = menu;
    element('.start').hidden = !menu;
    cards.forEach((card, index) => {
      const ingredient = INGREDIENTS[index];
      if (!ingredient) return;
      card.hidden = index >= rules.shelfSize;
      const stock = state.stock[ingredient.id] ?? 0;
      card.disabled =
        !playing || stock === 0 || state.cauldron.length >= rules.capacity;
      card.classList.toggle('depleted', stock === 0);
      card.querySelector('.stock')?.replaceChildren(String(stock));
      card.setAttribute(
        'aria-label',
        `${ingredient.name}, temperature ${signed(ingredient.temperature)}, density ${signed(ingredient.density)}, magic power ${signed(ingredient.magicPower)}, stock ${String(stock)}`,
      );
    });
    element('#recipe-name').textContent =
      state.recipe?.name ?? 'A recipe awaits';
    element('#counter').textContent =
      `Ingredients: ${String(state.cauldron.length)} / ${String(rules.capacity)}`;
    element('#counter').classList.toggle(
      'full',
      state.cauldron.length === rules.capacity,
    );
    element('.mixture').replaceChildren(
      ...state.cauldron.map((item) => {
        const li = document.createElement('li');
        li.textContent = `${item.icon} ${item.name}`;
        return li;
      }),
    );
    element('.empty-mix').hidden = state.cauldron.length > 0;
    const values = calculateCauldron(state.cauldron);
    const limit = state.difficulty === 'hard' ? 250 : 160;
    bars.forEach(({ key, container, value, target, marker, range }) => {
      const zone = state.recipe?.[key];
      container
        .querySelector('.bar-scale > span:first-child')
        ?.replaceChildren(String(-limit));
      container
        .querySelector('.bar-scale > span:last-child')
        ?.replaceChildren(String(limit));
      if (value) value.textContent = String(values[key]);
      if (marker)
        marker.style.left = `${String(((values[key] + limit) / (limit * 2)) * 100)}%`;
      if (target) {
        target.hidden = !zone;
        target.style.left = `${String((((zone?.min ?? 0) + limit) / (limit * 2)) * 100)}%`;
        target.style.width = `${String((((zone?.max ?? 0) - (zone?.min ?? 0)) / (limit * 2)) * 100)}%`;
      }
      if (range)
        range.textContent = zone
          ? `Target: ${String(zone.min)}…${String(zone.max)}`
          : 'Target: —';
      container.classList.toggle(
        'in-range',
        Boolean(zone && values[key] >= zone.min && values[key] <= zone.max),
      );
    });
    element('.feedback').textContent = state.message;
    if (state.status === 'game-over' && !dialog.open) {
      endedAt = Date.now();
      gameOver();
    }
  }
  function difficultyButtons(
    action: 'difficulty' | 'board',
    selected: Difficulty,
  ): string {
    return (
      '<div class="difficulty-options" role="group" aria-label="Difficulty">' +
      DIFFICULTIES.map((difficulty) => {
        const rules = DIFFICULTY_SETTINGS[difficulty];
        const summary =
          action === 'difficulty'
            ? `<span>${String(rules.shelfSize)} ingredients · max ${String(rules.capacity)} portions<br>${String(rules.time / 1000)}s · ${String(rules.lives)} lives · ±${String(rules.tolerance)}<br>+${String(rules.score)} points · +${String(rules.bonus / 1000)}s per brew</span>`
            : '';
        return `<button data-action="${action}" data-difficulty="${difficulty}" aria-pressed="${String(difficulty === selected)}">${rules.label}${summary}</button>`;
      }).join('') +
      '</div>'
    );
  }
  function showMenu(): void {
    showDialog(
      'Workshop menu',
      `<p>Choose your difficulty before starting a new game.</p>${difficultyButtons('difficulty', state.difficulty)}<div class="dialog-actions">${savedGame ? '<button data-action="continue">Continue Game</button>' : ''}<button class="primary" data-action="start">Start new game</button><button data-action="leaderboard">Leaderboard</button><button data-action="close">Back</button></div>`,
    );
  }
  function helpText(): string {
    const rules = DIFFICULTY_SETTINGS[state.difficulty];
    return `<p>${rules.label}: add up to ${String(rules.capacity)} portions from the shelf. Temperature (T), Density (D) and Magic Power (M) are added together, including negative values.</p><p>Match all three recipe ranges with ±${String(rules.tolerance)} tolerance, then Brew. Success earns ${String(rules.score)} points and ${String(rules.bonus / 1000)} seconds, capped at ${String(rules.time / 1000)} seconds. Failure costs one life. Every portion is spent.</p><p>You start with ${String(rules.time / 1000)} seconds and ${String(rules.lives)} lives. The run ends when time, lives or all ingredients run out. Leaving the tab pauses the game.</p><p>Choose Easy, Medium or Hard in Menu before starting. Unfinished games save automatically; Continue Game restores them on pause. Exit to Menu clears the save.</p><button data-action="close">Back to workshop</button>`;
  }
  function showPause(): void {
    showDialog(
      'A moment of stillness',
      '<p>Your potion can wait. The timer is paused.</p><div class="dialog-actions"><button class="primary" data-action="resume">Resume</button><button data-action="exit">Exit to Menu</button></div>',
    );
  }
  function showLeaderboard(): void {
    entries = readLeaderboard(boardDifficulty);
    showDialog(
      'The alchemists’ Top-10',
      `${difficultyButtons('board', boardDifficulty)}<div class="table-wrap"><table><thead><tr><th>Rank</th><th>Name</th><th>Score</th><th>Difficulty</th><th>Date</th></tr></thead><tbody></tbody></table></div><p class="board-message" role="status"></p><div class="dialog-actions"><button data-action="back">Back</button><button data-action="clear">Clear Leaderboard</button></div>`,
    );
    const tbody = element('tbody');
    entries.forEach((entry, index) => {
      const row = document.createElement('tr');
      [
        String(index + 1),
        entry.name,
        String(entry.score),
        DIFFICULTY_SETTINGS[boardDifficulty].label,
        formatDate(entry.date),
      ].forEach((text) => {
        const cell = document.createElement('td');
        cell.textContent = text;
        row.append(cell);
      });
      tbody.append(row);
    });
    if (!entries.length)
      element('.board-message').textContent =
        'No discoveries yet. Yours could be the first.';
  }
  root.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-action]')
        : null;
    if (!button || button.disabled) return;
    switch (button.dataset['action']) {
      case 'difficulty': {
        const difficulty = button.dataset['difficulty'];
        if (state.status !== 'menu' || !isDifficulty(difficulty)) break;
        state = createMenu(difficulty);
        render();
        showMenu();
        content
          .querySelector<HTMLElement>(`[data-difficulty="${difficulty}"]`)
          ?.focus();
        break;
      }
      case 'board': {
        const difficulty = button.dataset['difficulty'];
        if (!isDifficulty(difficulty)) break;
        boardDifficulty = difficulty;
        showLeaderboard();
        content
          .querySelector<HTMLElement>(`[data-difficulty="${difficulty}"]`)
          ?.focus();
        break;
      }
      case 'continue':
        if (state.status !== 'menu' || !savedGame) break;
        state = savedGame;
        savedGame = null;
        saved = false;
        render();
        showPause();
        break;
      case 'start':
        state = startGame(Date.now(), Math.random, state.difficulty);
        savedGame = null;
        saved = false;
        closeDialog();
        render();
        break;
      case 'brew':
        brew(state);
        render();
        break;
      case 'pause':
        pauseGame(state);
        render();
        if (state.status === 'paused') showPause();
        break;
      case 'resume':
        resumeGame(state);
        closeDialog();
        render();
        break;
      case 'exit':
        clearSave();
        savedGame = null;
        state = createMenu(state.difficulty);
        closeDialog();
        render();
        break;
      case 'help':
        if (state.status === 'playing') {
          pauseGame(state);
          render();
        }
        if (state.status === 'game-over') {
          gameOver();
          break;
        }
        showDialog('The art of brewing', helpText());
        break;
      case 'menu':
        if (state.status === 'playing') {
          pauseGame(state);
          render();
        }
        if (state.status === 'game-over') {
          gameOver();
          break;
        }
        if (state.status === 'paused') {
          showPause();
          break;
        }
        showMenu();
        break;
      case 'close':
        if (state.status === 'paused') showPause();
        else closeDialog();
        break;
      case 'leaderboard':
        boardDifficulty = state.difficulty;
        returnTo = state.status === 'game-over' ? 'game-over' : 'menu';
        showLeaderboard();
        break;
      case 'back':
        if (returnTo === 'game-over') gameOver();
        else showMenu();
        break;
      case 'clear':
        showDialog(
          'Clear Leaderboard?',
          '<p>This removes the results for the selected difficulty from this browser.</p><div class="dialog-actions"><button data-action="confirm-clear">Clear these results</button><button data-action="cancel-clear">Cancel</button></div>',
        );
        break;
      case 'cancel-clear':
        showLeaderboard();
        break;
      case 'confirm-clear':
        if (writeLeaderboard([], boardDifficulty)) {
          entries = [];
          showLeaderboard();
        } else {
          showLeaderboard();
          element('.board-message').textContent =
            'Storage is unavailable. Results could not be cleared.';
        }
        break;
    }
  });
  root.addEventListener('submit', (event) => {
    if (
      !(event.target instanceof HTMLFormElement) ||
      event.target.id !== 'score-form'
    )
      return;
    event.preventDefault();
    if (saved || state.status !== 'game-over') return;
    const input = element<HTMLInputElement>('#player-name');
    const name = input.value.trim();
    if (!validName(name)) {
      input.setCustomValidity('Use 2–15 letters, digits, spaces, _ or -.');
      input.reportValidity();
      return;
    }
    const next = rankEntries([
      ...readLeaderboard(state.difficulty),
      { name, score: state.score, date: endedAt },
    ]);
    if (writeLeaderboard(next, state.difficulty)) {
      entries = next;
      saved = true;
      gameOver();
    } else
      element('#save-message').textContent =
        'Storage is unavailable. Please try saving again.';
  });
  root.addEventListener('input', (event) => {
    if (event.target instanceof HTMLInputElement)
      event.target.setCustomValidity('');
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (state.status === 'paused') {
      resumeGame(state);
      closeDialog();
      render();
    } else if (state.status === 'game-over') gameOver();
    else closeDialog();
  });
  window.addEventListener('pagehide', () => {
    if (state.status === 'playing') pauseGame(state);
    if (state.status !== 'menu') saveGame(state);
  });
  window.addEventListener('pageshow', () => {
    if (state.status === 'paused') {
      render();
      showPause();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.status === 'playing') {
      handlePause();
    }
  });
  function handlePause(): void {
    pauseGame(state);
    render();
    if (state.status === 'paused') showPause();
  }
  window.setInterval(() => {
    if (state.status !== 'playing') return;
    updateTime(state);
    updateClock();
    saveGame(state);
    if (state.timeLeft === 0) render();
  }, 1000);
  render();
}
