import type { Ingredient } from '../data/types.ts';

export const signed = (value: number): string =>
  value > 0
    ? `+${String(value)}`
    : value < 0
      ? `−${String(Math.abs(value))}`
      : '0';

export function createTooltip(root: HTMLElement): {
  show: (card: HTMLElement, ingredient: Ingredient) => void;
  hide: () => void;
} {
  const tooltip = document.createElement('div');
  tooltip.id = 'ingredient-tooltip';
  tooltip.className = 'ingredient-tooltip';
  tooltip.role = 'tooltip';
  tooltip.hidden = true;
  root.append(tooltip);
  let owner: HTMLElement | null = null;
  function hide(): void {
    tooltip.hidden = true;
    owner?.removeAttribute('aria-describedby');
    owner = null;
  }
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
  return {
    hide,
    show(card, ingredient) {
      hide();
      owner = card;
      card.setAttribute('aria-describedby', tooltip.id);
      tooltip.textContent = `${ingredient.name}\nTemperature ${signed(ingredient.temperature)}\nDensity ${signed(ingredient.density)}\nMagic Power ${signed(ingredient.magicPower)}`;
      tooltip.hidden = false;
      const cardRect = card.getBoundingClientRect();
      const rect = tooltip.getBoundingClientRect();
      const left =
        cardRect.right + 8 + rect.width > window.innerWidth
          ? cardRect.left - rect.width - 8
          : cardRect.right + 8;
      const top =
        cardRect.top + rect.height > window.innerHeight - 8
          ? cardRect.top - rect.height - 8
          : cardRect.top;
      tooltip.style.left = `${String(Math.max(8, Math.min(left, window.innerWidth - rect.width - 8)))}px`;
      tooltip.style.top = `${String(Math.max(8, Math.min(top, window.innerHeight - rect.height - 8)))}px`;
    },
  };
}
