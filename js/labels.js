const labels = {
  Italian: 'Italiensk', Asian: 'Asiatisk', Mexican: 'Mexicansk', American: 'Amerikansk', Mediterranean: 'Middelhavskøkken',
  Indian: 'Indisk', Pakistani: 'Pakistansk', Japanese: 'Japansk', Korean: 'Koreansk', Greek: 'Græsk', Thai: 'Thailandsk',
  Turkish: 'Tyrkisk', French: 'Fransk', Moroccan: 'Marokkansk', Lebanese: 'Libanesisk', Brazilian: 'Brasiliansk',
  Spanish: 'Spansk', Vietnamese: 'Vietnamesisk', Russian: 'Russisk', Cuban: 'Cubansk', Hawaiian: 'Hawaiiansk',
  Breakfast: 'Morgenmad', Lunch: 'Frokost', Dinner: 'Aftensmad', Snack: 'Snack', Snacks: 'Snack', Dessert: 'Dessert',
  Appetizer: 'Forret', 'Side Dish': 'Tilbehør', Beverage: 'Drik', Easy: 'Let', Medium: 'Middel', Hard: 'Svær',
  under30: 'Under 30 min', '30to45': '30–45 min', over45: 'Over 45 min'
};
export const displayLabel = value => labels[value] || value;
export const normalizeText = value => String(value).trim().toLocaleLowerCase('da').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// Search aliases are our UI aid, not translations or new recipe data.
const aliases = { tomat: 'tomato', tomater: 'tomato', kylling: 'chicken', ris: 'rice', ost: 'cheese', kartoffel: 'potato', kartofler: 'potato', aeg: 'egg', log: 'onion', hvidlog: 'garlic', maelk: 'milk', oksekod: 'beef', rejer: 'shrimp' };
export function searchTerms(value) { const text = normalizeText(value); return [text, aliases[text]].filter(Boolean); }
