import './styles/style.css';
import { mountGame } from './ui/game';

const root = document.querySelector<HTMLDivElement>('#app');

if (root === null) {
  throw new Error('Application root #app is missing.');
}

mountGame(root);
