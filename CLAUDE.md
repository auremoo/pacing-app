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
├── index.html                      # Shell HTML unique (sidebar + app)
├── setup.html                      # Page standalone de génération du config.json
├── config.json                     # { owner, repo, branch, encryptedToken }
├── manifest.webmanifest
├── service-worker.js               # Force no-store JS/CSS/HTML (évite cache périmé sur iOS PWA)
├── css/
│   ├── tokens.css                  # Variables CSS (couleurs, spacing, typo)
│   ├── reset.css                   # Reset + base + layout desktop (grid sidebar)
│   └── components.css              # Tous les composants UI + styles sidebar
├── js/
│   ├── app.js                      # Router hash-based + boot + montage sidebar
│   ├── store.js                    # State management + GitHub sync
│   ├── github-api.js               # Wrapper API GitHub (GET/PUT, rawBase64, fallback download_url >1MB)
│   ├── parser.js                   # Parse le template .md → objet structuré
│   ├── views/
│   │   ├── lock.js                 # Écran password + déchiffrement PAT
│   │   ├── dashboard.js            # Liste des événements + bouton Créer
│   │   ├── sidebar.js              # Sidebar desktop (événements, séance du jour, nouvel événement)
│   │   ├── event.js                # Container événement (onglets)
│   │   ├── plan-view.js            # Plan semaines/séances + checkboxes + état manquée (skipped)
│   │   ├── course-view.js          # Parcours (GPX+PDF+photos, résultat, stats)
│   │   ├── versions-view.js        # Gestion versions + prompt initial + prompt révision
│   │   ├── infos-view.js           # Synthèse, Allures, Principes, PPG, Vigilance, Stratégie, Nutrition
│   │   ├── session-view.js         # Détail d'une séance + note
│   │   ├── settings.js             # Formulaire profil athlète (stocké dans athlete.json)
│   │   └── new-event.js            # Formulaire création d'un nouvel événement
│   └── utils/
│       ├── dates.js
│       ├── markdown.js             # Renderer markdown minimal
│       ├── crypto.js               # AES-GCM + PBKDF2 (chiffrement du PAT)
│       └── gpx-parser.js          # Parse GPX + profil altimétrique + curseur interactif
├── events/
│   ├── index.json                  # Liste des slugs d'événements
│   ├── run-in-lyon-2026/
│   │   ├── meta.json               # Métadonnées + versions + course (gpx + pdf)
│   │   ├── plans/v1.md             # Plan au format template
│   │   └── course/                 # Fichiers GPX et PDF importés
│   └── marathon-alpes-bsm/
│       └── meta.json
├── athlete.json                    # Profil athlète (niveau, perfs, volume, jours, équipements, terrain, pathologies, objectifs)
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
  ├── athlete.json          → profil athlète (lu au boot, écrit depuis Réglages)
  └── state.json            → sessions cochées (lu au boot, écrit en temps réel)
```

**Auth** : PAT GitHub chiffré AES-GCM (PBKDF2, mot de passe `171225`) stocké dans `config.json` du repo (`encryptedToken`). Jamais en clair dans le repo ni dans localStorage.  
**Session app** : `sessionStorage.pacing_auth = '1'` après saisie du mot de passe. PAT déchiffré stocké dans `sessionStorage('pacing_pat')` pour la durée de la session.  
**Nouveau device** : aucune config à faire — le PAT est dans `config.json` (repo public), déchiffré automatiquement au login.  
**`setup.html`** : page standalone pour générer un nouveau `config.json` (nouveau PAT ou changement de repo).

## Template .md des plans

Le format template que Claude génère est décrit en détail dans [docs/CLAUDE_PROMPT.md](./docs/CLAUDE_PROMPT.md).

**Sections du template :**
- `## META` — clé: valeur (event, slug, date, distance_km, objective_time, plan_start, plan_weeks…)
- `## PHASES` — tableau markdown (ID | Nom | Semaines | Couleur)
- `## ALLURES` — deux sous-sections `### Actuelles` et `### Cibles` avec tableaux
- `## SEMAINES` — une `### S{NN} | date | phase-id | {N}km | note` par semaine, sessions en tableau
- `## SYNTHESE` — mise en perspective athlète/objectif, analyse du gap, cible réaliste
- `## PRINCIPES` — structure hebdo, rôle du cross-training, décharge, spécificités parcours
- `## PPG`, `## VIGILANCE`, `## STRATEGIE_COURSE`, `## NUTRITION` — markdown libre

**Onglet Infos** (infos-view.js) : 7 onglets — Synthèse, Allures, Principes, PPG, Vigilance, Stratégie, Nutrition (onglets masqués si section vide).

**Types de séance valides :** `rest`, `easy`, `long`, `intervals`, `tempo`, `hills`, `race`, `strength`, `cross`

**IDs de session :** générés par le parser → `s{NN}-{daycode}` (ex: `s01-mon`, `s03-thu`)  
**State.json** structure : `{ events: { "slug": { "s01-mon": { completed, completedAt, skipped, skippedAt, note } } } }`  
`skipped: true` = séance manquée (orange, barré). Exclusif avec `completed`.

## Ajouter un événement

