/**
 * Export DOCX — MathActif
 * Équations : LaTeX → Unicode texte (couvre ~80% cas S3-S6)
 * Équations complexes (intégrales, matrices) → texte entre crochets colorés
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, Header,
} from 'docx'
import { saveAs } from 'file-saver'
import { PROFILS, NIVEAUX, TYPES_ENSEIGNEMENT } from './constants'

const BRAND_TEAL = '0a9370'
const GRAY_LIGHT = 'F3F4F6'
const GRAY_TEXT  = '6B7280'

function superscript(str) {
  const map = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','n':'ⁿ' }
  return [...str].map(c => map[c] ?? c).join('')
}

function latexToUnicode(latex) {
  return latex
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\sqrt/g, '√')
    .replace(/\^{([^}]+)}/g, (_, e) => superscript(e))
    .replace(/\^(\d)/g, (_, d) => superscript(d))
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\pi/g, 'π')
    .replace(/\\infty/g, '∞')
    .replace(/\\in/g, '∈')
    .replace(/\\mathbb\{R\}/g, 'ℝ')
    .replace(/\\mathbb\{N\}/g, 'ℕ')
    .replace(/\\mathbb\{Z\}/g, 'ℤ')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    .replace(/\\angle/g, '∠')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ')
    .replace(/[{}]/g, '')
    .trim()
}

function isComplexLatex(latex) {
  return /\\int|\\sum|\\prod|\\lim|\\begin|\\end|\\matrix|\\pmatrix|\\bmatrix/.test(latex)
    || (latex.match(/\\frac/g) || []).length > 1
}

function renderMathLine(line) {
  const parts = line.split(/(\$[^$\n]+\$)/g)
  return parts.flatMap((part, i) => {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      const latex = part.slice(1, -1)
      const display = isComplexLatex(latex)
        ? `[${latexToUnicode(latex)}]`
        : latexToUnicode(latex)
      return [new TextRun({ text: display, bold: true, color: BRAND_TEAL })]
    }
    return part ? [new TextRun({ text: part })] : []
  })
}

function spacer() {
  return new Paragraph({ text: '', spacing: { after: 160 } })
}

function sectionTitle(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: BRAND_TEAL, size: 26 })],
    spacing: { before: 320, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BRAND_TEAL } },
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

function isFractionBar(line) {
  return /^─{3,}$/.test(line.trim())
}

function fractionParagraphs(num, den) {
  const barLen = Math.max(num.length, den.length, 6)
  const bar = '─'.repeat(barLen)
  return [
    new Paragraph({
      alignment: 'center',
      children: renderMathLine(num),
      spacing: { after: 0, before: 80 },
    }),
    new Paragraph({
      alignment: 'center',
      children: [new TextRun({ text: bar, color: BRAND_TEAL, bold: true })],
      spacing: { after: 0, before: 0 },
    }),
    new Paragraph({
      alignment: 'center',
      children: renderMathLine(den),
      spacing: { after: 100, before: 0 },
    }),
  ]
}

function parseMathText(text) {
  if (!text) return [new Paragraph({ text: '—' })]
  const lines = text.split('\n')
  const paragraphs = []
  let i = 0
  while (i < lines.length) {
    const trimmed = lines[i].trim()

    // Détection pattern fraction 3 lignes : num / ──── / den
    if (
      i + 2 < lines.length &&
      isFractionBar(lines[i + 1]) &&
      lines[i + 2].trim()
    ) {
      paragraphs.push(...fractionParagraphs(trimmed, lines[i + 2].trim()))
      i += 3
      continue
    }

    if (!trimmed) { paragraphs.push(spacer()); i++; continue }
    if (/^\[saut_de_page\]/i.test(trimmed)) {
      paragraphs.push(new Paragraph({ text: '', pageBreakBefore: true })); i++; continue
    }
    if (isFractionBar(trimmed)) { i++; continue } // barre orpheline → ignorer

    const isTitle = /^(Exercice|Étape|Section|RAPPEL|##)\s/.test(trimmed)
    if (isTitle) {
      paragraphs.push(new Paragraph({
        children: renderMathLine(trimmed.replace(/^#+\s*/, '')),
        spacing: { before: 200, after: 60 },
        keepNext: true,
      }))
    } else {
      paragraphs.push(new Paragraph({
        children: renderMathLine(trimmed),
        spacing: { after: 100, line: 360, lineRule: 'auto' },
        keepLines: true,
      }))
    }
    i++
  }
  return paragraphs
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

