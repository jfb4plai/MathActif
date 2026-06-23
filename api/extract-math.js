/**
 * POST /api/extract-math
 * Body : { xml: string }  — contenu brut de word/document.xml
 * Return: { text: string } — texte reconstitué avec équations en $LaTeX$
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  const { xml } = req.body
  if (!xml || typeof xml !== 'string') return res.status(400).json({ error: 'xml requis' })
  if (xml.length > 500_000) return res.status(400).json({ error: 'Document trop volumineux (max ~500 Ko XML).' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Clé API manquante' })

  const SYSTEM = `Tu es un extracteur de contenu pour documents Word de mathématiques (FWB — Fédération Wallonie-Bruxelles, niveaux S3 à S6).

Tu reçois le XML brut du fichier word/document.xml d'un .docx Word.

MISSION : Extraire le contenu dans l'ordre de lecture et retourner UNIQUEMENT le texte reconstitué, sans aucun commentaire.

RÈGLES D'EXTRACTION :

1. TEXTE ORDINAIRE — transcrire tel quel, dans l'ordre de lecture.

2. ÉQUATIONS (<m:oMath> … </m:oMath>) — convertir en LaTeX inline entre $…$ :
   - Addition/soustraction : + −
   - Multiplication : \\times
   - Fraction : \\frac{numérateur}{dénominateur}
   - Puissance : x^{2}
   - Racine : \\sqrt{x}
   - Égalité, inégalités : = \\leq \\geq \\neq
   - Delta discriminant : \\Delta
   - Infini : \\infty
   - Appartenance : \\in \\mathbb{R} \\mathbb{N} \\mathbb{Z}
   - Pi : \\pi
   - Angle : \\angle
   - Fonctions trig : \\sin \\cos \\tan
   - Si la structure OMML est ambiguë → retranscris au mieux et continue.

3. TABLEAUX (<w:tbl>) — conserver la structure avec | comme séparateur de colonnes, une ligne par rangée.

4. IMAGES (<w:drawing>) — ignorer complètement (pas de description, pas de placeholder).

5. SAUTS DE PAGE (<w:lastRenderedPageBreak> ou <w:br w:type="page">) — insérer une ligne vide.

6. STYLES DE TITRE (<w:pStyle w:val="Heading…">) — insérer ## avant le texte du titre.

INTERDIT : ajouter des commentaires, des explications, des balises HTML, du Markdown autre que ## pour les titres. Retourner uniquement le texte extrait.`

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Extrais le contenu de ce word/document.xml :\n\n${xml}` }],
      }),
    })

    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}))
      if (resp.status === 504) return res.status(504).json({ error: 'Délai dépassé — document trop volumineux.' })
      return res.status(500).json({ error: e.error?.message ?? 'Erreur API Anthropic' })
    }

    const data = await resp.json()
    const text = data.content[0].text.trim()
    return res.status(200).json({ text })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
