import { displayLabel } from './labels.js';
import { totalTime } from './filters.js';
import { getFavoriteIds, toggleFavorite } from './favorites.js';
import { showStorageWarning } from './storage.js';
export function el(tag, text, className) {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}
export const numberLabel = value => value === null ? 'Ikke oplyst' : value.toLocaleString('da-DK');
export function status(text, state = '') {
  const node = document.getElementById('status'); if (!node) return;
  node.textContent = text; node.dataset.state = state; node.hidden = !text;
}
export function setImage(img, recipe, eager = false) {
  img.alt = recipe.name; img.width = 600; img.height = 400; img.loading = eager ? 'eager' : 'lazy'; img.decoding = 'async';
  if (eager) img.fetchPriority = 'high';
  img.addEventListener('error', () => { img.hidden = true; const fallback = el('p', 'Billedet er ikke tilgængeligt.', 'image-fallback'); img.after(fallback); }, { once: true });
  if (recipe.image) img.src = recipe.image; else img.hidden = true;
}
export function favoriteButton(recipe) {
  const button = el('button', '', 'favorite-button'); button.type = 'button'; button.dataset.favoriteId = recipe.id;
  function refresh() {
    const saved = getFavoriteIds().includes(recipe.id); button.textContent = saved ? '♥ Gemt' : '♡ Gem';
    button.setAttribute('aria-pressed', String(saved)); button.setAttribute('aria-label', `${saved ? 'Fjern favorit' : 'Gem favorit'}: ${recipe.name}`);
  }
  refresh(); button.addEventListener('click', () => {
    const result = toggleFavorite(recipe.id); refresh();
    document.dispatchEvent(new CustomEvent('favorites-changed'));
    status(`${result.saved ? 'Opskriften er gemt.' : 'Opskriften er fjernet fra favoritter.'}${result.persisted ? '' : ' Kun midlertidigt.'}`);
  }); return button;
}
export function createRecipeCard(recipe, eager = false) {
  const article = el('article', undefined, 'recipe-card'); article.dataset.recipeId = recipe.id;
  const imageLink = el('a'); imageLink.href = `singleproduct.html?id=${recipe.id}`; imageLink.tabIndex = -1; imageLink.setAttribute('aria-hidden', 'true');
  const image = el('img', undefined, 'recipe-image'); setImage(image, recipe, eager); imageLink.append(image);
  const body = el('div', undefined, 'card-body'), heading = el('h2', undefined, 'card-title'), link = el('a', recipe.name);
  link.lang = 'en'; link.href = imageLink.href; heading.append(link);
  const time = totalTime(recipe), meta = el('p', `${time === null ? 'Tid ikke oplyst' : `${time} min`} · ${displayLabel(recipe.difficulty) || 'Sværhedsgrad ukendt'}${recipe.rating === null ? '' : ` · ★ ${numberLabel(recipe.rating)}`}`, 'card-meta');
  const tags = el('p', [displayLabel(recipe.cuisine), ...[...new Set(recipe.mealType.map(displayLabel))]].filter(Boolean).join(' · '), 'card-tags');
  body.append(heading, meta, tags, favoriteButton(recipe)); article.append(imageLink, body); return article;
}
export function renderRecipes(container, recipes) { container.replaceChildren(...recipes.map((r, i) => createRecipeCard(r, i < 3))); }
export function showChips(container, filters, remove) {
  container.replaceChildren();
  const entries = [];
  if (filters.q) entries.push(['q', filters.q]);
  for (const key of ['cuisine', 'meal', 'time', 'difficulty', 'ingredients']) filters[key].forEach(value => entries.push([key, value]));
  if (filters.rating !== null) entries.push(['rating', `${filters.rating}+ stjerner`]);
  entries.forEach(([key, value]) => {
    const chip = el(remove ? 'button' : 'span', `${displayLabel(value)}${remove ? ' ×' : ''}`, 'chip');
    if (remove) { chip.type = 'button'; chip.setAttribute('aria-label', `Fjern filter: ${displayLabel(value)}`); chip.addEventListener('click', () => remove(key, value)); }
    container.append(chip);
  });
}
export async function loadWithRetry(load) {
  const retry = document.getElementById('retry');
  async function run() { if (retry) retry.hidden = true; status('Henter opskrifter…', 'loading');
    try { await load(); }
    catch (error) { status(error.message || 'Noget gik galt. Prøv igen.', 'error'); if (retry) retry.hidden = false; }
  }
  retry?.addEventListener('click', run); await run();
}
export function initCommon() {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(a => { if (a.getAttribute('href') === path) a.setAttribute('aria-current', 'page'); });
  showStorageWarning();
  window.addEventListener('storage', () => document.dispatchEvent(new CustomEvent('favorites-changed')));
  document.addEventListener('favorites-changed', () => {
    const ids = getFavoriteIds();
    document.querySelectorAll('[data-favorite-id]').forEach(button => {
      const saved = ids.includes(Number(button.dataset.favoriteId)); button.textContent = saved ? '♥ Gemt' : '♡ Gem'; button.setAttribute('aria-pressed', String(saved));
      button.setAttribute('aria-label', button.getAttribute('aria-label').replace(/^(Gem favorit|Fjern favorit)/, saved ? 'Fjern favorit' : 'Gem favorit'));
    });
  });
}
