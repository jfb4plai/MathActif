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
