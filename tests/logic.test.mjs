import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecipe, getRecipes, getRecipe } from '../js/api.js';
import { emptyFilters, filterRecipes, sortRecipes, totalTime, readFilters, writeFilters, pickRecipe } from '../js/filters.js';
import { addRecipeItems, addManualItem, clearPurchased } from '../js/shopping.js';

// Synthetic fixtures exercise boundaries only. They never supply website content.
const recipe = (id, minutes, extra = {}) => normalizeRecipe({ id, name: `Test ${id}`, prepTimeMinutes: minutes, cookTimeMinutes: 0, cuisine: 'Italian', difficulty: 'Easy', rating: 4, ingredients: ['Tomato sauce', 'Pasta'], mealType: ['Dinner'], ...extra });
test('normalization preserves source strings; unavailable values stay unknown', () => {
  const r = normalizeRecipe({ id: 1, name: 'Original English', ingredients: ['Pizza dough'] });
  assert.equal(r.name, 'Original English'); assert.equal(totalTime(r), null); assert.equal(r.rating, null);
  assert.deepEqual(r.ingredients, ['Pizza dough']); assert.equal('price' in r, false);
  assert.throws(() => normalizeRecipe({ id: 0, name: 'x' }));
});
test('time bands include exactly the intended boundaries', () => {
  const data = [29, 30, 45, 46].map((n, i) => recipe(i + 1, n));
  for (const [band, ids] of [['under30', [1]], ['30to45', [2, 3]], ['over45', [4]]]) {
    assert.deepEqual(filterRecipes(data, { ...emptyFilters(), time: [band] }).map(r => r.id), ids);
  }
});
test('OR within categories, AND across filters and ALL ingredient terms', () => {
  const data = [recipe(1, 20), recipe(2, 40, { cuisine: 'Mexican' }), recipe(3, 20, { mealType: ['Lunch'] })];
  const f = { ...emptyFilters(), cuisine: ['Italian', 'Mexican'], meal: ['Dinner'], time: ['under30'], rating: 4, ingredients: ['tomat', 'pasta'] };
  assert.deepEqual(filterRecipes(data, f).map(r => r.id), [1]);
  assert.equal(filterRecipes(data, { ...f, ingredients: ['unavailable'] }).length, 0);
  assert.equal(filterRecipes(data, { ...emptyFilters(), q: ' TOMAT ' }).length, 3);
});
test('unknown time excluded by time filter; sort does not mutate', () => {
  const data = [recipe(2, 20), recipe(1, 10), normalizeRecipe({ id: 3, name: 'Missing' })];
  assert.equal(filterRecipes(data, { ...emptyFilters(), time: ['under30'] }).length, 2);
  assert.deepEqual(sortRecipes(data, 'time').map(r => r.id), [1, 2, 3]);
  assert.deepEqual(data.map(r => r.id), [2, 1, 3]);
});
test('filter URL roundtrip and invalid ranges', () => {
  const f = { ...emptyFilters(), q: 'pasta', cuisine: ['Italian'], meal: ['Dinner'], time: ['under30'], ingredients: ['tomat'], rating: 4 };
  assert.deepEqual(readFilters(`?${writeFilters(f)}`), f);
  assert.equal(readFilters('?rating=99&time=wrong').rating, null);
  assert.deepEqual(readFilters('?time=wrong').time, []);
});
test('dice respects candidates and avoids immediate repeat when possible', () => {
  const a = recipe(1, 10), b = recipe(2, 20);
  assert.equal(pickRecipe([], null, () => 0), null);
  assert.equal(pickRecipe([a], 1, () => 0).id, 1);
  assert.equal(pickRecipe([a, b], 1, () => 0).id, 2);
  assert.equal(pickRecipe([a, b], null, () => 0.999).id, 2);
});
test('shopping source identity, no fabricated quantities, repeat is idempotent', () => {
  const a = recipe(1, 10), b = recipe(2, 20);
  let items = addRecipeItems([], a); items[0].checked = true;
  assert.equal(addRecipeItems(items, a).length, 2);
  assert.equal(addRecipeItems(items, a)[0].checked, true);
  assert.equal(addRecipeItems(items, b).length, 4);
  assert.equal('quantity' in items[0], false);
  assert.equal(clearPurchased(items).length, 1);
});
test('manual item validation trims and rejects blank/too long', () => {
  assert.throws(() => addManualItem([], '  ')); assert.throws(() => addManualItem([], 'x'.repeat(121)));
  const items = addManualItem([], '  2 tomater  ');
  assert.equal(items[0].text, '2 tomater'); assert.equal(items[0].source, 'manual');
});
test('API handles complete dataset or paginates; never silently uses first page', async () => {
  const requests = [];
  const fetcher = async url => { requests.push(url); return { ok: true, json: async () => ({ recipes: requests.length === 1 ? [recipe(1, 10)] : [recipe(2, 20)], total: 2 }) }; };
  const rs = await getRecipes({ fetcher }); assert.equal(rs.length, 2); assert.match(requests[0], /limit=0/); assert.match(requests[1], /skip=1/);
});
test('API HTTP, JSON, schema and ID failures reject without fallback data', async () => {
  await assert.rejects(getRecipes({ fetcher: async () => ({ ok: false, status: 500 }) }));
  await assert.rejects(getRecipes({ fetcher: async () => ({ ok: true, json: async () => { throw Error('JSON'); } }) }));
  await assert.rejects(getRecipes({ fetcher: async () => ({ ok: true, json: async () => ({ recipes: [], total: 1 }) }) }));
  await assert.rejects(getRecipe('1x')); await assert.rejects(getRecipe(null));
  await assert.rejects(getRecipe(1, { fetcher: async () => ({ ok: true, json: async () => ({ id: 2, name: 'Wrong' }) }) }));
});

test('missing ingredient selection preserves original indices and stored purchases', () => {
  const r = recipe(7, 20, { ingredients: ['First', 'Second', 'Third'] });
  assert.deepEqual(addRecipeItems([], r, []), []);
  const missing = addRecipeItems([], r, [1, 2]);
  assert.deepEqual(missing.map(x => [x.id, x.ingredientIndex, x.text]), [['recipe-7-1', 1, 'Second'], ['recipe-7-2', 2, 'Third']]);
  missing[0].checked = true;
  assert.equal(addRecipeItems(missing, r, [1, 2]).length, 2);
  assert.equal(addRecipeItems(missing, r, [1, 2])[0].checked, true);
  assert.equal(addRecipeItems(missing, r, [0]).length, 3);
  assert.deepEqual(r.ingredients, ['First', 'Second', 'Third']);
});
