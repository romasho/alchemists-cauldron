import { DIFFICULTY_SETTINGS, isDifficulty } from '../data/difficulty.ts';
import { INGREDIENTS } from '../data/ingredients.ts';
import { REACTIONS } from '../data/reactions.ts';
import { clearSave, loadGame, saveGame } from '../storage/save.ts';
import { bindDragDrop } from './drag-drop.ts';
import {
  calculateMixture,
  checkBrew,
  activeReactions,
  formatTime,
  PARAMETERS,
} from '../logic/brewing.ts';
import type { GameState } from '../state/game-state.ts';
import {
  addIngredient,
  brew,
  createMenu,
  pauseGame,
  resumeGame,
  getShelf,
  pourOut,
  startGame,
  updateTime,
} from '../state/game-state.ts';
import {
  formatDate,
  qualifies,
  recordResult,
  readLeaderboard,
  validName,
  writeLeaderboard,
} from '../storage/leaderboard.ts';

import {
  icon,
  ingredientDetails,
  ingredientView,
  LABELS,
  parameterView,
  difficultyMenu,
  ingredientImage,
  workshopView,
} from './workshop-view.ts';
import { parameterStatus } from './parameter-status.ts';

export function mountGame(
  root: HTMLElement,
  initialState: GameState = createMenu(),
  options: { persist?: boolean } = {},
): void {
  let state = initialState;
  const persist = options.persist ?? true;
  let savedGame = persist ? loadGame() : null;
  const rules = () => DIFFICULTY_SETTINGS[state.difficulty];
  let entries = readLeaderboard(state.difficulty);
  let saved = false;
  let endedAt = 0;
  let returnTo: 'menu' | 'game-over' = 'menu';
  let opener: HTMLElement | null = null;
  root.innerHTML = workshopView();
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
  let resumeAfterDetails = false;
  let reaction: 'success' | 'error' | null = null;
  const hideTooltips = (): void => {
    root.querySelectorAll<HTMLElement>('.ingredient-tooltip').forEach((tip) => {
      tip.hidden = true;
    });
  };
  const canAdd = (id: string): boolean =>
    state.status === 'playing' &&
    state.cauldron.length < rules().capacity &&
    (state.stock[id] ?? 0) > 0 &&
    getShelf(state.difficulty).some((item) => item.id === id);
  const add = (id: string): void => {
    if (!canAdd(id)) return;
    const lives = state.lives;
    reaction = null;
    addIngredient(state, id);
    if (state.lives < lives) reaction = 'error';
    hideTooltips();
    render();
  };
  const cards = INGREDIENTS.map((ingredient) => {
    const card = document.createElement('div');
    card.className = 'ingredient-card';
    card.innerHTML = ingredientView(ingredient);
    const button = card.querySelector<HTMLButtonElement>('.ingredient');
    const tip = card.querySelector<HTMLElement>('.ingredient-tooltip');
    if (!button || !tip) throw new Error('Missing ingredient control');
    root.append(tip);
    function showTip(): void {
      if (
        state.status !== 'playing' ||
        (state.stock[ingredient.id] ?? 0) === 0 ||
        window.innerWidth < 801
      )
        return;
      hideTooltips();
      if (!tip) return;
      tip.hidden = false;
      const rect = card.getBoundingClientRect();
      const size = tip.getBoundingClientRect();
      let left = rect.right + 8;
      if (left + size.width > window.innerWidth - 8)
        left = rect.left - size.width - 8;
      let top = rect.top;
      if (top + size.height > window.innerHeight - 8)
        top = rect.bottom - size.height;
      tip.style.left = `${String(Math.max(8, left))}px`;
      tip.style.top = `${String(Math.max(8, top))}px`;
    }
    button.addEventListener('click', () => {
      add(ingredient.id);
    });
    card.addEventListener('mouseenter', showTip);
    card.addEventListener('mouseleave', () => {
      tip.hidden = true;
    });
    card.addEventListener('focusin', showTip);
    card.addEventListener('focusout', () => {
      tip.hidden = true;
    });
    shelf.append(card);
    return button;
  });
  bindDragDrop(root, canAdd, add);
  element('.scene').addEventListener('scroll', hideTooltips);
  window.addEventListener('resize', hideTooltips);
  const bars = PARAMETERS.map((key) => {
    const container = document.createElement('div');
    container.className = `parameter ${key}`;
    container.innerHTML = parameterView(key);
    element('.bars').append(container);
    return {
      key,
      container,
      value: container.querySelector('strong'),
      target: container.querySelector<HTMLElement>('.target'),
      tolerance: container.querySelector<HTMLElement>('.tolerance'),
      marker: container.querySelector<HTMLElement>('.marker'),
      track: container.querySelector<HTMLElement>('.track'),
      range: container.querySelector('.range-label'),
      status: container.querySelector('.parameter-status'),
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
    (
      content.querySelector<HTMLElement>('[aria-pressed="true"]') ??
      content.querySelector<HTMLElement>('input, button')
    )?.focus();
  }
  function closeDialog(): void {
    dialog.close();
    if (
      opener?.isConnected &&
      !opener.closest('[hidden]') &&
      !opener.hasAttribute('disabled')
    )
      opener.focus();
    else
      root
        .querySelector<HTMLElement>(
          '[data-action="pause"]:not(:disabled), [data-action="start"]:not([hidden])',
        )
        ?.focus();
  }
  function updateClock(): void {
    element('#score').textContent = String(state.score);
    element('#time').textContent = formatTime(state.timeLeft);
    element<HTMLProgressElement>('#time-bar').value = state.timeLeft;
    element('.timer').classList.toggle(
      'urgent',
      state.timeLeft > 0 && state.timeLeft < 15_000,
    );
    element('#lives').innerHTML =
      state.lives > 0 ? icon('heart').repeat(state.lives) : '—';
    element('#lives').setAttribute(
      'aria-label',
      `${String(state.lives)} lives`,
    );
  }
  function gameOver(): void {
    entries = readLeaderboard(state.difficulty);
    const canSave = !saved && qualifies(entries, state.score);
    showDialog(
      'Game Over',
      `<p>${state.reason}</p><p class="final-score">${String(state.score)} <small>points</small></p>${canSave ? '<form id="score-form"><label for="player-name">You made the Top-10! Your name</label><input id="player-name" name="name" minlength="2" maxlength="15" required autocomplete="nickname" aria-describedby="name-hint"><p id="name-hint" class="footnote">2–15 characters: letters, digits, spaces, _ or -.</p><button class="primary" type="submit">Save result</button><p id="save-message" role="status"></p></form>' : '<p>Your run is complete.</p>'}<div class="dialog-actions"><button class="primary" data-action="start">Play again</button><button data-action="leaderboard">Leaderboard</button><button data-action="exit">Exit to Menu</button></div>`,
    );
  }
  function renderShelf(): void {
    const playing = state.status === 'playing';
    const menu = state.status === 'menu';
    const full = state.cauldron.length >= rules().capacity;
    element('.shelf-status').textContent = menu
      ? 'Start a game to open the shelf.'
      : full
        ? 'Cauldron full · Brew to make room.'
        : 'Choose an ingredient to add one portion.';
    cards.forEach((card, index) => {
      const ingredient = INGREDIENTS[index];
      if (!ingredient) return;
      const stock = state.stock[ingredient.id] ?? 0;
      const shown = !menu && index < rules().shelfSize;
      if (card.parentElement) card.parentElement.hidden = !shown;
      const unavailable = !playing || stock === 0 || full;
      card.disabled = unavailable;
      card.draggable = !unavailable;
      const info =
        card.parentElement?.querySelector<HTMLButtonElement>(
          '.ingredient-info',
        );
      if (info) {
        info.hidden = stock === 0 || menu;
        info.disabled = !playing || stock === 0;
      }
      card.setAttribute('aria-disabled', String(unavailable));
      card.classList.toggle('depleted', !menu && stock === 0);
      card.classList.toggle('capacity-blocked', full && stock > 0);
      const availability = menu
        ? 'Start to add'
        : stock === 0
          ? 'Out of stock'
          : full
            ? 'Cauldron full'
            : 'Add portion';
      card
        .querySelector('.ingredient-availability')
        ?.replaceChildren(availability);
      root
        .querySelector(`#tip-${ingredient.id} .tooltip-stock`)
        ?.replaceChildren(
          menu
            ? 'Stock is assigned when the game starts.'
            : `${String(stock)} portions remaining. ${availability}.`,
        );
      card.querySelector('.stock')?.replaceChildren(menu ? '—' : String(stock));
      card.setAttribute(
        'aria-label',
        `${ingredient.name}, stock ${String(stock)}, ${availability}`,
      );
    });
  }
  function renderRecipe(): void {
    element('#recipe-name').textContent =
      state.recipe?.name ?? 'A recipe awaits';
    element('.recipe-ranges').replaceChildren(
      ...PARAMETERS.map((key) => {
        const row = document.createElement('div');
        row.className = key;
        const label = document.createElement('dt');
        label.setAttribute('aria-label', LABELS[key]);
        label.innerHTML = `${icon(key)}<span class="recipe-label-full">${LABELS[key]}</span><span class="recipe-label-short" aria-hidden="true">${key === 'temperature' ? 'Temp.' : key === 'magicPower' ? 'Magic' : 'Density'}</span>`;
        const value = document.createElement('dd');
        const zone = state.recipe?.[key];
        value.textContent = zone
          ? `${String(zone.min)} … ${String(zone.max)}`
          : '—';
        row.append(label, value);
        return row;
      }),
    );
    element('#counter').textContent =
      `Ingredients: ${String(state.cauldron.length)} / ${String(rules().capacity)}`;
    element('#counter').classList.toggle(
      'full',
      state.cauldron.length === rules().capacity,
    );
  }
  function renderCauldron(): void {
    element('.mixture').replaceChildren(
      ...state.cauldron.map((item) => {
        const li = document.createElement('li');
        li.textContent = `${item.icon} ${item.name}`;
        return li;
      }),
    );
    element('.floating-ingredients').replaceChildren(
      ...state.cauldron.map((item, index) => {
        const img = document.createElement('img');
        img.src = ingredientImage(item.id);
        img.alt = '';
        img.style.setProperty('--index', String(index));
        return img;
      }),
    );
    const active = activeReactions(state.cauldron, state.difficulty);
    element('.reaction-label').textContent = active.length
      ? `Active: ${active.map((item) => item.name).join(' · ')}`
      : state.lastReactionId
        ? `Last reaction: ${REACTIONS.find((item) => item.id === state.lastReactionId)?.name ?? ''}`
        : '';
    element('.empty-mix').hidden = state.cauldron.length > 0;
    const count = state.cauldron.length;
    element('.portion-count').textContent =
      `${String(count)} / ${String(rules().capacity)}`;
    const ready = Boolean(
      count &&
      state.recipe &&
      checkBrew(state.cauldron, state.recipe, state.difficulty),
    );
    const cauldronState =
      reaction ?? (ready ? 'ready' : count ? 'filling' : 'empty');
    element('.cauldron-panel').dataset['state'] = cauldronState;
    element('.cauldron-panel').style.setProperty(
      '--fill',
      String(count / rules().capacity),
    );
    element('.cauldron-state').textContent =
      reaction === 'success'
        ? '✓ Potion brewed successfully!'
        : reaction === 'error'
          ? '✕ The mixture failed. Try another combination.'
          : ready
            ? '✓ All parameters within tolerance. Ready to brew!'
            : count === rules().capacity
              ? 'Cauldron full. Brew this mixture.'
              : count
                ? 'Mixture in progress. Add a portion or brew.'
                : 'Choose an ingredient to begin.';
  }
  function renderParameters(): void {
    const values = calculateMixture(state.cauldron, state.difficulty);
    bars.forEach(
      ({
        key,
        container,
        value,
        target,
        tolerance,
        marker,
        track,
        range,
        status,
      }) => {
        const zone = state.recipe?.[key];
        const min = Math.min(
          -160,
          Math.floor((values[key] - rules().tolerance) / 40) * 40,
        );
        const max = Math.max(
          160,
          Math.ceil((values[key] + rules().tolerance) / 40) * 40,
        );
        const extent = max - min;
        const percent = (number: number): number =>
          ((number - min) / extent) * 100;
        container.querySelector('.scale-min')?.replaceChildren(String(min));
        container.querySelector('.scale-max')?.replaceChildren(String(max));
        const zero = container.querySelector<HTMLElement>('.zero');
        if (zero) zero.style.left = `${String(percent(0))}%`;
        track?.setAttribute('aria-valuemin', String(min));
        track?.setAttribute('aria-valuemax', String(max));
        if (value) value.textContent = String(values[key]);
        if (marker) marker.style.left = `${String(percent(values[key]))}%`;
        if (target) {
          target.hidden = !zone;
          target.style.left = `${String(percent(zone?.min ?? 0))}%`;
          target.style.width = `${String((((zone?.max ?? 0) - (zone?.min ?? 0)) / extent) * 100)}%`;
        }
        if (tolerance) {
          tolerance.hidden = !zone;
          tolerance.style.left = `${String(percent((zone?.min ?? 0) - rules().tolerance))}%`;
          tolerance.style.width = `${String((((zone?.max ?? 0) - (zone?.min ?? 0) + 2 * rules().tolerance) / extent) * 100)}%`;
        }
        const statusText = parameterStatus(
          values[key],
          zone,
          rules().tolerance,
        );
        if (status) status.textContent = statusText;
        track?.setAttribute('aria-valuenow', String(values[key]));
        track?.setAttribute(
          'aria-valuetext',
          `${String(values[key])}. ${zone ? `Target ${String(zone.min)} to ${String(zone.max)}. ` : ''}${statusText}`,
        );
        if (range)
          range.textContent = zone
            ? `Target: ${String(zone.min)}…${String(zone.max)}`
            : 'Target: —';
        container.classList.toggle(
          'in-range',
          Boolean(zone && values[key] >= zone.min && values[key] <= zone.max),
        );
      },
    );
  }
  function render(): void {
    updateClock();
    element('.workshop').dataset['status'] = state.status;
    element('.workshop').dataset['difficulty'] = state.difficulty;
    element<HTMLProgressElement>('#time-bar').max = rules().time;
    element('.workshop').classList.toggle('shake', reaction === 'error');
    if (state.status !== 'playing') hideTooltips();
    const playing = state.status === 'playing';
    const menu = state.status === 'menu';
    field.classList.toggle('obscured', state.status === 'paused');
    field.inert = state.status === 'paused' || state.status === 'game-over';
    field.setAttribute('aria-hidden', String(state.status === 'paused'));
    element<HTMLButtonElement>('[data-action="pause"]').disabled = !playing;
    element<HTMLButtonElement>('.brew').disabled =
      !playing || !state.cauldron.length;
    element('.brew').hidden = menu;
    const startButton = element<HTMLButtonElement>('.start');
    const canContinue = menu && Boolean(savedGame);
    startButton.hidden = !menu;
    startButton.textContent = canContinue ? 'Continue Game' : 'Start Game';
    startButton.dataset['action'] = canContinue ? 'continue' : 'start';
    element('.pour').hidden = menu;
    element<HTMLButtonElement>('.pour').disabled =
      !playing || !state.cauldron.length;
    root.querySelectorAll('.tolerance-value').forEach((label) => {
      label.textContent = `±${String(rules().tolerance)}`;
    });
    element('.brew-hint').hidden = menu || !state.cauldron.length;
    element('.brew-hint').textContent = state.cauldron.length
      ? `Brew ${String(state.cauldron.length)} of ${String(rules().capacity)} possible portions.`
      : '';
    renderShelf();
    renderRecipe();
    renderCauldron();
    renderParameters();
    element('.feedback').hidden = menu;
    element('.feedback').textContent = menu ? '' : state.message;
    if (persist && (state.status === 'playing' || state.status === 'paused'))
      saveGame(state);
    if (persist && state.status === 'game-over') {
      clearSave();
      savedGame = null;
    }
    if (state.status === 'game-over' && !dialog.open) {
      endedAt = Date.now();
      gameOver();
    }
  }
  function showPause(): void {
    showDialog(
      'A moment of stillness',
      '<p>Your potion can wait. The timer is paused.</p><div class="dialog-actions"><button class="primary" data-action="resume">Resume</button><button data-action="exit">Exit to Menu</button></div>',
    );
  }
  function showLeaderboard(): void {
    entries = readLeaderboard(state.difficulty);
    showDialog(
      'The alchemists’ Top-10',
      '<div class="table-wrap"><table><thead><tr><th>Rank</th><th>Name</th><th>Difficulty</th><th>Score</th><th>Date</th></tr></thead><tbody></tbody></table></div><p class="board-message" role="status"></p><div class="dialog-actions"><button data-action="back">Back</button><button data-action="clear">Clear Leaderboard</button></div>',
    );
    const tbody = element('tbody');
    entries.forEach((entry, index) => {
      const row = document.createElement('tr');
      [
        String(index + 1),
        entry.name,
        state.difficulty,
        String(entry.score),
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
        entries = readLeaderboard(difficulty);
        render();
        showDialog(
          'Workshop menu',
          difficultyMenu(difficulty, Boolean(savedGame)),
        );
        break;
      }
      case 'continue':
        if (state.status !== 'menu' || !savedGame) break;
        state = savedGame;
        state.status = 'paused';
        entries = readLeaderboard(state.difficulty);
        savedGame = null;
        saved = false;
        render();
        showPause();
        break;
      case 'pour':
        reaction = null;
        pourOut(state);
        render();
        break;
      case 'start':
        reaction = null;
        state = startGame(Date.now(), Math.random, state.difficulty);
        entries = readLeaderboard(state.difficulty);
        savedGame = null;
        saved = false;
        render();
        closeDialog();
        break;
      case 'brew': {
        const previousScore = state.score;
        const previousLives = state.lives;
        brew(state);
        reaction =
          state.score > previousScore
            ? 'success'
            : state.lives < previousLives
              ? 'error'
              : null;
        render();
        break;
      }
      case 'ingredient-info': {
        const ingredient = getShelf(state.difficulty).find(
          (item) => item.id === button.dataset['id'],
        );
        if (!ingredient) break;
        resumeAfterDetails = state.status === 'playing';
        if (resumeAfterDetails) {
          pauseGame(state);
          render();
        }
        if (state.status === 'game-over') {
          resumeAfterDetails = false;
          gameOver();
          break;
        }
        showDialog(
          ingredient.name,
          ingredientDetails(ingredient, state.stock[ingredient.id] ?? 0),
        );
        break;
      }
      case 'detail-close':
        if (state.status === 'game-over') {
          resumeAfterDetails = false;
          gameOver();
          break;
        }
        if (resumeAfterDetails && state.status === 'paused') resumeGame(state);
        resumeAfterDetails = false;
        render();
        closeDialog();
        break;
      case 'pause':
        pauseGame(state);
        render();
        if (state.status === 'paused') showPause();
        break;
      case 'resume':
        resumeGame(state);
        render();
        closeDialog();
        break;
      case 'exit':
        reaction = null;
        if (persist) clearSave();
        savedGame = null;
        state = createMenu(state.difficulty);
        render();
        closeDialog();
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
        showDialog(
          'The art of brewing',
          `<p>Choose Easy, Medium or Hard in Menu before starting. ${state.difficulty}: ${String(rules().shelfSize)} ingredients, up to ${String(rules().capacity)} portions, ${String(rules().time / 1000)} seconds and ${String(rules().lives)} lives.</p><p>Click or drag an ingredient into the cauldron. Hover or focus for its signed base values; use the information button on a phone. Stock is spent immediately.</p><p>Match all three ranges with ±${String(rules().tolerance)} tolerance. Success earns ${String(rules().score)} points and ${String(rules().bonus / 1000)} seconds, capped at ${formatTime(rules().time)}. Failure costs one life. Pour Out clears the mixture for 10 seconds.</p><p>Enabled reactions: ${
            rules()
              .reactions.map(
                (id) => REACTIONS.find((item) => item.id === id)?.name ?? id,
              )
              .join(', ') || 'none'
          }. Bubbling increases magic by 50% and costs 10 seconds once. Solar Frost sets temperature to 0 and adds 20% density. Volatile Mix loses a life and clears the cauldron.</p><p>Shortcuts during play: 1–8 add ingredients, B brews, O pours out, P pauses. On pause, use the focused Resume button with Enter or Escape. Shortcuts do not run in text fields, menus or dialogs.</p><p>Unfinished games are saved automatically. Continue Game restores them paused. Exit to Menu clears the save.</p><button data-action="close">Back to workshop</button>`,
        );
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
        showDialog(
          'Workshop menu',
          difficultyMenu(state.difficulty, Boolean(savedGame)),
        );
        break;
      case 'close':
        if (state.status === 'paused') showPause();
        else closeDialog();
        break;
      case 'leaderboard':
        returnTo = state.status === 'game-over' ? 'game-over' : 'menu';
        showLeaderboard();
        break;
      case 'back':
        if (returnTo === 'game-over') gameOver();
        else closeDialog();
        break;
      case 'clear':
        showDialog(
          'Clear Leaderboard?',
          `<p>This removes the ${state.difficulty} Top-10 from this browser.</p><div class="dialog-actions"><button data-action="confirm-clear">Clear this board</button><button data-action="cancel-clear">Cancel</button></div>`,
        );
        break;
      case 'cancel-clear':
        showLeaderboard();
        break;
      case 'confirm-clear':
        if (writeLeaderboard([], state.difficulty)) {
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
  root.addEventListener('animationend', (event) => {
    if (
      event.animationName !== 'brew-success' &&
      event.animationName !== 'brew-error'
    )
      return;
    reaction = null;
    render();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideTooltips();
    if (
      state.status !== 'playing' ||
      dialog.open ||
      event.repeat ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || target.closest('input, textarea, select'))
    )
      return;
    const index = Number(event.key) - 1;
    if (/^[1-8]$/.test(event.key)) {
      const ingredient = getShelf(state.difficulty)[index];
      if (ingredient) {
        event.preventDefault();
        add(ingredient.id);
      }
      return;
    }
    const action = { b: 'brew', o: 'pour', p: 'pause' }[
      event.key.toLowerCase()
    ];
    if (action) {
      event.preventDefault();
      element<HTMLButtonElement>(`[data-action="${action}"]`).click();
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
    const result = recordResult(
      { name, score: state.score, date: endedAt },
      state.difficulty,
    );
    if (result === 'saved') {
      saved = true;
      gameOver();
    } else if (result === 'not-qualified') {
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
      render();
      closeDialog();
    } else if (state.status === 'game-over') gameOver();
    else closeDialog();
    resumeAfterDetails = false;
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
  let lastSavedSecond = -1;
  window.addEventListener('pagehide', () => {
    if (persist && state.status === 'playing') {
      pauseGame(state);
      saveGame(state);
    }
  });
  window.setInterval(() => {
    if (state.status !== 'playing') return;
    updateTime(state);
    updateClock();
    const second = Math.ceil(state.timeLeft / 1000);
    if (persist && second !== lastSavedSecond) {
      saveGame(state);
      lastSavedSecond = second;
    }
    if (state.timeLeft === 0) render();
  }, 100);
  render();
}
