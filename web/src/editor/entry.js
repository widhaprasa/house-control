// The standalone editor: a web page that only makes the floor-plan JSON. It has no
// connections to real devices; entity bindings are plain Home Assistant entity IDs.
import { bootEditor } from './editor.js';

const app = document.getElementById('app');

bootEditor(app, { standalone: true }).catch((error) => {
  console.error(error);
  app.replaceChildren();
  const message = document.createElement('div');
  message.className = 'fatal';
  message.textContent = `The editor could not start: ${error?.message || error}`;
  app.append(message);
});
