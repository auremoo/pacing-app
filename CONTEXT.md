# Brief technique — App de suivi d'entraînement course à pied

## 1. Mission

Construire une PWA mobile-first (iPhone Safari) pour suivre des plans d'entraînement de course à pied. L'utilisateur consulte son plan, coche les séances réalisées, ajoute des notes courtes. Les données sont persistées sur GitHub via l'API GitHub. Hébergement sur GitHub Pages.

Le premier plan à charger est joint à ce brief (`plan_semi_lyon_1h50.md`) : préparation semi-marathon Run in Lyon 4 octobre 2026, objectif 1h50.

## 2. Contexte utilisateur

- **Utilisateur unique** (pas de multi-tenant)
- Coureur, 1 an de pratique, base 2h05 sur semi, vise 1h50 sur 20 semaines
- Antécédents : syndrome essuie-glace (récent), arthrites M1 → l'app doit afficher clairement les **points de vigilance** liés à ces pathologies
- Usage principal : iPhone, en mobilité (avant/après séance), parfois desktop pour planifier
- Tech : développeur (pas besoin de vulgariser le code), compte GitHub existant mais peu utilisé (guider sur les commandes Git/Pages)

## 3. Choix techniques validés

| Choix | Décision | Raison |
|---|---|---|
| Framework | Vanilla JS (ES modules) | Maintenable seul, pas de build à gérer pour GitHub Pages |
| Style | CSS pur, variables CSS pour theming | Pas de Tailwind/SCSS, on reste léger |
| PWA | Oui (manifest + service worker) | Install écran d'accueil iOS + offline read |
| Stockage plans | Fichiers JSON dans `/plans/` du repo | Versionné, éditable directement sur GitHub |
| Stockage état | `/data/state.json` du repo, MAJ via API GitHub | Sync entre devices, historique Git gratuit |
| Auth | Personal Access Token (PAT) fine-grained, scope `contents:write` sur ce repo | Stocké en localStorage, jamais commité |
| Hosting | GitHub Pages depuis branche `main`, dossier racine | Gratuit, simple, HTTPS auto |
| Cible | iOS Safari 16+ (iPhone 12+), Chrome desktop | Pas besoin de support legacy |

**Non négociables :**
- Pas de backend, pas de Firebase, pas de dépendances runtime externes (CDN OK pour polices Apple si besoin, sinon system fonts)
- Pas de framework JS (React/Vue/Svelte)
- Tout doit fonctionner avec GitHub Pages statique

## 4. Architecture fichiers proposée

```
training-app/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── css/
│   ├── reset.css
│   ├── tokens.css         # variables CSS (couleurs iOS, spacings, radii)
│   └── components.css     # styles des composants
├── js/
│   ├── app.js             # point d'entrée, routing
│   ├── store.js           # state management (in-memory + sync)
│   ├── github-api.js      # wrapper API GitHub (read/write state.json)
│   ├── views/
│   │   ├── today.js       # vue principale "aujourd'hui"
│   │   ├── week.js        # vue semaine
│   │   ├── plan.js        # vue plan complet
│   │   ├── session.js     # détail d'une séance
│   │   ├── info.js        # PPG, allures, stratégie de course (statique)
│   │   └── settings.js    # token PAT, repo config, export
│   └── utils/
│       ├── dates.js
│       └── markdown.js    # rendu Markdown minimal pour les descriptions de séances
├── plans/
│   └── semi-lyon-2026.json
├── data/
│   └── state.json         # initialement : { "sessions": {}, "version": 1 }
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
└── README.md
```

À adapter si tu vois mieux pendant le dev. Les modules sont là pour orienter, pas pour figer.

## 5. Data models

### `/plans/semi-lyon-2026.json`

