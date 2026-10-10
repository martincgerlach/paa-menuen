import { getRecipes } from './api.js';
import { getFavoriteIds } from './favorites.js';
import { initCommon, loadWithRetry, renderRecipes, status } from './ui.js';
initCommon();
let recipes = [];
function render() {
  const root = document.getElementById('recipe-grid');
  const buttons = [...root.querySelectorAll('button')];
  const focusedIndex = buttons.indexOf(document.activeElement);
  const ids = getFavoriteIds(),
    saved = recipes.filter(r => ids.includes(r.id));
  const missing = ids.filter(id => !recipes.some(r => r.id === id));
  const missingMessage = `${missing.length} gemte opskrifter er ikke længere tilgængelige i API’et.`;
  renderRecipes(root, saved);
  if (!saved.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const message = document.createElement('p');
    message.textContent = ids.length
      ? missingMessage
      : 'Du har ingen favoritter endnu.';
    const link = document.createElement('a');
    link.href = 'productlist.html';
    link.textContent = 'Find opskrifter';
    link.className = 'button button-secondary';
    empty.append(message, link);
    root.append(empty);
  }
  status(saved.length && missing.length ? missingMessage : '');
  missing.forEach(id => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `Fjern utilgængelig opskrift ${id}`;
    button.addEventListener('click', async () => {
      const {
        toggleFavorite
      } = await import('./favorites.js');
      toggleFavorite(id);
      render();
    });
    root.append(button);
  });
  if (focusedIndex >= 0) {
    const remaining = [...root.querySelectorAll('button')];
    const target = remaining[Math.min(focusedIndex, remaining.length - 1)]
      || root.querySelector('a');
    target?.focus();
  }
}
document.addEventListener('favorites-changed', render);
await loadWithRetry(async () => {
  recipes = await getRecipes();
  render();
});
