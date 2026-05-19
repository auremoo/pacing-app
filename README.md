# Pacing App

PWA mobile-first pour gérer ses plans de préparation sportive.  
Protégée par mot de passe, données stockées dans ce repo GitHub via l'API.

## Accès

URL GitHub Pages : `https://amoote.github.io/pacing-app/`  
Mot de passe : configuré à l'installation.

## Utilisation

### 1. Lancer l'app

Ouvre l'URL dans Safari (iPhone) → Partager → **"Sur l'écran d'accueil"** pour l'installer en PWA.

### 2. Configurer la connexion GitHub (premier lancement)

L'app a besoin d'un **Personal Access Token** GitHub pour lire et écrire les données :

1. Va sur [github.com/settings/tokens](https://github.com/settings/tokens) → *Fine-grained tokens* → Generate new token
2. Repository access : **Only select repositories** → `pacing-app`
3. Permissions → Contents : **Read and write**
4. Durée recommandée : 1 an
5. Dans l'app → **Réglages** → colle le token, owner = `amoote`, repo = `pacing-app`

### 3. Générer un nouveau plan avec Claude

Le prompt template est dans [`docs/CLAUDE_PROMPT.md`](./docs/CLAUDE_PROMPT.md).

1. Copie le prompt, remplis tes infos de course et de profil
2. Envoie à Claude → récupère le `.md` généré
3. Dans l'app → ton événement → **Versions** → *Importer nouvelle version*

### 4. Importer un parcours

Dans l'app → ton événement → **Parcours** → importer un fichier GPX, PDF ou JSON.

## Ajouter un nouvel événement

1. Copie `events/run-in-lyon-2026/meta.json`, adapte les valeurs
2. Ajoute-le dans `events/index.json`
3. Push sur `main` → GitHub Actions redéploie automatiquement

## Structure

```
pacing-app/
├── index.html              # App shell
├── css/                    # Design iOS mobile-first
├── js/
│   ├── app.js              # Router
│   ├── store.js            # État + sync GitHub
│   ├── github-api.js       # API GitHub
│   ├── parser.js           # Parse le template .md
│   └── views/              # Vues (lock, dashboard, plan, session…)
├── events/
│   ├── index.json          # Liste des événements
│   └── {slug}/
│       ├── meta.json       # Métadonnées + versions
│       ├── plans/v{N}.md   # Plans importés
│       └── course/         # Fichiers parcours
├── state.json              # Sessions cochées
└── docs/
    └── CLAUDE_PROMPT.md    # Template prompt pour générer des plans
```

## Format des plans `.md`

Les plans sont générés par Claude via le template dans `docs/CLAUDE_PROMPT.md`.  
Sections obligatoires : `META` · `PHASES` · `ALLURES` · `SEMAINES` · `PPG` · `VIGILANCE` · `STRATEGIE_COURSE` · `NUTRITION`

## Déploiement

Chaque push sur `main` déclenche GitHub Actions → déploiement automatique sur GitHub Pages.

```
Push main → GitHub Actions → GitHub Pages
```
