import { readStore, writeStore } from './storage.js';
const key = 'paa-menuen:shopping:v1';
const validItem = x => x
  && typeof x.id === 'string'
  && ['recipe', 'manual'].includes(x.source)
  && typeof x.text === 'string'
  && typeof x.checked === 'boolean'
  && (x.source === 'manual' || (
    Number.isInteger(x.recipeId)
    && typeof x.recipeName === 'string'
    && Number.isInteger(x.ingredientIndex)
  ));
export function getShoppingItems() {
  return readStore(key, [], v => Array.isArray(v) && v.every(validItem));
}
export function saveShoppingItems(items) {
  return writeStore(key, items);
}
export function addRecipeItems(items, recipe, ingredientIndices = recipe.ingredients.map((_, index) => index)) {
  const next = [...items],
    selected = new Set(ingredientIndices);
  recipe.ingredients.forEach((text, index) => {
    if (!selected.has(index)) return;
    const id = `recipe-${recipe.id}-${index}`;
    if (!next.some(item => item.id === id)) next.push({
      id,
      source: 'recipe',
      recipeId: recipe.id,
      recipeName: recipe.name,
      ingredientIndex: index,
      text,
      checked: false
    });
  });
  return next;
}
export function addManualItem(items, value) {
  const text = value.trim();
  if (!text || text.length > 120) throw new Error('Skriv en vare på 1–120 tegn.');
  return [...items, {
    id: `manual-${globalThis.crypto.randomUUID()}`,
    source: 'manual',
    recipeId: null,
    recipeName: null,
    ingredientIndex: null,
    text,
    checked: false
  }];
}
export const clearPurchased = items => items.filter(item => !item.checked);
