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
  selectedRappelLines = null, methodeTemplate = null, audience = 'enseignant',
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
  bodyParagraphs.push(spacer())
  bodyParagraphs.push(...audienceBanner(audience))
  bodyParagraphs.push(spacer())

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
