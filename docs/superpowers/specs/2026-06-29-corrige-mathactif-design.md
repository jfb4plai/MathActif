# MathActif — Corrigé pas à pas : Design Spec

**Date :** 2026-06-29  
**Statut :** validé  
**Fonctionnalité :** génération optionnelle d'un corrigé avec résolutions pas à pas pour les exercices AU

---

## Contexte

MathActif génère un document AU (Aménagements Universels) à partir d'un .docx d'exercices maths S3-S6 FWB. Cette feature ajoute une option "Corrigé" : l'enseignant sélectionne les exercices à corriger, l'IA (Sonnet) produit des résolutions pas à pas dans des zones éditables, l'enseignant valide, puis exporte en .docx séparé ou intégré au document AU.

---

## Décisions de conception

| Dimension | Choix |
|---|---|
| Audience | Enseignant, élèves, ou les deux — choix à l'export |
| Génération | Hybride : Sonnet propose, enseignant édite étape par étape (split 80/20) |
| Sélection exercices | Aucun par défaut, l'enseignant coche les exercices à corriger |
| Format export | Séparé, intégré au .docx AU, ou les deux — choix à l'export |

---

## Architecture

### Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `src/components/CorrigePanel.jsx` | UI : liste exercices + checkboxes + zones éditables par correction |
| `api/generate-corrige.js` | Serverless Sonnet : résolution pas à pas des exercices sélectionnés |
| `src/lib/exportCorrigeDocx.js` | Export DOCX corrigé (mode séparé) |

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `src/pages/MathAdapter.jsx` | Ajouter `<CorrigePanel>` conditionnel après génération AU validée |
| `src/lib/exportMathDocx.js` | Mode "intégré" : insérer les corrections intercalées après chaque exercice |

---

## Flux utilisateur

```
[AU générée + validée]
       ↓
[CorrigePanel s'affiche]
  → Liste des exercices détectés (regex /^Exercice\s+\d+/im sur texte AU)
  → Checkboxes (aucune cochée par défaut)
  → Sélecteur audience : Enseignant | Élèves | Les deux
  → Bouton "Générer les corrections sélectionnées"
       ↓
[api/generate-corrige.js — Sonnet]
  → Résolution pas à pas par exercice sélectionné
  → Retour JSON : tableau { id, titre, etapes: [{formule, description}], conclusion }
       ↓
[Zones éditables par exercice dans CorrigePanel]
  → Formule + description par étape (textarea)
  → Boutons + Ajouter étape / Supprimer / ↑↓
  → Conclusion éditable
       ↓
[Export]
  → Format : Séparé | Intégré | Les deux
  → [Télécharger le corrigé]
```

---

## API — `api/generate-corrige.js`

**Modèle :** `claude-sonnet-4-6` (Haiku insuffisant pour raisonnement math S3-S6)

### Input

```json
{
  "exercices": [
    { "id": 1, "texte": "Calcule la dérivée de f(x) = 3x² + 2x - 5" }
  ],
  "chapitre": "dérivation",
  "niveau": "S4",
  "audience": "eleves"
}
```

Note : les tokens `«MATH_N»` sont restaurés côté client avant envoi — l'API reçoit le texte mathématique réel.

### Output (JSON strict)

```json
{
  "corrections": [
    {
      "id": 1,
      "titre": "Exercice 1",
      "etapes": [
        { "formule": "f(x) = 3x² + 2x - 5", "description": "Fonction de départ" },
        { "formule": "f'(x) = 6x + 2", "description": "Dérivée : règle de la puissance appliquée terme par terme" }
      ],
      "conclusion": "La dérivée de f est f'(x) = 6x + 2"
    }
  ]
}
```

### Règles du prompt système

- Répondre en JSON pur — aucun texte hors JSON
- Chaque étape : formule (peut être vide) + description du processus en une phrase
- Si audience = élèves : langage pédagogique, vocabulaire S3-S6 FWB, accessible
- Si audience = enseignant : concis, termes techniques acceptés
- Si audience = les deux : privilégier la clarté pédagogique
- ANTI-CLAUDISATION : pas de "Voici", "Bien sûr", aucun préambule

