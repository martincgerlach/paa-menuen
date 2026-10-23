# På Menuen – teknisk dokumentation

Vi er Team 8: Martin, Sia, Jennifer og Sabrina. På Menuen er vores gruppeprojekt i Tema 8 / Web II på multimediedesigneruddannelsens 2. semester.

Vi har lavet et opskriftswebsite til udeboende 18–40-årige, som selv laver mad. Brugeren kan finde opskrifter, få et forslag fra Madterningen, gemme favoritter og lave en indkøbsliste. Vi bruger HTML, CSS og JavaScript uden framework eller buildtrin.

## Projektlinks

- [Den færdige hjemmeside](https://martincgerlach.github.io/paa-menuen/)
- [Dokumentationsrapport](https://docs.google.com/document/d/1OaKauzlZGXVv00-3RbMD_0LlEyUpeaSn0dXgdTdE68s/edit)
- [Figma – wireframes og prototype](https://www.figma.com/design/6i9jiZIJXc5KY8s76n7b8k/P%C3%A5-Menuen)
- [FigJam – research og designproces](https://www.figma.com/board/h9SC79INo4A1w6o2tqCzVb/Team-8?node-id=2-2)
- [SCRUM – projektstyring](https://www.figma.com/board/h9SC79INo4A1w6o2tqCzVb/Team-8?node-id=167-965)

README’en samler vores tekniske dokumentation og retningslinjer for videre arbejde. Beskrivelserne tager udgangspunkt i koden på `main`. Lokale ændringer og åbne pull requests er ikke nødvendigvis udgivet.

## Projektstruktur

HTML-siderne ligger i roden. Fælles CSS ligger i `css/`, JavaScript i `js/` og ressourcer i `assets/`.

```text
paa-menuen/
├── index.html             # Forside
├── productlist.html       # Opskriftsliste
├── singleproduct.html     # Opskriftsdetalje
├── madterningen.html
├── favoritter.html
├── indkoebsliste.html
├── om-os.html
├── css/style.css          # Fælles styling og responsive layouts
├── js/                    # Sidescripts og fælles moduler
├── assets/                # Logo, ikoner, lokal Inter-font og fontlicens
├── docs/                  # Supplerende dokumentation
├── tests/                 # Tekniske tests
└── .github/workflows/     # GitHub Actions
```

Opskriftsbilleder hentes fra API’et. I `assets/` ligger blandt andet logo og et reservebillede. Vi bruger ikke en separat boilerplate-mappe. Fælles funktioner ligger i moduler, som siderne importerer.

| HTML-side | Sidescript |
| --- | --- |
| `index.html` | `js/index.js` |
| `productlist.html` | `js/productlist.js` |
| `singleproduct.html` | `js/singleproduct.js` |
| `madterningen.html` | `js/dice-page.js` |
| `favoritter.html` | `js/favorites-page.js` |
| `indkoebsliste.html` | `js/shopping-page.js` |
| `om-os.html` | `js/about.js` |

De fælles moduler har hver sin opgave:

- `api.js` henter og kontrollerer opskriftsdata.
- `filters.js` filtrerer, sorterer og vælger opskrifter.
- `ui.js` samler fælles visning og navigation.
- `labels.js` indeholder danske kategorinavne og udvalgte søgeord.
- `favorites.js`, `shopping.js` og `storage.js` håndterer favoritter, indkøbsliste og lagring i browseren.

## Navngivning

Vi bruger små bogstaver og ingen mellemrum i fil- og mappenavne. Flere ord adskilles med bindestreg, som i `dice-page.js`. Vi beholder de eksisterende navne, selv om projektet blander danske og engelske filnavne.

Sidescriptet skal have et navn, der viser, hvilken side det hører til. Tabellen ovenfor forklarer de steder, hvor navnene ikke er ens. I JavaScript bruger vi camelCase, fx `filterRecipes` og `previousId`. CSS-klasser bruger bindestreger, fx `.recipe-card`.

## Link til scripts

Vi placerer sidens script i `<head>` med `type="module"`:

```html
<script type="module" src="js/productlist.js"></script>
```

Modulscripts venter som udgangspunkt på, at HTML’en er læst. Derfor bruger vi ikke et ekstra `defer`. Fælles funktioner importeres fra andre JavaScript-filer.

## Git branches

`main` er vores fælles version og den branch, GitHub Pages udgiver fra. Vi laver afgrænsede ændringer i separate branches og samler dem gennem pull requests.

Ved nye branches bruger vi korte navne, som viser person og opgave, fx `feature-martin-opskriftsfiltre` eller `fix-sia-mobil-layout`. Det er retningslinjen fremover; ældre branches har også andre navne. Vi omskriver ikke den gamle Git-historik.

## Arbejdsflow

Vi bruger FigJam/SCRUM til at holde overblik over opgaverne. Underviseren har godkendt boardet som erstatning for Trello. Ved videre arbejde følger vi disse retningslinjer:

1. Aftal, hvem der arbejder med hvilken side eller funktion. Giv besked, før du ændrer fælles filer som `style.css` eller `ui.js`.
2. Hent den seneste `main`, og opret en branch til en afgrænset opgave.
3. Lav små commits med en konkret besked, fx `Ret overlap på opskriftsdetaljen`.
4. Kontrollér ændringen i browseren, også på mobil, og kør de relevante tests.
5. Opret en pull request, og gennemgå ændringerne før merge.
6. Giv gruppen besked, når ændringen er samlet i `main`, og opdatér opgaven på SCRUM-boardet. Tjek den udgivne hjemmeside, før opgaven kaldes udgivet.

## Kode og kommentarer

Vi bruger `function` til navngivne funktioner, fx `filterRecipes()`, og arrow functions til korte hjælpefunktioner og callbacks. Begge former findes i projektet. Det vigtigste er tydelige navne og små funktioner med en afgrænset opgave.

Vi bruger primært klasser til CSS og id’er til bestemte elementer i JavaScript. Der findes også klassevælgere i JavaScript, fx `.dice-cube`, og `data-*`-attributter til ekstra information. Derfor skal vi tjekke både CSS og JavaScript, før vi omdøber en klasse eller et id.

Kommentarer skal forklare noget, der ikke er tydeligt i koden, fx en begrænsning i API’et. Vi undgår kommentarer, der bare gentager den næste kodelinje. Tilføj en kort forklaring i starten af en fil, hvis dens formål ikke er tydeligt ud fra navnet og indholdet.

## Funktionalitet

- Hente opskrifter og opskriftsdetaljer fra DummyJSON.
- Søge efter opskrifter og ingredienser, herunder udvalgte danske søgeord.
- Filtrere efter køkken, måltid, tid, sværhedsgrad, rating og ingredienser.
- Sortere opskrifter og vise flere kort uden at genindlæse siden.
- Åbne en detaljeside ud fra opskriftens id i URL’en.
- Vælge et tilfældigt forslag med Madterningen blandt de opskrifter, der matcher filtrene.
- Gemme favoritter og indkøbsliste lokalt i browseren.
- Markere ingredienser, man allerede har, og tilføje de manglende til indkøbslisten.
- Tilføje egne varer med en HTML-valideret formular og krydse købte varer af.
- Vise beskeder ved indlæsning, tomme resultater og fejl.

Flere valg inden for samme filterkategori fungerer som alternativer. Forskellige kategorier kombineres. Samlet tid er forberedelsestid plus tilberedningstid. Favoritter og indkøbsliste deles ikke mellem enheder eller brugere.

## API endpoints

Vi bruger [DummyJSON Recipes](https://dummyjson.com/docs/recipes):

| Endpoint | Brug |
| --- | --- |
| `https://dummyjson.com/recipes?limit=0` | Henter opskriftslisten. |
| `https://dummyjson.com/recipes?limit=100&skip={antal}` | Henter flere, hvis første svar ikke indeholder hele listen. `antal` er antallet, vi allerede har hentet. |
| `https://dummyjson.com/recipes/{id}` | Henter en bestemt opskrift til detaljesiden. |

Søgning, filtrering og sortering sker i de indlæste data. Vi bruger derfor ikke særskilte API-endpoints til hvert filter.

Navne, ingredienser, instruktioner, billeder og ratings kommer fra API’et. Opskriftsteksten er på engelsk. Danske kategorinavne og søgeord er hjælp i vores brugerflade, ikke en oversættelse af alle opskrifter. API’et har ikke priser eller ingrediensmængder, så vi beregner ikke budget, besparelser eller præcise indkøbsmængder.

## Dokumentation af funktion: `pickRecipe()`

**Beskrivelse:** Funktionen i `js/filters.js` vælger et tilfældigt forslag til Madterningen. `dice-page.js` giver den de opskrifter, der matcher de aktive filtre. Hvis der er flere muligheder, undgår funktionen at vælge samme opskrift to gange i træk.

**Parametre:**

- `candidates`: Et array med de mulige opskrifter.
- `previousId`: Id’et på det forrige forslag.
- `rng`: En funktion, der giver et tilfældigt tal fra 0 til under 1. Som standard bruges `Math.random`. I tests kan vi sende en fast funktion ind.

**Returnerer:** En opskrift eller `null`, hvis der ikke er nogen at vælge mellem. Hvis der kun er én opskrift, kan den vælges igen. Funktionen ændrer ikke DOM’en; sidescriptet viser resultatet.

Koden fra `js/filters.js`:

```js
export function pickRecipe(candidates, previousId, rng = Math.random) {
  const pool = candidates.length > 1 ? candidates.filter(r => r.id !== previousId) : candidates;
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] : null;
}
```

Sådan kaldes den i `js/dice-page.js`:

```js
const recipe = pickRecipe(candidates(), previousId);
```

Her finder `candidates()` de opskrifter, der passer til filtrene. `previousId` bruges til at undgå en gentagelse, når der er flere resultater.

## Kør projektet lokalt

Start en lokal webserver fra repositoryets rod:

```sh
python3 -m http.server 8018 --bind 127.0.0.1
```

Åbn `http://127.0.0.1:8018/`. Brug en webserver frem for at åbne HTML-filerne direkte, da JavaScript-filerne bruger moduler. Der kræves internet til opskriftsdata og billeder.

## Tekniske tests

Logiktests kan køres med Node 22 eller nyere:

```sh
node --experimental-default-type=module --test tests/logic.test.mjs
```

Browsertests kræver en separat Playwright-installation:

```sh
PLAYWRIGHT_PATH=/path/to/playwright QA_OUTPUT=/path/to/evidence node tests/browser.cjs
```

GitHub Actions i `.github/workflows/` indeholder målrettede kontroller af blandt andet navigation, mobilmenu og layout. Testantal og resultater skal læses i den enkelte kørsel. Automatiske kontroller er ikke brugertests med deltagere.

Mobilmenuens baggrund og kontrol er beskrevet i [UX-iteration: mobilmenu](docs/ux-iteration-mobilmenu.md). Kode og testfiler kan følges i [Git-historikken](https://github.com/martincgerlach/paa-menuen/commits/main/).
