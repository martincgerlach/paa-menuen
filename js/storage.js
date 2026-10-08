const memory = new Map();
let warned = false;
function warning(message) {
  warned = true;
  if (typeof document === 'undefined') return;
  const notice = document.getElementById('storage-notice');
  if (notice) { notice.textContent = message; notice.hidden = false; }
}
export function readStore(key, fallback, validate, area = 'localStorage') {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = globalThis[area].getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    if (!validate(value)) throw new Error('Ugyldigt format');
    return value;
  } catch {
    warning('Gemte data kunne ikke læses. Nye valg gemmes midlertidigt i denne fane.');
    memory.set(key, fallback); return fallback;
  }
}
export function writeStore(key, value, area = 'localStorage') {
  if (memory.has(key)) { memory.set(key, value); warning('Valget er kun gemt midlertidigt i denne fane.'); return false; }
  try { globalThis[area].setItem(key, JSON.stringify(value)); return true; }
  catch { memory.set(key, value); warning('Valget er kun gemt midlertidigt i denne fane. Browseren tillader ikke lagring.'); return false; }
}
export function saveActiveFilters(query) { writeStore('paa-menuen:filters:v1', query, 'sessionStorage'); }
export function activeFiltersQuery() { return readStore('paa-menuen:filters:v1', '', v => typeof v === 'string', 'sessionStorage'); }
export function showStorageWarning() { if (warned) warning('Nogle valg er kun gemt midlertidigt i denne fane.'); }