export async function exportAuMathDocx({ auTexte, chapitre, niveau, typeEnseignement }) {
  const date    = new Date().toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })
  const niveauL = NIVEAUX.find(n => n.value === niveau)?.label ?? niveau ?? ''
  const typeL   = TYPES_ENSEIGNEMENT.find(t => t.value === typeEnseignement)?.label ?? typeEnseignement ?? ''

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 24 } } } },
    sections: [{
      properties: { page: { margin: { top: 720, right: 850, bottom: 720, left: 850 } } },
      headers: { default: makeHeader('Document AU universel', date) },
      children: [
        new Paragraph({
          children: [new TextRun({ text: chapitre ? `${chapitre} — Aménagements Universels` : 'Document — Aménagements Universels', bold: true, color: BRAND_TEAL, size: 36 })],
          heading: HeadingLevel.TITLE,
          spacing: { after: 160 },
        }),
        ...metaTable([
          ['Chapitre', chapitre || '—'],
          ['Niveau',   niveauL  || '—'],
          ['Type',     typeL    || '—'],
          ['Date',     date],
        ]),
        spacer(),
        sectionTitle('Document avec Aménagements Universels'),
        ...parseMathText(auTexte),
        spacer(),
        new Paragraph({
          children: [new TextRun({
            text: 'Sources RISS — CUA : Rusconi (2025) W4414205903 · Alvarez (2024) W4402615917  |  Maths & IA : Mahi Haddad & Beaud (2025) dumas-05106961',
            size: 16, color: GRAY_TEXT, italics: true,
          })],
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' } },
          spacing: { before: 600, after: 200 },
          pageBreakBefore: false,
        }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `MathActif_AU_${(chapitre || 'cours').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`)
}

export async function exportProfilMathDocx({ profil, auTexte, conseilsTexte, chapitre, niveau, typeEnseignement, arMode = false }) {
  const profilDef   = PROFILS.find(p => p.value === profil)
  const profilLabel = profilDef?.label ?? profil
  const date    = new Date().toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })
  const niveauL = NIVEAUX.find(n => n.value === niveau)?.label ?? niveau ?? ''
  const typeL   = TYPES_ENSEIGNEMENT.find(t => t.value === typeEnseignement)?.label ?? typeEnseignement ?? ''
  const bodySize = arMode ? 28 : 24

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: bodySize } } } },
    sections: [{
      properties: { page: { margin: { top: 720, right: 850, bottom: 720, left: 850 } } },
      headers: { default: makeHeader(`Version ${profilLabel}`, date) },
      children: [
        new Paragraph({
          children: [new TextRun({ text: `${chapitre || 'Mathématiques'} — Version ${profilLabel}`, bold: true, color: BRAND_TEAL, size: 36 })],
          heading: HeadingLevel.TITLE,
          spacing: { after: 160 },
        }),
        ...metaTable([
          ['Chapitre', chapitre   || '—'],
          ['Niveau',   niveauL    || '—'],
          ['Profil',   profilLabel],
          ['Date',     date],
        ]),
        spacer(),
        sectionTitle('Document avec Aménagements Universels'),
        ...parseMathText(auTexte),
        spacer(),
        new Paragraph({ text: '', pageBreakBefore: true }),
        sectionTitle(`Conseils spécifiques — ${profilLabel}`),
        ...parseMathText(conseilsTexte),
        spacer(),
        new Paragraph({
          children: [new TextRun({
            text: 'Sources RISS — Dyscalculie : Thibaut (2016) dumas-01488139 · Le Cam & Toussaint (2017) dumas-01549091  |  Mahi Haddad & Beaud (2025) dumas-05106961',
            size: 16, color: GRAY_TEXT, italics: true,
          })],
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' } },
          spacing: { before: 600, after: 200 },
          pageBreakBefore: false,
        }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `MathActif_${profil}_${(chapitre || 'cours').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`)
}
