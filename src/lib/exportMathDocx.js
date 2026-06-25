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
    .replace(/\\int/g, '∫')
    .replace(/\\sum/g, 'Σ')
    .replace(/\\prod/g, 'Π')
    .replace(/\\lim/g, 'lim')
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
  return /\\begin|\\end|\\matrix|\\pmatrix|\\bmatrix/.test(latex)
    || (latex.match(/\\frac/g) || []).length > 1
}

/**
 * Convertit les blocs $LaTeX$ simples en Unicode lisible.
 * Exclut \frac (géré par expandAllFractions) et \begin/\end (matrices — trop complexe).
 * Pipeline : greques → opérateurs → √ → exposants → indices → nettoyage accolades.
 */
function expandLatexToUnicode(text) {
  if (!text) return text

  const SUPER = {
    '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
    'n':'ⁿ','i':'ⁱ','k':'ᵏ','x':'ˣ','a':'ᵃ','b':'ᵇ','p':'ᵖ',
  }
  const SUB = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉' }

  const SYMBOLS = {
    '\\pi':'π','\\Pi':'Π','\\alpha':'α','\\beta':'β','\\gamma':'γ','\\Gamma':'Γ',
    '\\delta':'δ','\\Delta':'Δ','\\epsilon':'ε','\\varepsilon':'ε',
    '\\theta':'θ','\\Theta':'Θ','\\lambda':'λ','\\mu':'μ','\\nu':'ν','\\xi':'ξ',
    '\\sigma':'σ','\\Sigma':'Σ','\\tau':'τ','\\phi':'φ','\\Phi':'Φ',
    '\\chi':'χ','\\psi':'ψ','\\Psi':'Ψ','\\omega':'ω','\\Omega':'Ω',
    '\\infty':'∞','\\pm':'±','\\mp':'∓',
    '\\times':'×','\\div':'÷','\\cdot':'·','\\circ':'∘',
    '\\leq':'≤','\\geq':'≥','\\neq':'≠','\\approx':'≈','\\sim':'∼',
    '\\in':'∈','\\notin':'∉','\\subset':'⊂','\\supset':'⊃',
    '\\cup':'∪','\\cap':'∩','\\emptyset':'∅',
    '\\to':'→','\\rightarrow':'→','\\leftarrow':'←',
    '\\Rightarrow':'⇒','\\Leftarrow':'⇐','\\Leftrightarrow':'⟺',
    '\\forall':'∀','\\exists':'∃',
    '\\partial':'∂','\\nabla':'∇',
    '\\int':'∫','\\iint':'∬','\\oint':'∮',
    '\\sum':'Σ','\\prod':'Π',
    '\\lim':'lim','\\min':'min','\\max':'max',
    '\\sin':'sin','\\cos':'cos','\\tan':'tan',
    '\\arcsin':'arcsin','\\arccos':'arccos','\\arctan':'arctan',
    '\\ln':'ln','\\log':'log','\\exp':'exp',
    '\\ldots':'…','\\cdots':'⋯',
  }

  return text.replace(/\$([^$]+)\$/g, (match, inner) => {
    // Fraction PURE $\frac{A}{B}$ → laisser expandAllFractions faire le bloc 3 lignes
    if (/^\\frac\{/.test(inner.trim())) return match
    if (/\\begin|\\end/.test(inner)) return `[${latexToUnicode(inner)}]`

    let out = inner
    // 0a. Espaces LaTeX (thin/medium/hard) → espace simple
    out = out.replace(/\\[,;:! ]/g, ' ')
    // 0b. \left \right → supprimer seulement devant un délimiteur, pas \rightarrow
    out = out.replace(/\\(?:left|right)(?=[^a-zA-Z])/g, '')
    // 0c. Racines nièmes : \sqrt[N]{expr} — avant le handler \sqrt{...} ci-dessous
    out = out.replace(/\\sqrt\[3\]\{([^}]+)\}/g, (_, e) => `∛(${e})`)
    out = out.replace(/\\sqrt\[4\]\{([^}]+)\}/g, (_, e) => `∜(${e})`)
    out = out.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, (_, n, e) => `[${n}]√(${e})`)
    // 0d. Fractions inline \frac{A}{B} — parens seulement si expression composée (+ ou -)
    out = out.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, (_, n, d) => {
      const wrap = s => { const t = s.trim(); return (t.startsWith('(') || !/[+\-]/.test(t)) ? t : `(${t})` }
      return `${wrap(n)}/${wrap(d)}`
    })
    // 1. Symboles grecs et opérateurs — lookahead (?![a-zA-Z]) évite \in de corrompre \int
    for (const [cmd, sym] of Object.entries(SYMBOLS)) {
      const escaped = cmd.replace(/\\/g, '\\\\')
      out = out.replace(new RegExp(escaped + '(?![a-zA-Z])', 'g'), sym)
    }
    // 2. Racines carrées : \sqrt{expr}
    out = out.replace(/\\sqrt\{([^}]+)\}/g, (_, e) => e.length <= 2 ? `√${e}` : `√(${e})`)
    out = out.replace(/\\sqrt\s*([a-zA-Z0-9])/g, '√$1')
    // 3. Exposants : ^{expr} ou ^c
    out = out.replace(/\^\{([^}]+)\}/g, (_, e) =>
      e.length === 1 && SUPER[e] ? SUPER[e] : `^(${e})`
    )
    out = out.replace(/\^([0-9nxkiabp])/g, (_, e) => SUPER[e] || `^${e}`)
    // 4. Indices : _{expr} ou _c
    out = out.replace(/\_\{([^}]+)\}/g, (_, s) =>
      s.length === 1 && SUB[s] ? SUB[s] : `_(${s})`
    )
    out = out.replace(/_([0-9])/g, (_, s) => SUB[s] || `_${s}`)
    // 5. Nettoyage accolades et commandes LaTeX restantes
    out = out.replace(/[{}]/g, '')
    out = out.replace(/\\([a-zA-Z]+)/g, '$1')   // \foo → foo
    out = out.replace(/\\/g, '')               // backslashes résiduels (\ , \( , etc.)
    return out
  })
}