```json
{
  "id": "semi-lyon-2026",
  "title": "Semi-marathon Run in Lyon",
  "subtitle": "Objectif 1h50 (cible réaliste : 1h51-1h53)",
  "raceDate": "2026-10-04",
  "raceLocation": "Lyon, France",
  "startDate": "2026-05-18",
  "course": {
    "distanceKm": 21.0975,
    "elevationGainM": 184,
    "profile": "Vallonné léger — montée notable Croix-Rousse km 14-17"
  },
  "paces": {
    "current": [
      { "label": "Footing récup", "value": "6'30-6'45\"/km" },
      { "label": "Footing EF", "value": "6'15-6'30\"/km" },
      { "label": "Allure semi actuelle", "value": "6'00\"/km" },
      { "label": "VMA estimée (13.5-14 km/h)", "value": "4'15-4'25\"/km" }
    ],
    "target": [
      { "label": "Footing EF", "value": "5'45-6'00\"/km" },
      { "label": "Allure semi cible (plat)", "value": "5'05-5'10\"/km" },
      { "label": "Allure semi moyenne course", "value": "5'10-5'12\"/km" },
      { "label": "Allure 10K cible", "value": "4'55-5'00\"/km" },
      { "label": "VMA cible (15.5-16 km/h)", "value": "3'45-3'52\"/km" }
    ]
  },
  "phases": [
    { "id": "phase-1", "name": "Récupération + Reprise", "weeks": [1, 2], "color": "gray" },
    { "id": "phase-2", "name": "Base aérobie", "weeks": [3, 4, 5, 6], "color": "blue" },
    { "id": "phase-3", "name": "Développement VMA & Seuil", "weeks": [7, 8, 9, 10], "color": "indigo" },
    { "id": "phase-4", "name": "Spécifique 1", "weeks": [11, 12, 13, 14], "color": "orange" },
    { "id": "phase-5", "name": "Spécifique 2", "weeks": [15, 16, 17, 18], "color": "red" },
    { "id": "phase-6", "name": "Affûtage", "weeks": [19, 20], "color": "green" }
  ],
  "weeks": [
    {
      "number": 1,
      "phaseId": "phase-1",
      "label": "Semaine 1",
      "dateRange": "18-24 mai 2026",
      "targetVolumeKm": 12,
      "note": "Récupération active post-semi des Alpes",
      "sessions": [
        {
          "id": "w1-lun",
          "dayLabel": "Lundi",
          "date": "2026-05-18",
          "type": "rest",
          "title": "Repos",
          "description": "Repos total. Marche douce et étirements OK."
        },
        {
          "id": "w1-mer",
          "dayLabel": "Mercredi",
          "date": "2026-05-20",
          "type": "easy",
          "title": "Footing récup 30 min",
          "description": "Allure 6'45-7'00\"/km. Terrain souple si possible. Étirements en fin."
        },
        {
          "id": "w1-jeu",
          "dayLabel": "Jeudi",
          "date": "2026-05-21",
          "type": "strength",
          "title": "PPG #1",
          "description": "Séance renforcement 20 min (voir onglet Infos > PPG)."
        }
      ]
    }
  ],
  "info": {
    "ppg": "...markdown du bloc PPG...",
    "raceStrategy": "...markdown stratégie de course...",
    "watchPoints": "...markdown points de vigilance (essuie-glace, M1)..."
  }
}
```

**Types de séance** (pour iconographie et filtrage) :
- `rest` (repos)
- `easy` (footing facile)
- `long` (sortie longue)
- `intervals` (fractionné piste / VMA)
- `tempo` (seuil / tempo)
- `hills` (côtes)
- `race` (course / test)
- `strength` (PPG / renforcement)
- `cross` (cross-training : vélo, natation, rameur)

À convertir depuis le markdown `plan_semi_lyon_1h50.md` joint. Toutes les séances de toutes les semaines doivent être encodées. Les dates exactes sont calculées à partir de `startDate` + numéro de semaine (lundi de S1 = 18 mai 2026).

### `/data/state.json`

```json
{
  "version": 1,
  "lastUpdated": "2026-05-18T10:00:00Z",
  "sessions": {
    "w1-lun": {
      "completed": true,
      "completedAt": "2026-05-18T18:30:00Z",
      "note": "Repos complet, bien."
    },
    "w1-mer": {
      "completed": false,
      "note": "Genou droit un peu tendu, à surveiller"
    }
  }
}
```

L'app lit ce fichier au démarrage, le tient en mémoire, et le réécrit (via PUT GitHub API) à chaque modification (debounce ~500ms pour éviter le spam).

## 6. Features V1 (scope strict)

### Vues
1. **Aujourd'hui** (vue par défaut) : carte de la séance du jour, gros bouton "Marquer comme faite", champ note (1 ligne, taps pour étendre). Sous la carte, aperçu de la semaine en cours avec checkboxes.
2. **Semaine** : la semaine en cours, navigation gauche/droite vers autres semaines, séances en cards.
3. **Plan complet** : liste verticale des 20 semaines groupées par phase, % de complétion par semaine, navigation rapide.
4. **Détail séance** : description complète, checkbox, note multi-ligne, sauvegarde auto avec indicateur "Sauvegardé" / "Sync...".
5. **Infos** : onglets pour PPG, allures, stratégie de course, points de vigilance (rendu Markdown).
6. **Réglages** : PAT GitHub, repo URL, propriétaire/nom, branche. Bouton "Tester la connexion". Bouton "Exporter state.json" (download local).

