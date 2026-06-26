export const RAPPEL_STATIQUE = {
  integr: [
    '[RAPPEL : ∫xⁿ dx = xⁿ⁺¹/(n+1) + C  (n ≠ −1)]',
    '[RAPPEL : ∫(1/x) dx = ln|x| + C]',
    '[RAPPEL : ∫eˣ dx = eˣ + C]',
    '[RAPPEL : ∫sin x dx = −cos x + C]',
    '[RAPPEL : ∫cos x dx = sin x + C]',
    '[RAPPEL : ∫(u\'·f(u)) dx = F(u) + C  (substitution)]',
  ],
  derivat: [
    '[RAPPEL : (u·v)\' = u\'v + uv\']',
    '[RAPPEL : (u/v)\' = (u\'v − uv\') / v²]',
    '[RAPPEL : (f∘g)\'(x) = f\'(g(x))·g\'(x)]',
  ],
  degree2: [
    '[RAPPEL : Δ = b² − 4ac]',
    '[RAPPEL : si Δ > 0 → x = (−b ± √Δ) / 2a]',
    '[RAPPEL : si Δ = 0 → x = −b / 2a]',
    '[RAPPEL : si Δ < 0 → aucune solution réelle]',
  ],
  trigo: [
    '[RAPPEL : sin²x + cos²x = 1]',
    '[RAPPEL : tan x = sin x / cos x]',
    '[RAPPEL : solutions de sin x = a → x = arcsin a + 2kπ ou x = π − arcsin a + 2kπ]',
    '[RAPPEL : solutions de cos x = a → x = ±arccos a + 2kπ]',
  ],
  limite: [
    '[RAPPEL : forme 0/0 ou ∞/∞ → factoriser ou conjuguer pour lever l\'indétermination]',
    '[RAPPEL : lim xⁿ = ±∞ quand x → ±∞ (selon parité de n)]',
  ],
  vecteur: [
    '[RAPPEL : u⃗·v⃗ = x₁x₂ + y₁y₂  (produit scalaire)]',
    '[RAPPEL : ‖u⃗‖ = √(x² + y²)  (norme)]',
    '[RAPPEL : u⃗ ⊥ v⃗ ⟺ u⃗·v⃗ = 0]',
  ],
}

export function detectChapitreKey(chapitre) {
  const ch = (chapitre || '').toLowerCase().normalize('NFC')
  if (/intégr|primitiv/.test(ch)) return 'integr'
  if (/dérivat|dériver/.test(ch)) return 'derivat'
  if (/2e degré|trinôme|discriminant/.test(ch)) return 'degree2'
  if (/trigo|sinus|cosinus|tangente/.test(ch)) return 'trigo'
  if (/limit/.test(ch)) return 'limite'
  if (/vecteur|scalaire/.test(ch)) return 'vecteur'
  return null
}
