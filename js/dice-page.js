import { getRecipes } from './api.js';
import { filterRecipes, readFilters, pickRecipe } from './filters.js';
import { activeFiltersQuery } from './storage.js';
import { initCommon, loadWithRetry, renderRecipes, showChips, status } from './ui.js';
initCommon();
let recipes = [], previousId = null;
const form = document.getElementById('dice-form'), checkbox = document.getElementById('use-filters'), button = document.getElementById('dice-roll');
let filters = readFilters(location.search || activeFiltersQuery());
function candidates() { return checkbox.checked ? filterRecipes(recipes, filters) : recipes; }
function preview() {
  showChips(document.getElementById('active-filters'), checkbox.checked ? filters : readFilters(''));
  const count = candidates().length;
  status(count ? `${count} opskrifter at vælge mellem.${checkbox.checked ? ' Aktive filtre bruges.' : ' Alle opskrifter bruges.'}` : 'Ingen opskrifter matcher. Skift filtre på opskriftssiden eller slå aktive filtre fra.', count ? '' : 'empty');
  button.disabled = !count;
}
checkbox.addEventListener('change', () => { document.getElementById('dice-result').replaceChildren(); previousId = null; preview(); });
form.addEventListener('submit', event => { event.preventDefault(); const recipe = pickRecipe(candidates(), previousId);
  if (!recipe) { preview(); return; }
  previousId = recipe.id; renderRecipes(document.getElementById('dice-result'), [recipe]); button.textContent = 'Kast igen'; status(`Dit forslag: ${recipe.name}`);
});
button.disabled = true;
await loadWithRetry(async () => { recipes = await getRecipes(); preview(); });
