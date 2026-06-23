import { describe, it, expect } from 'vitest'
import { protectMath, restoreMath } from '../mathProtect.js'

describe('protectMath', () => {
  it('remplace un seul bloc $…$ par un token', () => {
    const { protected: p, map } = protectMath('Résous $2x + 3 = 7$ dans ℝ.')
    expect(p).toBe('Résous «MATH_0» dans ℝ.')
    expect(map).toEqual(['$2x + 3 = 7$'])
  })

  it('remplace plusieurs blocs $…$ en ordre', () => {
    const { protected: p, map } = protectMath('$a^2$ + $b^2$ = $c^2$')
    expect(p).toBe('«MATH_0» + «MATH_1» = «MATH_2»')
    expect(map).toHaveLength(3)
  })

  it('laisse le texte sans équation inchangé', () => {
    const { protected: p, map } = protectMath('Pas de maths ici.')
    expect(p).toBe('Pas de maths ici.')
    expect(map).toHaveLength(0)
  })

  it('gère les blocs $…$ multilignes (pas de capture cross-ligne)', () => {
    const text = 'Début $x = 1$ milieu $y = 2$ fin'
    const { protected: p } = protectMath(text)
    expect(p).toBe('Début «MATH_0» milieu «MATH_1» fin')
  })
})

describe('restoreMath', () => {
  it('restaure les tokens dans leur ordre', () => {
    const map = ['$2x + 3 = 7$', '$x^2$']
    const result = restoreMath('«MATH_0» et «MATH_1»', map)
    expect(result).toBe('$2x + 3 = 7$ et $x^2$')
  })

  it('laisse le texte sans token inchangé', () => {
    const result = restoreMath('Aucun token ici', [])
    expect(result).toBe('Aucun token ici')
  })

  it('round-trip protect → restore = identique', () => {
    const original = 'Résous $2x^2 + 3x - 1 = 0$ pour $x \\in \\mathbb{R}$.'
    const { protected: p, map } = protectMath(original)
    const restored = restoreMath(p, map)
    expect(restored).toBe(original)
  })
})
