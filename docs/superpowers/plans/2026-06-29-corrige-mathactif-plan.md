# MathActif — Corrigé pas à pas : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une option "Corrigé" à MathActif : l'enseignant sélectionne les exercices à corriger, Sonnet génère les résolutions pas à pas dans des zones éditables, l'enseignant valide, puis exporte en .docx séparé ou intégré au document AU.

**Architecture:** Un composant `CorrigePanel` s'affiche après validation AU. Il liste les exercices détectés (regex `/^Exercice\s+\d+/i` — garanti présent par la validation AU). Sonnet génère le JSON des corrections via `api/generate-corrige.js`. L'export est géré par `exportCorrigeDocx.js` (mode séparé) et une nouvelle fonction dans `exportMathDocx.js` (mode intégré).

**Tech Stack:** React 18, docx v9.6.1, Vercel Serverless Functions, claude-sonnet-4-6, Vitest

**Spec:** `docs/superpowers/specs/2026-06-29-corrige-mathactif-design.md`

---

## File Map

| Fichier | Action | Responsabilité |
|---|---|---|
| `src/lib/corrigeUtils.js` | Créer | Fonctions pures : split exercices, validation JSON Sonnet |
| `src/lib/__tests__/corrigeUtils.test.js` | Créer | Tests vitest des fonctions pures |
| `api/generate-corrige.js` | Créer | Serverless Sonnet : génère JSON corrections |
| `src/lib/exportCorrigeDocx.js` | Créer | Export DOCX mode séparé + mode intégré |
| `src/lib/exportMathDocx.js` | Modifier | Exporter `parseMathText`, ajouter param `keepAllNext` |
| `src/components/CorrigePanel.jsx` | Créer | UI : checkboxes, zones éditables, export |
| `src/pages/MathAdapter.jsx` | Modifier | Monter `<CorrigePanel>` après validation AU |

---

## Task 1 : Fonctions pures — `src/lib/corrigeUtils.js`

**Files:**
- Create: `src/lib/corrigeUtils.js`
- Create: `src/lib/__tests__/corrigeUtils.test.js`

- [ ] **Step 1 : Écrire les tests**

```js
// src/lib/__tests__/corrigeUtils.test.js
import { describe, it, expect } from 'vitest'
import { splitAuByExercice, parseCorrigeResponse } from '../corrigeUtils.js'

describe('splitAuByExercice', () => {
  it('retourne un tableau vide si aucun exercice', () => {
    expect(splitAuByExercice('Texte sans exercice')).toEqual([])
  })

  it('détecte un seul exercice', () => {
    const texte = 'Exercice 1\nCalcule la dérivée.\n___\n___\n___'
    const result = splitAuByExercice(texte)
    expect(result).toHaveLength(1)
    expect(result[0].num).toBe(1)
    expect(result[0].titre).toBe('Exercice 1')
    expect(result[0].texte).toContain('Calcule la dérivée.')
  })

  it('détecte deux exercices et leur texte respectif', () => {
    const texte = 'Exercice 1\nQ1\n___\nExercice 2\nQ2\n___'
    const result = splitAuByExercice(texte)
    expect(result).toHaveLength(2)
    expect(result[0].texte).not.toContain('Q2')
    expect(result[1].texte).toContain('Q2')
    expect(result[1].texte).not.toContain('Q1')
  })

  it('ignore le texte avant le premier exercice', () => {
    const texte = 'En-tête\nSéquence\nExercice 1\nQ1\n___'
    const result = splitAuByExercice(texte)
    expect(result).toHaveLength(1)
  })
})

describe('parseCorrigeResponse', () => {
  it('retourne le tableau corrections si JSON valide', () => {
    const json = {
      corrections: [
        { id: 1, titre: 'Exercice 1', etapes: [{ formule: 'f(x)', description: 'Fonction' }], conclusion: 'OK' }
      ]
    }
    const result = parseCorrigeResponse(json)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
    expect(result[0].etapes).toHaveLength(1)
  })

  it('lève une erreur si corrections manquant', () => {
    expect(() => parseCorrigeResponse({})).toThrow('corrections manquant')
  })

  it('lève une erreur si corrections n\'est pas un tableau', () => {
    expect(() => parseCorrigeResponse({ corrections: 'mauvais' })).toThrow('corrections manquant')
  })

  it('lève une erreur si une correction manque etapes', () => {
    expect(() => parseCorrigeResponse({
      corrections: [{ id: 1, titre: 'Ex 1', conclusion: 'OK' }]
    })).toThrow('etapes manquant')
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```
npx vitest run src/lib/__tests__/corrigeUtils.test.js
```
Attendu : FAIL (module introuvable)

- [ ] **Step 3 : Implémenter `src/lib/corrigeUtils.js`**

```js
/**
 * Fonctions pures utilitaires pour la feature "Corrigé"
 */

