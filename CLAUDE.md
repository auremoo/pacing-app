# Pacing App — CLAUDE.md

Application web PWA mobile-first pour gérer des plans de préparation sportive, **plurisport** (course à pied, salle muscu/cardio, ou un mélange).  
Multi-utilisateur : une seule app, un dossier de données par personne, le mot de passe désigne l'utilisateur. Données stockées sur GitHub via API.

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
│   │   ├── home.js                 # Accueil générique : séance du jour + course en préparation (si active)
│   │   ├── courses.js              # Liste des événements + bouton Créer (route /courses)
│   │   ├── global-nav.js           # Menu du bas commun (Accueil/Entraînement/Courses/Réglages), mobile only
│   │   ├── sidebar.js              # Sidebar desktop (événements, séance du jour, nouvel événement)
│   │   ├── event.js                # Container événement (onglets)
│   │   ├── plan-view.js            # Plan semaines/séances + checkboxes + état manquée (skipped) — réutilisé par routine.js
│   │   ├── course-view.js          # Parcours (GPX+PDF+photos, résultat, stats)
│   │   ├── versions-view.js        # Gestion versions + prompt initial + prompt révision (courses)
│   │   ├── infos-view.js           # Synthèse, Allures, Principes, PPG, Vigilance, Stratégie, Nutrition
│   │   ├── strategy-view.js        # Onglet Stratégie : bilan de fin de prépa + prompt + stratégie IA
│   │   ├── gpx-modal.js            # Profil altimétrique plein écran (pivoté en paysage sur mobile)
│   │   ├── event-closure.js        # Clôture d'un événement quand la séance de course est cochée
│   │   ├── race-result-modal.js    # Saisie du résultat proposée juste après la clôture
│   │   ├── onboarding.js           # Tutoriel de prise en main (pages à faire défiler)
│   │   ├── session-view.js         # Détail d'une séance + note (courses et plan général)
│   │   ├── settings.js             # Formulaire profil athlète (stocké dans athlete.json), route /settings
│   │   ├── new-event.js            # Formulaire création d'un nouvel événement
│   │   ├── routine.js              # Container plan général (onglets Plan/Contexte/Versions), route /routine
│   │   ├── routine-settings.js     # Activités récurrentes + objectifs du plan général
│   │   ├── routine-versions.js     # Prompt initial/révision + versions du plan général
│   │   └── body-view.js            # Onglet Suivi du plan général : pesées + courbe
│   └── utils/
│       ├── dates.js
│       ├── markdown.js             # Renderer markdown minimal
│       ├── crypto.js               # AES-GCM + PBKDF2 (chiffrement du PAT)
│       ├── gpx-parser.js           # Parse GPX + profil altimétrique + curseur (tap/survol) + splitByKm
│       ├── plan-overrides.js       # applyDateOverrides/applyWeekMetaOverrides (échanges/déplacements)
│       ├── prep-report.js          # Bilan de fin de prépa consolidé toutes versions + prompt de stratégie
│       ├── race-status.js          # Séance de course d'un événement + isRaceDone (course courue ?)
│       ├── session-types.js        # Types de séance : pastille + nom (types du plan + activités concrètes)
│       ├── prompt-modal.js         # Modale "copier un prompt" partagée (versions + stratégie)
│       ├── prompt-output.js        # Consigne « livrable : un fichier .md » ajoutée aux prompts à importer
│       ├── sports.js               # Mes sports (athlete.json) : ce que l'app montre selon les sports
│       ├── body.js                 # Suivi du poids : évolution, objectif, courbe SVG, section de prompt
│       ├── routine-context.js      # Plan général → prompts : activités récurrentes, historique récent, objectifs perso
│       ├── routine-overlap.js      # Détecte les semaines du plan général chevauchant une course active
│       └── today-session.js        # Séance du jour unifiée (courses + plan général) pour home.js/sidebar.js
├── events/
│   ├── index.json                  # Liste des slugs d'événements
│   ├── run-in-lyon-2026/
│   │   ├── meta.json               # Métadonnées + versions + course (gpx + pdf)
│   │   ├── plans/v1.md             # Plan au format template
│   │   ├── bilan.md                # Bilan de préparation consolidé (généré en fin de prépa)
│   │   ├── strategy.md             # Stratégie de course renvoyée par l'IA (importée)
│   │   └── course/                 # Fichiers GPX et PDF importés
│   └── marathon-alpes-bsm/
│       └── meta.json
├── routine/                         # Plan général (hors courses), un seul, jamais dans events/
│   ├── meta.json                    # context, goals, blockWeeks, startDate, versions, activeVersion
│   └── plans/v1.md                  # Même format template que les plans de course
├── athlete.json                    # Profil athlète (niveau, perfs, volume, jours, équipements, terrain, pathologies, objectifs)
├── state.json                      # Sessions cochées, notes
├── body.json                       # Pesées (créé à la première), si « Suivre mon poids »
└── docs/
    └── CLAUDE_PROMPT.md            # Template prompt pour générer des plans
