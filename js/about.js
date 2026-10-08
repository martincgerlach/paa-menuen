import { initCommon } from './ui.js';
initCommon();
const form = document.getElementById('contact-form');
form.addEventListener('submit', event => {
  event.preventDefault();
  document.getElementById('form-status').textContent = 'Formularen er gyldig. Dette er en demonstration; ingen besked er sendt eller gemt.';
});