/**
 * Découpe le texte AU en blocs par exercice.
 * Utilise le même regex que validateMathAuRules.
 * @param {string} auTexte
 * @returns {{ num: number, titre: string, texte: string }[]}
 */
export function splitAuByExercice(auTexte) {
  if (!auTexte) return []
  const lines = auTexte.split('\n')
  const blocks = []
  let current = null

  for (const line of lines) {
    const match = line.trim().match(/^(Exercice\s+(\d+))/i)
    if (match) {
      if (current) blocks.push({ ...current, texte: current.lines.join('\n') })
      current = { num: parseInt(match[2], 10), titre: match[1], lines: [line] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) blocks.push({ ...current, texte: current.lines.join('\n') })
  return blocks
}

/**
 * Valide et retourne le tableau corrections depuis la réponse JSON de Sonnet.
 * @param {object} json
 * @returns {{ id: number, titre: string, etapes: { formule: string, description: string }[], conclusion: string }[]}
 */
export function parseCorrigeResponse(json) {
  if (!Array.isArray(json?.corrections)) throw new Error('corrections manquant dans la réponse Sonnet')
  for (const c of json.corrections) {
    if (!Array.isArray(c.etapes)) throw new Error(`etapes manquant pour correction id=${c.id}`)
  }
  return json.corrections
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```
npx vitest run src/lib/__tests__/corrigeUtils.test.js
```
Attendu : PASS (9 tests)

- [ ] **Step 5 : Commit**

```bash
git add src/lib/corrigeUtils.js src/lib/__tests__/corrigeUtils.test.js
git commit -m "feat: corrigeUtils — splitAuByExercice + parseCorrigeResponse"
```

---

## Task 2 : API Sonnet — `api/generate-corrige.js`

**Files:**
- Create: `api/generate-corrige.js`

Note : cette route ne peut pas être testée avec `npx vite dev`. Utiliser `vercel dev` et tester via curl ou l'UI.

- [ ] **Step 1 : Créer `api/generate-corrige.js`**

```js
/**
 * POST /api/generate-corrige
 * Body : { exercices, chapitre, niveau, audience }
 * Retourne : { corrections: [{ id, titre, etapes: [{formule, description}], conclusion }] }
 */

const ANTI_CLAUDISATION = `
STYLE DE RÉPONSE :
- JSON pur uniquement — aucun texte hors JSON, aucun bloc markdown
- Jamais "Voici", "Bien sûr", "Certainement" ni aucun préambule
- Jamais de résumé ou d'introduction
- Jamais de commentaire après le JSON
`.trim()

function buildSystemPrompt(audience) {
  const audienceRules = audience === 'enseignant'
    ? 'Description concise. Termes techniques acceptés. Pas de répétition des formules évidentes.'
    : audience === 'eleves'
    ? 'Description pédagogique, vocabulaire accessible S3-S6 FWB. Une phrase claire par étape. Jamais condescendant.'
    : 'Description pédagogique et accessible. Clarté pédagogique prioritaire sur la concision.'

  return `Tu es un professeur de mathématiques FWB expert en résolution d'exercices S3-S6.
Tu génères des corrigés pas à pas en JSON strict.

RÈGLES :
1. Répondre UNIQUEMENT en JSON valide — aucun texte en dehors.
2. Structure obligatoire : { "corrections": [ { "id": number, "titre": string, "etapes": [ { "formule": string, "description": string } ], "conclusion": string } ] }
3. "formule" : expression mathématique (peut être vide "" si l'étape est purement textuelle).
4. "description" : processus en UNE phrase. ${audienceRules}
5. "conclusion" : phrase résumant le résultat final.
6. Résoudre chaque exercice complètement — ne pas sauter d'étapes intermédiaires.
7. Conserver les notations exactes de l'énoncé (f(x), u(x), etc.).

${ANTI_CLAUDISATION}`
}

function buildUserMessage(exercices, chapitre, niveau) {
  const ctx = [
    chapitre ? `Chapitre : ${chapitre}` : '',
    niveau ? `Niveau : ${niveau}` : '',
  ].filter(Boolean).join(' | ')

  const exList = exercices.map(e =>
    `### Exercice ${e.id}\n${e.texte}`
  ).join('\n\n')

  return `${ctx ? ctx + '\n\n' : ''}Génère le corrigé pas à pas pour chaque exercice ci-dessous.\n\n${exList}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Clé API manquante' })

  const { exercices, chapitre, niveau, audience = 'enseignant' } = req.body
  if (!Array.isArray(exercices) || exercices.length === 0)
    return res.status(400).json({ error: 'exercices requis (tableau non vide)' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: buildSystemPrompt(audience),
        messages: [{ role: 'user', content: buildUserMessage(exercices, chapitre, niveau) }],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      if (response.status === 529 || err.error?.type === 'overloaded_error')
        return res.status(503).json({ error: 'API surchargée — réessayez dans quelques secondes.' })
      return res.status(500).json({ error: err.error?.message ?? 'Erreur API Anthropic' })
    }

    const data = await response.json()
    const rawText = data.content?.[0]?.text ?? ''

    let parsed
    try {
      // Sonnet peut envelopper le JSON dans ```json ... ```
      const clean = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      return res.status(500).json({ error: 'Réponse non-JSON de Sonnet', raw: rawText.slice(0, 200) })
    }

    if (!Array.isArray(parsed?.corrections))
      return res.status(500).json({ error: 'Structure JSON invalide', raw: rawText.slice(0, 200) })

    return res.status(200).json(parsed)

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
```

- [ ] **Step 2 : Vérifier le build**

```
npx vite build
```
Attendu : aucune erreur (les fichiers `/api/*` ne sont pas bundlés par Vite)

- [ ] **Step 3 : Commit**

```bash
git add api/generate-corrige.js
git commit -m "feat: api/generate-corrige — Sonnet résolution pas à pas JSON"
```

---

## Task 3 : Préparer `exportMathDocx.js` pour réutilisation

**Files:**
- Modify: `src/lib/exportMathDocx.js`

`parseMathText` est actuellement une fonction interne. Il faut (1) l'exporter et (2) ajouter un paramètre `keepAllNext` pour forcer `keepNext: true` sur tous les paragraphes d'un bloc (nécessaire pour le mode intégré).

- [ ] **Step 1 : Ajouter `keepAllNext` à `parseMathText` et l'exporter**

Localiser la ligne 482 :
```js
function parseMathText(text, { includeRappel = true } = {}) {
```

Remplacer par :
```js
export function parseMathText(text, { includeRappel = true, keepAllNext = false } = {}) {
```

Ensuite, dans le corps de `parseMathText`, localiser le bloc des fractions (ligne ~496) :
```js
const keepNextAfter = blockContinues(lines, i + 2) || hasAuContentAhead(lines, i + 2)
paragraphs.push(...fractionParagraphs(trimmed, lines[i + 2].trim(), keepNextAfter))
```
Remplacer par :
```js
const keepNextAfter = keepAllNext || blockContinues(lines, i + 2) || hasAuContentAhead(lines, i + 2)
paragraphs.push(...fractionParagraphs(trimmed, lines[i + 2].trim(), keepNextAfter))
```

Localiser le bloc spacer (ligne ~505) :
```js
const zdtAhead = hasAuContentAhead(lines, i)
paragraphs.push(zdtAhead
  ? new Paragraph({ text: '', spacing: { after: 160 }, keepNext: true })
  : spacer()
)
```
Remplacer par :
```js
const zdtAhead = keepAllNext || hasAuContentAhead(lines, i)
paragraphs.push(zdtAhead
  ? new Paragraph({ text: '', spacing: { after: 160 }, keepNext: true })
  : spacer()
)
```

Localiser le bloc `___` (ligne ~527) :
```js
const nextIsUnderline = i + 1 < lines.length && /^_{3,}$/.test(lines[i + 1].trim())
paragraphs.push(new Paragraph({
  children: [new TextRun({ text: display })],
  spacing: { after: 100, line: 360, lineRule: 'auto' },
  keepLines: true,
  keepNext: nextIsUnderline,
}))
```
Remplacer par :
```js
const nextIsUnderline = i + 1 < lines.length && /^_{3,}$/.test(lines[i + 1].trim())
paragraphs.push(new Paragraph({
  children: [new TextRun({ text: display })],
  spacing: { after: 100, line: 360, lineRule: 'auto' },
  keepLines: true,
  keepNext: keepAllNext || nextIsUnderline,
}))
```

Localiser le bloc `stays` (ligne ~560) :
```js
const stays = blockContinues(lines, i) || hasAuContentAhead(lines, i)
```
Remplacer par :
```js
const stays = keepAllNext || blockContinues(lines, i) || hasAuContentAhead(lines, i)
```

- [ ] **Step 2 : Vérifier le build**

```
npx vite build
```
Attendu : PASS sans erreur

- [ ] **Step 3 : Vérifier que les tests existants passent toujours**

```
npx vitest run
```
Attendu : PASS (les tests existants de mathProtect et corrigeUtils)

- [ ] **Step 4 : Commit**

```bash
git add src/lib/exportMathDocx.js
git commit -m "feat: exporter parseMathText + param keepAllNext pour mode intégré corrigé"
```

---

## Task 4 : Export DOCX — `src/lib/exportCorrigeDocx.js`

**Files:**
- Create: `src/lib/exportCorrigeDocx.js`

Contient deux fonctions exportées :
- `exportCorrigeDocx` : document corrigé séparé
- `exportAuAvecCorrigeDocx` : document AU + corrections intégrées (même page)

- [ ] **Step 1 : Créer `src/lib/exportCorrigeDocx.js`**

```js
/**
 * Export DOCX corrigé — MathActif
 * Mode séparé : exportCorrigeDocx
 * Mode intégré : exportAuAvecCorrigeDocx
 */

import {
  Document, Packer, Paragraph, TextRun,
  BorderStyle, Header, WidthType, Table, TableRow, TableCell, ShadingType,
} from 'docx'
import { saveAs } from 'file-saver'
import { NIVEAUX, TYPES_ENSEIGNEMENT } from './constants'
import { parseMathText } from './exportMathDocx'
import { splitAuByExercice } from './corrigeUtils'

const BRAND_TEAL   = '0a9370'
const BRAND_ORANGE = 'f97316'
const GRAY_TEXT    = '6B7280'
const GRAY_LIGHT   = 'F3F4F6'

function spacer() {
  return new Paragraph({ text: '', spacing: { after: 160 } })
}

function makeHeader(subtitle, date) {
  return new Header({
    children: [new Paragraph({
      children: [
        new TextRun({ text: 'MathActif — PLAI', bold: true, color: BRAND_TEAL, size: 18 }),
        new TextRun({ text: `  |  ${subtitle}  |  ${date}`, color: GRAY_TEXT, size: 18 }),
      ],
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BRAND_TEAL } },
    })],
  })
}

function metaTable(rows) {
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, color: GRAY_TEXT })] })],
          shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: value, size: 20 })] })],
        }),
      ],
    })),
  })]
}

function audienceBanner(audience) {
  if (audience === 'enseignant') return []
  const label = audience === 'eleves' ? 'Document élèves' : 'Document élèves et enseignant'
  return [new Paragraph({
    children: [new TextRun({ text: `Corrigé — ${label}`, bold: true, color: 'ffffff', size: 22 })],
    spacing: { before: 160, after: 160 },
    shading: { type: ShadingType.CLEAR, fill: BRAND_ORANGE },
    keepNext: true,
  })]
}

/**
 * Génère les paragraphes DOCX pour une correction (mode séparé).
 * keepNext: true sur tout sauf la conclusion (dernier élément).
 * @param {{ id: number, titre: string, etapes: {formule: string, description: string}[], conclusion: string }} correction
 * @returns {import('docx').Paragraph[]}
 */
function correctionParagraphs(correction) {
  const paragraphs = []

  // Titre "Exercice N — Correction"
  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: `${correction.titre} — Correction`, bold: true, color: BRAND_ORANGE, size: 26 })],
    spacing: { before: 280, after: 100 },
    keepNext: true,
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: BRAND_ORANGE, space: 8 } },
  }))

  // Étapes
  for (let idx = 0; idx < correction.etapes.length; idx++) {
    const { formule, description } = correction.etapes[idx]

    if (formule && formule.trim()) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: formule.trim(), italics: true, color: BRAND_TEAL, size: 22 })],
        spacing: { before: 80, after: 20 },
        indent: { left: 200 },
        keepNext: true,
      }))
    }

    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: description.trim(), size: 22 })],
      spacing: { after: 80 },
      indent: { left: 200 },
      keepNext: true,
    }))
  }

  // Conclusion (keepNext: false — Word peut paginer après)
  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: correction.conclusion.trim(), bold: true, size: 22 })],
    spacing: { before: 100, after: 200 },
    keepNext: false,
  }))

  return paragraphs
}

/**
 * Export document corrigé séparé.
 */
export async function exportCorrigeDocx({ corrections, chapitre, niveau, typeEnseignement, audience = 'enseignant' }) {
  const date    = new Date().toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })
  const niveauL = NIVEAUX.find(n => n.value === niveau)?.label ?? niveau ?? ''
  const typeL   = TYPES_ENSEIGNEMENT.find(t => t.value === typeEnseignement)?.label ?? typeEnseignement ?? ''

  const children = [
    new Paragraph({
      children: [new TextRun({ text: `${chapitre || 'Mathématiques'} — Corrigé`, bold: true, color: BRAND_TEAL, size: 36 })],
      spacing: { after: 160 },
    }),
    ...metaTable([
      ['Chapitre', chapitre || '—'],
      ['Niveau',   niveauL  || '—'],
      ['Type',     typeL    || '—'],
      ['Date',     date],
    ]),
    spacer(),
    ...audienceBanner(audience),
    spacer(),
    ...corrections.flatMap(c => correctionParagraphs(c)),
  ]

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 24 } } } },
    sections: [{
      properties: { page: { margin: { top: 720, right: 850, bottom: 720, left: 850 } } },
      headers: { default: makeHeader('Corrigé', date) },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `MathActif_Corrigé_${(chapitre || 'cours').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`)
}

/**
 * Export document AU + corrections intégrées.
 * Énoncé AU + correction = même page (keepAllNext sur le bloc AU).
 */
export async function exportAuAvecCorrigeDocx({
  auTexte, corrections, chapitre, niveau, typeEnseignement,
  selectedRappelLines = null, methodeTemplate = null,
}) {
  const date    = new Date().toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })
  const niveauL = NIVEAUX.find(n => n.value === niveau)?.label ?? niveau ?? ''
  const typeL   = TYPES_ENSEIGNEMENT.find(t => t.value === typeEnseignement)?.label ?? typeEnseignement ?? ''

  // Index des corrections par numéro d'exercice
  const correctionByNum = Object.fromEntries(corrections.map(c => [c.id, c]))

  // Blocs exercice du texte AU
  const exerciceBlocks = splitAuByExercice(auTexte)

  // Texte avant le premier exercice (préambule : Méthode, Rappels, etc.)
  const premierIdx = auTexte.indexOf(exerciceBlocks[0]?.titre ?? '\x00')
  const preamble = premierIdx > 0 ? auTexte.slice(0, premierIdx) : ''

  const bodyParagraphs = []

  // Préambule (Méthode + Rappels si présents)
  if (methodeTemplate) {
    bodyParagraphs.push(...parseMathText(methodeTemplate))
    bodyParagraphs.push(spacer())
  }
  if (selectedRappelLines?.length) {
    bodyParagraphs.push(...parseMathText(selectedRappelLines.join('\n'), { includeRappel: true }))
    bodyParagraphs.push(spacer())
  }
  if (preamble.trim()) {
    bodyParagraphs.push(...parseMathText(preamble))
  }

  // Exercices : AU + correction sur même page
  for (const block of exerciceBlocks) {
    const hasCorrection = Boolean(correctionByNum[block.num])

    if (hasCorrection) {
      // keepAllNext: true force tous les paragraphes AU à keepNext: true
      // → Word ne peut pas paginer au sein du bloc AU
      bodyParagraphs.push(...parseMathText(block.texte, { keepAllNext: true }))
      bodyParagraphs.push(...correctionParagraphs(correctionByNum[block.num]))
    } else {
      // Pas de correction pour cet exercice → comportement normal
      bodyParagraphs.push(...parseMathText(block.texte))
    }
    bodyParagraphs.push(spacer())
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 24 } } } },
    sections: [{
      properties: { page: { margin: { top: 720, right: 850, bottom: 720, left: 850 } } },
      headers: { default: makeHeader('Document AU avec corrigé', date) },
      children: [
        new Paragraph({
          children: [new TextRun({ text: `${chapitre || 'Mathématiques'} — AU + Corrigé`, bold: true, color: BRAND_TEAL, size: 36 })],
          spacing: { after: 160 },
        }),
        ...metaTable([
          ['Chapitre', chapitre || '—'],
          ['Niveau',   niveauL  || '—'],
          ['Type',     typeL    || '—'],
          ['Date',     date],
        ]),
        spacer(),
        ...bodyParagraphs,
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `MathActif_AU_Corrigé_${(chapitre || 'cours').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`)
}
```

- [ ] **Step 2 : Vérifier le build**

```
npx vite build
```
Attendu : PASS sans erreur

- [ ] **Step 3 : Commit**

```bash
git add src/lib/exportCorrigeDocx.js
git commit -m "feat: exportCorrigeDocx — mode séparé + mode intégré avec même-page"
```

---

## Task 5 : UI — `src/components/CorrigePanel.jsx`

**Files:**
- Create: `src/components/CorrigePanel.jsx`

- [ ] **Step 1 : Créer `src/components/CorrigePanel.jsx`**

```jsx
import { useState, useMemo } from 'react'
import { splitAuByExercice, parseCorrigeResponse } from '../lib/corrigeUtils'
import { exportCorrigeDocx, exportAuAvecCorrigeDocx } from '../lib/exportCorrigeDocx'

const AUDIENCE_OPTIONS = [
  { value: 'enseignant', label: 'Enseignant uniquement' },
  { value: 'eleves',     label: 'Élèves' },
  { value: 'les deux',   label: 'Élèves et enseignant' },
]

const FORMAT_OPTIONS = [
  { value: 'separe',   label: 'Document corrigé séparé' },
  { value: 'integre',  label: 'Intégré au document AU (même page)' },
  { value: 'les deux', label: 'Les deux' },
]

export default function CorrigePanel({
  auTexte,
  chapitre,
  niveau,
  typeEnseignement,
  selectedRappelLines,
  methodeTemplate,
}) {
  const exercices = useMemo(() => splitAuByExercice(auTexte), [auTexte])

  const [selected, setSelected]       = useState(new Set())
  const [audience, setAudience]       = useState('enseignant')
  const [format, setFormat]           = useState('separe')
  const [generating, setGenerating]   = useState(false)
  const [exporting, setExporting]     = useState(false)
  const [corrections, setCorrections] = useState([])
  const [error, setError]             = useState('')
  const [exported, setExported]       = useState(false)

  function toggleAll() {
    if (selected.size === exercices.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(exercices.map(e => e.num)))
    }
  }

  function toggleOne(num) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(num) ? next.delete(num) : next.add(num)
      return next
    })
  }

  function updateEtape(corrId, etapeIdx, field, value) {
    setCorrections(prev => prev.map(c =>
      c.id !== corrId ? c : {
        ...c,
        etapes: c.etapes.map((e, i) => i !== etapeIdx ? e : { ...e, [field]: value }),
      }
    ))
  }

  function addEtape(corrId) {
    setCorrections(prev => prev.map(c =>
      c.id !== corrId ? c : { ...c, etapes: [...c.etapes, { formule: '', description: '' }] }
    ))
  }

  function removeEtape(corrId, etapeIdx) {
    setCorrections(prev => prev.map(c =>
      c.id !== corrId ? c : { ...c, etapes: c.etapes.filter((_, i) => i !== etapeIdx) }
    ))
  }

  function moveEtape(corrId, etapeIdx, dir) {
    setCorrections(prev => prev.map(c => {
      if (c.id !== corrId) return c
      const etapes = [...c.etapes]
      const target = etapeIdx + dir
      if (target < 0 || target >= etapes.length) return c
      ;[etapes[etapeIdx], etapes[target]] = [etapes[target], etapes[etapeIdx]]
      return { ...c, etapes }
    }))
  }

  function updateConclusion(corrId, value) {
    setCorrections(prev => prev.map(c =>
      c.id !== corrId ? c : { ...c, conclusion: value }
    ))
  }

  async function generer() {
    setError('')
    setGenerating(true)
    setCorrections([])
    setExported(false)
    try {
      const exercicesSelectionnes = exercices
        .filter(e => selected.has(e.num))
        .map(e => ({ id: e.num, texte: e.texte }))

      const res = await fetch('/api/generate-corrige', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercices: exercicesSelectionnes, chapitre, niveau, audience }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Erreur API')
      }
      const json = await res.json()
      const parsed = parseCorrigeResponse(json)
      setCorrections(parsed)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      if (format === 'separe' || format === 'les deux') {
        await exportCorrigeDocx({ corrections, chapitre, niveau, typeEnseignement, audience })
      }
      if (format === 'integre' || format === 'les deux') {
        await exportAuAvecCorrigeDocx({
          auTexte, corrections, chapitre, niveau, typeEnseignement,
          selectedRappelLines, methodeTemplate,
        })
      }
      setExported(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setExporting(false)
    }
  }

  if (exercices.length === 0) return null

  return (
    <div className="card mt-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Générer un corrigé</h2>
      <p className="text-sm text-gray-500 mb-4">Sélectionnez les exercices à corriger. Aucun n'est sélectionné par défaut.</p>

      {/* Bandeau pas de sauvegarde */}
      {corrections.length > 0 && !exported && (
        <div className="mb-4 p-3 rounded-xl bg-orange-50 border border-orange-300 text-orange-800 text-sm font-medium">
          Ce corrigé n'est pas sauvegardé. Exportez votre document avant de quitter cette page.
        </div>
      )}

      {/* Liste exercices */}
      <div className="space-y-2 mb-4">
        {exercices.map(e => (
          <label key={e.num} className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
            <input
              type="checkbox"
              checked={selected.has(e.num)}
              onChange={() => toggleOne(e.num)}
              className="w-4 h-4 mt-0.5 accent-teal-600"
            />
            <span className="text-sm text-gray-700">
              <span className="font-medium">{e.titre}</span>
              {' — '}
              <span className="text-gray-500">{e.texte.split('\n').find(l => l.trim() && !l.trim().match(/^Exercice/i))?.slice(0, 60) ?? '…'}</span>
            </span>
          </label>
        ))}
      </div>

      <button onClick={toggleAll} className="text-xs text-teal-700 underline mb-4">
        {selected.size === exercices.length ? 'Tout désélectionner' : 'Tout sélectionner'}
      </button>

      {/* Audience */}
      <div className="mb-4">
        <label className="label">Destination du corrigé</label>
        <select
          value={audience}
          onChange={e => setAudience(e.target.value)}
          className="input mt-1"
        >
          {AUDIENCE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Bouton générer */}
      <button
        onClick={generer}
        disabled={selected.size === 0 || generating}
        className="btn-primary w-full py-3 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed mb-4"
      >
        {generating
          ? 'Génération en cours…'
          : selected.size === 0
            ? 'Sélectionnez au moins un exercice'
            : `Générer le corrigé (${selected.size} exercice${selected.size > 1 ? 's' : ''})`}
      </button>

      {error && (
        <div className="card bg-red-50 border-red-200 text-red-700 text-sm mb-4">{error}</div>
      )}

      {/* Zones d'édition */}
      {corrections.map(c => (
        <div key={c.id} className="card border-orange-200 mb-4">
          <h3 className="font-semibold text-orange-700 mb-3">{c.titre} — Correction</h3>

          {c.etapes.map((etape, idx) => (
            <div key={idx} className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">Étape {idx + 1}</span>
                <div className="flex gap-1">
                  <button onClick={() => moveEtape(c.id, idx, -1)} disabled={idx === 0} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30">↑</button>
                  <button onClick={() => moveEtape(c.id, idx, 1)} disabled={idx === c.etapes.length - 1} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30">↓</button>
                  <button onClick={() => removeEtape(c.id, idx)} className="text-xs text-red-400 hover:text-red-600 ml-1">Supprimer</button>
                </div>
              </div>
              <input
                type="text"
                placeholder="Formule (optionnelle)"
                value={etape.formule}
                onChange={e => updateEtape(c.id, idx, 'formule', e.target.value)}
                className="input text-sm mb-2 font-mono"
              />
              <textarea
                placeholder="Description du processus"
                value={etape.description}
                onChange={e => updateEtape(c.id, idx, 'description', e.target.value)}
                rows={2}
                className="input text-sm resize-none"
              />
            </div>
          ))}

          <button
            onClick={() => addEtape(c.id)}
            className="text-xs text-teal-700 underline mb-3"
          >+ Ajouter une étape</button>

          <div>
            <label className="label text-xs">Conclusion</label>
            <textarea
              value={c.conclusion}
              onChange={e => updateConclusion(c.id, e.target.value)}
              rows={2}
              className="input text-sm resize-none mt-1"
              placeholder="Résultat final"
            />
          </div>
        </div>
      ))}

      {/* Export */}
      {corrections.length > 0 && (
        <div className="card bg-gray-50 border-gray-200 mt-4">
          <h3 className="font-medium text-gray-700 mb-3">Exporter le corrigé</h3>
          <div className="space-y-2 mb-4">
            {FORMAT_OPTIONS.map(o => (
              <label key={o.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format-corrige"
                  value={o.value}
                  checked={format === o.value}
                  onChange={() => setFormat(o.value)}
                  className="accent-teal-600"
                />
                <span className="text-sm text-gray-700">{o.label}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-primary w-full py-3 font-semibold disabled:opacity-40"
          >
            {exporting ? 'Export en cours…' : 'Télécharger le corrigé'}
          </button>
          {exported && (
            <p className="text-xs text-green-700 mt-2 text-center">Corrigé exporté avec succès.</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier le build**

```
npx vite build
```
Attendu : PASS sans erreur

- [ ] **Step 3 : Commit**

```bash
git add src/components/CorrigePanel.jsx
git commit -m "feat: CorrigePanel — sélection exercices, édition corrections, export"
```

---

## Task 6 : Intégration dans `MathAdapter.jsx`

**Files:**
- Modify: `src/pages/MathAdapter.jsx`

`CorrigePanel` s'affiche uniquement après validation AU réussie (`auValidation` non null ET au moins un exercice valide).

- [ ] **Step 1 : Ajouter l'import en tête de `MathAdapter.jsx`**

Localiser le bloc d'imports existant (ligne ~1-11). Après la dernière ligne d'import, ajouter :
```js
import CorrigePanel from '../components/CorrigePanel'
```

- [ ] **Step 2 : Monter `<CorrigePanel>` dans le JSX**

Dans le JSX de `MathAdapter`, localiser la section qui affiche les résultats de validation AU. Elle est après le rendu de `auValidation` (chercher `auValidation &&` ou `auValidation?.map`).

Ajouter `<CorrigePanel>` **après** le bloc de validation AU et **avant** la section export profil :

```jsx
{auTexte && auValidation && (
  <CorrigePanel
    auTexte={auTexte}
    chapitre={chapitre}
    niveau={niveau}
    typeEnseignement={typeEns}
    selectedRappelLines={getSelectedRappelLines()}
    methodeTemplate={useMethodeFixed ? methodeEdit : null}
  />
)}
```

- [ ] **Step 3 : Vérifier le build**

```
npx vite build
```
Attendu : PASS sans erreur

- [ ] **Step 4 : Vérifier les tests**

```
npx vitest run
```
Attendu : PASS

- [ ] **Step 5 : Commit**

```bash
git add src/pages/MathAdapter.jsx
git commit -m "feat: monter CorrigePanel dans MathAdapter après validation AU"
```

---

## Task 7 : Test manuel `vercel dev`

- [ ] **Step 1 : Lancer `vercel dev`**

```
vercel dev
```

- [ ] **Step 2 : Parcours golden path**

1. Importer un .docx d'exercices maths
2. Remplir chapitre / niveau / type
3. Cliquer "Appliquer les AU"
4. Attendre la génération AU et la validation
5. Vérifier que `CorrigePanel` apparaît sous la validation AU
6. Cocher 2 exercices
7. Choisir audience "Élèves"
8. Cliquer "Générer le corrigé"
9. Vérifier les zones d'édition : titre, étapes, conclusion
10. Modifier une étape manuellement
11. Exporter mode "Séparé" → vérifier .docx téléchargé
12. Exporter mode "Intégré" → ouvrir dans Word et vérifier que énoncé + correction restent sur la même page
13. Tester mode "Les deux" → 2 fichiers téléchargés

- [ ] **Step 3 : Vérifier les cas limites**

- Aucun exercice sélectionné : bouton "Générer" désactivé ✓
- Quitter la page sans exporter : le bandeau orange est visible ✓
- Erreur API (simuler en coupant le réseau) : message d'erreur visible ✓

- [ ] **Step 4 : Push final**

```
npx vite build
git push origin main
```

---

## Spec coverage check

| Exigence spec | Tâche |
|---|---|
| Audience : enseignant / élèves / les deux | Task 5 (sélecteur), Task 4 (audienceBanner) |
| Hybride : Sonnet propose, enseignant édite | Task 2 (API), Task 5 (zones éditables) |
| Aucune sélection par défaut | Task 5 (`useState(new Set())`) |
| Format séparé / intégré / les deux | Task 5 (radio), Task 4 (deux fonctions export) |
| Règle même page énoncé+correction | Task 3 (`keepAllNext`), Task 4 (`keepAllNext: true`) |
| Bandeau "pas de sauvegarde" | Task 5 (bandeau orange conditionnel) |
| Ajout / suppression / réordre étapes | Task 5 (`addEtape`, `removeEtape`, `moveEtape`) |
| OMML via `parseMathText` | Task 4 (`correctionParagraphs` + import `parseMathText`) |
| Coût Sonnet | Task 2 (`max_tokens: 4000`, Sonnet) |
| Pas de clé côté frontend | Task 2 (serverless uniquement) |
