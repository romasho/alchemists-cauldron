import cauldronIcon from '../assets/cauldron.svg';

export function renderSetupScreen(root: HTMLElement): void {
  const screen = document.createElement('main');
  screen.className = 'setup-screen';

  const icon = document.createElement('img');
  icon.src = cauldronIcon;
  icon.alt = '';
  icon.width = 96;
  icon.height = 96;

  const eyebrow = document.createElement('p');
  eyebrow.className = 'setup-screen__eyebrow';
  eyebrow.textContent = 'THE WORKSHOP';

  const heading = document.createElement('h1');
  heading.textContent = "Alchemist's Cauldron";

  const description = document.createElement('p');
  description.className = 'setup-screen__description';
  description.textContent =
    'A little heat, a little magic. Mix ingredients and discover the perfect potion.';

  const status = document.createElement('p');
  status.className = 'setup-screen__status';
  status.textContent = 'Workshop prepared · Gameplay arrives in Level 1';

  screen.append(icon, eyebrow, heading, description, status);
  root.replaceChildren(screen);
}
