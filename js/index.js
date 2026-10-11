import { getRecipes } from './api.js';
import { initCommon, loadWithRetry, renderRecipes, setImage, status } from './ui.js';
initCommon();
await loadWithRetry(async () => {
  const recipes = await getRecipes();
  // Figma's hero uses recipe 4; its title/image still come from the live response.
  const hero = recipes.find(r => r.id === 4) || recipes[0];
  if (hero) {
    setImage(document.getElementById('hero-image'), hero, true);
    // Opskriftskortet linker altid til det samme API-id som fotografiet.
    if (hero.image) {
      const link = document.getElementById('hero-recipe-link');
      link.href = `singleproduct.html?id=${hero.id}`;
      link.textContent = hero.name;
      document.getElementById('hero-image-overlay').hidden = false;
    }
  }
  const selected = [1, 4, 6].map(id => recipes.find(r => r.id === id)).filter(Boolean);
  renderRecipes(document.getElementById('home-recipes'), selected.length ? selected : recipes.slice(0, 3));
  status(recipes.length ? '' : 'Ingen opskrifter er tilgængelige lige nu.', recipes.length ? '' : 'empty');
});
