import { getRecipes } from './api.js';
import { getFavoriteIds } from './favorites.js';
import { initCommon, loadWithRetry, renderRecipes, status } from './ui.js';
initCommon(); let recipes = [];
function render() {
  const ids = getFavoriteIds(), saved = recipes.filter(r => ids.includes(r.id));
  const root = document.getElementById('recipe-grid'); renderRecipes(root, saved);
  if (!ids.length) {
    const link = document.createElement('a');
    link.href = 'productlist.html';
    link.textContent = 'Find opskrifter';
    root.append(link);
  }
  const missing = ids.filter(id => !recipes.some(r => r.id === id));
  status(!ids.length ? 'Du har ingen favoritter endnu. Find en opskrift og vælg Gem.' : missing.length ? `${missing.length} gemte opskrifter er ikke længere tilgængelige i API’et.` : '', !ids.length ? 'empty' : '');
  missing.forEach(id => { const button = document.createElement('button'); button.type = 'button'; button.textContent = `Fjern utilgængelig opskrift ${id}`;
    button.addEventListener('click', async () => { const { toggleFavorite } = await import('./favorites.js'); toggleFavorite(id); render(); }); root.append(button); });
}
document.addEventListener('favorites-changed', render);
await loadWithRetry(async () => { recipes = await getRecipes(); render(); });
