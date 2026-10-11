import { getRecipes } from './api.js';
import { emptyFilters, filterRecipes, readFilters, pickRecipe } from './filters.js';
import { activeFiltersQuery } from './storage.js';
import { displayLabel } from './labels.js';
import { el, initCommon, loadWithRetry, renderRecipes, showChips, status } from './ui.js';

initCommon();
let recipes = [];
let previousId = null;
let rollingRecipe = null;
let rollTimer;
let ready = false;
let hasRolled = false;
let filters = readFilters(location.search || activeFiltersQuery());
const form = document.getElementById('dice-filters');
const preferences = document.getElementById('dice-preferences');
const button = document.getElementById('dice-roll');
const result = document.getElementById('dice-result');
const instruction = document.getElementById('dice-instruction');
const countLabel = document.getElementById('match-count');
const resetButton = document.getElementById('dice-reset');
const dice = document.querySelector('.dice-cube');
const chips = document.getElementById('active-filters');
const statusNode = document.getElementById('status');
const primaryControls = [['meal', 'dice-meals'], ['time', 'dice-times'], ['difficulty', 'dice-difficulties']];
const initialMessage = 'Klik på terningen og lad os finde din næste ret. Du kan også vælge filtre først.';
const updatedMessage = 'Dine filtre er opdateret. Kast terningen igen for at få et nyt forslag.';
const emptyMessage = 'Ingen opskrifter passer til dine filtre. Prøv at ændre eller nulstille et filter.';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Vinklerne vender hver af de seks flader frem. Tallet vælger ikke opskriften.
const faceAngles = [[0, 0], [-90, 0], [0, -90], [0, 90], [90, 0], [0, 180]];

