import { getRecipes } from './api.js';
import { initCommon, loadWithRetry, renderRecipes, setImage, status } from './ui.js';

initCommon();

await loadWithRetry(async () => {
  const recipes = await getRecipes();
  const withPhotos = recipes.filter(recipe => recipe.image);
  // Første foto bevarer Figma-valget. De øvrige kommer også direkte fra API'et.
  const first = withPhotos.find(recipe => recipe.id === 4) || withPhotos[0];
  const featured = first ? [first, ...withPhotos.filter(recipe => recipe.id !== first.id).slice(0, 4)] : [];

  if (featured.length) {
    const photo = document.getElementById('hero-image');
    const recipeLink = document.getElementById('hero-recipe-link');
    const overlay = document.getElementById('hero-image-overlay');
    const controls = document.getElementById('hero-image-controls');
    const previous = document.getElementById('hero-previous');
    const next = document.getElementById('hero-next');
    const pause = document.getElementById('hero-pause');
    const photoCard = document.querySelector('.hero-image-wrap');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let current = 0;
    let changing = false;
    let paused = false;
    let mouseOver = false;
    let focusWithin = false;

    function updateDetails(recipe) {
      recipeLink.href = `singleproduct.html?id=${recipe.id}`;
      recipeLink.textContent = recipe.name;
      recipeLink.lang = 'en';
      overlay.hidden = false;
    }

    // Det første billede er stadig højt prioriteret for hurtig indlæsning.
    setImage(photo, featured[0], true);
    updateDetails(featured[0]);

    async function changePhoto(direction) {
      if (changing || featured.length < 2) return;
      changing = true;
      try {
        // Indlæs det næste API-billede, inden det nuværende erstattes.
        // Hvis et billede fejler, prøver vi det næste i stedet.
        for (let step = 1; step < featured.length; step++) {
          const index = (current + direction * step + featured.length) % featured.length;
          const recipe = featured[index];
          const preview = new Image();
          preview.src = recipe.image;
          try {
            await preview.decode();
          } catch {
            continue;
          }
          photo.src = recipe.image;
          photo.alt = recipe.name;
          updateDetails(recipe);
          current = index;
          photo.classList.remove('is-changing');
          // En lille fade-in uden eksterne animationsbiblioteker.
          void photo.offsetWidth;
          if (!reducedMotion) photo.classList.add('is-changing');
          break;
        }
      } finally {
        changing = false;
      }
    }

    if (featured.length > 1) {
      controls.hidden = false;
      // Ved reduceret bevægelse er der intet automatisk billedskift at sætte på pause.
      pause.hidden = reducedMotion;
      previous.addEventListener('click', () => changePhoto(-1));
      next.addEventListener('click', () => changePhoto(1));
      pause.addEventListener('click', () => {
        paused = !paused;
        pause.textContent = paused ? 'Afspil' : 'Pause';
        pause.setAttribute('aria-pressed', String(paused));
        pause.setAttribute('aria-label', paused ? 'Genoptag automatisk billedskift' : 'Sæt automatisk billedskift på pause');
      });

      photoCard.addEventListener('mouseenter', () => { mouseOver = true; });
      photoCard.addEventListener('mouseleave', () => { mouseOver = false; });
      photoCard.addEventListener('focusin', () => { focusWithin = true; });
      photoCard.addEventListener('focusout', event => {
        if (!photoCard.contains(event.relatedTarget)) focusWithin = false;
      });

      // Intet automatisk skift ved reduceret bevægelse, men pilene virker stadig.
      if (!reducedMotion) {
        window.setInterval(() => {
          if (!paused && !mouseOver && !focusWithin && !document.hidden) changePhoto(1);
        }, 7000);
      }
    }
  }

  const selected = [1, 4, 6].map(id => recipes.find(recipe => recipe.id === id)).filter(Boolean);
  renderRecipes(document.getElementById('home-recipes'), selected.length ? selected : recipes.slice(0, 3));
  status(recipes.length ? '' : 'Ingen opskrifter er tilgængelige lige nu.', recipes.length ? '' : 'empty');
});
