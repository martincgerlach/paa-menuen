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
let filters = readFilters(location.search || activeFiltersQuery());
const form = document.getElementById('dice-filters');
const preferences = document.getElementById('dice-preferences');
const button = document.getElementById('dice-roll');
const result = document.getElementById('dice-result');
const instruction = document.getElementById('dice-instruction');
const countLabel = document.getElementById('match-count');
const dice = document.querySelector('.dice-cube');
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
function populateOptions() {
  const meals = [...new Set(recipes.flatMap(r => r.mealType).map(value => value === 'Snacks' ? 'Snack' : value))];
  const primaryMeals = ['Breakfast', 'Lunch', 'Dinner', 'Snack'].filter(value => meals.includes(value));
  // Bevar også importerede måltidstyper, fx Dessert, uden at opfinde API-værdier.
  const importedMeals = filters.meal.filter(value => meals.includes(value) && !primaryMeals.includes(value));
  choices('dice-meals', 'meal', [...primaryMeals, ...importedMeals], 'Alle');
  choices('dice-times', 'time', ['under30', '30to45', 'over45'], 'Alle tider');
  const difficulties = [...new Set(recipes.map(r => r.difficulty).filter(Boolean))];
  choices('dice-difficulties', 'difficulty', difficulties, 'Alle niveauer');
  const cuisines = [...new Set(recipes.map(r => r.cuisine).filter(Boolean))];
  cuisines.sort((a, b) => displayLabel(a).localeCompare(displayLabel(b), 'da'));
  choices('dice-cuisines', 'cuisine', cuisines, 'Alle køkkener');
  if (filters.rating !== null && ![...form.elements.rating.options].some(option => Number(option.value) === filters.rating && option.value !== '')) {
    const option = el('option', `${filters.rating.toLocaleString('da-DK')}+ stjerner`);
    option.value = filters.rating;
    form.elements.rating.append(option);
  }
  syncForm();
  if (filters.q || filters.ingredients.length || filters.cuisine.length || filters.rating !== null) {
    form.querySelector('details').open = true;
  }
}
function syncForm() {
  form.querySelectorAll('input[type=checkbox]').forEach(input => {
    input.checked = input.value ? filters[input.name].includes(input.value) : !filters[input.name].length;
    input.closest('label').classList.toggle('is-selected', input.checked);
  });
  form.elements.rating.value = filters.rating === null ? '' : filters.rating;
  form.elements.ingredients.value = filters.ingredients.join(', ');
  form.elements.q.value = filters.q;
}
function emptyResult() {
  const placeholder = el('div', undefined, 'dice-result-placeholder');
  placeholder.append(el('p', 'Vælg dine filtre, og klik på terningen for at finde din næste ret.'));
  result.replaceChildren(placeholder);
}
function cancelRoll() {
  clearTimeout(rollTimer);
  rollingRecipe = null;
  dice.classList.remove('is-rolling');
  button.removeAttribute('aria-disabled');
  button.removeAttribute('aria-busy');
}
function preview() {
  const count = candidates().length;
  const hasFilters = filters.q || filters.rating !== null
    || ['cuisine', 'meal', 'time', 'difficulty', 'ingredients'].some(key => filters[key].length);
  countLabel.textContent = `${count} opskrifter matcher dine valg${hasFilters ? '' : ' · Alle opskrifter'}`;
  showChips(document.getElementById('active-filters'), filters);
  button.disabled = !ready || !count;
  status(count ? '' : 'Ingen opskrifter passer til dine filtre. Prøv at ændre eller nulstille et filter.', count ? 'ready' : 'empty');
}
function filtersChanged() {
  cancelRoll();
  emptyResult();
  setInstruction(false);
  preview();
}
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  const input = event.target;
  if (input.type === 'checkbox') {
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
  renderRecipes(result, [recipe]);
  const recipeLink = el('a', 'Se opskrift', 'button');
  recipeLink.href = `singleproduct.html?id=${recipe.id}`;
  result.querySelector('.card-body').append(recipeLink);
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
    countLabel.textContent = '';
    throw error;
  }
  ready = true;
  populateOptions();
  preferences.disabled = false;
  preview();
});