/**
 * Expand $\frac{A}{B}$ → 3 lines : A / ─────── / B
 * Applied before parseMathText so fractionParagraphs() can render them.
 * Also handles plain-text fractions (A)/(B) as fallback.
 */
function expandAllFractions(text) {
  if (!text) return text
  // 1. D'abord convertir tous les $LaTeX$ simples en Unicode
  let out = expandLatexToUnicode(text)
  // 2. LaTeX fractions : $\frac{A}{B}$
  out = out.replace(
    /\$\\frac\{([^}]+)\}\{([^}]+)\}\$/g,
    (_, num, den) => {
      const n = num.trim()
      const d = den.trim()
      return `${n}\n${'─'.repeat(Math.max(n.length, d.length, 6))}\n${d}`
    }
  )
  // Fallback : (A)/(B) — seulement si A et B contiennent des maths (chiffres/variables)
  // Évite de découper les lignes "Données : u(x) = (-4x+1)" qui ne sont pas des fractions
  out = out.replace(
    /(\([^()]{2,60}\))\s*\/\s*(\([^()]{2,60}\))/g,
    (match, num, den) => {
      // Ne remplacer que si les deux termes ressemblent à des expressions mathématiques
      const isMath = s => /[0-9x²³]/.test(s) && /[+\-]/.test(s)
      if (!isMath(num) || !isMath(den)) return match
      const n = num.trim()
      const d = den.trim()
      return `${n}\n${'─'.repeat(Math.max(n.length, d.length, 6))}\n${d}`
    }
  )
  return out
}

