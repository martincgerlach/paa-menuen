// Gennemgår alle opskrifter og hver eneste ingrediens fra det aktuelle DummyJSON API.
// Kun test: intet gemmes som statisk opskriftsdata på hjemmesiden.
import { mkdir, writeFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import { getRecipes } from '../js/api.js';
import { filterRecipes, emptyFilters } from '../js/filters.js';

const recipes = await getRecipes();
assert(recipes.length > 0, 'API gav ingen opskrifter');
const allIngredients = [];
const mismatches = [];

for (const recipe of recipes) {
  for (const ingredient of recipe.ingredients) {
    const bySearch = filterRecipes([recipe], { ...emptyFilters(), q: ingredient });
    const byIngredient = filterRecipes([recipe], { ...emptyFilters(), ingredients: [ingredient] });
    const pass = bySearch.length === 1 && byIngredient.length === 1;
    allIngredients.push({ recipeId: recipe.id, recipe: recipe.name, ingredient, searchable: pass });
    if (!pass) mismatches.push({ recipeId: recipe.id, ingredient });
  }
}

const checks = ['kød', 'æg', 'aeg', 'hvidløg', 'løg', 'tomater', 'ris', 'mælk', 'ost', 'kartofler', 'kylling', 'pasta', 'rejer', 'ingefær', 'fisk', 'aubergine'];
const danishSearch = Object.fromEntries(checks.map(word => {
  const matches = filterRecipes(recipes, { ...emptyFilters(), q: word });
  return [word, { count: matches.length, examples: matches.slice(0, 5).map(r => ({ id:r.id, name:r.name })) }];
}));
const file = {
  source: 'https://dummyjson.com/recipes?limit=0 (hentet live via getRecipes)',
  date: new Date().toISOString(),
  recipeCount: recipes.length,
  ingredientOccurrences: allIngredients.length,
  uniqueIngredientStrings: new Set(allIngredients.map(x => x.ingredient)).size,
  invalidCount: mismatches.length,
  danishSearch,
  eachIngredient: allIngredients
};
await mkdir('qa-search', { recursive:true });
await writeFile('qa-search/ingredient-audit.json', JSON.stringify(file,null,2));
console.log('API_OPSKRIFTER:', recipes.length);
console.log('INGREDIENSER_I_ALT:', allIngredients.length);
console.log('UNIKKE_INGREDIENSER:', file.uniqueIngredientStrings);
console.log('DANSKE_SOEGNINGER:', JSON.stringify(danishSearch));
console.log('MISLYKKEDE_INGREDIENSER:', mismatches.length);
assert.equal(mismatches.length, 0, 'Nogle af API-ingrediensnavnene kunne ikke søges');
for (const word of ['kød','æg','hvidløg','tomater','ris']) {
  assert(danishSearch[word].count > 0, 'Intet match for forventet dansk ord: ' + word);
}
// Æg må ikke i sig selv matche opskrifter, som kun indeholder aubergine/eggplant.
const onlyEggplant = recipes.filter(r => r.ingredients.some(i => /eggplant/i.test(i)) && !r.ingredients.some(i => /(^|[^a-z])eggs?([^a-z]|$)/i.test(i)));
for (const recipe of onlyEggplant) {
  assert(!filterRecipes([recipe], { ...emptyFilters(), q:'æg' }).length, '"æg" ramte en aubergine uden æg: ' + recipe.name);
}
console.log('ALLE_INGREDIENSER_KAN_SOEGES: OK');