---

## UI — `CorrigePanel.jsx`

### États

```
idle → generating → editing → exported
```

### Structure visuelle

**Phase sélection :**
- Titre section "Générer un corrigé"
- Liste des exercices avec checkboxes (aucune cochée par défaut)
- Lien "Tout sélectionner / Tout désélectionner"
- Sélecteur audience (dropdown)
- Bouton "Générer les corrections sélectionnées" (désactivé si aucune sélection)

**Phase édition (après génération) :**
- Pour chaque exercice sélectionné : carte avec titre, étapes éditables (formule + description), boutons ↑↓ + supprimer par étape, bouton "+ Ajouter une étape", conclusion éditable
- Spinner pendant génération

**Phase export :**
- Choix format : radio Séparé | Intégré | Les deux
- Bouton "Télécharger le corrigé"

### Détection des exercices

```js
const exercices = auTexte
  .split('\n')
  .filter(l => /^Exercice\s+\d+/i.test(l.trim()))
  .map((l, i) => ({ id: i + 1, titre: l.trim(), texte: extraireBloc(auTexte, l.trim()) }))
```

`extraireBloc` extrait le texte entre deux en-têtes "Exercice N" consécutifs.

---

## Export DOCX

### Règle absolue : énoncé + correction sur la même page

`keepNext: true` sur **tous** les paragraphes d'un exercice (énoncé AU + ZDT + correction), sauf le **dernier paragraphe de la correction** (`keepNext: false`). Word peut paginer entre exercices, jamais au sein d'un exercice+correction.

Cas limite : si une correction est trop longue (>1 page), Word paginera quand même — comportement accepté, l'enseignant ajuste manuellement dans Word.

### Mode séparé — `exportCorrigeDocx.js`

Structure du document :

```
[En-tête] Corrigé — [Chapitre] — [Niveau]
[Bandeau audience si "élèves"] : style teal, mention explicite

Pour chaque exercice corrigé :
  → Titre "Exercice N — Correction"  (style Exercice, keepNext: true)
  → Pour chaque étape :
      → Formule (si présente) : OMML via parseMathText (keepNext: true)
      → Description : paragraphe indenté, style Étape (keepNext: true)
  → Conclusion : paragraphe gras (keepNext: false — dernier élément)
  → Séparateur visuel entre exercices
```

### Mode intégré — modification `exportMathDocx.js`

Après chaque bloc exercice AU, insérer la correction si disponible :

```
[Exercice N — énoncé AU]         keepNext: true (tous paragraphes)
[ZDT — lignes ___]               keepNext: true
[Exercice N — Correction]        keepNext: true  ← bordure gauche orange #f97316
[Étapes…]                        keepNext: true
[Conclusion]                     keepNext: false ← Word peut paginer ici
```

Style visuel correction intégrée : bordure gauche orange (`#f97316`) pour distinguer de l'énoncé teal.

### Paramètres d'appel export

```js
exportCorrigeDocx({
  corrections,      // tableau issu de CorrigePanel
  chapitre,
  niveau,
  audience,         // "enseignant" | "eleves" | "les deux"
  mode,             // "separe" | "integre" | "les deux"
  auTexte,          // nécessaire pour mode intégré
  methodeTemplate,
  chapitreKey,
})
```

---

## Contraintes techniques

- `ANTHROPIC_API_KEY` côté serveur uniquement (`api/generate-corrige.js`)
- Tester avec `vercel dev` (pas `vite dev`)
- `npx vite build` doit passer avant tout push
- Pas de sauvegarde Supabase des corrigés en v1 (export direct, pas de persistance)
- Les formules dans les corrections suivent le même pipeline OMML que `exportMathDocx.js` (`parseMathText`)

---

## Hors scope v1

- Sauvegarde des corrigés en base Supabase
- Réorganisation manuelle des étapes par glisser-déposer (remplacé par ↑↓)
- Génération automatique sans validation enseignant
- Corrigé différencié par profil (PAI, dyslexie…)