function renderMathLine(line) {
  const parts = line.split(/(\$[^$\n]+\$)/g)
  return parts.flatMap((part, i) => {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      const latex = part.slice(1, -1)
      // expandLatexToUnicode gère déjà la conversion — les $...$ résiduels
      // sont des cas complexes (\begin, fractions imbriquées) : rendu noir sans $
      const display = isComplexLatex(latex)
        ? `[${latexToUnicode(latex)}]`
        : latexToUnicode(latex)
      return [new TextRun({ text: display })]
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

/**
 * Convertit les fractions texte (A)/(B) ou A/B en format 3 lignes avec barre ─────
 * Appelé sur le texte AVANT parseMathText pour garantir un rendu visuel correct.
 * Ne touche pas aux tokens «MATH_N» ni aux blocs $LaTeX$.
 */

function isFractionBar(line) {
  return /^─{3,}$/.test(line.trim())
}

function fractionParagraphs(num, den, keepNextAfter = false) {
  const barLen = Math.max(num.length, den.length, 6)
  const bar = '─'.repeat(barLen)
  return [
    new Paragraph({
      alignment: 'center',
      children: renderMathLine(num),
      spacing: { after: 0, before: 80 },
      keepLines: true,
      keepNext: true,   // numérateur toujours collé à la barre
    }),
    new Paragraph({
      alignment: 'center',
      children: [new TextRun({ text: bar, color: BRAND_TEAL, bold: true })],
      spacing: { after: 0, before: 0 },
      keepNext: true,   // barre toujours collée au dénominateur
    }),
    new Paragraph({
      alignment: 'center',
      children: renderMathLine(den),
      spacing: { after: 100, before: 0 },
      keepNext: keepNextAfter,  // le dénominateur reste avec la suite si le bloc continue
    }),
  ]
}

function blockContinues(lines, i) {
  for (let j = i + 1; j < lines.length; j++) {
    const t = lines[j].trim()
    if (!t) return false
    if (t) return true
  }
  return false
}

/**
 * Regarde en avant (jusqu'à 2 lignes vides) pour détecter du contenu AU
 * (Zone de travail, Données, Inconnue, lignes ___).
 * Permet de chaîner keepNext même quand Haiku insère une ligne vide
 * entre l'énoncé et la zone de travail.
 */
function hasAuContentAhead(lines, i) {
  let blanks = 0
  for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
    const t = lines[j].trim()
    if (!t) {
      blanks++
      if (blanks > 2) return false
      continue
    }
    return /^(Zone de travail|Données\s*:|Inconnue|_{5,})/i.test(t)
  }
  return false
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
      const keepNextAfter = blockContinues(lines, i + 2) || hasAuContentAhead(lines, i + 2)
      paragraphs.push(...fractionParagraphs(trimmed, lines[i + 2].trim(), keepNextAfter))
      i += 3
      continue
    }

    if (!trimmed) {
      // Si du contenu AU suit (Zone de travail, Données, ___), le spacer doit
      // garder keepNext pour ne pas rompre la chaîne de pagination.
      const zdtAhead = hasAuContentAhead(lines, i)
      paragraphs.push(zdtAhead
        ? new Paragraph({ text: '', spacing: { after: 160 }, keepNext: true })
        : spacer()
      )
      i++
      continue
    }
    if (/^\[saut_de_page\]/i.test(trimmed)) {
      paragraphs.push(new Paragraph({ text: '', pageBreakBefore: true })); i++; continue
    }
    if (isFractionBar(trimmed)) { i++; continue }

    // Strip markdown bold markers (**...**) produits par Haiku
    const display = trimmed.replace(/^\*\*(.+)\*\*$/, '$1')
    const isTitle = /^(Exercice|Étape|Section|RAPPEL|##|AE|AU)\s/.test(display)
    // keepNext : bloc non terminé OU contenu AU détecté dans les prochaines lignes
    const stays = blockContinues(lines, i) || hasAuContentAhead(lines, i)

    if (isTitle) {
      paragraphs.push(new Paragraph({
        children: renderMathLine(display.replace(/^#+\s*/, '')),
        spacing: { before: 200, after: 60 },
        keepNext: true,
      }))
    } else {
      paragraphs.push(new Paragraph({
        children: renderMathLine(display),
        spacing: { after: 100, line: 360, lineRule: 'auto' },
        keepLines: true,
        keepNext: stays,
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
        ...parseMathText(expandAllFractions(auTexte)),
        spacer(),
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
        ...parseMathText(expandAllFractions(auTexte)),
        spacer(),
        new Paragraph({ text: '', pageBreakBefore: true }),
        sectionTitle(`Conseils spécifiques — ${profilLabel}`),
        ...parseMathText(expandAllFractions(conseilsTexte)),
        spacer(),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `MathActif_${profil}_${(chapitre || 'cours').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`)
}
