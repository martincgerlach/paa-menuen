import { normalizeText, searchTerms } from './labels.js';
export const emptyFilters = () => ({
  q: '',
  cuisine: [],
  meal: [],
  time: [],
  difficulty: [],
  rating: null,
  ingredients: []
});
export function totalTime(r) {
  return r.prepTimeMinutes === null || r.cookTimeMinutes === null ? null : r.prepTimeMinutes + r.cookTimeMinutes;
}
const canonicalMeal = value => value === 'Snacks' ? 'Snack' : value;
export function filterRecipes(recipes, f) {
  return recipes.filter(r => {
    const text = normalizeText([r.name, ...r.ingredients].join(' '));
    const time = totalTime(r);
    return (!f.q || searchTerms(f.q).some(term => text.includes(term))) && (!f.cuisine.length || f.cuisine.includes(r.cuisine)) && (!f.meal.length || r.mealType.some(meal => f.meal.includes(canonicalMeal(meal)))) && (!f.difficulty.length || f.difficulty.includes(r.difficulty)) && (f.rating === null || r.rating !== null && r.rating >= f.rating) && (!f.time.length || time !== null && f.time.some(band => band === 'under30' ? time < 30 : band === '30to45' ? time >= 30 && time <= 45 : time > 45)) && f.ingredients.every(ingredient => r.ingredients.some(item => searchTerms(ingredient).some(term => normalizeText(item).includes(term))));
  });
}
export function sortRecipes(recipes, mode) {
  return [...recipes].sort((a, b) => {
    if (mode === 'time') return (totalTime(a) ?? Infinity) - (totalTime(b) ?? Infinity) || a.id - b.id;
    if (mode === 'rating') return (b.rating ?? -1) - (a.rating ?? -1) || a.id - b.id;
    return a.name.localeCompare(b.name, 'en') || a.id - b.id;
  });
}
export function readFilters(search) {
  const p = new URLSearchParams(search),
    f = emptyFilters();
  f.q = (p.get('q') || '').trim().slice(0, 120);
  for (const key of ['cuisine', 'meal', 'difficulty', 'ingredients']) f[key] = [...new Set(p.getAll(key).map(x => x.trim()).filter(Boolean))].slice(0, 30);
  f.time = [...new Set(p.getAll('time'))].filter(x => ['under30', '30to45', 'over45'].includes(x));
  const rating = p.get('rating');
  f.rating = rating !== null && rating !== '' && Number.isFinite(Number(rating)) && Number(rating) >= 0 && Number(rating) <= 5 ? Number(rating) : null;
  return f;
}
export function writeFilters(f) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  for (const key of ['cuisine', 'meal', 'time', 'difficulty', 'ingredients']) f[key].forEach(x => p.append(key, x));
  if (f.rating !== null) p.set('rating', f.rating);
  return p.toString();
}
export function pickRecipe(candidates, previousId, rng = Math.random) {
  const pool = candidates.length > 1 ? candidates.filter(r => r.id !== previousId) : candidates;
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] : null;
}
