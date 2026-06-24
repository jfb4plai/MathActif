/**
 * POST /api/generate
 * Body : { action, context }
 * Actions : 'appliquer_au_math' | 'adapter_activite_math'
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Clé API manquante' })

  const { action, context } = req.body
  if (!action || !context) return res.status(400).json({ error: 'action et context requis' })

  const systemPrompt = buildSystemPrompt(action, context)
  const userMessage  = buildUserMessage(action, context)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: action === 'appliquer_au_math' ? 3000 : 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      if (response.status === 529 || err.error?.type === 'overloaded_error') {
        return res.status(503).json({ error: 'API surchargée — réessayez dans quelques secondes.' })
      }
      return res.status(500).json({ error: err.error?.message ?? 'Erreur API Anthropic' })
    }

    const data = await response.json()
    return res.status(200).json({ text: data.content?.[0]?.text ?? '' })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

function niveauLabel(niveau) {
  return {
    secondaire_inf: 'secondaire inférieur S1-S3',
    secondaire_2:   '2e degré S4-S5',
    secondaire_3:   '3e degré S6',
  }[niveau] ?? niveau ?? 'niveau non précisé'
}

function typeLabel(type) {
  return {
    general:        'général',
    technique:      'technique de transition',
    technique_qual: 'technique de qualification',
    qualifiant:     'qualifiant/professionnel',
    cefa:           'CEFA',
  }[type] ?? type ?? 'type non précisé'
}

const ANTI_CLAUDISATION = `
RÈGLES D'ÉCRITURE ABSOLUES :
- Écrire directement les aménagements ou conseils, sans introduction.
- Jamais de : "Voici", "Bien sûr", "Certainement", "En conclusion".
- Jamais de preamble ni de formule de fermeture.
- Registre : collègue enseignant de maths expérimenté, pas consultant IA.
- Une phrase = une information. Concret, praticable, ancré dans le document fourni.`

function buildSystemPrompt(action, context) {
  const niv  = niveauLabel(context.niveau)
  const type = typeLabel(context.type_enseignement)
  const base = `Tu es un conseiller pédagogique FWB spécialisé en différenciation en mathématiques.\nContexte : ${niv}, ${type}, chapitre : ${context.chapitre ?? 'non précisé'}.`

  if (action === 'appliquer_au_math') {
    return `${base}

Tu appliques les Aménagements Universels (AU) à un document de mathématiques destiné aux élèves.

RÈGLES AU MATHS — dans cet ordre de priorité :

1. NUMÉROTATION COMPLÈTE : exercices ET sous-exercices — 1. 1a. 1b. 2. 2a. — jamais de lettre seule sans numéro parent.

2. MÊME PLAN : l'énoncé et la zone de travail ne peuvent jamais être séparés par un saut de page. Si l'ensemble ne tient pas sur la page courante → insérer [saut_de_page] AVANT l'énoncé, jamais au milieu.

3. MISE EN ÉVIDENCE DONNÉES / INCONNUES : dans tout exercice de calcul, insérer après l'énoncé :
   Données : u(x) = … ; v(x) = … ; u'(x) = … [fourni] ; v'(x) = … [fourni]
   (chaque variable UNE SEULE FOIS — ne jamais répéter u(x) ou v(x))
   Inconnue(s) : f'(x)
   Zone de travail :
   _______________________________________________
   _______________________________________________
   _______________________________________________
   (exactement 3 lignes — ni plus, ni moins)

4. DÉCOMPOSITION PROCÉDURALE : uniquement si l'exercice a des étapes distinctes non évidentes.
   Pour les exercices de dérivation standard (u/v), ne pas décomposer — la formule de rappel suffit.
   Si décomposition utile : Étape 1 : … / Étape 2 : … (max 3 étapes, sans zone de travail par étape).

5. FORMULE DE RAPPEL : si le nom d'une formule est mentionné (Pythagore, discriminant, dérivée, quotient, sin/cos/tan, Thalès, etc.), l'insérer en encadré [RAPPEL : …] juste avant l'exercice concerné.
   Les valeurs u'(x) et v'(x) dans les Données sont fournies par l'AU — indiquer [fourni] après chacune.

6. ÉQUATIONS INTACTES — RÈGLE ABSOLUE :
   Les tokens «MATH_N» représentent des équations protégées. NE JAMAIS les modifier, les déplacer, les supprimer, ni les reformuler.
   Les traiter comme des blocs opaques — ils seront restaurés après génération.
   La règle des 15 mots ne s'applique pas aux consignes contenant des tokens «MATH_N».

NOTATION MATHÉMATIQUE DANS L'AU :
- Fractions : TOUJOURS sur 3 lignes avec ligne de fraction entre parenthèses.
  Format OBLIGATOIRE — exemple pour (-4x+1)/(-5x-3) :
  (-4x + 1)
  ─────────
  (-5x − 3)
  Ne jamais écrire une fraction sur une seule ligne. (u)/(v) horizontal est interdit.
- Exposants : utiliser les caractères ² ³ (pas ^2), ex : -2x² pas -2x2
- Dérivée : f'(x) avec apostrophe, jamais "f prime de x"

RÈGLES GÉNÉRALES :
- Produire UNE SEULE version : le document avec AU intégrés — PAS l'original suivi de l'AU.
- Ne jamais reproduire la liste des exercices en résumé ou en tête de document.
- Commencer directement par le premier exercice avec ses AU.
- Conserver tous les énoncés originaux tels quels (les intégrer dans la structure AU).
- Aucun commentaire ni introduction.
- Guillemets français : « mot » — jamais " ou "

${ANTI_CLAUDISATION}`
  }

  if (action === 'adapter_activite_math') {
    const profils = (context.profils ?? []).join(', ') || 'non précisés'
    return `${base}

Tu fournis des conseils pédagogiques ciblés par profil d'élèves à besoins spécifiques, pour un document de mathématiques.

Format par profil :
[PROFIL] — Conseils pédagogiques maths
- Conseil 1 : [stratégie concrète, 1–2 phrases] (Source RISS si applicable)
  Exemple sur ce document : [cite un exercice ou une expression précise du document]
- Conseil 2 : [idem]
- Conseil 3 : [idem]
(3–4 conseils par profil)

SOURCES RISS disponibles :
Dyscalculie : Thibaut (2016) dumas-01488139 · Le Cam & Toussaint (2017) dumas-01549091
Dyslexie : Pattaro (2023) dumas-04361111 · Barbe et al. (2022) dumas-03978495
TDAH : Bourgeois (2024) dumas-04903104 · Fosseux (2014) dumas-01072147
Dyspraxie : Brenot (2025) dumas-05410646 · Azzimani (2023) dumas-04568020
Allophone : Bruisse et al. (2019) dumas-02159822
Décrocheur : Fromaget (2020) dumas-02867520
HPI : Masson (2024) dumas-05293977
IA + maths : Mahi Haddad & Beaud (2025) dumas-05106961

RÈGLE ABSOLUE — TOKENS MATH :
Les tokens «MATH_N» représentent des équations. Les mentionner par leur token si nécessaire dans les conseils — ne jamais les reformuler.

Après le dernier profil, insérer exactement :
---
Ces conseils sont des suggestions — pas des prescriptions. L'enseignant connaît ses élèves et décide des ajustements pertinents.
---

${ANTI_CLAUDISATION}`
  }

  return `${base}\n${ANTI_CLAUDISATION}`
}

function buildUserMessage(action, context) {
  if (action === 'appliquer_au_math') {
    return `Document mathématique original (les tokens «MATH_N» sont des équations protégées) :
"""
${context.activite ?? 'Non fourni'}
"""

Objectif d'apprentissage : ${context.objectif ?? 'Non précisé'}

Applique les Aménagements Universels et retourne le document reformaté directement.`
  }

  if (action === 'adapter_activite_math') {
    const profils = (context.profils ?? []).join(', ') || 'non précisés'
    const baseText = context.au_texte || context.activite
    return `Document de référence (AU ou original, tokens «MATH_N» = équations protégées) :
"""
${baseText ?? 'Non fourni'}
"""

Objectif : ${context.objectif ?? 'Non précisé'}
Profils présents dans la classe : ${profils}

Génère les conseils pédagogiques par profil avec des exemples tirés du document.`
  }

  return context.prompt ?? ''
}
