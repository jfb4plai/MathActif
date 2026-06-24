/**
 * POST /api/extract
 * Body  : { images: string[] }  // base64 JPEG, max 6 pages (PDF scanné ou image)
 * Return: { text: string }
 *
 * Pipeline maths : Vision OCR maths → Haiku cohérence légère
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  const { images } = req.body
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'images[] requis' })
  }
  if (images.length > 6) {
    return res.status(400).json({ error: 'Maximum 6 pages par requête.' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Clé API manquante' })

  const HEADERS = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }

  const SYSTEM_OCR = `Tu es un OCR expert pour documents mathématiques scolaires (FWB — niveaux S3 à S6).

ÉTAPE 1 — IDENTIFICATION DU CONTEXTE :
Détermine le niveau (S3/S4/S5/S6), le chapitre mathématique (algèbre, géométrie, trigonométrie, analyse…) et le type d'exercice dominant.

ÉTAPE 2 — TRANSCRIPTION FIDÈLE :
- Extrais TOUT le texte dans l'ordre naturel de lecture.
- Les blancs à remplir (______, .......) → transcris-les tels quels. Ne jamais les compléter.

ÉTAPE 2b — SYMBOLES MATHÉMATIQUES (priorité absolue) :
- × (multiplication) → jamais "x" ni "X" — toujours ×
- ÷ (division posée) → ÷
- − (signe moins) → toujours le signe moins Unicode −, jamais le tiret court -
- EXPOSANTS — règle critique : TOUJOURS utiliser les caractères Unicode ² ³ ⁴ ⁿ
  Exemples : x² (pas x^2, pas x2), -2x² (pas -2x2), 4x² - 5x + 3 (pas 4x2)
  Si l'exposant est une expression : x^(n+1) avec le caret est acceptable
- DÉRIVÉES : f'(x) avec apostrophe droite ', jamais f prime(x) ni f´(x)
- √ (racine carrée) → √, jamais "V" ni "sq"
- π → π, jamais "pi"
- ≤ ≥ ≠ → ces symboles, jamais "<=" ">=" "!="
- Δ (discriminant) → Δ, jamais "delta" ni "D"
- INTÉGRALES — règle critique : le signe ∫ est TOUJOURS transcrit en LaTeX $\int$
  Jamais "et", jamais "ʃ", jamais le caractère Unicode ∫ seul hors LaTeX
  Format : $\int f(x)\,dx$ ou $\int (expr)\,dx$
  Exemples : $\int (3x^4+5x^2-2x+1)/\sqrt{x^2}\,dx$  $\int \frac{2x+1}{x-3}\,dx$  $\int 3^x\,dx$
  Si l'intégrale contient une fraction verticale, utiliser \frac : $\int \frac{numérateur}{dénominateur}\,dx$
  Ne JAMAIS utiliser \begin{aligned}...\end{aligned} pour une intégrale simple — juste $\int ...$
- Fractions verticales → TOUJOURS en notation LaTeX : $\frac{numérateur}{dénominateur}$
  Exemples : $\frac{-4x+1}{-5x-3}$  $\frac{3x+2}{-2x²+4x-4}$  $\frac{x}{x}$
  Ne jamais écrire (A)/(B) sur une ligne — toujours $\frac{A}{B}$
  Si la fraction est dans une expression plus longue : f(x) = $\frac{-4x+1}{-5x-3}$
- Systèmes d'équations (accolade + lignes) → chaque ligne sur sa propre ligne, préfixée "{ "
- Tableaux de valeurs → conserver " | " comme séparateur
- Ne jamais confondre la lettre "x" (variable) avec × (multiplication) — le contexte (entouré de chiffres) tranche.

ÉTAPE 3 — CONTRÔLE DE COHÉRENCE :
- Vérifier la cohérence des expressions mathématiques.
- Ne jamais "corriger" un symbole mathématique par un mot.
- Pour tout passage illisible : [?texte douteux?] — jamais sur des blancs d'exercice.

Retourne uniquement le texte extrait. Ne commente pas.`

  try {
    // Étape 1 — Vision OCR maths (Sonnet)
    const ocrContent = [
      ...images.map(img => ({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: img },
      })),
      { type: 'text', text: 'Extrais le contenu mathématique de ce document.' },
    ]

    const ocrResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_OCR,
        messages: [{ role: 'user', content: ocrContent }],
      }),
    })

    if (!ocrResp.ok) {
      if (ocrResp.status === 504) return res.status(504).json({ error: 'Délai dépassé — réduisez à 4 pages.' })
      const e = await ocrResp.json().catch(() => ({}))
      return res.status(500).json({ error: e.error?.message ?? 'Erreur OCR Vision' })
    }

    const ocrData = await ocrResp.json()
    const textOcr = ocrData.content[0].text.trim()

    // Étape 2 — Cohérence légère (Haiku)
    const verifResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: `Tu vérifies la cohérence d'un texte OCR mathématique.
Corrige uniquement les symboles manifestement mal reconnus (ex : "x" à la place de "×" entre deux chiffres).
Ne touche pas aux variables algébriques, aux blancs "......" ni aux expressions correctes.
Ne modifie pas la structure. Retourne le texte corrigé directement, sans commentaire.`,
        messages: [{
          role: 'user',
          content: `Texte OCR maths :\n\n${textOcr}\n\nCorrige les seules erreurs manifestes de symboles.`,
        }],
      }),
    })

    if (!verifResp.ok) {
      return res.status(200).json({ text: textOcr })
    }

    const verifData = await verifResp.json()
    const text = verifData.content[0].text.trim()
    return res.status(200).json({ text })

  } catch (err) {
    return res.status(500).json({ error: `Erreur OCR : ${err.message}` })
  }
}
