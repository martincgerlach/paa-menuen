import { readStore, writeStore } from './storage.js';
const key = 'paa-menuen:favorites:v1';
export function getFavoriteIds() { return readStore(key, [], v => Array.isArray(v) && v.every(id => Number.isInteger(id) && id > 0)); }
export function toggleFavorite(id) {
  const ids = getFavoriteIds(), saved = !ids.includes(id);
  const next = saved ? [...new Set([...ids, id])] : ids.filter(x => x !== id);
  return { saved, persisted: writeStore(key, next) };
}
