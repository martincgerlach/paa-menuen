import { getShoppingItems, saveShoppingItems, addManualItem, clearPurchased } from './shopping.js';
import { el, initCommon, status } from './ui.js';
initCommon();
const root = document.getElementById('shopping-groups'),
  form = document.getElementById('manual-form'),
  input = document.getElementById('manual-item'),
  error = document.getElementById('manual-error');
function render() {
  const items = getShoppingItems(),
    groups = new Map();
  root.replaceChildren();
  items.forEach(item => {
    const key = item.source === 'manual' ? 'manual' : String(item.recipeId);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  for (const [key, group] of groups) {
    const section = el('section', undefined, 'shopping-group'),
      heading = el('h2', key === 'manual' ? 'Egne varer' : group[0].recipeName);
    if (key !== 'manual') heading.lang = 'en';
    section.append(heading);
    if (key !== 'manual') {
      const link = el('a', 'Se opskrift →');
      link.href = `singleproduct.html?id=${key}`;
      section.append(link);
    }
    group.forEach(item => {
      const row = el('div', undefined, `shopping-row${item.checked ? ' purchased' : ''}`),
        label = el('label'),
        check = el('input');
      check.type = 'checkbox';
      check.checked = item.checked;
      const text = el('span', item.text);
      if (item.source === 'recipe') text.lang = 'en';
      label.append(check, text);
      check.addEventListener('change', () => {
        const next = getShoppingItems().map(x => x.id === item.id ? {
          ...x,
          checked: check.checked
        } : x);
        const persisted = saveShoppingItems(next);
        row.classList.toggle('purchased', check.checked);
        document.getElementById('clear-purchased').disabled = !next.some(x => x.checked);
        status(`${check.checked ? 'Varen er markeret som købt.' : 'Varen er markeret som ikke købt.'}${persisted ? '' : ' Kun midlertidigt.'}`);
      });
      const remove = el('button', 'Fjern', 'remove-item');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Fjern vare: ${item.text}`);
      remove.addEventListener('click', () => {
        const buttons = [...root.querySelectorAll('.remove-item')];
        const index = buttons.indexOf(remove);
        const persisted = saveShoppingItems(getShoppingItems().filter(x => x.id !== item.id));
        render();
        const remaining = [...root.querySelectorAll('.remove-item')];
        const target = remaining[Math.min(index, remaining.length - 1)] || input;
        target.focus();
        status(`Varen er fjernet.${persisted ? '' : ' Kun midlertidigt.'}`);
      });
      row.append(label, remove);
      section.append(row);
    });
    root.append(section);
  }
  document.getElementById('clear-purchased').disabled = !items.some(x => x.checked);
  if (!items.length) root.append(el('p', 'Din indkøbsliste er tom. Tilføj ingredienser fra en opskrift eller skriv din egen vare.', 'empty-state'));
}
form.addEventListener('submit', event => {
  event.preventDefault();
  error.textContent = '';
  input.setCustomValidity('');
  try {
    const next = addManualItem(getShoppingItems(), input.value),
      persisted = saveShoppingItems(next);
    input.value = '';
    render();
    status(`Varen er tilføjet.${persisted ? '' : ' Kun midlertidigt.'}`);
    input.focus();
  } catch (err) {
    error.textContent = err.message;
    input.setCustomValidity(err.message);
    input.reportValidity();
  }
});
input.addEventListener('input', () => {
  input.setCustomValidity('');
  error.textContent = '';
});
document.getElementById('clear-purchased').addEventListener('click', () => {
  const persisted = saveShoppingItems(clearPurchased(getShoppingItems()));
  render();
  const target = root.querySelector('.remove-item') || input;
  target.focus();
  status(`Købte varer er ryddet.${persisted ? '' : ' Kun midlertidigt.'}`);
});
window.addEventListener('storage', render);
render();