### Comportements clés
- **Première ouverture** : si pas de token configuré → redirection vers Réglages avec onboarding court (3 étapes : créer PAT, coller, valider).
- **Cocher une séance** : optimistic UI (coché immédiatement) + sync en arrière-plan + toast d'erreur en cas d'échec (avec retry).
- **Conflits** : à chaque sync, on GET `state.json` d'abord, on merge (dernière écriture par session ID gagne), on PUT. Si erreur 409 (sha mismatch), on refetch et retry une fois.
- **Mode offline** : lecture du plan et de l'état (depuis cache SW) OK, modifications mises en queue dans IndexedDB et flushées à la reconnexion.
- **Pas de séance aujourd'hui** : afficher une carte "Repos prévu aujourd'hui ✓" ou "Pas de séance planifiée".

### Navigation
- Tab bar fixe en bas (iOS-style) : Aujourd'hui · Semaine · Plan · Infos · Réglages
- Pull-to-refresh sur les vues principales (force un fetch du state.json)

## 7. Design system iOS

### Couleurs (light + dark, switch automatique)
```css
:root {
  --ios-blue: #007AFF;
  --ios-green: #34C759;
  --ios-red: #FF3B30;
  --ios-orange: #FF9500;
  --ios-yellow: #FFCC00;
  --ios-purple: #AF52DE;
  --ios-gray-1: #8E8E93;
  --ios-gray-2: #AEAEB2;
  --ios-gray-6: #F2F2F7;
  --bg-primary: #FFFFFF;
  --bg-grouped: #F2F2F7;
  --bg-elevated: #FFFFFF;
  --text-primary: #000000;
  --text-secondary: #3C3C43;
  --separator: rgba(60, 60, 67, 0.12);
}
@media (prefers-color-scheme: dark) { /* equivalents iOS dark */ }
```

### Typo
```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif;
```
Tailles : Large Title 34/41, Title 1 28/34, Title 2 22/28, Title 3 20/25, Headline 17/22 semi-bold, Body 17/22, Callout 16/21, Subhead 15/20, Footnote 13/18, Caption 12/16.

### Composants à recréer
- **Grouped list** (style Settings iOS) : cards arrondies 10px, fond `bg-elevated`, séparateurs internes 1px à 16px de gauche
- **Section header** : caps lock 13px gris, marge supérieure 32px
- **Tab bar** : fixe bas, `backdrop-filter: blur(20px)`, safe-area-inset-bottom
- **Navigation bar** : fixe haut, blur, titre centré ou large title
- **Bouton primary** : rond ou capsule, `var(--ios-blue)`, blanc dessus, padding 14px vertical
- **Checkbox** : style cercle iOS (vide → trait, coché → cercle plein bleu avec check blanc)
- **Toast** : capsule grise sombre, 80% opacity, blur, en haut, auto-dismiss 2s

### Animations
Transitions douces 200-300ms avec `cubic-bezier(0.25, 0.46, 0.45, 0.94)`. Spring sur les pressions de bouton (`active:scale-95`). Pas d'animations gratuites.

### Safe areas
```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```
Toutes les barres collantes doivent en tenir compte.

## 8. Sécurité — Token PAT GitHub

- Le user crée un **fine-grained PAT** scoped sur **ce repo uniquement**, permission **Contents : Read and write**.
- Stocké en `localStorage` sous clé `gh_pat`. Jamais loggé, jamais commit, jamais transmis ailleurs que `api.github.com`.
- Dans Réglages : afficher uniquement les 4 derniers caractères (`••••••••abcd`), bouton "Remplacer" pour le changer.
- Documenter dans le README et dans l'onboarding la procédure exacte de création (URL, options à cocher, durée recommandée 1 an).

## 9. Déploiement GitHub Pages

L'app doit pouvoir tourner depuis `https://<user>.github.io/<repo>/`. Donc :
- Paths relatifs partout (`./js/app.js`, pas `/js/app.js`)
- Le service worker doit utiliser `self.registration.scope` pour ses URLs cachées
- `start_url` du manifest = `./`

