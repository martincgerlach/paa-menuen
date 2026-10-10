import { getRecipes } from './api.js';
import { emptyFilters, filterRecipes, readFilters, writeFilters, sortRecipes } from './filters.js';
import { displayLabel } from './labels.js';
import { saveActiveFilters } from './storage.js';
import { el, initCommon, loadWithRetry, renderRecipes, showChips, status } from './ui.js';
initCommon();
let recipes = [],
  filters = readFilters(location.search),
  visible = 12;
const panel = document.getElementById('filter-panel'),
  form = document.getElementById('filter-form');
const searchForm = document.getElementById('search-form'),
  sort = document.getElementById('sort');
searchForm.elements.q.value = filters.q;
function populateOptions() {
  for (const [key, field, id] of [['cuisine', 'cuisine', 'cuisine-options'], ['meal', 'mealType', 'meal-options'], ['difficulty', 'difficulty', 'difficulty-options']]) {
    const values = [...new Set(recipes.flatMap(r => Array.isArray(r[field]) ? r[field] : [r[field]]).map(x => x === 'Snacks' ? 'Snack' : x).filter(Boolean))].sort((a, b) => displayLabel(a).localeCompare(displayLabel(b), 'da'));
    const box = document.getElementById(id);
    box.replaceChildren();
    values.forEach(value => {
      const label = el('label', undefined, 'filter-option'),
        input = el('input');
      input.type = 'checkbox';
      input.name = key;
      input.value = value;
      label.append(input, el('span', displayLabel(value)));
      box.append(label);
    });
  }
}
function syncForm() {
  form.querySelectorAll('input[type=checkbox]').forEach(input => {
    input.checked = filters[input.name]?.includes(input.value) || false;
  });
  form.elements.rating.value = filters.rating === null ? '' : filters.rating;
  form.elements.ingredients.value = filters.ingredients.join(', ');
}
function draftFilters() {
  const data = new FormData(form),
    draft = {
      ...emptyFilters(),
      q: searchForm.elements.q.value.trim()
    };
  for (const key of ['cuisine', 'meal', 'time', 'difficulty']) draft[key] = data.getAll(key);
  draft.rating = data.get('rating') === '' ? null : Number(data.get('rating'));
  draft.ingredients = String(data.get('ingredients') || '').split(',').map(x => x.trim()).filter(Boolean);
  return draft;
}
function updatePreview() {
  document.getElementById('filter-apply').textContent = `Vis ${filterRecipes(recipes, draftFilters()).length} opskrifter`;
}
function render() {
  const matches = sortRecipes(filterRecipes(recipes, filters), sort.value);
  renderRecipes(document.getElementById('recipe-grid'), matches.slice(0, visible));
  document.getElementById('result-count').textContent = `${matches.length} opskrifter`;
  document.getElementById('load-more').hidden = visible >= matches.length;
  showChips(document.getElementById('active-filters'), filters, (key, value) => {
    if (key === 'q') {
      filters.q = '';
      searchForm.elements.q.value = '';
    } else if (key === 'rating') filters.rating = null;else filters[key] = filters[key].filter(x => x !== value);
    apply();
  });
  status(matches.length ? '' : 'Ingen opskrifter matcher dine valg. Fjern et filter eller prøv en anden søgning.', matches.length ? '' : 'empty');
}
function apply(push = true) {
  const query = writeFilters(filters);
  if (push) history.pushState(null, '', `productlist.html${query ? `?${query}` : ''}`);
  saveActiveFilters(query);
  visible = 12;
  render();
}
document.getElementById('filter-open').addEventListener('click', () => {
  syncForm();
  updatePreview();
  panel.showModal();
});
document.getElementById('filter-close').addEventListener('click', () => panel.close());
form.addEventListener('input', updatePreview);
form.addEventListener('submit', event => {
  event.preventDefault();
  filters = draftFilters();
  panel.close();
  apply();
});
document.getElementById('filter-reset').addEventListener('click', () => {
  filters = emptyFilters();
  searchForm.elements.q.value = '';
  syncForm();
  updatePreview();
  apply();
});
searchForm.addEventListener('submit', event => {
  event.preventDefault();
  filters.q = searchForm.elements.q.value.trim();
  apply();
});
sort.addEventListener('change', render);
document.getElementById('load-more').addEventListener('click', () => {
  visible += 12;
  render();
});
window.addEventListener('popstate', () => {
  filters = readFilters(location.search);
  searchForm.elements.q.value = filters.q;
  apply(false);
});
await loadWithRetry(async () => {
  recipes = await getRecipes();
  populateOptions();
  apply(false);
});
