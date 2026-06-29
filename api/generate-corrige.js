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
