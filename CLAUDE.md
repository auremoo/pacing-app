# Pacing App — CLAUDE.md

Application web PWA mobile-first pour gérer des plans de préparation sportive.  
Utilisateur unique, protégée par mot de passe (171225). Données stockées sur GitHub via API.

## Stack

- **Vanilla JS** (ES modules, pas de framework, pas de build)
- **CSS pur** (variables CSS, design iOS)
- **GitHub API** (PAT fine-grained, Contents read+write) pour persistance
- **PWA** (manifest + service worker) pour installation mobile iOS
- **Hébergement** : GitHub Pages sur branche `main`

## Architecture fichiers

```
pacing-app/
├── index.html                      # Shell HTML unique
├── manifest.webmanifest
├── service-worker.js
├── css/
│   ├── tokens.css                  # Variables CSS (couleurs, spacing, typo)
│   ├── reset.css                   # Reset + base
│   └── components.css              # Tous les composants UI
├── js/
│   ├── app.js                      # Router hash-based + boot
│   ├── store.js                    # State management + GitHub sync
│   ├── github-api.js               # Wrapper API GitHub (GET/PUT)
│   ├── parser.js                   # Parse le template .md → objet structuré
│   ├── views/
│   │   ├── lock.js                 # Écran password
│   │   ├── dashboard.js            # Liste des événements
│   │   ├── event.js                # Container événement (onglets)
│   │   ├── plan-view.js            # Plan semaines/séances + checkboxes
│   │   ├── course-view.js          # Parcours (GPX/PDF/JSON)
│   │   ├── versions-view.js        # Gestion versions du plan
│   │   ├── infos-view.js           # Allures, PPG, vigilance, stratégie, nutrition
│   │   ├── session-view.js         # Détail d'une séance + note
│   │   └── settings.js             # Config PAT GitHub
│   └── utils/
│       ├── dates.js
│       ├── markdown.js             # Renderer markdown minimal
│       └── gpx-parser.js          # Parse GPX + génère SVG profil altimétrique
├── events/
│   ├── index.json                  # Liste des slugs d'événements
│   ├── run-in-lyon-2026/
│   │   ├── meta.json               # Métadonnées + versions + course
│   │   └── plans/v1.md             # Plan au format template
│   └── marathon-alpes-bsm/
│       └── meta.json
├── state.json                      # Sessions cochées, notes
└── docs/
    └── CLAUDE_PROMPT.md            # Template prompt pour générer des plans
```

## Flux de données

```
GitHub repo
  ├── events/index.json     → liste des événements (lu au boot)
  ├── events/{slug}/meta.json → métadonnées + liste des versions
  ├── events/{slug}/plans/v{N}.md → plan parsé en mémoire
  ├── events/{slug}/course/{file} → GPX/PDF/JSON du parcours
  └── state.json            → sessions cochées (lu au boot, écrit en temps réel)
```

**Auth** : PAT GitHub stocké dans `localStorage` sous la clé `pacing_github`.  
**Session app** : `sessionStorage.pacing_auth = '1'` après saisie du mot de passe.

## Template .md des plans

Le format template que Claude génère est décrit en détail dans [docs/CLAUDE_PROMPT.md](./docs/CLAUDE_PROMPT.md).

**Sections du template :**
- `## META` — clé: valeur (event, slug, date, distance_km, objective_time, plan_start, plan_weeks…)
- `## PHASES` — tableau markdown (ID | Nom | Semaines | Couleur)
- `## ALLURES` — deux sous-sections `### Actuelles` et `### Cibles` avec tableaux
- `## SEMAINES` — une `### S{NN} | date | phase-id | {N}km | note` par semaine, sessions en tableau
- `## PPG`, `## VIGILANCE`, `## STRATEGIE_COURSE`, `## NUTRITION` — markdown libre

**Types de séance valides :** `rest`, `easy`, `long`, `intervals`, `tempo`, `hills`, `race`, `strength`, `cross`

**IDs de session :** générés par le parser → `s{NN}-{daycode}` (ex: `s01-mon`, `s03-thu`)  
**State.json** structure : `{ events: { "slug": { "s01-mon": { completed, completedAt, note } } } }`

## Ajouter un événement

1. Créer `events/{slug}/meta.json` (copier le template depuis run-in-lyon-2026)
2. Ajouter l'entrée dans `events/index.json`
3. Pousser sur GitHub
4. L'événement apparaît au prochain chargement de l'app

## Modifier un plan existant

1. Générer le nouveau `.md` avec le prompt Claude (voir `docs/CLAUDE_PROMPT.md`)
2. Dans l'app → événement → onglet Versions → Importer nouvelle version
3. L'app upload le fichier et met à jour `meta.json` automatiquement

## Conventions de code

- Pas de build step, tout en ES modules natifs
- Les vues exportent `mount(container, ...params)` qui écrit dans `container.innerHTML`
- Délégation d'événements sur le container plutôt qu'éléments individuels quand c'est dynamique
- GitHub sync : debounce 600ms, optimistic UI, refetch du sha avant chaque PUT pour éviter les 409
- Pas de TypeScript, pas de linter — garder simple

## Déploiement GitHub Pages

1. Créer repo public `pacing-app` sur GitHub
2. Push le code (branche `main`)
3. Settings → Pages → Source : main, root `/` → Save
4. Sur iPhone : Safari → l'URL → Partager → "Sur l'écran d'accueil"
5. Configurer le PAT dans l'app (Réglages)
