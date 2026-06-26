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
   Données : u(x) = [valeur extraite] ; v(x) = [valeur extraite] ; u'(x) = [valeur calculée] [fourni] ; v'(x) = [valeur calculée] [fourni]
   (chaque variable UNE SEULE FOIS — ne jamais répéter u(x) ou v(x))
   (NE JAMAIS écrire "…" ou "..." dans le document — toujours extraire la valeur réelle de l'énoncé)
   Inconnue(s) : f'(x)
   Zone de travail :
   _______________________________________________
   _______________________________________________
   _______________________________________________
   (exactement 3 lignes — ni plus, ni moins)

4. MÉTHODE — ÉTAPES (section sur la première page, avant le premier exercice) :
   Insérer une section décrivant la PROCÉDURE MATHÉMATIQUE SPÉCIFIQUE au type d'exercices du document.
   INTERDIT : généralités du type "lire l'énoncé", "vérifier le résultat", "identifier les données".
   INTERDIT ABSOLU : le terme "dérivées partielles" (dérivées partielles = calcul multivariable ∂f/∂x, hors programme S6 FWB).
   OBLIGATOIRE : les étapes nomment les objets mathématiques du programme S3-S6 FWB : primitive F(x), substitution u=g(x), formule d'intégration, règle de dérivation, etc.
   VOCABULAIRE CORRECT pour l'intégration : "primitive", "formule d'intégration", "substitution u=...", "intégrale directe" — JAMAIS "dérivée partielle".

   Exemple CORRECT pour calcul de primitives (intégrales directes + substitution) :
   Méthode — Calcul de primitives
   Étape 1 : Reconnaître la forme — intégrale directe (∫xⁿ, ∫sin x, ∫cos x, ∫eˣ...) ou composée (substitution)
   Étape 2 : Pour une forme directe — appliquer la formule de primitive correspondante
   Étape 3 : Pour une forme composée — poser u = [partie interne] et calculer du = u'(x)dx
   Étape 4 : Réécrire l'intégrale entièrement en u et du, puis intégrer en u
   Étape 5 : Remplacer u par son expression en x — ajouter + C
   Étape 6 : Contrôle : dériver F(x) doit redonner f(x)

   Exemple CORRECT pour dérivation (règle du quotient) :
   Méthode — Dérivation par la règle du quotient
   Étape 1 : Identifier u(x) = numérateur, v(x) = dénominateur
   Étape 2 : Calculer u'(x) et v'(x)
   Étape 3 : Appliquer f'(x) = (u'v − uv') / v²

   Format OBLIGATOIRE (adapter au type réel du document) :
   Méthode — [nom mathématique précis du chapitre, ex : Calcul de primitives]
   Étape 1 : [action mathématique concrète avec vocabulaire FWB correct]
   ...
   (4 à 6 étapes — pas de [saut_de_page] après cette section)

5. FORMULE DE RAPPEL : insérer [RAPPEL : formule] juste avant l'exercice qui l'utilise pour la première fois.
   Ne pas répéter le même RAPPEL pour chaque exercice — une seule fois par type de formule.
   Formules d'intégration à utiliser si pertinentes :
   ∫xⁿ dx = xⁿ⁺¹/(n+1) + C (n ≠ −1) · ∫(1/x)dx = ln|x| + C · ∫eˣ dx = eˣ + C
   ∫sin x dx = −cos x + C · ∫cos x dx = sin x + C · ∫tan x dx = −ln|cos x| + C
   ∫(1/(1+x²))dx = arctan x + C · ∫(u'·f(u))dx = F(u) + C (substitution)
   Pour la dérivation : f'(u·v) = u'v + uv' · f'(u/v) = (u'v − uv')/v²

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
- Commencer par la section Méthode — Étapes (page 1, règle 4), puis les exercices avec leurs AU.
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