function candidates() {
  return filterRecipes(recipes, filters);
}
function choices(id, key, values, allLabel) {
  const box = document.getElementById(id);
  box.replaceChildren();
  for (const value of ['', ...values]) {
    const label = el('label', undefined, 'dice-choice');
    const input = el('input');
    input.type = 'checkbox';
    input.name = key;
    input.value = value;
    label.append(input, el('span', value ? displayLabel(value) : allLabel));
    box.append(label);
  }
}
function selectChoices(id, values, allLabel) {
  const select = document.getElementById(id);
  select.replaceChildren();
  for (const value of ['', ...values]) {
    const option = el('option', value ? displayLabel(value) : allLabel);
    option.value = value;
    select.append(option);
  }
}
function populateOptions() {
  const meals = [...new Set(recipes.flatMap(r => r.mealType).map(value => value === 'Snacks' ? 'Snack' : value))];
  const primaryMeals = ['Breakfast', 'Lunch', 'Dinner', 'Snack'].filter(value => meals.includes(value));
  // Bevar også importerede måltidstyper, fx Dessert, uden at opfinde API-værdier.
  const importedMeals = filters.meal.filter(value => meals.includes(value) && !primaryMeals.includes(value));
  selectChoices('dice-meals', [...primaryMeals, ...importedMeals], 'Alle');
  selectChoices('dice-times', ['under30', '30to45', 'over45'], 'Alle tider');
  const difficulties = [...new Set(recipes.map(r => r.difficulty).filter(Boolean))];
  selectChoices('dice-difficulties', difficulties, 'Alle niveauer');
  const cuisines = [...new Set(recipes.map(r => r.cuisine).filter(Boolean))];
  cuisines.sort((a, b) => displayLabel(a).localeCompare(displayLabel(b), 'da'));
  choices('dice-cuisines', 'cuisine', cuisines, 'Alle køkkener');
  if (filters.rating !== null && ![...form.elements.rating.options].some(option => Number(option.value) === filters.rating && option.value !== '')) {
    const option = el('option', `${filters.rating.toLocaleString('da-DK')}+ stjerner`);
    option.value = filters.rating;
    form.elements.rating.append(option);
  }
  syncForm();
  const hasImportedFilters = filters.q || filters.rating !== null
    || ['cuisine', 'meal', 'time', 'difficulty', 'ingredients'].some(key => filters[key].length);
  document.getElementById('dice-filter-options').open = Boolean(hasImportedFilters);
  if (filters.q || filters.ingredients.length || filters.cuisine.length || filters.rating !== null) {
    document.getElementById('dice-more-filters').open = true;
  }
}
function syncForm() {
  for (const [key, id] of primaryControls) {
    const select = document.getElementById(id);
    select.querySelector('option[data-imported]')?.remove();
    const values = filters[key];
    const supported = [...select.options].some(option => option.value === values[0]);
    if (values.length > 1 || values.length === 1 && !supported) {
      // Flervalg bevares i arrayet, indtil brugeren selv vælger én mulighed.
      const label = values.length > 1 ? `Flere valg (${values.length})` : `Bevaret valg: ${displayLabel(values[0])}`;
      const option = el('option', label);
      option.value = 'imported';
      option.disabled = true;
      option.dataset.imported = 'true';
      select.append(option);
      select.value = 'imported';
    } else {
      select.value = values[0] || '';
    }
    select.classList.toggle('is-selected', values.length > 0);
  }
  document.getElementById('dice-imported-note').hidden = !primaryControls.some(([key]) => filters[key].length > 1);
  form.querySelectorAll('input[type=checkbox]').forEach(input => {
    input.checked = input.value ? filters[input.name].includes(input.value) : !filters[input.name].length;
    input.closest('label').classList.toggle('is-selected', input.checked);
  });
  form.elements.rating.value = filters.rating === null ? '' : filters.rating;
  form.elements.ingredients.value = filters.ingredients.join(', ');
  form.elements.q.value = filters.q;
}
function emptyResult(message) {
  // Genbrug den tomme visning ved indtastning, så den ikke bygges på ny for hvert tegn.
  const current = result.querySelector('.dice-result-placeholder');
  if (current?.textContent.trim() === message) return;
  const placeholder = el('div', undefined, 'dice-result-placeholder');
  placeholder.append(el('p', message));
  result.replaceChildren(placeholder);
}
function cancelRoll() {
  clearTimeout(rollTimer);
  rollingRecipe = null;
  dice.classList.remove('is-rolling');
  button.removeAttribute('aria-disabled');
  button.removeAttribute('aria-busy');
}
function preview(changed = false) {
  const count = candidates().length;
  const hasFilters = filters.q || filters.rating !== null
    || ['cuisine', 'meal', 'time', 'difficulty', 'ingredients'].some(key => filters[key].length);
  const noun = count === 1 ? 'opskrift' : 'opskrifter';
  countLabel.textContent = `${count} ${noun}${hasFilters ? ' matcher dine valg' : ' · ingen filtre'}`;
  resetButton.hidden = !hasFilters;
  showChips(chips, filters, removeFilter);
  button.disabled = !ready || !count;
  const message = !count ? emptyMessage : hasRolled && changed ? updatedMessage : initialMessage;
  emptyResult(message);
  const announcement = !count || hasRolled && changed ? message : '';
  const state = count ? 'ready' : 'empty';
  if (statusNode.textContent !== announcement || statusNode.dataset.state !== state) {
    status(announcement, state);
  }
}
function filtersChanged() {
  cancelRoll();
  setInstruction(false);
  preview(true);
}
function removeFilter(key, value) {
  const index = [...chips.children].indexOf(document.activeElement);
  if (key === 'q') filters.q = '';
  else if (key === 'rating') filters.rating = null;
  else filters[key] = filters[key].filter(item => item !== value);
  syncForm();
  filtersChanged();
  // Bevar fokus på næste chip, sidste chip eller den eksisterende nulstil-knap.
  const next = chips.children[Math.min(Math.max(index, 0), chips.children.length - 1)];
  (next || document.getElementById('dice-reset')).focus();
}
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  const input = event.target;
  if (['meal', 'time', 'difficulty'].includes(input.name)) {
    filters[input.name] = input.value ? [input.value] : [];
    syncForm();
  } else if (input.type === 'checkbox') {
    const key = input.name;
    if (!input.value) {
      filters[key] = [];
    } else {
      filters[key] = [...form.querySelectorAll(`input[name="${key}"]:checked`)].map(item => item.value).filter(Boolean);
    }
    syncForm();
  } else if (input.name === 'rating') {
    filters.rating = input.value === '' ? null : Number(input.value);
  } else if (input.name === 'ingredients') {
    filters.ingredients = input.value.split(',').map(value => value.trim()).filter(Boolean);
  } else if (input.name === 'q') {
    filters.q = input.value.trim().slice(0, 120);
  }
  filtersChanged();
});
document.getElementById('dice-reset').addEventListener('click', () => {
  // Kun sidens lokale valg nulstilles. Opskriftssidens sessionStorage ændres ikke.
  filters = emptyFilters();
  syncForm();
  filtersChanged();
});
function setInstruction(again) {
  const verb = matchMedia('(pointer: coarse)').matches ? 'Tryk' : 'Klik';
  instruction.textContent = `${verb} på terningen for at kaste${again ? ' igen' : ''}`;
  button.setAttribute('aria-label', again ? 'Kast igen med Madterningen' : 'Kast med Madterningen');
}
function finishRoll() {
  if (!rollingRecipe) return;
  const recipe = rollingRecipe;
  cancelRoll();
  previousId = recipe.id;
  hasRolled = true;
  renderRecipes(result, [recipe]);
  result.prepend(el('h2', 'Terningen har valgt!', 'dice-result-heading'));
  const recipeLink = el('a', 'Se opskrift', 'button');
  recipeLink.href = `singleproduct.html?id=${recipe.id}`;
  result.querySelector('.card-body').append(recipeLink);
  result.querySelector('.recipe-card').classList.add('is-revealing');
  setInstruction(true);
  status(`Dit forslag: ${recipe.name}`);
}
button.addEventListener('click', () => {
  if (!ready || rollingRecipe) return;
  const recipe = pickRecipe(candidates(), previousId);
  if (!recipe) {
    preview();
    return;
  }
  rollingRecipe = recipe;
  const [x, y] = faceAngles[Math.floor(Math.random() * faceAngles.length)];
  const pose = (rx, ry) => `rotateX(-18deg) rotateY(-22deg) rotateX(${rx}deg) rotateY(${ry}deg)`;
  dice.style.setProperty('--dice-start', dice.style.transform || pose(0, 0));
  dice.style.setProperty('--dice-end', pose(x + 720, y + 720));
  dice.style.transform = pose(x, y);
  if (reducedMotion.matches) {
    finishRoll();
    return;
  }
  // aria-disabled blokerer gentagelser uden at flytte tastaturfokus fra knappen.
  button.setAttribute('aria-disabled', 'true');
  button.setAttribute('aria-busy', 'true');
  dice.classList.add('is-rolling');
  // Animationens slut-event viser resultatet. Timeren er kun en sikkerhedsreserve.
  rollTimer = setTimeout(finishRoll, 1000);
});
dice.addEventListener('animationend', finishRoll);
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) finishRoll();
});
setInstruction(false);
await loadWithRetry(async () => {
  ready = false;
  button.disabled = true;
  preferences.disabled = true;
  countLabel.textContent = 'Henter opskrifter…';
  try {
    recipes = await getRecipes();
  } catch (error) {
    countLabel.textContent = error.message || 'Opskrifter kunne ikke hentes.';
    throw error;
  }
  ready = true;
  populateOptions();
  preferences.disabled = false;
  preview();
});
