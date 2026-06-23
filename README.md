# Pacing App

> Créé par Aurélien Moote - Moo - 2026. Logiciel libre (licence MIT) :
> réutilisable à condition de conserver la mention de l'auteur.

PWA mobile-first pour gérer ses plans de préparation sportive.  
Fonctionne sans serveur : toutes les données sont stockées dans ce repo GitHub via l'API.

---

## Philosophie : application mono-utilisateur

Pacing App est conçue pour **un seul utilisateur** propriétaire du repo GitHub.

Il n'y a pas de backend, pas de base de données, pas de compte à créer. Le repo GitHub **est** la base de données : chaque événement, chaque plan, chaque séance cochée est un fichier JSON ou Markdown versionné dans le repo.

**Le mot de passe à l'entrée ne protège pas un compte** — il protège la clé d'accès à ton repo (le Personal Access Token GitHub). Ce token est chiffré en AES-GCM avec PBKDF2 et stocké dans `config.json`. Sans le bon mot de passe, impossible de déchiffrer le token et donc d'écrire quoi que ce soit.

> **Gestion multi-utilisateurs prévue prochainement.**

---

## Sécurité & authentification

| Élément | Détail |
|---|---|
| Mot de passe | `171225` — déchiffre le PAT GitHub |
| Chiffrement | AES-GCM 256 bits, dérivation PBKDF2 SHA-256 |
| Stockage du PAT | Chiffré dans `config.json` du repo public |
| Session | PAT déchiffré en `sessionStorage` uniquement (effacé à la fermeture) |
| Nouveau device | Aucune config — le PAT chiffré est dans `config.json` (repo public) |

Le PAT n'est jamais en clair dans le repo, ni dans `localStorage`. Il vit uniquement en mémoire le temps de la session.

---

## Installation

### Sur iPhone (PWA)

1. Ouvre l'URL GitHub Pages dans **Safari**
2. Partager → **"Sur l'écran d'accueil"**
3. L'app s'installe comme une app native (plein écran, icône, pas de barre Safari)

### Sur desktop

Ouvre simplement l'URL dans un navigateur. La sidebar s'affiche automatiquement à partir de 768 px.

---

## Fonctionnement général

### 1. Données stockées sur GitHub

Toutes les données vivent dans le repo :

```
events/
  index.json              ← liste des slugs d'événements
  {slug}/
    meta.json             ← métadonnées, versions, parcours, résultat
    plans/v{N}.md         ← plan généré par Claude (Markdown structuré)
    course/               ← fichiers GPX, PDF, photos
athlete.json              ← profil athlète (niveau, perfs, objectifs…)
state.json                ← séances cochées et notes
```

Au démarrage, l'app charge `events/index.json`, `athlete.json` et `state.json`. Chaque action (cocher une séance, importer un plan, ajouter un événement) écrit immédiatement sur GitHub via l'API.

### 2. Événements

Un **événement** représente une course ou objectif sportif. Il contient :
- Les métadonnées (distance, date, objectif, lieu, D+…)
- Un ou plusieurs **plans** versionnés (v1, v2…)
- Le **parcours** (fichier GPX pour le profil altimétrique, PDF du roadbook, photos)
- Le **résultat** après la course

**Créer un événement** : Dashboard → "Créer un événement" → remplir le formulaire.  
L'app crée `events/{slug}/meta.json` et met à jour `events/index.json` automatiquement.

### 3. Plans de préparation

Un plan est un fichier Markdown structuré, généré par Claude à partir d'un prompt détaillé.

**Générer un plan :**
1. Événement → onglet **Versions** → "Générer le prompt de plan initial"
2. Le prompt est pré-rempli avec ton profil athlète et les données de l'événement
3. Copie le prompt → envoie à Claude → récupère le `.md`
4. Versions → "Importer nouvelle version" → sélectionne le fichier `.md`

**Réviser un plan :**
1. Versions → "Générer un prompt de révision"
2. Le prompt inclut le bilan des semaines passées, le plan actuel, et le profil
3. Même process → importer la nouvelle version

L'app conserve l'historique de toutes les versions.

### 4. Suivi des séances

L'onglet **Plan** affiche les semaines et séances du plan actif.

- ✅ **Cocher** une séance : `completed: true` dans `state.json`
- ⛔ **Marquer comme manquée** : appui long → "Marquer comme manquée" → `skipped: true` (orange, barré)
- **Note** : chaque séance accepte une note libre
- Les états `completed` et `skipped` sont exclusifs

### 5. Parcours (GPX / PDF / Photos)