```

## Navigation

Menu du bas commun (mobile) / sidebar (desktop) à 4 sections racines : **Accueil** (`/`), **Entraînement** (`/routine`), **Courses** (`/courses`), **Réglages** (`/settings`). Un seul menu/tab-bar visible à la fois : les sections avec leurs propres sous-onglets (`/event/:slug/*`, `/routine/*`) remplacent le menu global par leur propre barre — cohérent avec le pattern déjà utilisé par `event.js`.

**Accueil (`home.js`)** : contextuel — séance du jour (tous plans confondus), puis ce qu'on prépare en ce moment : la carte « Course en préparation » si une course a un plan actif couvrant aujourd'hui, **sinon** la carte « Entraînement en cours » du plan général (semaine, séances faites, phase, prochaine séance — `getRoutineProgress`). Jamais les deux : le plan général est en pause pendant une prépa. La liste complète des événements vit dans `/courses`. Sur desktop, la sidebar a une rubrique « Entraînement » avant « Mes courses ».

**Plan général vs course** : un seul plan général évolutif (`routine/`), bien séparé des courses (jamais dans `events/index.json`). Quand une course a un plan actif qui chevauche une semaine du plan général, cette semaine est marquée "en pause" (grisée, actions désactivées) dans `plan-view.js` — on ne suit jamais deux plans en parallèle. `js/utils/routine-overlap.js` calcule ce chevauchement ; `js/utils/today-session.js` centralise la détection de la séance du jour en respectant cette règle.

**Le plan général dans les prompts de course** : puisque le plan général est en pause pendant une prépa, le plan de course doit reprendre lui-même les activités fixes (club, badminton…). `buildRoutineSectionForRace` (`js/utils/routine-context.js`) ajoute aux prompts de plan initial et de révision d'une course une section « Entraînement général en cours » : activités récurrentes du Contexte (à intégrer comme séances et à compter dans la charge), bilan des 4 dernières semaines du plan général (plan initial seulement — en révision il est en pause depuis le début de la prépa ; séance jamais cochée = statut inconnu) et objectifs perso. Section absente si rien de tout ça n'est renseigné.

**Programmes et conseils reçus / Déjà fait récemment** (plan général → Contexte, facultatifs) : `routine/meta.json` → `references` (programme d'un coach ou d'un ami collé tel quel) et `recentDone` (séances faites avant le premier plan). `referencesSection` les donne à l'IA comme exemples à adapter — niveau, jours, nombre de séances (un programme sur 4 séances recombiné sur 3), points de vigilance — avec ce qui a été repris ou changé dans la SYNTHESE ; dans les prompts initial et de révision. `recentDoneSection` seulement dans le plan initial, pour enchaîner la première semaine ; ensuite les coches font foi.

**Objectifs perso** (plan général → Contexte) : ce qu'on vise hors course officielle, `routine/meta.json` → `targets: [{ kind, what, value, by, achieved }]`, `kind` ∈ `chrono` (distance + temps, ou allure avec `measure: 'pace'` — distance alors facultative, « /km » ajouté si l'unité manque), `force` (exercice + charge), `poids` (poids visé), `autre` (texte) — champs et libellés dans `TARGET_KINDS`. Les tout premiers objectifs, chrono seulement, étaient `{ distance, time }` : `normalizeTarget` les relit. Type par défaut d'un nouvel objectif selon les sports (chrono si course, force si salle, sinon poids). Ligne vide ignorée, ligne à moitié remplie refusée à l'enregistrement. Sans échéance, le prompt demande à l'IA de choisir elle-même le moment, d'après le niveau actuel et la progression, et de le justifier dans la SYNTHESE. Repris dans les prompts du plan général (`targetsSection`) avec une consigne par type présent : test chronométré (`race`), test de charge (`gym`), poids (entraînement + repères nutritionnels généraux dans la SYNTHESE). Un rappel sous les boutons de prompt de l'onglet Versions liste les objectifs repris, avec un lien vers Contexte : c'est là qu'on les choisit avant le plan initial ou une nouvelle version.

## Flux de données

```
GitHub repo
  ├── events/index.json     → liste des événements (lu au boot)
  ├── events/{slug}/meta.json → métadonnées + liste des versions
  ├── events/{slug}/plans/v{N}.md → plan parsé en mémoire
  ├── events/{slug}/course/{file} → GPX/PDF/JSON du parcours
  ├── routine/meta.json      → contexte/objectifs + versions du plan général (lu au boot si présent)
  ├── routine/plans/v{N}.md  → plan général parsé en mémoire
  ├── athlete.json          → profil athlète (lu au boot, écrit depuis Réglages)
  └── state.json            → sessions cochées (lu au boot, écrit en temps réel) — état du plan général sous la clé interne "__routine__"
```

**Auth** : PAT GitHub chiffré AES-GCM (PBKDF2) dans `config.json`. Plus de mot de passe en dur : `config.json` liste les utilisateurs (`users: [{ name, dataPath, encryptedToken }]`), chacun avec le PAT chiffré par **son** mot de passe. Connexion par **prénom + mot de passe** (`findUserByNameAndPassword`, utils/users.js) : le prénom (comparé sans accents ni casse) choisit l'entrée à déchiffrer, ce qui distingue « Aucun compte au nom de … » de « Mot de passe incorrect ». Un prénom inconnu retombe sur les entrées sans nom (config historique, dont le premier utilisateur n'a pas de nom) ; sans prénom, toutes les entrées sont essayées. Le prénom se choisit dans une **liste déroulante** (`fillNameList` dans lock.js, alimentée par `listUserNames` à partir de config.json, déjà public) ; elle est obligatoire (`required`) et reste un champ texte tant qu'aucun compte n'a de nom. Le prénom de la dernière connexion est gardé dans `localStorage` (`pacing_last_name`), présélectionné (ajouté à la liste s'il n'y est pas encore, cas d'un compte tout juste créé avant republication), et le curseur va alors au mot de passe. Le premier utilisateur s'appelle « Aurélien » (`users[0]`, `dataPath: ''`). **Trousseau d'Apple** : iOS proposait « mot de passe fort » à chaque connexion, prenant l'écran pour une inscription. Deux causes traitées dans lock.js : le formulaire d'inscription (deux champs `new-password`) n'est injecté qu'au clic sur « Créer un compte » (`SIGNUP_FIELDS`) et retiré au retour ; la liste déroulante n'étant pas un identifiant, un champ texte invisible `#lock-username` (`autocomplete="username"`, classe `visually-hidden` — pas `display:none`, ignoré par l'autoremplissage) suit le prénom choisi, à côté du mot de passe `current-password`. Non vérifiable hors iPhone. **Pas de doublons** : `buildConfigWithUser` refuse un prénom déjà pris, sans accents ni casse (« aurelien » = « Aurélien »), pour l'ajout depuis Réglages comme pour l'inscription. Le format historique (un seul `encryptedToken`, données à la racine) reste lu, et `encryptedToken` au premier niveau est conservé pour le premier utilisateur. Jamais en clair dans le repo ni dans localStorage.  
**Données par utilisateur** : `dataPath` = `''` pour le premier (données à la racine, comme avant), `users/<prenom>` pour les suivants. `configure({ …, dataPath })` préfixe toutes les lectures/écritures de `github-api.js` ; seul `config.json` s'adresse à la racine (`{ root: true }`).  
**Ajout d'un utilisateur** : Réglages → Compte → « Ajouter un utilisateur » (`addUser` dans store.js) : crée `users/<prenom>/` (events/index.json vide, state.json, athlete.json) puis l'entrée dans `config.json`, avec le PAT de la session courante chiffré par le nouveau mot de passe (chiffres uniquement, ≥ 6 : l'écran de connexion montre le pavé numérique). Un mot de passe déjà pris est refusé. Connexion possible après redéploiement de GitHub Pages (config.json est servi par le site). **Limite** : si le PAT est renouvelé, `setup.html` ne régénère que l'entrée historique — les autres utilisateurs devront être recréés (leurs mots de passe ne sont connus que d'eux).  
**Inscription depuis l'écran de connexion** (« Créer un compte ») : demande un **code d'invitation**. Raison : créer un compte exige d'écrire dans le dépôt, donc le PAT, alors que personne n'est connecté ; une inscription libre rendrait ce PAT récupérable par n'importe quel visiteur de l'URL publique, avec les droits d'écriture sur le dépôt — donc sur le code même de l'app publiée. Le PAT est donc aussi chiffré par le code (`config.invite = { encryptedToken, createdAt }`). Le code se crée, se change ou se retire dans Réglages → Compte → « Code d'invitation » (`setInviteCode`). Garde-fous : le code ne peut pas être le mot de passe d'un utilisateur, et un nouveau mot de passe ne peut pas être le code (sinon tous les invités pourraient ouvrir ce compte). Après inscription, la personne est connectée tout de suite (le dossier est connu, inutile d'attendre la republication de config.json) et voit le tutoriel. « Ajouter un utilisateur » dans Réglages reste disponible pour un utilisateur déjà connecté.  
**Déconnexion** : `flushSync()` envoie d'abord les écritures de `state.json` encore dans le délai de regroupement (600 ms) — sinon une coche ou la fermeture du tutoriel faites juste avant étaient perdues au rechargement.  
**Tutoriel de prise en main** (`onboarding.js`) : 8 pages (la page profil présente « Mes sports », la page course est titrée « Si tu cours ») à faire glisser (défilement horizontal natif en `scroll-snap`, piloté aussi par Suivant, les points et les flèches du clavier) — bienvenue, profil (les 8 champs de Réglages), entraînement général, prompt → Claude → import (avec l'encart « remplis d'abord, génère ensuite » : le prompt est construit au clic, un champ vide y devient `[à compléter]`), fiche d'une course (ses 11 champs, regroupés), plan et parcours de la course, usage quotidien, révisions. S'ouvre à la première connexion d'un utilisateur **ajouté** : `addUser` pose `onboardingPending: true` dans son `state.json`, retiré à la fermeture (`completeOnboarding`). Jamais d'office pour le premier utilisateur. Rejouable depuis Réglages → « Revoir le tutoriel ». Les boutons de la dernière page vivent dans la barre du bas, hors de la zone qui défile, pour ne jamais être rognés sur petit écran. Le texte décrit les vrais noms d'écrans et de boutons : à mettre à jour si on les renomme.  
**Session app** : `sessionStorage` (`pacing_auth`, `pacing_pat`, `pacing_data_path`, `pacing_user`) pour la durée de la session ; « Se déconnecter » dans Réglages la vide.  
**Nouveau device** : aucune config à faire — le PAT est dans `config.json` (repo public), déchiffré automatiquement au login.  
**`setup.html`** : page standalone pour générer un nouveau `config.json` (nouveau PAT ou changement de repo).

## Plurisport

**Mes sports** (Réglages, en tête) : interrupteurs « Course à pied » et « Salle : muscu / cardio », champ « Autres sports », interrupteur « Suivre mon poids » — `athlete.json` → `sports: ['running','gym']`, `otherSports`, `trackWeight`. Les interrupteurs s'enregistrent tout de suite (le menu suit) ; `sports` absent = coureur, comportement d'avant. `js/utils/sports.js` (`doesRun`, `doesGym`, `tracksWeight`, `showsCourses`, `sportsSummary`) décide de ce qui s'affiche :
- **Onglet Courses** (menu du bas et barre latérale, avec « Nouvel événement ») : seulement si on court **ou** qu'on a déjà des courses (`showsCourses`) — décocher la course ne cache pas des données existantes.
- **Exemples des champs du profil** : version salle quand on ne court pas (« 3 séances de 1h », « Lieu d'entraînement »).
- **Types proposés dans « Activité réalisée »** : sans course, pas de types course ; sans salle, pas de types salle (le type prévu et l'actuel restent toujours proposés).
- **Prompts du plan général** : ligne « Sports pratiqués », types valides et consignes selon les sports (`sessionRules`), description de muscu en séries × reps × charge. Les prompts de course ajoutent les types salle si l'athlète va aussi en salle (`gymTypesNote`).

**Niveau en salle** (Réglages → Mes sports, visible si « Salle » est coché) : `athlete.json` → `gymLevel` ∈ `beginner` (défaut), `intermediate`, `advanced` (`GYM_LEVELS`, `gymLevel()` dans sports.js), enregistré tout de suite. Il règle les consignes de musculation des prompts du plan général (`GYM_RULES` dans routine-versions.js) : débutant = l'IA choisit les exercices (4-6, machines guidées), explique chacun (nom, geste, erreur à éviter), charge de départ décrite sans kilos, mêmes exercices plusieurs semaines, points de vigilance respectés, lexique dans la SYNTHESE — demande d'une débutante qui « n'y connaît rien » ; un plan qui dirait seulement « bosse les jambes » la laisserait sans savoir quoi faire. Intermédiaire = séries × reps × charges ; confirmé = programmation structurée. Objectifs perso : `renfo` (zone ou but en mots simples, « fessiers et cuisses ») pour tous ceux qui vont en salle, `force` (exercice + charge) réservé aux confirmés (`availableTargetKinds` ; un type déjà utilisé reste proposé). Ligne « Niveau en salle » dans le profil du prompt.

**Volume de semaine libre** : l'en-tête `### S01 | … | phase | {volume} | note` accepte `18km` (ou un nombre seul = km, comme avant), `4 séances`, `3h30`, ou `-`. Le parser pose `targetVolumeKm` (0 hors km) et `volumeLabel` (texte affiché, via `weekVolumeLabel`). Un échange de semaines antérieur à `volumeLabel` reconstruit le libellé depuis les km.

**Suivi du poids** (si « Suivre mon poids ») : onglet **Suivi** du plan général (`body-view.js`, route `/routine/body`) — résumé (dernière pesée, évolution sur 4 semaines, objectif), courbe avec l'objectif de poids en pointillés (premier objectif `poids` non atteint, `weightTarget`), saisie (date, poids, tour de taille facultatif), historique supprimable. Une pesée par jour au plus (une nouvelle le même jour remplace). Stocké dans `body.json` du dossier de l'utilisateur, écrit tout de suite (`saveBodyEntry`/`deleteBodyEntry`, SHA relu avant chaque PUT). Carte « Poids » sur l'accueil. Les prompts du plan général reçoivent la section « Suivi du poids » (`bodyPromptSection`) : première et dernière pesée, évolution, 12 dernières pesées, consigne de rythme raisonnable.

**Affichage d'une séance** (`js/utils/session-format.js`) : une description tient sur une seule ligne de tableau ; une séance de muscu y devenait un pavé illisible pour une débutante. `renderSessionDescription` (détail de séance) la découpe à l'affichage — donc aussi pour les plans déjà importés : bloc Échauffement, une fiche par exercice numéroté `N) Nom — …` (pastilles « 3 séries de 12 », « Repos 90 s », « Charge légère » ; « Comment faire », « À éviter » tiré de « évite … », « Le bon poids » qui traduit « 2–3 répétitions en réserve »), Retour au calme **à la fin** même si l'IA l'a écrit avant, puis « À savoir » (phrases après le dernier exercice). Sans exercices numérotés, seuls échauffement / retour au calme sont isolés, et seulement au-delà de 200 caractères ; sinon texte inchangé (les plans de course ne bougent pas). L'accueil montre la liste des exercices (`sessionDescriptionSummary`). Le prompt débutant demande cet ordre et cette forme.

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

**Types de séance valides :** course `easy`, `long`, `intervals`, `tempo`, `hills`, `race` ; salle `gym` (musculation), `cardio`, `hiit`, `mobility`, `class` (cours collectif) ; communs `strength`, `cross`, `rest`. Source unique : `PLAN_TYPES` dans `session-types.js`, que le parser utilise.

**Activité changée sur une journée (plan général uniquement)** : depuis le détail d'une séance du plan général, l'athlète peut remplacer le type par un autre type du plan ou par une activité concrète — `bike`, `badminton`, `swim`, `hike`, `other` — qui n'existent que comme remplacement (le parser ne les accepte pas dans un plan). Stocké dans `state.json` sous `events.__routine__._typeOverrides` (`{ sessionId: type }`) ; choisir le type prévu supprime le remplacement. `applyTypeOverrides` (plan-overrides.js) pose `type` = activité faite et `plannedType` = type prévu ; la liste affiche la nouvelle pastille et « · prévu EF ». `getTypeOverrides` renvoie `{}` pour tout événement et `setSessionTypeOverride` les refuse : un plan de course est une prescription, on n'en réécrit pas les séances. Appliqué partout où le plan général est affiché (plan-view, session-view, séance du jour) et dans son prompt de révision, qui rappelle à l'IA de ne pas réutiliser ces types dans le plan généré. Libellés et noms dans `js/utils/session-types.js`, source unique.

**IDs de session :** générés par le parser → `s{NN}-{daycode}` (ex: `s01-mon`, `s03-thu`)  
**State.json** structure : `{ events: { "slug": { "s01-mon": { completed, completedAt, skipped, skippedAt, note, version } } } }`  
`skipped: true` = séance manquée (orange, barré). Exclusif avec `completed`.  
**Changement de version** (`migrateStateToVersion`, store.js) : un id de séance n'a de sens que dans sa version — une v2 qui repart à S01 donne `s01-mon` à la séance que la v1 appelait `s04-mon`. À l'import d'une version (et à la réactivation d'une ancienne), tout l'état de la version quittée (coches, notes, `_dateOverrides`, `_weekMetaOverrides`, `_typeOverrides`) est archivé dans `events.{slug}._history.v{N}` (réglages sous `_overrides`), puis chaque séance de la nouvelle version tombant le même jour qu'une séance traitée reprend son état, marqué `carriedFrom: { v, id }` ; l'activité changée suit sauf si la nouvelle version la prévoit déjà. Déplacements et échanges ne sont pas reportés. Revenir sur une version déjà suivie restaure ses propres réglages. `_planVersion` mémorise la version de l'état ; au boot, `repairUnmigratedStates` migre un état resté sur une ancienne version (cas du plan général passé en v2 le 06/10/2026, dont la coche du 5 octobre était partie au 26 et dont un échange mercredi/jeudi de la v1 dédoublait la semaine en cours). `buildConsolidatedHistory` relit l'état vivant puis les archives, compte une séance reportée une seule fois sous son origine, et date les séances archivées avec les déplacements de leur version.  
`version` = version du plan active au moment du cochage. Indispensable au bilan de fin de prépa : deux versions peuvent partager les mêmes numéros de semaine aux mêmes dates avec des séances différentes (v1 et v2 de `run-in-lyon-2026` partagent S13→S20). Pour l'historique antérieur à ce champ, `prep-report.js` déduit la version via `versions[].importedAt` comparé à la date de cochage.

## Ajouter un événement

**Via l'app (recommandé)** : Courses → "Créer un événement" (ou bouton sidebar) → formulaire → `createEvent()` crée `events/{slug}/meta.json` et met à jour `events/index.json` automatiquement.

**Manuellement** : Créer `events/{slug}/meta.json`, ajouter l'entrée dans `events/index.json`, pusher sur GitHub.

## Importer / Modifier un plan

**Livrable demandé** : les 5 prompts dont la réponse s'importe (plan initial et révision d'une course, du plan général, stratégie de course) passent par `withFileDeliverable` (`js/utils/prompt-output.js`) : annonce en tête et consigne détaillée en toute fin — un fichier `.md` téléchargeable au nom donné (`plan-<slug>-vN.md`, `plan-general-vN.md`, `strategie-<slug>.md`), contenu seul et complet, commençant par la première ligne attendue ; à défaut, un seul bloc de code markdown. Un nouveau prompt à importer doit y passer aussi.

**Réglages avant un prompt** (`js/utils/plan-tuning.js`) : les 4 boutons de prompt de plan (initial, révision ; course, plan général) ouvrent d'abord `openTuningModal` — curseurs à 5 crans relatifs (beaucoup moins · moins · = · plus · beaucoup plus), tout au milieu au départ ; le milieu se lit « comme maintenant » en révision, « l'IA décide » pour un premier plan. Une note absolue de 1 à 5 a été écartée : l'IA ne saurait pas à quoi la rapporter. Groupes : général (difficulté, séances/semaine, récupération), course à pied (sorties longues, fractionné, seuil, côtes, volume — toujours pour un plan de course, sinon si on court), salle (muscu, cardio, mobilité — si on va en salle), plus une note libre. « Passer » génère sans réglage, la croix annule. `withTuning` insère la section « Réglages demandés » avant le format de sortie (la consigne de livrable reste en dernier), avec garde-fou : progressivité, récupération, arbitrage expliqué dans la SYNTHESE. La demande est gardée dans le meta (`pendingTuning`, `saveTuningRequest`) puis recopiée sur la version importée (`versions[].tuning`), affichée sur sa carte (« Demandé : Sorties longues ++ … »).

**Programmes et conseils reçus d'une course** : `meta.references` (Parcours → Modifier ces infos), repris comme pour le plan général via `referencesSection` (`js/utils/references.js`, partagé).

1. Dans l'app → événement → onglet Versions :
   - Sans plan : "Générer le prompt de plan initial" → copier → Claude → obtenir .md → importer
   - Avec plan : "Générer un prompt de révision" → copier → Claude → obtenir .md → importer
2. Les deux prompts sont pré-remplis avec le profil athlète (Réglages) + les données de l'événement
3. "Importer nouvelle version" upload le .md et met à jour `meta.json` automatiquement

## Bilan de fin de préparation et stratégie de course

Onglet **Stratégie** d'un événement (`strategy-view.js`), 5e onglet affiché uniquement
quand la préparation est terminée ou qu'une stratégie a déjà été importée.

**Déclencheur** : `isPrepComplete(slug)` — la dernière séance d'entraînement du plan
actif (types `race` et `rest` exclus, car la dernière séance du plan est la course
elle-même) est traitée, cochée comme faite *ou* comme manquée.

**Flux** :
1. « Générer le bilan et le prompt » consolide l'historique réel de la prépa toutes
   versions confondues (`buildConsolidatedHistory`), l'écrit dans `events/{slug}/bilan.md`
   et ouvre le prompt à copier.
2. Le prompt contient : objectif de départ (lu dans `plans/v1.md`, seule source non
   écrasée) et ses révisions, profil athlète, assiduité par type de séance, détail
   semaine par semaine avec le contenu prescrit, et le profil du parcours km par km
   calculé depuis le GPX (`splitByKm`).
3. L'IA choisit elle-même l'objectif atteignable et renvoie un plan d'allure ; le .md
   est importé dans `events/{slug}/strategy.md` et rendu dans l'onglet.

**Convention de lecture du réalisé**, rappelée explicitement dans le prompt :
séance cochée **sans** note = faite exactement comme prescrite ; séance cochée **avec**
note = la note décrit l'écart ; séance manquée = non faite ; séance jamais cochée =
statut inconnu.

## Clôture d'un événement

Cocher la séance **de course** (`type: race` ET date == `meta.raceDate`) clôt l'événement :
`closedAt` est écrit dans `meta.json` et la saisie du résultat s'ouvre dans la foulée
(`race-result-modal.js`). Décocher la séance rouvre l'événement (`closedAt: null`).

**Source de vérité de l'état « course courue » : le cochage de la séance**
(`isRaceDone` dans `js/utils/race-status.js`), pas `closedAt`. Les deux vivent dans des
fichiers écrits séparément (`state.json` et `meta.json`) et peuvent diverger — c'est
arrivé sur Run in Lyon, séance cochée et `closedAt` revenu à `null` après un
décochage/recochage rapide. `closedAt` ne sert plus qu'à horodater et à ne pas
reproposer la saisie du résultat.

Une course courue sort des « courses en préparation » de l'accueil (`getActiveRacePreps`),
même le jour J où sa période la couvre encore. Dans `/courses`, sa carte passe en
`event-card--past` : grisée, temps et allure à la place de l'objectif, **sans** phase ni
complétion ni barre de progression — sinon elle gardait sa pastille de phase et sa barre
verte à côté du chrono, là où les courses sans plan n'affichent que le résultat.

Une course **test** au milieu du plan est elle aussi de type `race` (S08 et S16 de
`run-in-lyon-2026`) : seule la séance tombant le jour de la course déclenche la clôture.
La comparaison se fait sur la date d'origine de la séance (plan brut, pas le planning
effectif) pour qu'un déplacement manuel ne la fausse pas.

`syncEventClosure` est appelée après chaque `toggleSession` d'un événement — par
`plan-view.js` et `session-view.js`, qui cochent tous deux une séance. Un nouveau point
de cochage devrait l'appeler aussi.

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
  "closedAt": "2026-10-04T16:20:00.000Z",
  "prepReport": { "file": "bilan.md", "generatedAt": "…" },
  "strategy": { "file": "strategy.md", "importedAt": "…" },
  "result": { "time": "1h52'34\"", "pacePerKm": "5'20\"/km", "activityUrl": null }
}
```

`activeVersion: null` + `versions: []` = événement sans plan (état normal après création via l'app).  
`location`, `objectiveRealistic`, `courseDescription` sont optionnels mais utilisés dans les prompts générés.

`course.gpx` et `course.pdf` sont `null` si pas encore importés. `photos` est un tableau de noms de fichiers (max 2, 5 Mo/photo, stockés dans `events/{slug}/course/`).  
**GPX** : quand un GPX est présent, distance et D+ sont calculés automatiquement (window=3 + `ELEVATION_THRESHOLD_M`, 5 m). Ces champs sont en **lecture seule avant la date de course**, puis **éditables après** (pour saisir les valeurs officielles).  
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
- **GPX parser** : `smoothElevation(points, 3)` + `calcElevationThreshold(smoothed, ELEVATION_THRESHOLD_M)` pour le D+/D- ; le seuil d'hystérésis (5 m) est une constante partagée par le total, `splitByKm` et le cumul du curseur. Il était à 1,5 m, trop bas pour des altitudes issues d'un modèle de terrain (traces dessinées sur gpx.studio ou fonds de carte) : 189 m annoncés sur le semi de Lyon pour ~70 m réellement grimpés. Un GPX dessiné reste une estimation — après la course, distance et D+ sont éditables pour saisir les valeurs mesurées ; `splitByKm(profile)` découpe le profil en tranches d'1 km (D+/D-/altitudes) pour le prompt de stratégie
- **Profil altimétrique** : en vignette, deux gestes cohabitent — un appui ouvre le plein écran, un glissement lit le profil sur place. `attachElevationCursor` arbitre via `onTap` et un seuil de 8 px : sous le seuil c'est un appui, au-delà un glissement. L'ouverture ne passe pas par un listener `click`, qui se déclencherait aussi à la fin d'un glissement à la souris. En plein écran (`gpx-modal.js`), la scène est pivotée de 90° quand le téléphone est en portrait (iOS Safari n'expose pas `screen.orientation.lock()`) ; la croix vit dans la scène pivotée, donc en haut à gauche de ce que l'utilisateur regarde une fois le téléphone tourné ; fermeture aussi par Échap. Le curseur convertit les coordonnées via `svg.getScreenCTM()` et non `getBoundingClientRect()`, seule façon de rester juste dans un conteneur pivoté. Valeurs (km, altitude, pente locale sur ±75 m, D+ cumulé) dans une ligne **sous** le graphique, jamais par-dessus le tracé. `touch-action: pan-y` laisse la page défiler. La hauteur du viewBox est inscrite dans `data-chart-height` sur le SVG et relue par le curseur : rendu et curseur ne peuvent pas diverger
- **Bilan de prépa** : `prep-report.js` — historique consolidé multi-versions, `events/{slug}/bilan.md` + `events/{slug}/strategy.md`

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
