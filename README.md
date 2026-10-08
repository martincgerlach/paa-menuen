# På Menuen

Tema 8 / Web II — Team 8. Static, mobile-first HTML/CSS/vanilla JavaScript website. No build step, production packages, database or backend.

## Run locally

From this repository's root (the existing local directory is **Kodning 2/**):

```sh
python3 -m http.server 8018 --bind 127.0.0.1
```

Open http://127.0.0.1:8018/. Use HTTP rather than opening the HTML as files, because the page scripts are ES-modules.

## Pages and script flow

- `index.html` / `js/index.js`: live API hero and inspiration cards, discovery links.
- `productlist.html` / `js/productlist.js`: complete dataset, search, filters, sorting and incremental rendering.
- `singleproduct.html?id=1` / `js/singleproduct.js`: fetch the actual recipe by ID, favorite toggle and shopping-list integration.
- `madterningen.html` / `js/dice-page.js`: random choice from the same active filter pool; explicit switch to all recipes.
- `favoritter.html` / `js/favorites-page.js`: locally saved recipe IDs, hydrated from API data.
- `indkoebsliste.html` / `js/shopping-page.js`: source ingredient checklist, manual items, purchased state and removal.
- `om-os.html` / `js/about.js`: project description and native HTML-validated feedback demonstration. No message is transmitted or retained.

`api.js` fetches/validates/normalizes → `filters.js` selects results → `ui.js` renders DOM nodes. `labels.js` contains category labels and a small explicit Danish ingredient-search alias dictionary. `storage.js` handles persistence failures; `favorites.js` and `shopping.js` own the small local models. CSS holds the shared Hi-Fi tokens and mobile-first layouts. Comments explain non-obvious choices rather than repeat code.

## API and data integrity

Source: [official DummyJSON Recipes REST API](https://dummyjson.com/docs/recipes). Website reads `https://dummyjson.com/recipes?limit=0` and `https://dummyjson.com/recipes/{id}`. If a response is incomplete, the list continues with `limit=100&skip=…`; duplicates/incomplete pages raise an error. No permanent API snapshot, invented recipes or Products API. No backend clone.

Verified 8 October 2026: default endpoint returned 30 of 50; limit=0 returned all 50. Counts in the UI come from data, never a fixed number. Official meal endpoint is **/recipes/meal-type/{mealType}**, not /recipes/meal/{mealType}. Server search searches name only. Cuisine/time/difficulty/rating/ingredient combinations are applied locally to the complete set. Endpoint responses can change; the complete verification evidence lives in the parent project's review report.

Data remains English for names, ingredients and instructions, with `lang=en`. Danish UI/category labels and aliases are our interface aids, not original API content or verified recipe translations. Unknown numeric metadata remains unknown, not zero. Times are **prepTimeMinutes + cookTimeMinutes**. No prices, ingredient quantities, portion scaling, own review system, allergen or complete dietary classification is invented. Ratings belong to the sample API dataset.

## Behavior contracts

- OR within a selected filter category, AND between categories. All entered home ingredients must appear somewhere in a recipe's ingredients; this does not mean the user has every required ingredient. Comma separates ingredient terms. Search matches title/ingredients and documented Danish aliases.
- Time: under 30 = `<30`, 30–45 includes both boundaries, over 45 = `>45`. Unknown time does not match a time constraint.
- Filters are URL parameters (`q`, `cuisine`, `meal`, `time`, `difficulty`, `rating`, `ingredients`). Active query is shared with Madterningen using sessionStorage. Browser back restores the URL filters. Search is part of the active pool.
- Madterningen chooses from array elements, not assumed ID ranges. Zero matches disables a roll with a clear explanation; one result may repeat; several results avoid immediately repeating the prior result.
- Favorites store real recipe IDs in localStorage. Shopping items store source recipe ID/name/ingredient-index/text or a separately labeled manual entry. Identical ingredient text from different recipes is not merged or added as a quantity. Adding the same recipe again adds only absent ingredient rows and preserves checked rows.
- Detail ingredient checkboxes are a temporary checklist. The clearly labeled action adds **all** ingredients. Purchases in the shopping list persist. Removing favorites never deletes shopping items.
- Storage keys begin `paa-menuen:`. Corrupt/unavailable storage falls back in the current page with a visible warning. Temporary fallback is not promised to survive reload/navigation. Nothing synchronizes between devices/accounts.

## Source and design decisions

Ruling: Preserve the actual `Kodning 2/` checkout and repository-root file names rather than create `Kodning2/` or a new repository. Main and remote teammate work were inspected before branching; initially only seven empty files existed and no open PRs were present.

Ruling: Implement the provided Hi-Fi reference values (#29483B, #E5ECDF, #F7F5EF, #FFFFFF, #252D29, #657269, #D9DED5), Inter, 12 px controls / 16 px cards. Inter Latin variable WOFF2 is local (48,432 bytes); OFL license is in assets. Keep draft Style Tile alternatives separate. Final group sign-off is not manufactured.

Ruling: Use a responsive native dialog for filters rather than a fixed desktop sidebar. Increase interactive row areas and provide visible focus. At 320 px use one recipe column; at 390 px use two. Preserve source order/hierarchy but record layout/copy differences for independent review.

Ruling: Describe the fictional concept alongside truthful school-project/API provenance, without claiming an unsupported commercial organization, user research result or budget calculation. The precise primary audience remains a group decision.

## Tests

Node 22+ (no packages needed for pure logic):

```sh
node --experimental-default-type=module --test tests/logic.test.mjs
```

Browser verification uses a separately available Playwright installation and Chrome. Neither is a production dependency:

```sh
PLAYWRIGHT_PATH=/path/to/playwright QA_OUTPUT=/path/to/evidence node tests/browser.cjs
```

The browser suite uses live API data for normal flows, and clearly scoped response/network/storage simulations only for error tests. Synthetic logic fixtures are test-only and never served as website recipe data. Browser screenshots, HTML validation and Lighthouse outputs are retained outside the code repository in the parent project's `reports/2026-10-08/` folder. Runtime errors, simulated failures and measurement limitations are distinguished there.

## Git and release

Development branch: `feat/recipes-integration`. Main is unchanged. No remote push, PR, merge or deployment was authorized in this task. GitHub Pages remains an outstanding assignment delivery requirement, not a claimed result. A future authorized release can publish repository-root files without a framework/build. Use relative paths beneath `/paa-menuen/`; rerun live API/links/forms/persistence checks on the public URL after deployment.

Independent review recommendations are report-only and must not automatically be applied.