### Workflow Git pour l'utilisateur
À documenter dans le README :
1. Créer repo public sur GitHub (privé impossible avec Pages free)
2. Push le code
3. Settings → Pages → Source : `main` branch, root folder → Save
4. Attendre 1-2 min, l'URL apparaît
5. Sur iPhone : ouvrir l'URL dans Safari → Partager → "Sur l'écran d'accueil"

### Limites API GitHub
- 5000 req/h authenticated → largement suffisant
- Chaque update = 1 GET (pour sha) + 1 PUT → ~quelques dizaines de requêtes par séance max

## 10. Roadmap (hors V1, pour structurer le code)

À garder en tête lors de l'architecture **sans implémenter** :
- V2 : multiples plans actifs (multi-objectifs)
- V2 : graphiques de progression (volume réalisé vs prévu, courbe d'allures)
- V2 : journal libre quotidien (humeur, sommeil, douleur sur échelle, météo)
- V2 : intégration manuelle de chronos / données de séance (allure moyenne, FC)
- V2 : import Strava/Garmin (gros sujet, à isoler)
- V3 : générateur de plan à partir d'un objectif (probablement via une autre conv Claude)

Donc : data models pensés extensibles (versionner `state.json` et les `plan.json`), pas de logique métier hardcodée dans les vues.

## 11. Premières tâches suggérées

Ordre conseillé pour Claude Code :

1. **Setup** : init repo, créer la structure de dossiers, README initial avec checklist déploiement
2. **Convertir `plan_semi_lyon_1h50.md` → `plans/semi-lyon-2026.json`** : encoder les 20 semaines, toutes les séances, les infos PPG/stratégie/vigilance
3. **Squelette HTML + design tokens CSS** : `index.html`, `css/tokens.css`, `css/reset.css`, validation visuelle d'une page blanche aux bonnes couleurs
4. **Tab bar + routing minimal** : navigation entre 5 vues vides
5. **Module store + chargement du plan JSON** : lecture du plan, affichage simple "Semaine 1" en texte brut
6. **Vue "Aujourd'hui"** : carte séance du jour + checkbox locale (sans sync encore)
7. **Vue Semaine + Plan complet** : navigation, % complétion
8. **Module github-api + Réglages** : configuration PAT, test connexion, lecture de `state.json`
9. **Sync écritures** : optimistic UI + PUT + gestion conflits 409
10. **PWA** : manifest, service worker, cache strategy (network-first pour state.json, cache-first pour le reste)
11. **Onboarding** + polish des animations
12. **Tests sur iPhone réel** + ajustements safe areas / blur / touch targets

## 12. Détails à ne pas oublier

- **Bouton "Marquer comme faite" doit déclencher un haptic feedback** si dispo (`navigator.vibrate(10)`)
- **Le check d'une séance doit afficher visuellement la barre de progression de la semaine** qui se remplit
- **La note d'une séance** : textarea qui s'agrandit, sauvegarde sur blur (pas sur chaque keystroke)
- **Cas "le plan a été modifié sur GitHub directement"** : un refresh manuel doit re-fetch le plan, pas juste le state
- **Indiquer clairement les semaines de décharge** (badge ou couleur différente) — c'est important pour l'utilisateur
- **Sur la carte de séance du jour** : afficher en pied de carte l'allure cible si applicable + warning si la séance est une séance "à risque" (côtes, intensité) avec rappel "écouter le corps" — surtout vu l'historique essuie-glace

## 13. Hors scope V1

Pour éviter le scope creep, **ne pas implémenter** :
- Authentification GitHub OAuth (PAT suffit)
- Notifications push
- Édition du plan depuis l'app (édition = via GitHub directement)
- Multi-utilisateurs / partage
- Statistiques avancées / graphiques
- Synchronisation avec montre / app de sport
- Export PDF / impression
- Mode dark forcé (laisser le système gérer)

---

## Annexe — Fichier à joindre

**`plan_semi_lyon_1h50.md`** : plan d'entraînement détaillé sur 20 semaines, à convertir en JSON (étape 2 de la roadmap ci-dessus). Le markdown contient :
- 6 phases d'entraînement
- 20 semaines avec séances détaillées
- Section PPG complète (avec bloc descente / excentrique quadriceps)
- Allures de référence (actuelles + cibles)
- Stratégie de course détaillée par section du parcours
- Points de vigilance pathologies (syndrome essuie-glace, arthrites M1)

Toutes les sections doivent être préservées dans le JSON (info statique) ou converties en sessions actionnables (séances de la semaine).
