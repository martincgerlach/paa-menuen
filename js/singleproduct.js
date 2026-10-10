import { getRecipe } from './api.js';
import { totalTime } from './filters.js';
import { displayLabel } from './labels.js';
import { getShoppingItems, addRecipeItems, saveShoppingItems } from './shopping.js';
import { activeFiltersQuery } from './storage.js';
import { el, initCommon, loadWithRetry, setImage, favoriteButton, numberLabel, status } from './ui.js';
initCommon();
await loadWithRetry(async () => {
  const recipe = await getRecipe(new URLSearchParams(location.search).get('id'));
  document.title = `${recipe.name} — På Menuen`;
  const root = document.getElementById('recipe-detail');
  root.replaceChildren();
  const back = el('a', '← Tilbage til opskrifter', 'back-link');
  back.href = `productlist.html${activeFiltersQuery() ? `?${activeFiltersQuery()}` : ''}`;
  const grid = el('div', undefined, 'detail-grid'),
    image = el('img', undefined, 'detail-image');
  setImage(image, recipe, true);
  const summary = el('div', undefined, 'detail-summary'),
    h1 = el('h1', recipe.name);
  h1.lang = 'en';
  const rating = el('p', recipe.rating === null ? 'Rating ikke oplyst' : `★ ${numberLabel(recipe.rating)}${recipe.reviewCount === null ? '' : ` (${recipe.reviewCount} vurderinger i DummyJSON)`}`);
  const tags = el('div', undefined, 'detail-tags');
  [...new Set([recipe.cuisine, ...recipe.mealType, recipe.difficulty].filter(Boolean))].forEach(t => tags.append(el('span', displayLabel(t), 'chip')));
  const time = totalTime(recipe);
  const meta = el('p', `${time === null ? 'Samlet tid ikke oplyst' : `${time} min samlet`} · ${recipe.servings === null ? 'Portioner ikke oplyst' : `${recipe.servings} portioner`}`);
  const timings = el('p', `Forberedelse: ${recipe.prepTimeMinutes === null ? 'ikke oplyst' : `${recipe.prepTimeMinutes} min`} · Tilberedning: ${recipe.cookTimeMinutes === null ? 'ikke oplyst' : `${recipe.cookTimeMinutes} min`}`, 'card-meta');
  const actions = el('div', undefined, 'detail-actions'),
    save = favoriteButton(recipe);
  save.classList.add('button');
  const add = el('button', 'Tilføj manglende ingredienser', 'button button-secondary');
  add.type = 'button';
  add.disabled = !recipe.ingredients.length;
  const availability = el('p', '', 'data-note');
  availability.setAttribute('role', 'status');
  function missingIngredients() {
    const indices = [];
    root.querySelectorAll('.ingredient-row input').forEach((input, index) => {
      if (!input.checked) indices.push(index);
    });
    return indices;
  }
  function updateIngredients() {
    const count = missingIngredients().length;
    add.disabled = count === 0;
    availability.textContent = count ? `${count} ingredienser mangler.` : 'Ingen ingredienser mangler.';
  }
  add.addEventListener('click', () => {
    const before = getShoppingItems(),
      next = addRecipeItems(before, recipe, missingIngredients()),
      persisted = saveShoppingItems(next);
    status(`${next.length - before.length} ingredienser tilføjet. ${persisted ? 'Gemt på denne enhed.' : 'Kun midlertidigt gemt.'}`);
  });
  const go = el('a', 'Se indkøbsliste →');
  go.href = 'indkoebsliste.html';
  actions.append(save, add, go);
  summary.append(h1, rating, tags, meta, timings, actions);
  grid.append(image, summary);
  const body = el('div', undefined, 'recipe-body'),
    ingredients = el('section', undefined, 'ingredient-panel');
  ingredients.append(el('h2', 'Ingredienser'), el('p', recipe.servings === null ? 'Portioner ikke oplyst' : `Til ${recipe.servings} portioner`));
  const note = el('p', 'API’et angiver ikke ingrediensmængder. Kontrollér selv, hvor meget du skal bruge.', 'data-note');
  ingredients.append(note);
  const help = el('p', 'Markér de ingredienser, du allerede har hjemme.', 'data-note');
  help.id = 'ingredient-help';
  ingredients.append(help);
  if (!recipe.ingredients.length) ingredients.append(el('p', 'Ingredienser er ikke oplyst.'));
  recipe.ingredients.forEach((text, index) => {
    const row = el('label', undefined, 'ingredient-row'),
      input = el('input');
    input.type = 'checkbox';
    input.id = `ingredient-${index}`;
    input.setAttribute('aria-describedby', 'ingredient-help');
    input.addEventListener('change', updateIngredients);
    const span = el('span', text);
    span.lang = 'en';
    row.append(input, span);
    ingredients.append(row);
  });
  ingredients.append(availability, el('p', 'Markeringen gælder kun denne visning. Allerede gemte indkøbsvarer ændres ikke.', 'data-note'));
  const instructions = el('section', undefined, 'instruction-panel');
  instructions.append(el('h2', 'Sådan gør du'));
  const steps = el('ol');
  steps.lang = 'en';
  recipe.instructions.forEach(text => steps.append(el('li', text)));
  instructions.append(steps);
  if (!recipe.instructions.length) instructions.append(el('p', 'Fremgangsmåde er ikke oplyst.'));
  body.append(ingredients, instructions);
  root.append(back, grid, el('p', 'Opskriftsindhold leveres på engelsk af DummyJSON.', 'data-note'), body);
  updateIngredients();
  status('');
});
