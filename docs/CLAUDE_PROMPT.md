# Prompt de génération de plan d'entraînement

## Comment utiliser ce fichier

1. Copie le bloc **PROMPT** ci-dessous (tout ce qui est entre les deux lignes `---`)
2. Remplace chaque `[VALEUR]` par tes informations
3. Envoie le message complet à Claude (claude.ai ou Claude Code)
4. Claude retourne un fichier `.md` → copie-le dans un fichier `v{N}.md`
5. Dans l'app → événement → Versions → **Importer nouvelle version**

---

## PROMPT — copie à partir d'ici

Tu es un coach expert en running, trail et préparation physique. Génère un plan d'entraînement complet et personnalisé pour la préparation d'un événement sportif.

### Profil athlète

- Niveau et expérience : [ex: intermédiaire, 2 ans de course à pied régulière]
- Meilleures performances récentes : [ex: 2h05'22" au semi-marathon des Alpes le 2026-05-17 | 51'10 sur 10K]
- Volume d'entraînement actuel : [ex: 25-35 km/semaine, 3 séances]
- Jours disponibles par semaine : [ex: mardi, jeudi, dimanche + 1-2 cross-training]
- Accès équipements : [ex: piste d'athlétisme à 5 km, vélo, pas de rameur]
- Terrain local : [ex: Marseille — massif de l'Étoile accessible, terrain vallonné]
- Pathologies / points de vigilance : [ex: syndrome essuie-glace droit (récent), arthrites métatarses M1 gauche]
- Objectifs secondaires : [ex: perdre 3 kg, améliorer ma VMA]

### Événement cible

- Nom complet : [ex: Run in Lyon 2026]
- Date de la course : [ex: 2026-10-04]
- Lieu : [ex: Lyon, France]
- Type de discipline : [ex: Semi-marathon route | Marathon trail | 10K route | Ultra trail 80K]
- Distance exacte : [ex: 21.0975 km | 42.195 km | 10 km]
- Dénivelé positif total : [ex: 184 m D+ | 2400 m D+ | plat]
- Description du parcours : [ex: Vallonné léger, montée notable km 14-17 vers la Croix-Rousse]
- Objectif temps : [ex: 1h50 | terminer | améliorer de 10 min]
- Date de début du plan : [ex: 2026-05-18 (lundi)]
- Durée souhaitée du plan : [ex: 20 semaines | 16 semaines | 12 semaines]

### Contexte supplémentaire

[Ajoute ici tout ce qui aide à personnaliser :
- Événements intermédiaires (10K test à mi-plan, trail en préparation…)
- Contraintes calendaires (vacances, déplacements)
- Préférences d'entraînement
- Matériel GPS / montres pour gérer les allures
- Expérience trail vs route
- Tout autre contexte utile]

---

**FORMAT DE SORTIE OBLIGATOIRE**

Génère le plan en suivant **EXACTEMENT** ce format template, sans aucune déviation, pour qu'il soit importable dans mon application de suivi. Ne commence pas par une introduction, commence directement par `# PLAN_v1 — {Nom de l'événement}`.

Le format utilise des marqueurs de section `## NOM_SECTION` en majuscules. Ne crée pas de sections supplémentaires.

```
# PLAN_v{N} — {Nom complet de l'événement}

## META
event: {Nom complet de l'événement}
slug: {nom-en-minuscules-avec-tirets}
date: {YYYY-MM-DD}
location: {Ville, Pays}
distance_km: {nombre décimal}
distance_label: {Semi-marathon | Marathon | 10K | Trail XXK | etc.}
elevation_gain_m: {nombre entier ou 0 si plat}
course_description: {Description courte du profil du parcours}
objective_time: {Xh MM ou "Terminer" ou "Améliorer"}
objective_realistic: {fourchette réaliste ex: 1h51-1h53}
plan_start: {YYYY-MM-DD}
plan_weeks: {nombre}
version: {N}
generated: {YYYY-MM-DD}

## PHASES
| ID | Nom | Semaines | Couleur |
|---|---|---|---|
| phase-1 | {Nom phase 1} | 1-{fin} | gray |
| phase-2 | {Nom phase 2} | {début}-{fin} | blue |
| phase-3 | {Nom phase 3} | {début}-{fin} | indigo |
| phase-4 | {Nom phase 4} | {début}-{fin} | orange |
| phase-5 | {Nom phase 5} | {début}-{fin} | red |
| phase-6 | {Nom phase 6} | {début}-{fin} | green |

Couleurs disponibles : gray, blue, indigo, orange, red, green, teal, purple

## ALLURES

### Actuelles
| Zone | Allure | Usage |
|---|---|---|
| {Zone} | {allure "/km"} | {usage} |

### Cibles
| Zone | Allure | Usage |
|---|---|---|
| {Zone} | {allure "/km"} | {usage} |

## SEMAINES

### S{NN} | {date début}-{date fin} {mois} {année} | {phase-id} | {volume}km | {note courte}
| Jour | Date | Type | Titre | Description |
|---|---|---|---|---|
| {Lundi/Mardi/…} | {YYYY-MM-DD} | {type} | {Titre court} | {Description détaillée de la séance} |

Types valides : rest, easy, long, intervals, tempo, hills, race, strength, cross

{Répéter pour toutes les semaines du plan}

## PPG

{Contenu markdown détaillé du programme de renforcement musculaire, adapté au profil de l'athlète et aux pathologies}

## VIGILANCE

{Contenu markdown sur les points de vigilance spécifiques à l'athlète (pathologies, risques, signaux d'alerte, conduite à tenir)}

## STRATEGIE_COURSE

{Contenu markdown sur la stratégie de course : pacing par section, repères chronos, scénarios, ravitaillement, mental}

## NUTRITION

{Contenu markdown sur la nutrition : à l'entraînement, semaine de course, jour J, pendant la course}
```

**Règles importantes :**
- Calcule les dates exactes de chaque séance à partir de `plan_start` (toujours un lundi)
- Semaines de décharge (-20-25% volume) toutes les 3-4 semaines — indique `DÉCHARGE` dans la note de la semaine
- Chaque séance a une description détaillée : allures précises, répétitions, durées, conseils
- N'inclus que les jours avec des séances (pas les jours vides)
- Pour les séances PPG, type = `strength`, pour cross-training type = `cross`
- Le plan doit être cohérent avec le profil de l'athlète, progressif et sécuritaire

---

## Exemples de notes de semaine

```
### S01 | 18-24 mai 2026 | phase-1 | 12km | Récupération active post-semi des Alpes
### S05 | 15-21 juin 2026 | phase-2 | 17km | DÉCHARGE — Semaine de récupération
### S16 | 31 août-6 sept 2026 | phase-5 | 25km | Course test 10 km
### S20 | 28 sept-4 oct 2026 | phase-6 | 10km | SEMAINE COURSE — Affûtage final
```

## Exemples de séances

```
| Mardi | 2026-06-30 | intervals | Piste — 10×30/30 | 15 min échauffement + 10×(30" à allure VMA / 30" trot) + 15 min retour. Première séance piste, focus régularité. Allure VMA ≈ 4'15-4'25"/km. |
| Jeudi | 2026-07-02 | easy | Footing EF 45 min + lignes | Allure 6'10-6'20"/km. 5×100m lignes droites en fin. |
| Samedi | 2026-07-04 | strength | PPG 25 min | 3 tours du circuit complet. Voir onglet Infos > PPG. |
| Dimanche | 2026-07-05 | long | Sortie longue 1h20 | 13-14 km à 6'00-6'10"/km. |
```

---

*Ce fichier fait partie du repo pacing-app. Ne pas modifier le format template.*