L'onglet **Parcours** permet d'importer :
- Un **fichier GPX** : l'app calcule automatiquement distance et D+/D- (lissage de l'altitude, seuil 1,5 m)  
  Le profil altimétrique est interactif (curseur sur le tracé)
- Un **PDF** roadbook
- Jusqu'à **2 photos** (5 Mo max chacune)

Distance et D+ sont en lecture seule avant la date de course (calculés depuis le GPX), puis éditables après (pour saisir les valeurs officielles).

### 6. Profil athlète

Le profil est stocké dans `athlete.json` et injecté automatiquement dans tous les prompts générés.

**Réglages** → formulaire athlète :
- Niveau, performances récentes
- Volume hebdomadaire habituel
- Jours disponibles, équipements, terrain
- Pathologies / points de vigilance
- Objectifs

### 7. Onglet Infos

Contient les sections analytiques du plan : Synthèse, Allures cibles, Principes d'entraînement, PPG, Vigilance, Stratégie de course, Nutrition.  
Les onglets sans contenu sont masqués automatiquement.

---

## Format des plans `.md`

Les plans sont générés par Claude via le template dans [`docs/CLAUDE_PROMPT.md`](./docs/CLAUDE_PROMPT.md).

Sections obligatoires :

| Section | Contenu |
|---|---|
| `## META` | Clés/valeurs (event, date, distance, objectif…) |
| `## PHASES` | Tableau des phases (ID, nom, semaines, couleur) |
| `## ALLURES` | Allures actuelles et cibles (tableaux) |
| `## SEMAINES` | Une entrée par semaine avec tableau des séances |
| `## SYNTHESE` | Analyse athlète/objectif, gap, cible réaliste |
| `## PRINCIPES` | Structure hebdo, cross-training, spécificités parcours |
| `## PPG` | Préparation physique générale |
| `## VIGILANCE` | Points de vigilance personnalisés |
| `## STRATEGIE_COURSE` | Stratégie le jour J |
| `## NUTRITION` | Stratégie nutritionnelle |

**Types de séance valides :** `rest` · `easy` · `long` · `intervals` · `tempo` · `hills` · `race` · `strength` · `cross`

---

## Structure du repo

```
pacing-app/
├── index.html                  # App shell (sidebar + vues)
├── setup.html                  # Générateur de config.json (nouveau PAT)
├── config.json                 # { owner, repo, branch, encryptedToken }
├── manifest.webmanifest        # PWA manifest
├── service-worker.js           # No-store sur JS/CSS/HTML (évite cache périmé iOS)
├── css/
│   ├── tokens.css              # Variables CSS (couleurs, spacing, typo)
│   ├── reset.css               # Reset + layout desktop (grid sidebar)
│   └── components.css          # Tous les composants UI
├── js/
│   ├── app.js                  # Router hash-based + boot
│   ├── store.js                # State management + GitHub sync
│   ├── github-api.js           # Wrapper API GitHub (GET/PUT)
│   ├── parser.js               # Parse le template .md → objet structuré
│   └── views/                  # Vues (lock, dashboard, plan, session…)
├── events/
│   ├── index.json              # Liste des slugs
│   └── {slug}/
│       ├── meta.json           # Métadonnées + versions + parcours + résultat
│       ├── plans/v{N}.md       # Plans versionnés
│       └── course/             # GPX, PDF, photos
├── athlete.json                # Profil athlète
├── state.json                  # Sessions cochées, notes
└── docs/
    └── CLAUDE_PROMPT.md        # Template prompt pour générer des plans
```

---

## Configurer un nouveau token GitHub

Si le token expire ou si tu changes de repo :

1. Va sur [github.com/settings/tokens](https://github.com/settings/tokens) → *Fine-grained tokens* → Generate new token
2. Repository access : **Only select repositories** → `pacing-app`
3. Permissions → Contents : **Read and write**
4. Durée recommandée : 1 an
5. Ouvre `setup.html` → colle le token + owner + repo → télécharge le nouveau `config.json` → remplace-le dans le repo

---

## Déploiement

Chaque push sur `main` déclenche GitHub Actions → déploiement automatique sur GitHub Pages.

```
Push main → GitHub Actions → GitHub Pages
```

Pour le premier déploiement : Settings → Pages → Source : main, root `/` → Save.

---

## Auteur & licence

**Aurélien Moote - Moo - 2026**  
Copyright (c) 2026 Aurélien Moote ("Moo")  
Distribué sous [licence MIT](./LICENSE) — réutilisable à condition de conserver la mention de l'auteur.
