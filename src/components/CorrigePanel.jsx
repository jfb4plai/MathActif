import { useState, useMemo } from 'react'
import { splitAuByExercice, parseCorrigeResponse } from '../lib/corrigeUtils'
import { exportCorrigeDocx, exportAuAvecCorrigeDocx } from '../lib/exportCorrigeDocx'

const AUDIENCE_OPTIONS = [
  { value: 'enseignant', label: 'Enseignant uniquement' },
  { value: 'eleves',     label: 'Élèves' },
  { value: 'les deux',   label: 'Élèves et enseignant' },
]

const FORMAT_OPTIONS = [
  { value: 'separe',   label: 'Document corrigé séparé' },
  { value: 'integre',  label: 'Intégré au document AU (même page)' },
  { value: 'les deux', label: 'Les deux' },
]

export default function CorrigePanel({
  auTexte,
  chapitre,
  niveau,
  typeEnseignement,
  selectedRappelLines,
  methodeTemplate,
}) {
  const exercices = useMemo(() => splitAuByExercice(auTexte), [auTexte])

  const [selected, setSelected]       = useState(new Set())
  const [audience, setAudience]       = useState('enseignant')
  const [format, setFormat]           = useState('separe')
  const [generating, setGenerating]   = useState(false)
  const [exporting, setExporting]     = useState(false)
  const [corrections, setCorrections] = useState([])
  const [error, setError]             = useState('')
  const [exported, setExported]       = useState(false)

  function toggleAll() {
    if (selected.size === exercices.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(exercices.map(e => e.num)))
    }
  }

  function toggleOne(num) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(num) ? next.delete(num) : next.add(num)
      return next
    })
  }

  function updateEtape(corrId, etapeIdx, field, value) {
    setExported(false)
    setCorrections(prev => prev.map(c =>
      c.id !== corrId ? c : {
        ...c,
        etapes: c.etapes.map((e, i) => i !== etapeIdx ? e : { ...e, [field]: value }),
      }
    ))
  }

  function addEtape(corrId) {
    setExported(false)
    setCorrections(prev => prev.map(c =>
      c.id !== corrId ? c : { ...c, etapes: [...c.etapes, { formule: '', description: '' }] }
    ))
  }

  function removeEtape(corrId, etapeIdx) {
    setExported(false)
    setCorrections(prev => prev.map(c =>
      c.id !== corrId ? c : { ...c, etapes: c.etapes.filter((_, i) => i !== etapeIdx) }
    ))
  }

  function moveEtape(corrId, etapeIdx, dir) {
    setExported(false)
    setCorrections(prev => prev.map(c => {
      if (c.id !== corrId) return c
      const etapes = [...c.etapes]
      const target = etapeIdx + dir
      if (target < 0 || target >= etapes.length) return c
      ;[etapes[etapeIdx], etapes[target]] = [etapes[target], etapes[etapeIdx]]
      return { ...c, etapes }
    }))
  }

  function updateConclusion(corrId, value) {
    setExported(false)
    setCorrections(prev => prev.map(c =>
      c.id !== corrId ? c : { ...c, conclusion: value }
    ))
  }

  async function generer() {
    setError('')
    setGenerating(true)
    setCorrections([])
    setExported(false)
    try {
      const exercicesSelectionnes = exercices
        .filter(e => selected.has(e.num))
        .map(e => ({ id: e.num, texte: e.texte }))

      const res = await fetch('/api/generate-corrige', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercices: exercicesSelectionnes, chapitre, niveau, audience }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Erreur API')
      }
      const json = await res.json()
      const parsed = parseCorrigeResponse(json)
      setCorrections(parsed)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      if (format === 'separe' || format === 'les deux') {
        await exportCorrigeDocx({ corrections, chapitre, niveau, typeEnseignement, audience })
      }
      if (format === 'integre' || format === 'les deux') {
        await exportAuAvecCorrigeDocx({
          auTexte, corrections, chapitre, niveau, typeEnseignement,
          selectedRappelLines, methodeTemplate, audience,
        })
      }
      setExported(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setExporting(false)
    }
  }

  if (exercices.length === 0) return null

  return (
    <div className="card mt-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Générer un corrigé</h2>
      <p className="text-sm text-gray-500 mb-4">Sélectionnez les exercices à corriger. Aucun n'est sélectionné par défaut.</p>

      {/* Bandeau pas de sauvegarde */}
      {corrections.length > 0 && !exported && (
        <div className="mb-4 p-3 rounded-xl bg-orange-50 border border-orange-300 text-orange-800 text-sm font-medium">
          Ce corrigé n'est pas sauvegardé. Exportez votre document avant de quitter cette page.
        </div>
      )}

      {/* Liste exercices */}
      <div className="space-y-2 mb-4">
        {exercices.map(e => (
          <label key={e.num} className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
            <input
              type="checkbox"
              checked={selected.has(e.num)}
              onChange={() => toggleOne(e.num)}
              className="w-4 h-4 mt-0.5 accent-teal-600"
            />
            <span className="text-sm text-gray-700">
              <span className="font-medium">{e.titre}</span>
              {' — '}
              <span className="text-gray-500">{e.texte.split('\n').find(l => l.trim() && !l.trim().match(/^Exercice/i))?.slice(0, 60) ?? '…'}</span>
            </span>
          </label>
        ))}
      </div>

      <button onClick={toggleAll} className="text-xs text-teal-700 underline mb-4">
        {selected.size === exercices.length ? 'Tout désélectionner' : 'Tout sélectionner'}
      </button>

      {/* Audience */}
      <div className="mb-4">
        <label className="label">Destination du corrigé</label>
        <select
          value={audience}
          onChange={e => setAudience(e.target.value)}
          className="input mt-1"
        >
          {AUDIENCE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Bouton générer */}
      <button
        onClick={generer}
        disabled={selected.size === 0 || generating}
        className="btn-primary w-full py-3 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed mb-4"
      >
        {generating
          ? 'Génération en cours…'
          : selected.size === 0
            ? 'Sélectionnez au moins un exercice'
            : `Générer le corrigé (${selected.size} exercice${selected.size > 1 ? 's' : ''})`}
      </button>

      {error && (
        <div className="card bg-red-50 border-red-200 text-red-700 text-sm mb-4">{error}</div>
      )}

      {/* Zones d'édition */}
      {corrections.map(c => (
        <div key={c.id} className="card border-orange-200 mb-4">
          <h3 className="font-semibold text-orange-700 mb-3">{c.titre} — Correction</h3>

          {c.etapes.map((etape, idx) => (
            <div key={idx} className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">Étape {idx + 1}</span>
                <div className="flex gap-1">
                  <button onClick={() => moveEtape(c.id, idx, -1)} disabled={idx === 0} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30">↑</button>
                  <button onClick={() => moveEtape(c.id, idx, 1)} disabled={idx === c.etapes.length - 1} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30">↓</button>
                  <button onClick={() => removeEtape(c.id, idx)} className="text-xs text-red-400 hover:text-red-600 ml-1">Supprimer</button>
                </div>
              </div>
              <input
                type="text"
                placeholder="Formule (optionnelle)"
                value={etape.formule}
                onChange={e => updateEtape(c.id, idx, 'formule', e.target.value)}
                className="input text-sm mb-2 font-mono"
              />
              <textarea
                placeholder="Description du processus"
                value={etape.description}
                onChange={e => updateEtape(c.id, idx, 'description', e.target.value)}
                rows={2}
                className="input text-sm resize-none"
              />
            </div>
          ))}

          <button
            onClick={() => addEtape(c.id)}
            className="text-xs text-teal-700 underline mb-3"
          >+ Ajouter une étape</button>

          <div>
            <label className="label text-xs">Conclusion</label>
            <textarea
              value={c.conclusion}
              onChange={e => updateConclusion(c.id, e.target.value)}
              rows={2}
              className="input text-sm resize-none mt-1"
              placeholder="Résultat final"
            />
          </div>
        </div>
      ))}

      {/* Export */}
      {corrections.length > 0 && (
        <div className="card bg-gray-50 border-gray-200 mt-4">
          <h3 className="font-medium text-gray-700 mb-3">Exporter le corrigé</h3>
          <div className="space-y-2 mb-4">
            {FORMAT_OPTIONS.map(o => (
              <label key={o.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format-corrige"
                  value={o.value}
                  checked={format === o.value}
                  onChange={() => setFormat(o.value)}
                  className="accent-teal-600"
                />
                <span className="text-sm text-gray-700">{o.label}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-primary w-full py-3 font-semibold disabled:opacity-40"
          >
            {exporting ? 'Export en cours…' : 'Télécharger le corrigé'}
          </button>
          {exported && (
            <p className="text-xs text-green-700 mt-2 text-center">Corrigé exporté avec succès.</p>
          )}
        </div>
      )}
    </div>
  )
}
