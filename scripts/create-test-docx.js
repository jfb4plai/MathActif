/**
 * Génère test-maths-s3s6.docx avec équations OMML valides.
 * Usage : node scripts/create-test-docx.js
 */

import JSZip from 'jszip'
import { writeFileSync } from 'fs'

// ── OMML minimal et valide ────────────────────────────────────────────────────
// m:r sans font explicite — Word applique Cambria Math automatiquement

const mR   = t  => `<m:r><m:t xml:space="preserve">${t}</m:t></m:r>`
const mSup = (b, e) => `<m:sSup><m:e>${b}</m:e><m:sup>${e}</m:sup></m:sSup>`
const mSub = (b, s) => `<m:sSub><m:e>${b}</m:e><m:sub>${s}</m:sub></m:sSub>`
const mFrac = (n, d) => `<m:f><m:num>${n}</m:num><m:den>${d}</m:den></m:f>`
const mSqrt = c => `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${c}</m:e></m:rad>`
const math  = c => `<m:oMathPara><m:oMath>${c}</m:oMath></m:oMathPara>`

const para  = t => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`
const titre = t => `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${t}</w:t></w:r></w:p>`
const bold  = t => `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`

// ── Équations ─────────────────────────────────────────────────────────────────

const eq1  = math(mR('a') + mSup(mR('x'), mR('2')) + mR('+bx+c=0'))
const eq2  = math(mR('x=') + mFrac(mR('-b±') + mSqrt(mSup(mR('b'), mR('2')) + mR('-4ac')), mR('2a')))
const eq3  = math(mR('Δ=') + mSup(mR('b'), mR('2')) + mR('-4ac'))
const eq4  = math(mR("f'(x)=3") + mSup(mR('x'), mR('2')) + mR('-2x+1'))
const eq5  = math(mSup(mR('sin'), mR('2')) + mR('(x)+') + mSup(mR('cos'), mR('2')) + mR('(x)=1'))
const eq6  = math(mSub(mR('log'), mR('a')) + mR('(xy)=') + mSub(mR('log'), mR('a')) + mR('(x)+') + mSub(mR('log'), mR('a')) + mR('(y)'))
const eq7  = math(mFrac(mR('2x+1'), mR('x-3')) + mR('=5'))
const eq8  = math(mSup(mR('a'), mR('2')) + mR('+') + mSup(mR('b'), mR('2')) + mR('=') + mSup(mR('c'), mR('2')))
const eq9  = math(mSqrt(mSup(mR('x'), mR('2')) + mR('+4')) + mR('=x+2'))
const eq10 = math(mSup(mR('(x+1)'), mR('2')) + mR('=') + mSup(mR('x'), mR('2')) + mR('+2x+1'))

// ── Fichiers DOCX ─────────────────────────────────────────────────────────────

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`

const relsMain = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const relsDoc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:asciiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia" w:hAnsiTheme="minorHAnsi" w:cstheme="minorBidi"/>
      <w:sz w:val="24"/><w:szCs w:val="24"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr>
      <w:spacing w:after="160" w:line="259" w:lineRule="auto"/>
    </w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:pPr><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="0a9370"/><w:sz w:val="28"/></w:rPr>
  </w:style>
</w:styles>`

const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:compat>
    <w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>
  </w:compat>
</w:settings>`

const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
<w:body>

${bold('TEST MATHACTIF — Équations S3-S6 FWB')}
${para('Ce fichier vérifie la lecture des équations Word (OMML) par MathActif.')}

${titre('1. Trinôme du second degré')}
${para('Forme générale :')}
${eq1}
${para('Formule des racines :')}
${eq2}
${para('Discriminant :')}
${eq3}

${titre('2. Analyse')}
${para("Dérivée d'un polynôme :")}
${eq4}

${titre('3. Trigonométrie')}
${para('Identité fondamentale :')}
${eq5}

${titre('4. Logarithmes')}
${para('Propriété du produit :')}
${eq6}

${titre('5. Exercices types')}
${para('Résoudre dans R :')}
${eq7}
${para('Théorème de Pythagore :')}
${eq8}
${para('Résoudre :')}
${eq9}
${para('Identité remarquable :')}
${eq10}

<w:sectPr>
  <w:pgSz w:w="12240" w:h="15840"/>
  <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
</w:sectPr>
</w:body>
</w:document>`

const zip = new JSZip()
zip.file('[Content_Types].xml', contentTypes)
zip.file('_rels/.rels', relsMain)
zip.file('word/document.xml', document)
zip.file('word/_rels/document.xml.rels', relsDoc)
zip.file('word/styles.xml', styles)
zip.file('word/settings.xml', settings)

const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
writeFileSync('test-maths-s3s6.docx', buf)
console.log('✓ test-maths-s3s6.docx généré')
