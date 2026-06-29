import { describe, it, expect } from 'vitest'
import { splitAuByExercice, parseCorrigeResponse } from '../corrigeUtils.js'

describe('splitAuByExercice', () => {
  it('retourne un tableau vide si aucun exercice', () => {
    expect(splitAuByExercice('Texte sans exercice')).toEqual([])
  })

  it('détecte un seul exercice', () => {
    const texte = 'Exercice 1\nCalcule la dérivée.\n___\n___\n___'
    const result = splitAuByExercice(texte)
    expect(result).toHaveLength(1)
    expect(result[0].num).toBe(1)
    expect(result[0].titre).toBe('Exercice 1')
    expect(result[0].texte).toContain('Calcule la dérivée.')
  })

  it('détecte deux exercices et leur texte respectif', () => {
    const texte = 'Exercice 1\nQ1\n___\nExercice 2\nQ2\n___'
    const result = splitAuByExercice(texte)
    expect(result).toHaveLength(2)
    expect(result[0].texte).not.toContain('Q2')
    expect(result[1].texte).toContain('Q2')
    expect(result[1].texte).not.toContain('Q1')
  })

  it('ignore le texte avant le premier exercice', () => {
    const texte = 'En-tête\nSéquence\nExercice 1\nQ1\n___'
    const result = splitAuByExercice(texte)
    expect(result).toHaveLength(1)
  })
})

describe('parseCorrigeResponse', () => {
  it('retourne le tableau corrections si JSON valide', () => {
    const json = {
      corrections: [
        { id: 1, titre: 'Exercice 1', etapes: [{ formule: 'f(x)', description: 'Fonction' }], conclusion: 'OK' }
      ]
    }
    const result = parseCorrigeResponse(json)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
    expect(result[0].etapes).toHaveLength(1)
  })

  it('lève une erreur si corrections manquant', () => {
    expect(() => parseCorrigeResponse({})).toThrow('corrections manquant')
  })

  it('lève une erreur si corrections n\'est pas un tableau', () => {
    expect(() => parseCorrigeResponse({ corrections: 'mauvais' })).toThrow('corrections manquant')
  })

  it('lève une erreur si une correction manque etapes', () => {
    expect(() => parseCorrigeResponse({
      corrections: [{ id: 1, titre: 'Ex 1', conclusion: 'OK' }]
    })).toThrow('etapes manquant')
  })
})
