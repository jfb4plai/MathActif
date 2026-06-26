import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PROFILS, NIVEAUX, TYPES_ENSEIGNEMENT } from '../lib/constants'
import { extractDocxMath } from '../lib/extractDocxMath'
import { extractFile } from '../lib/extractFile'
import { protectMath, restoreMath } from '../lib/mathProtect'
import { exportAuMathDocx, exportProfilMathDocx } from '../lib/exportMathDocx'
import { buildMethodeTemplate } from '../lib/methodeTemplates'
import MathDisplay from '../components/MathDisplay'

export default function MathAdapter() {
  const { user } = useAuth()

  const fileInputRef = useRef(null)
  const [importing, setImporting]       = useState(false)
  const [importError, setImportError]   = useState('')
  const [importedFile, setImportedFile] = useState('')
  const [activite, setActivite]         = useState('')

  const [niveau, setNiveau]             = useState('')
  const [typeEns, setTypeEns]           = useState('')
  const [chapitre, setChapitre]         = useState('')
  const [objectif, setObjectif]         = useState('')
  const [profilsChoisis, setProfilsChoisis] = useState([])

  const [generatingAu, setGeneratingAu] = useState(false)
  const [generating, setGenerating]     = useState(false)
  const [auTexte, setAuTexte]           = useState('')
  const [conseils, setConseils]         = useState('')
  const [texteFinal, setTexteFinal]     = useState('')
  const [error, setError]               = useState('')

  const [includeRappel, setIncludeRappel]   = useState(true)
  const [useMethodeFixed, setUseMethodeFixed] = useState(true)
  const [exporting, setExporting]           = useState(false)
  const [exportingProfil, setExportingProfil] = useState('')
  const [saved, setSaved]               = useState(false)
  const [saving, setSaving]             = useState(false)
  const [arMode, setArMode]             = useState(false)

  async function handleFile(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['docx', 'pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      setImportError('Format non supporté — utilisez .docx (recommandé), PDF ou image.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setImportError('Fichier trop lourd (max 10 Mo).')
      return
    }
    setImporting(true)
    setImportError('')
    setImportedFile(file.name)
    setActivite('')
    setAuTexte('')
    setConseils('')
    setTexteFinal('')
    setSaved(false)
    try {
      const result = ext === 'docx'
        ? await extractDocxMath(file)
        : await extractFile(file)
      setActivite(result.text)
    } catch (err) {
      setImportError(err.message)
      setImportedFile('')
    }
    setImporting(false)
  }

  function onFileInput(e) { handleFile(e.target.files[0]); e.target.value = '' }
  function onDrop(e) { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }

  function toggleProfil(val) {
    setProfilsChoisis(prev =>
      prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]
    )
    setConseils('')
    setTexteFinal('')
    setSaved(false)
  }

  async function genererAU() {
    if (!activite.trim()) return
    setGeneratingAu(true)
    setError('')
    try {
      const { protected: activiteProtected, map } = protectMath(activite)
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'appliquer_au_math',
          context: {
            activite: activiteProtected, objectif, niveau, type_enseignement: typeEns, chapitre,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      setAuTexte(restoreMath(data.text, map))
    } catch (err) {
      setError(err.message)
    }
    setGeneratingAu(false)
  }

  async function genererConseils() {
    if (!activite.trim() || profilsChoisis.length === 0) return
    setGenerating(true)
    setError('')
    try {
      const baseText = auTexte || activite
      const { protected: baseProtected, map } = protectMath(baseText)
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adapter_activite_math',
          context: {
            activite: baseProtected,
            au_texte: auTexte ? baseProtected : null,
            objectif,
            profils: profilsChoisis,
            niveau,
            type_enseignement: typeEns,
            chapitre,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      const restored = restoreMath(data.text, map)
      setConseils(restored)
      setTexteFinal(restored)
    } catch (err) {
      setError(err.message)
    }
    setGenerating(false)
  }

  async function sauvegarder() {
    setSaving(true)
    await supabase.from('math_adaptations').insert({
      user_id: user.id,
      document_original: activite,
      au_texte: auTexte,
      conseils_ia: conseils,
      texte_final: texteFinal,
      profils: profilsChoisis,
      niveau,
      type_enseignement: typeEns,
      chapitre,
      objectif,
    })
    setSaved(true)
    setSaving(false)
  }

  async function exporterAU() {
    if (!auTexte) return
    setExporting(true)
    const methodeTemplate = useMethodeFixed ? (buildMethodeTemplate(chapitre) ?? null) : null
    await exportAuMathDocx({ auTexte, chapitre, niveau, typeEnseignement: typeEns, includeRappel, methodeTemplate })
    setExporting(false)
  }

  async function exporterProfil(profil) {
    if (!auTexte) { setError("Génère d'abord le document AU avant d'exporter une version profil."); return }
    setExportingProfil(profil)
    const showAr = arMode && ['dyslexie', 'dyspraxie', 'dyscalculie'].includes(profil)
    const methodeTemplate = useMethodeFixed ? (buildMethodeTemplate(chapitre) ?? null) : null
    await exportProfilMathDocx({
      profil, auTexte, conseilsTexte: texteFinal,
      chapitre, niveau, typeEnseignement: typeEns, arMode: showAr, includeRappel, methodeTemplate,
    })
    setExportingProfil('')
  }

  const canGenerate = activite.trim().length > 20 && profilsChoisis.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Adapter un exercice de maths</h1>
        <p className="text-gray-500 text-sm mt-1">
          Importez un document Word (.docx recommandé) — MathActif applique les AU maths et génère des conseils par profil
        </p>
      </div>

      {/* 1. Contexte */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4">1. Contexte</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Niveau</label>
            <p className="text-xs text-gray-400 mb-1">Le niveau conditionne les stratégies AU proposées</p>
            <select className="input" value={niveau} onChange={e => setNiveau(e.target.value)}>
              <option value="">Choisir…</option>
              {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Type d'enseignement</label>
            <p className="text-xs text-gray-400 mb-1">Adapte le registre des conseils</p>
            <select className="input" value={typeEns} onChange={e => setTypeEns(e.target.value)}>
              <option value="">Choisir…</option>
              {TYPES_ENSEIGNEMENT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Chapitre</label>
            <p className="text-xs text-gray-400 mb-1">Ex : Équations du 2e degré</p>
            <input className="input" value={chapitre} onChange={e => setChapitre(e.target.value)}
              placeholder="Équations du 2e degré" />
          </div>
        </div>

        {chapitre.trim() && !buildMethodeTemplate(chapitre) && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            Chapitre non reconnu — aucune section Méthode ne sera insérée dans le .docx.
            Chapitres supportés : intégration, dérivation, 2e degré, trigonométrie, limites, vecteurs.
          </div>
        )}
        {buildMethodeTemplate(chapitre) && (
          <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3">
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={useMethodeFixed} onChange={e => setUseMethodeFixed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-teal-600" />
              <div>
                <span className="text-sm font-medium text-teal-800">Section Méthode garantie</span>
                <span className="text-xs text-teal-600 ml-2">contenu fixe — non généré par l'IA</span>
              </div>
            </label>
            {useMethodeFixed && (
              <pre className="mt-2 text-xs text-teal-700 whitespace-pre-wrap leading-relaxed pl-6">
                {buildMethodeTemplate(chapitre)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* 2. Import document */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4">2. Document</h2>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all"
        >
          <input ref={fileInputRef} type="file"
            accept=".docx,.pdf,.jpg,.jpeg,.png,.webp"
            className="hidden" onChange={onFileInput} />
          {importing ? (
            <p className="text-sm font-medium" style={{ color: 'var(--teal)' }}>Extraction en cours…</p>
          ) : importedFile ? (
            <div className="flex items-center justify-center gap-2">
              <span className="text-green-600">✓</span>
              <span className="text-sm text-green-700 font-medium">{importedFile}</span>
              <button
                onClick={e => { e.stopPropagation(); setImportedFile(''); setActivite(''); setAuTexte(''); setConseils('') }}
                className="text-xs text-gray-400 hover:text-red-500 ml-2">✕</button>
            </div>
          ) : (
            <>
              <div className="text-2xl mb-1">📄</div>
              <p className="text-sm text-gray-600 font-medium">
                Glisser-déposer ou <span style={{ color: 'var(--teal)' }} className="underline">parcourir</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">.docx (recommandé — équations préservées) · PDF scanné · JPG · PNG — max 10 Mo</p>
            </>
          )}
        </div>
        {importError && <p className="text-xs text-red-500 mt-2">{importError}</p>}

        {activite && (
          <div className="mt-4">
            <label className="label">Aperçu — lecture seule</label>
            <p className="text-xs text-gray-400 mb-1">Les équations s'affichent en teal. Si une est incorrecte → corriger dans le .docx exporté sous Word</p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-48 overflow-y-auto">
              <MathDisplay text={activite} className="text-sm text-gray-700" />
            </div>
          </div>
        )}

        {activite && (
          <div className="mt-3">
            <label className="label">Objectif d'apprentissage (facultatif)</label>
            <p className="text-xs text-gray-400 mb-1">Ex : L'élève résout une équation du 2e degré à l'aide du discriminant — préciser améliore la qualité des AU</p>
            <input className="input" value={objectif} onChange={e => setObjectif(e.target.value)}
              placeholder="L'élève résout une équation du 2e degré à l'aide du discriminant" />
          </div>
        )}
      </div>

      {/* 3. AU universel */}
      {activite.trim().length > 20 && (
        <div className="card" style={{ background: '#f9fafb' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">Document AU universel</h2>
              <p className="text-xs text-gray-500 mt-0.5">Aménagements Universels — version distribuée à toute la classe</p>
              <p className="text-xs text-teal-700 mt-1.5 font-medium">
                Fondé sur la recherche RISS — Numérotation, même plan, zone de travail, formule de rappel (Rusconi 2025 · Alvarez 2024 · Mahi Haddad &amp; Beaud 2025)
              </p>
            </div>
            <button onClick={genererAU} disabled={generatingAu}
              className="btn-secondary text-sm whitespace-nowrap">
              {generatingAu ? 'Génération…' : auTexte ? 'Regénérer AU' : 'Générer document AU'}
            </button>
          </div>

          {auTexte && (
            <div className="mt-4 space-y-3">
              <div className="bg-white rounded-xl p-4 text-sm text-gray-700 border border-gray-200 max-h-56 overflow-y-auto">
                <MathDisplay text={auTexte} />
              </div>
              {(useMethodeFixed && buildMethodeTemplate(chapitre)) || includeRappel ? (
                <div className="rounded-lg bg-teal-50 border border-teal-100 px-3 py-2 text-xs text-teal-700 space-y-0.5">
                  <p className="font-medium">Contenu ajouté automatiquement en tête du .docx (non visible ici) :</p>
                  {useMethodeFixed && buildMethodeTemplate(chapitre) && (
                    <p>· Section Méthode — {buildMethodeTemplate(chapitre).split('\n')[0]}</p>
                  )}
                  {includeRappel && buildMethodeTemplate(chapitre) && (
                    <p>· Formules de rappel pour ce chapitre</p>
                  )}
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeRappel}
                  onChange={e => setIncludeRappel(e.target.checked)}
                  className="w-4 h-4 accent-teal-600"
                />
                Inclure les formules de rappel dans le .docx
              </label>
              <button onClick={exporterAU} disabled={exporting} className="btn-primary text-sm">
                {exporting ? 'Export…' : '⬇ Exporter AU universel (.docx)'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. Profils */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-1">3. Profils présents dans la classe</h2>
        <p className="text-xs text-gray-400 mb-3">Sélectionnez les profils pour recevoir des conseils pédagogiques ciblés</p>
        <div className="grid grid-cols-2 gap-2">
          {PROFILS.map(p => (
            <button key={p.value} onClick={() => toggleProfil(p.value)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                profilsChoisis.includes(p.value)
                  ? 'border-teal-600 bg-teal-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">{p.icon}</span>
              <div>
                <div className="text-sm font-medium text-gray-800">{p.label}</div>
                <div className="text-xs text-gray-500">{p.strategies_cles[0]}</div>
              </div>
            </button>
          ))}
        </div>

        {profilsChoisis.some(p => ['dyslexie', 'dyspraxie', 'dyscalculie'].includes(p)) && (
          <label className="flex items-start gap-2 cursor-pointer mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200 select-none">
            <input type="checkbox" checked={arMode} onChange={e => setArMode(e.target.checked)} className="w-4 h-4 mt-0.5" />
            <div>
              <span className="text-xs font-medium text-blue-800">AR actif — police 14pt à l'export profil</span>
              <p className="text-xs text-blue-600 mt-0.5">Pour élève DYS avec AR officiel (RISS : Nonnenmacher (2018) dumas-02535815)</p>
            </div>
          </label>
        )}
      </div>

      {/* Bouton générer conseils */}
      <button onClick={genererConseils} disabled={!canGenerate || generating}
        className="btn-accent w-full py-3 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
        {generating
          ? 'Génération…'
          : canGenerate
            ? `Recevoir des conseils (${profilsChoisis.length} profil${profilsChoisis.length > 1 ? 's' : ''})`
            : 'Importez un document et choisissez au moins un profil'}
      </button>

      {error && (
        <div className="card bg-red-50 border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Résultat */}
      {conseils && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Conseils pédagogiques par profil</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">80% IA — à personnaliser</span>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-4 text-sm text-gray-700 border border-gray-200">
            <MathDisplay text={conseils} />
          </div>

          <div>
            <label className="label">Votre version personnalisée (20%)</label>
            <p className="text-xs text-gray-400 mb-1">Injectez votre connaissance de vos élèves — contexte, style, formulations habituelles</p>
            <textarea className="input resize-none h-48" value={texteFinal}
              onChange={e => { setTexteFinal(e.target.value); setSaved(false) }} />
          </div>

          {auTexte && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <p className="text-xs font-semibold text-gray-700">Exports par profil (AU universel + conseils)</p>
              {profilsChoisis.map(profil => {
                const pd = PROFILS.find(p => p.value === profil)
                return (
                  <div key={profil}
                    className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-sm text-gray-800">{pd?.icon} {pd?.label}</span>
                    <button onClick={() => exporterProfil(profil)}
                      disabled={exportingProfil === profil}
                      className="btn-primary text-xs py-1.5 px-3">
                      {exportingProfil === profil ? 'Export…' : '⬇ Exporter'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button onClick={sauvegarder}
              disabled={saving || saved || !texteFinal.trim()}
              className={saved ? 'btn-secondary text-sm' : 'btn-primary text-sm'}>
              {saved ? 'Sauvegardé ✓' : saving ? 'Enregistrement…' : 'Sauvegarder'}
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-3">
            Sources RISS — Dyscalculie : Thibaut (2016) dumas-01488139 · Le Cam &amp; Toussaint (2017) dumas-01549091 · Mahi Haddad &amp; Beaud (2025) dumas-05106961
          </p>
        </div>
      )}
    </div>
  )
}
