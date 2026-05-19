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
├── service-worker.js               # Passthrough — pas de cache (évite JS périmé)
├── css/
│   ├── tokens.css                  # Variables CSS (couleurs, spacing, typo)
│   ├── reset.css                   # Reset + base + layout desktop (grid sidebar)
│   └── components.css              # Tous les composants UI + styles sidebar
├── js/
│   ├── app.js                      # Router hash-based + boot + montage sidebar
│   ├── store.js                    # State management + GitHub sync
│   ├── github-api.js               # Wrapper API GitHub (GET/PUT, option rawBase64)
│   ├── parser.js                   # Parse le template .md → objet structuré
│   ├── views/
│   │   ├── lock.js                 # Écran password + déchiffrement PAT
│   │   ├── dashboard.js            # Liste des événements
│   │   ├── sidebar.js              # Sidebar desktop (événements, séance du jour)
│   │   ├── event.js                # Container événement (onglets)
│   │   ├── plan-view.js            # Plan semaines/séances + checkboxes
│   │   ├── course-view.js          # Parcours (GPX+PDF, résultat, stats)
│   │   ├── versions-view.js        # Gestion versions du plan
│   │   ├── infos-view.js           # Synthèse, Allures, Principes, PPG, Vigilance, Stratégie, Nutrition
│   │   ├── session-view.js         # Détail d'une séance + note
│   │   └── settings.js             # Informations de connexion (lecture seule)
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
  "planStart": "2026-05-18",
  "planWeeks": 20,
  "activeVersion": 1,
  "versions": [{ "v": 1, "file": "v1.md", "importedAt": "…", "label": "…" }],
  "course": {
    "gpx": { "filename": "…gpx", "importedAt": "…" },
    "pdf": { "filename": "…pdf", "importedAt": "…" }
  },
  "result": { "time": "1h52'34\"", "pacePerKm": "5'20\"/km", "activityUrl": null }
}
```

`course.gpx` et `course.pdf` sont `null` si pas encore importés. Quand un GPX est présent, la distance et le D+ sont calculés depuis le GPX (lissage 7 points) et sont en lecture seule dans l'interface.

## Layout responsive

- **Mobile** : navigation par onglets en bas, nav-bar en haut, sidebar cachée
- **Desktop (≥768px)** : CSS Grid `260px sidebar + 1fr contenu`. La sidebar liste les événements + séance du jour. La nav-bar est masquée (la sidebar prend ce rôle).

## Conventions de code

- Pas de build step, tout en ES modules natifs
- Les vues exportent `mount(container, ...params)` qui écrit dans `container.innerHTML`
- Délégation d'événements sur le container plutôt qu'éléments individuels quand c'est dynamique
- GitHub sync : refetch du SHA avant chaque PUT pour éviter les 409 (conflit)
- Fichiers binaires (PDF) : `getFile(path, { rawBase64: true })` retourne le base64 brut sans décoder en UTF-8
- Pas de TypeScript, pas de linter — garder simple

## Déploiement GitHub Pages

1. Créer repo public `pacing-app` sur GitHub
2. Push le code (branche `main`)
3. Settings → Pages → Source : main, root `/` → Save
4. Sur iPhone : Safari → l'URL → Partager → "Sur l'écran d'accueil"
5. Configurer le PAT dans l'app (Réglages)
