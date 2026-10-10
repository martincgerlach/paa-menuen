import { getRecipes } from './api.js';
import { filterRecipes, readFilters, pickRecipe } from './filters.js';
import { activeFiltersQuery } from './storage.js';
import { initCommon, loadWithRetry, renderRecipes, showChips, status } from './ui.js';
initCommon();
let recipes = [],
  previousId = null;
const form = document.getElementById('dice-form'),
  checkbox = document.getElementById('use-filters'),
  button = document.getElementById('dice-roll');
let filters = readFilters(location.search || activeFiltersQuery());
function candidates() {
  return checkbox.checked ? filterRecipes(recipes, filters) : recipes;
}
function preview() {
  showChips(document.getElementById('active-filters'), checkbox.checked ? filters : readFilters(''));
  const count = candidates().length;
  const hasFilters = filters.q || filters.rating !== null
    || ['cuisine', 'meal', 'time', 'difficulty', 'ingredients'].some(key => filters[key].length);
  if (!count) {
    status('Ingen opskrifter matcher. Skift filtre på opskriftssiden eller slå aktive filtre fra.', 'empty');
  } else {
    const mode = checkbox.checked && hasFilters ? 'Aktive filtre bruges.' : 'Alle opskrifter bruges.';
    status(`${count} opskrifter at vælge mellem. ${mode}`);
  }
  button.disabled = !count;
}
checkbox.addEventListener('change', () => {
  document.getElementById('dice-result').replaceChildren();
  previousId = null;
  preview();
});
form.addEventListener('submit', event => {
  event.preventDefault();
  const recipe = pickRecipe(candidates(), previousId);
  if (!recipe) {
    preview();
    return;
  }
  previousId = recipe.id;
  renderRecipes(document.getElementById('dice-result'), [recipe]);
  button.textContent = 'Kast igen';
  status(`Dit forslag: ${recipe.name}`);
});
button.disabled = true;
await loadWithRetry(async () => {
  recipes = await getRecipes();
  preview();
});
