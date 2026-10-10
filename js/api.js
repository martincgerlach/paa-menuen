const API = 'https://dummyjson.com/recipes';
const numberOrNull = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const strings = value => Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];

// Keep the API's content; missing metadata stays unknown rather than becoming 0.
export function normalizeRecipe(raw) {
  if (!raw || !Number.isInteger(raw.id) || raw.id < 1 || typeof raw.name !== 'string' || !raw.name.trim()) throw new Error('Opskriftsdata har et ugyldigt format.');
  return {
    id: raw.id,
    name: raw.name,
    ingredients: strings(raw.ingredients),
    instructions: strings(raw.instructions),
    prepTimeMinutes: numberOrNull(raw.prepTimeMinutes),
    cookTimeMinutes: numberOrNull(raw.cookTimeMinutes),
    servings: numberOrNull(raw.servings),
    difficulty: typeof raw.difficulty === 'string' ? raw.difficulty : '',
    cuisine: typeof raw.cuisine === 'string' ? raw.cuisine : '',
    tags: strings(raw.tags),
    mealType: strings(raw.mealType),
    image: typeof raw.image === 'string' && raw.image.startsWith('https://') ? raw.image : '',
    rating: numberOrNull(raw.rating),
    reviewCount: numberOrNull(raw.reviewCount)
  };
}
async function request(url, fetcher) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetcher(url, {
      signal: controller.signal
    });
    if (!response.ok) throw new Error(response.status === 404 ? 'Opskriften blev ikke fundet.' : `Opskrifter kunne ikke hentes (HTTP ${response.status}).`);
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Det tog for lang tid at hente opskrifter. Prøv igen.');
    if (error instanceof TypeError || error instanceof SyntaxError) throw new Error('Opskrifter kunne ikke hentes. Kontrollér forbindelsen og prøv igen.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export async function getRecipes({
  fetcher = fetch
} = {}) {
  let results = [];
  let total;
  do {
    const data = await request(results.length ? `${API}?limit=100&skip=${results.length}` : `${API}?limit=0`, fetcher);
    if (!Array.isArray(data.recipes) || !Number.isInteger(data.total) || data.total < 0) throw new Error('Opskriftslisten har et ugyldigt format.');
    total = data.total;
    const page = data.recipes.map(normalizeRecipe);
    if (!page.length && results.length < total) throw new Error("API'et leverede en ufuldstændig opskriftsliste. Prøv igen.");
    results.push(...page);
    if (new Set(results.map(r => r.id)).size !== results.length) throw new Error("API'et leverede gentagne opskrifter. Prøv igen.");
  } while (results.length < total);
  return results;
}
export async function getRecipe(id, {
  fetcher = fetch
} = {}) {
  if (!/^[1-9]\d*$/.test(String(id))) throw new Error('Vælg en gyldig opskrift fra opskriftslisten.');
  const recipe = normalizeRecipe(await request(`${API}/${Number(id)}`, fetcher));
  if (recipe.id !== Number(id)) throw new Error("API'et returnerede en anden opskrift.");
  return recipe;
}
