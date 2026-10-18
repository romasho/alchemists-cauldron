import './styles/style.css';
import { renderSetupScreen } from './ui/setup-screen';

const root = document.querySelector<HTMLDivElement>('#app');

if (root === null) {
  throw new Error('Application root #app is missing.');
}

renderSetupScreen(root);