**Via l'app (recommandé)** : Dashboard → "Créer un événement" (ou bouton sidebar) → formulaire → `createEvent()` crée `events/{slug}/meta.json` et met à jour `events/index.json` automatiquement.

**Manuellement** : Créer `events/{slug}/meta.json`, ajouter l'entrée dans `events/index.json`, pusher sur GitHub.

## Importer / Modifier un plan

1. Dans l'app → événement → onglet Versions :
   - Sans plan : "Générer le prompt de plan initial" → copier → Claude → obtenir .md → importer
   - Avec plan : "Générer un prompt de révision" → copier → Claude → obtenir .md → importer
2. Les deux prompts sont pré-remplis avec le profil athlète (Réglages) + les données de l'événement
3. "Importer nouvelle version" upload le .md et met à jour `meta.json` automatiquement

## Profil athlète

Stocké dans `athlete.json` à la racine du repo. Chargé au boot dans `_athlete`. Géré depuis Réglages (formulaire).  
Champs : `level`, `perfs`, `volume`, `days`, `equipment`, `terrain`, `pathologies`, `goals`.  
Injecté automatiquement dans les prompts de plan initial et de révision.

## Structure meta.json d'un événement

```json
{
  "slug": "run-in-lyon-2026",
  "name": "Run in Lyon 2026",
  "distanceKm": 21.0975,
  "distanceLabel": "Semi-marathon",
  "raceDate": "2026-10-04",
  "elevationGainM": 184,
  "objective": "1h50",
  "objectiveRealistic": "1h51-1h53",
  "courseDescription": "Vallonné léger, montée notable km 14-17",
  "location": "Lyon, France",
  "planStart": "2026-05-18",
  "planWeeks": 20,
  "activeVersion": 1,
  "versions": [{ "v": 1, "file": "v1.md", "importedAt": "…", "label": "…" }],
  "course": {
    "gpx": { "filename": "…gpx", "importedAt": "…" },
    "pdf": { "filename": "…pdf", "importedAt": "…" }
  },
  "photos": ["photo-1234567890.jpg"],
  "result": { "time": "1h52'34\"", "pacePerKm": "5'20\"/km", "activityUrl": null }
}
```

`activeVersion: null` + `versions: []` = événement sans plan (état normal après création via l'app).  
`location`, `objectiveRealistic`, `courseDescription` sont optionnels mais utilisés dans les prompts générés.

`course.gpx` et `course.pdf` sont `null` si pas encore importés. `photos` est un tableau de noms de fichiers (max 2, 5 Mo/photo, stockés dans `events/{slug}/course/`).  
**GPX** : quand un GPX est présent, distance et D+ sont calculés automatiquement (window=3 + threshold=1.5m). Ces champs sont en **lecture seule avant la date de course**, puis **éditables après** (pour saisir les valeurs officielles).  
**Fichiers > 1MB** : `getFile` détecte un `content` vide et passe par `download_url` pour récupérer le fichier brut.

## Layout responsive

- **Mobile** : navigation par onglets en bas, nav-bar en haut, sidebar cachée
- **Desktop (≥768px)** : CSS Grid `260px sidebar + 1fr contenu`. La sidebar liste les événements + séance du jour. La nav-bar est masquée (la sidebar prend ce rôle).

## Fonctionnalités clés

- **Séances manquées** : `skipSession(slug, id, true)` — état `skipped` dans state.json, exclusif avec `completed`
- **Prompt plan initial** : versions-view (sans plan) → "Générer le prompt de plan initial" — pré-rempli profil athlète + meta événement
- **Prompt révision** : versions-view → "Générer un prompt de révision" — bilan semaine + profil athlète + plan brut + format template
- **Création événement** : `createEvent(data)` — crée `events/{slug}/meta.json` + màj `events/index.json` via API GitHub
- **Profil athlète** : `getAthleteProfile()` / `saveAthleteProfile(profile)` — `athlete.json` à la racine du repo
- **Photos** : 2 max par événement, 5 Mo max, stockées en base64 dans `events/{slug}/course/`, MIME auto-détecté
- **GPX parser** : `smoothElevation(points, 3)` + `calcElevationThreshold(smoothed, 1.5)` pour D+/D- précis

## Conventions de code

- Pas de build step, tout en ES modules natifs
- Les vues exportent `mount(container, ...params)` qui écrit dans `container.innerHTML`
- Délégation d'événements sur le container plutôt qu'éléments individuels quand c'est dynamique
- GitHub sync : refetch du SHA avant chaque PUT pour éviter les 409 (conflit)
- Fichiers binaires (PDF, photos) : `getFile(path, { rawBase64: true })` retourne le base64 brut sans décoder en UTF-8. Si > 1MB, fallback automatique via `download_url`
- Pas de TypeScript, pas de linter — garder simple

## Déploiement GitHub Pages

1. Créer repo public `pacing-app` sur GitHub
2. Push le code (branche `main`)
3. Settings → Pages → Source : main, root `/` → Save
4. Sur iPhone : Safari → l'URL → Partager → "Sur l'écran d'accueil"
5. Configurer le PAT dans l'app (Réglages → "Mettre à jour le token GitHub")
