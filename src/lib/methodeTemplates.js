/**
 * Templates de méthode pré-fabriqués par chapitre.
 * Contenu garanti mathématiquement correct (vocabulaire FWB S3-S6).
 * Si l'enseignant active l'option, le template est injecté verbatim
 * dans le prompt Haiku — l'IA ne génère pas la section Méthode.
 */

export function buildMethodeTemplate(chapitre) {
  const ch = (chapitre || '').toLowerCase()

  if (/intégr|primitiv/.test(ch)) {
    return `Méthode — Calcul de primitives
Étape 1 : Reconnaître la forme — directe (∫xⁿ, ∫sin x, ∫cos x, ∫eˣ…) ou composée (substitution)
Étape 2 : Pour une forme directe — appliquer la formule de primitive correspondante
Étape 3 : Pour une forme composée — poser u = [partie interne] et calculer du = u'(x)dx
Étape 4 : Réécrire l'intégrale entièrement en u et du, puis intégrer en u
Étape 5 : Remplacer u par son expression en x — ajouter + C
Étape 6 : Contrôle — dériver F(x) doit redonner f(x)`
  }

  if (/dérivat|dériver/.test(ch)) {
    return `Méthode — Dérivation
Étape 1 : Identifier la structure de f(x) — somme, produit, quotient ou composée
Étape 2 : Pour un produit u·v — appliquer (u·v)' = u'v + uv'
Étape 3 : Pour un quotient u/v — appliquer (u/v)' = (u'v − uv') / v²
Étape 4 : Pour une composée f(g(x)) — appliquer (f∘g)' = f'(g(x))·g'(x)
Étape 5 : Simplifier le résultat`
  }

  if (/2e degré|trinôme|discriminant/.test(ch)) {
    return `Méthode — Équations du 2e degré
Étape 1 : Mettre l'équation sous la forme ax² + bx + c = 0
Étape 2 : Calculer le discriminant Δ = b² − 4ac
Étape 3 : Si Δ > 0 — deux solutions x = (−b ± √Δ) / 2a
Étape 4 : Si Δ = 0 — une solution double x = −b / 2a
Étape 5 : Si Δ < 0 — aucune solution réelle`
  }

  if (/trigo|sinus|cosinus|tangente/.test(ch)) {
    return `Méthode — Résolution d'équations trigonométriques
Étape 1 : Isoler la fonction trigonométrique (sin x = a, cos x = a ou tan x = a)
Étape 2 : Identifier l'angle principal dans [0 ; 2π] via le cercle trigonométrique
Étape 3 : Ajouter les solutions périodiques (+ 2kπ ou symétrie selon la fonction)
Étape 4 : Filtrer les solutions selon l'intervalle demandé`
  }

  if (/limit/.test(ch)) {
    return `Méthode — Calcul de limites
Étape 1 : Substituer la valeur limite directement — si défini, c'est le résultat
Étape 2 : Si forme indéterminée (0/0 ou ∞/∞) — factoriser ou conjuguer
Étape 3 : Simplifier l'expression pour lever l'indétermination
Étape 4 : Substituer à nouveau et conclure`
  }

  if (/vecteur|scalaire/.test(ch)) {
    return `Méthode — Calcul vectoriel
Étape 1 : Identifier les vecteurs et leurs composantes
Étape 2 : Pour u⃗·v⃗ — appliquer x₁x₂ + y₁y₂ (+ z₁z₂ en 3D)
Étape 3 : Pour ‖u⃗‖ — appliquer √(x² + y²)
Étape 4 : Conclure sur la perpendicularité (u⃗·v⃗ = 0) ou le parallélisme`
  }

  return null
}
