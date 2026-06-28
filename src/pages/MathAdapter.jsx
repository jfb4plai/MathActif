import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PROFILS, NIVEAUX, TYPES_ENSEIGNEMENT } from '../lib/constants'
import { extractDocxMath } from '../lib/extractDocxMath'
import { extractFile } from '../lib/extractFile'
import { protectMath, restoreMath } from '../lib/mathProtect'
import { exportAuMathDocx, exportProfilMathDocx } from '../lib/exportMathDocx'
import { buildMethodeTemplate } from '../lib/methodeTemplates'
import { RAPPEL_STATIQUE, detectChapitreKey } from '../lib/rappelData'
import MathDisplay from '../components/MathDisplay'

// ── Validation AU maths (client-side) ────────────────────────
function validateMathAuRules(text) {
  const lines = text.split('\n')
  const exerciceLines = lines.filter(l => /^Exercice\s+\d+/i.test(l.trim()))
  const numerotationOk = exerciceLines.length > 0

  const nbZdt = (text.match(/^_{3,}$/gm) || []).length
  const zdtOk = nbZdt > 0

  const nbDoutes = (text.match(/\[\?/g) || []).length
  const sansDoutesOk = nbDoutes === 0

  const nbTokensMath = (text.match(/«MATH_\d+»/g) || []).length
  const mathRestoredOk = nbTokensMath === 0

  const nbSauts = (text.match(/\[saut_de_page\]/gi) || []).length

  return [
    {
      id: 'numerotation',
      label: 'Exercices numérotés (Exercice 1, 2…)',
      ok: numerotationOk,
      detail: numerotationOk ? `${exerciceLines.length} exercice(s)` : 'Aucun exercice numéroté trouvé',
    },
    {
      id: 'zdt',
      label: 'Zones de travail présentes (lignes ___)',
      ok: zdtOk,
      detail: zdtOk ? `${nbZdt} ligne(s) de travail` : 'Aucune zone de travail — vérifiez le document',
      warn: !zdtOk,
    },
    {
      id: 'meme_plan',
      label: 'Règle « Même Plan » — sauts de page',
      ok: true,
      detail: nbSauts > 0 ? `${nbSauts} saut(s) de page inséré(s)` : 'Aucun saut (thème unique ou non requis)',
      info: true,
    },
    {
      id: 'math_restored',
      label: 'Équations correctement restaurées',
      ok: mathRestoredOk,
      detail: mathRestoredOk ? 'Toutes les équations sont restaurées' : `${nbTokensMath} token(s) «MATH_N» non restauré(s) — regénérez`,
    },
    {
      id: 'sans_doutes',
      label: 'Aucun passage incertain [? ?] résiduel',
      ok: sansDoutesOk,
      detail: sansDoutesOk ? 'Texte propre' : `${nbDoutes} passage(s) incertain(s) — corrigez avant export`,
    },
  ]
}

export default function MathAdapter() {
  const { user } = useAuth()

  const fileInputRef = useRef(null)
  const [importing, setImporting]       = useState(false)
  const [importError, setImportError]   = useState('')
  const [importedFile, setImportedFile] = useState('')
  const [activite, setActivite]         = useState('')
  const [hasDoutes, setHasDoutes]       = useState(false)
  const [nbDoutes, setNbDoutes]         = useState(0)
  const [pageWarning, setPageWarning]   = useState(null)

  const [niveau, setNiveau]             = useState('')
  const [typeEns, setTypeEns]           = useState('')
  const [chapitre, setChapitre]         = useState('')
  const [chapitreMode, setChapitreMode] = useState('select')
  const [objectif, setObjectif]         = useState('')
  const [profilsChoisis, setProfilsChoisis] = useState([])

  const [generatingAu, setGeneratingAu] = useState(false)
  const [generating, setGenerating]     = useState(false)
  const [auTexte, setAuTexte]           = useState('')
  const [auValidation, setAuValidation] = useState(null)
  const [conseils, setConseils]         = useState('')
  const [texteFinal, setTexteFinal]     = useState('')
  const [error, setError]               = useState('')
  const [verifying, setVerifying]       = useState('')
  const [verificationResults, setVerificationResults] = useState({})
  const [histoAdaptations, setHistoAdaptations] = useState([])
  const [savedId, setSavedId]           = useState(null)
  const [feedback, setFeedback]         = useState(null)

  const [useMethodeFixed, setUseMethodeFixed] = useState(true)
  const [methodeEdit, setMethodeEdit]         = useState(null)
  const [nbLignesZdt, setNbLignesZdt]         = useState(3)
  const [nbLignesAtLastGen, setNbLignesAtLastGen] = useState(null)
  const [includeRappel, setIncludeRappel]     = useState(true)
  const [rappelSelected, setRappelSelected]   = useState(null)
  const [exporting, setExporting]             = useState(false)
  const [exportingProfil, setExportingProfil] = useState('')
  const [saved, setSaved]               = useState(false)
  const [saving, setSaving]             = useState(false)
  const [arMode, setArMode]             = useState(false)

  function initChapitreState(val) {
    setMethodeEdit(buildMethodeTemplate(val))
    const key = detectChapitreKey(val)
    setRappelSelected(key ? RAPPEL_STATIQUE[key].map(() => true) : null)
  }

  useEffect(() => {
    if (!user) return
    supabase
      .from('math_adaptations')
      .select('texte_final')
      .eq('user_id', user.id)
      .not('texte_final', 'is', null)
      .neq('texte_final', '')
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data?.length) setHistoAdaptations(data.map(d => d.texte_final.slice(0, 250)))
      })
  }, [user])

  function getSelectedRappelLines() {
    if (!includeRappel || !rappelSelected) return null
    const key = detectChapitreKey(chapitre)
    if (!key) return null
    return RAPPEL_STATIQUE[key].filter((_, i) => rappelSelected[i])
  }

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
    setAuValidation(null)
    setConseils('')
    setTexteFinal('')
    setSaved(false)
    setHasDoutes(false)
    setNbDoutes(0)
    setPageWarning(null)
    setVerificationResults({})
    try {
      const result = ext === 'docx'
        ? await extractDocxMath(file)
        : await extractFile(file)
      setActivite(result.text)
      setHasDoutes(result.hasDoutes ?? false)
      setNbDoutes(result.nbDoutes ?? 0)
      setPageWarning(result.pageWarning ?? null)
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
            nb_lignes_zdt: nbLignesZdt,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      const restored = restoreMath(data.text, map)
      setAuTexte(restored)
      setAuValidation(validateMathAuRules(restored))
      setNbLignesAtLastGen(nbLignesZdt)
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
            historique_enseignant: histoAdaptations.length ? histoAdaptations : undefined,
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
    const { data } = await supabase.from('math_adaptations').insert({
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
    }).select('id').single()
    if (data?.id) setSavedId(data.id)
    setFeedback(null)
    setSaved(true)
    setSaving(false)
  }

  async function envoyerFeedback(valeur) {
    if (!savedId) return
    setFeedback(valeur)
    await supabase.from('math_adaptations').update({ feedback: valeur }).eq('id', savedId)
  }

  async function verifierExercice(profil) {
    if (!auTexte) return
    setVerifying(profil)
    try {
      const profilLabel = PROFILS.find(p => p.value === profil)?.label ?? profil
      const { protected: auProtected, map } = protectMath(auTexte)
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verifier_exercice_math',
          context: {
            profil: profilLabel,
            exercice_adapte: auProtected,
            niveau,
            type_enseignement: typeEns,
            chapitre,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      setVerificationResults(prev => ({ ...prev, [profil]: restoreMath(data.text, map) }))
    } catch (err) {
      setError(err.message)
    }
    setVerifying('')
  }

  async function exporterAU() {
    if (!auTexte) return
    setExporting(true)
    const methodeTemplate = useMethodeFixed ? methodeEdit : null
    const selectedRappelLines = getSelectedRappelLines()
    await exportAuMathDocx({ auTexte, chapitre, niveau, typeEnseignement: typeEns, selectedRappelLines, methodeTemplate })
    setExporting(false)
  }

  async function exporterProfil(profil) {
    if (!auTexte) { setError("Génère d'abord le document AU avant d'exporter une version profil."); return }
    setExportingProfil(profil)
    const showAr = arMode && ['dyslexie', 'dyspraxie', 'dyscalculie'].includes(profil)
    const methodeTemplate = useMethodeFixed ? methodeEdit : null
    const selectedRappelLines = getSelectedRappelLines()
    try {
      await exportProfilMathDocx({
        profil, auTexte, conseilsTexte: texteFinal,
        chapitre, niveau, typeEnseignement: typeEns, arMode: showAr, selectedRappelLines, methodeTemplate,
      })
    } finally {
      setExportingProfil('')
    }
  }

  const zdtDirty = auTexte && nbLignesAtLastGen !== null && nbLignesZdt !== nbLignesAtLastGen
  const canGenerate = activite.trim().length > 20 && profilsChoisis.length > 0
  const chapitreKey = detectChapitreKey(chapitre)
  const rappelFormulas = chapitreKey ? RAPPEL_STATIQUE[chapitreKey] : null

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
            <label className="label">
              Chapitre <span className="text-teal-600 font-normal text-xs ml-1">— active Méthode + RAPPEL</span>
            </label>
            <p className="text-xs text-gray-400 mb-1">Détermine la section Méthode et les formules de rappel dans le .docx</p>
            <select
              className={`input ${!chapitre ? 'border-teal-400 ring-1 ring-teal-300' : ''}`}
              value={chapitreMode === 'autre' ? 'autre' : chapitre}
              onChange={e => {
                const val = e.target.value
                if (val === '') return
                if (val === 'autre') {
                  setChapitreMode('autre')
                  setChapitre('')
                  setMethodeEdit(null)
                  setRappelSelected(null)
                } else {
                  setChapitreMode('select')
                  setChapitre(val)
                  initChapitreState(val)
                }
              }}
            >
              <option value="">Choisir le chapitre…</option>
              <option value="Calcul de primitives">Intégration — Calcul de primitives</option>
              <option value="Dérivation">Dérivation</option>
              <option value="Équations du 2e degré">Équations du 2e degré</option>
              <option value="Trigonométrie">Trigonométrie</option>
              <option value="Calcul de limites">Calcul de limites</option>
              <option value="Vecteurs">Vecteurs</option>
              <option value="autre">Autre (saisir manuellement)</option>
            </select>
            {chapitreMode === 'autre' && (
              <input
                className="input mt-2"
                value={chapitre}
                onChange={e => {
                  const val = e.target.value
                  setChapitre(val)
                  initChapitreState(val)
                }}
                placeholder="Ex : Suites arithmétiques"
                autoFocus
              />
            )}
          </div>
        </div>

        {/* Avertissement chapitre non reconnu */}
        {chapitre.trim() && methodeEdit === null && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            Chapitre non reconnu — aucune section Méthode ni formule de rappel ne seront insérées dans le .docx.
            Chapitres supportés : intégration, dérivation, 2e degré, trigonométrie, limites, vecteurs.
          </div>
        )}

        {/* Méthode éditable */}
        {methodeEdit !== null && (
          <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3">
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={useMethodeFixed} onChange={e => setUseMethodeFixed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-teal-600" />
              <div>
                <span className="text-sm font-medium text-teal-800">Section Méthode — vos 20%</span>
                <span className="text-xs text-teal-600 ml-2">base proposée — modifiez selon votre contexte classe</span>
              </div>
            </label>
            {useMethodeFixed && (
              <div className="mt-2 pl-6">
                <p className="text-xs text-teal-500 mb-1">Adaptez les étapes, le vocabulaire, les remarques — le texte final est le vôtre.</p>
                <textarea
                  className="w-full text-sm text-teal-800 bg-white border border-teal-200 rounded-lg p-2 leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-teal-400"
                  rows={8}
                  value={methodeEdit}
                  onChange={e => setMethodeEdit(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Lignes pour les zones de travail */}
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="text-sm font-medium text-gray-800">Lignes pour les zones de travail</label>
              <p className="text-xs text-gray-500 mt-0.5">
                Nombre de lignes vierges insérées après chaque exercice (2–12, défaut : 3).
                La règle «énoncé + zone de travail sur la même page» est garantie quelle que soit la valeur.
              </p>
            </div>
            <input
              type="number" min={2} max={12}
              value={nbLignesZdt}
              onChange={e => setNbLignesZdt(Math.max(2, Math.min(12, parseInt(e.target.value) || 3)))}
              className="input w-20 text-center text-sm py-1 flex-shrink-0"
            />
          </div>
        </div>
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

        {importedFile && !importing && !hasDoutes && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
            <span className="text-blue-500 text-sm mt-0.5">ℹ</span>
            <div className="text-xs text-blue-800 space-y-1">
              <p><strong>Texte extrait — relisez avant de générer.</strong></p>
              <p>Vérifiez particulièrement que les expressions mathématiques sont bien présentes. Si une équation est absente, importez le fichier en .docx (équations préservées).</p>
            </div>
          </div>
        )}
        {importedFile && !importing && hasDoutes && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <span className="text-amber-500 text-sm mt-0.5">⚠</span>
            <p className="text-xs text-amber-800">
              <strong>{nbDoutes} passage{nbDoutes > 1 ? 's' : ''} incertain{nbDoutes > 1 ? 's' : ''}</strong> — signalé{nbDoutes > 1 ? 's' : ''}{' '}
              <code className="bg-amber-100 px-1 rounded">[? ... ?]</code> dans le texte. En maths, une expression mal lue change tout l'exercice — corrigez avant de générer.
            </p>
          </div>
        )}
        {pageWarning && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
            <span className="text-orange-500 text-sm mt-0.5">⚠</span>
            <p className="text-xs text-orange-800">
              <strong>PDF de {pageWarning.total} pages</strong> — seules les {pageWarning.extracted} premières pages ont été analysées.
              Importez le reste du document en un second passage.
            </p>
          </div>
        )}

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

              {zdtDirty && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  Le nombre de lignes a changé ({nbLignesAtLastGen} → {nbLignesZdt}). Cliquez sur «Regénérer AU» pour appliquer.
                </div>
              )}

              {/* Validation AU maths */}
              {auValidation && (
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-700">Vérification des règles AU maths</p>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {auValidation.map(rule => (
                      <li key={rule.id} className="flex items-start gap-3 px-4 py-2">
                        <span className={`mt-0.5 text-sm font-bold shrink-0 ${
                          rule.info ? 'text-blue-400' : rule.warn ? 'text-amber-400' : rule.ok ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {rule.info ? 'ℹ' : rule.warn ? '?' : rule.ok ? '✓' : '✗'}
                        </span>
                        <div>
                          <p className={`text-xs font-medium ${rule.ok && !rule.warn ? 'text-gray-700' : rule.warn ? 'text-amber-700' : 'text-red-700'}`}>
                            {rule.label}
                          </p>
                          <p className="text-xs text-gray-400">{rule.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {auValidation?.some(r => r.id === 'sans_doutes' && !r.ok) && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <span className="text-red-500 text-sm mt-0.5">✗</span>
                  <p className="text-xs text-red-800">
                    <strong>Export bloqué</strong> — des passages incertains <code className="bg-red-100 px-1 rounded">[? ?]</code> subsistent dans l'aperçu AU.
                    Corrigez-les dans le .docx Word après export, ou regénérez.
                  </p>
                </div>
              )}
              {auValidation?.some(r => r.id === 'math_restored' && !r.ok) && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <span className="text-red-500 text-sm mt-0.5">✗</span>
                  <p className="text-xs text-red-800">
                    <strong>Export bloqué</strong> — des équations n'ont pas été restaurées correctement. Cliquez sur «Regénérer AU».
                  </p>
                </div>
              )}

              {(useMethodeFixed && methodeEdit) || rappelFormulas ? (
                <div className="rounded-lg bg-teal-50 border border-teal-100 px-3 py-2 text-xs text-teal-700 space-y-0.5">
                  <p className="font-medium">Ajouté en tête du .docx (non visible dans l'aperçu) :</p>
                  {useMethodeFixed && methodeEdit && <p>· {methodeEdit.split('\n')[0]}</p>}
                  {rappelFormulas && (
                    <p>· {rappelSelected?.filter(Boolean).length ?? rappelFormulas.length} formule(s) de rappel</p>
                  )}
                </div>
              ) : null}

              {/* Sélection des formules de rappel */}
              <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeRappel}
                    onChange={e => setIncludeRappel(e.target.checked)}
                    className="w-4 h-4 accent-teal-600"
                  />
                  Inclure les formules de rappel dans le .docx
                </label>

                {includeRappel && rappelFormulas && (
                  <div className="pl-6 space-y-1">
                    <p className="text-xs text-gray-400 mb-2">
                      L'élève choisit la bonne formule — décochez celles qui ne s'appliquent pas à ce document.
                    </p>
                    {rappelFormulas.map((formula, i) => {
                      const display = formula.replace(/^\[RAPPEL : /, '').replace(/\]$/, '')
                      return (
                        <label key={i} className="flex items-start gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rappelSelected?.[i] ?? true}
                            onChange={e => setRappelSelected(prev => {
                              const next = [...(prev ?? rappelFormulas.map(() => true))]
                              next[i] = e.target.checked
                              return next
                            })}
                            className="mt-0.5 w-3.5 h-3.5 accent-teal-600 flex-shrink-0"
                          />
                          <span className="text-xs text-gray-600 font-mono">{display}</span>
                        </label>
                      )
                    })}
                  </div>
                )}

                {includeRappel && !rappelFormulas && (
                  <p className="pl-6 text-xs text-gray-400">
                    Sélectionnez un chapitre reconnu pour accéder aux formules de rappel.
                  </p>
                )}
              </div>

              <button
                onClick={exporterAU}
                disabled={exporting || auValidation?.some(r => ['sans_doutes', 'math_restored'].includes(r.id) && !r.ok)}
                className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
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
                const vr = verificationResults[profil]
                const isVerif = verifying === profil
                const isExport = exportingProfil === profil
                return (
                  <div key={profil} className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50">
                      <span className="text-sm text-gray-800">{pd?.icon} {pd?.label}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => verifierExercice(profil)}
                          disabled={isVerif || !!vr}
                          className="btn-secondary text-xs py-1.5 px-3">
                          {isVerif ? 'Vérif…' : vr ? 'Vérifié ✓' : 'Vérifier'}
                        </button>
                        <button onClick={() => exporterProfil(profil)}
                          disabled={isExport}
                          className="btn-primary text-xs py-1.5 px-3">
                          {isExport ? 'Export…' : '⬇ Exporter'}
                        </button>
                      </div>
                    </div>
                    {vr && (
                      <div className={`px-3 py-2 text-xs whitespace-pre-wrap border-t ${
                        /non solvable|partiellement/i.test(vr)
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-green-50 text-green-800 border-green-200'
                      }`}>
                        {vr}
                      </div>
                    )}
                  </div>
                )
              })}
              <p className="text-xs text-gray-400">Vérification solvabilité : Thibaut (2016) dumas-01488139 · Fliti &amp; Avarello (2025) hal-05450529</p>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button onClick={sauvegarder}
              disabled={saving || saved || !texteFinal.trim()}
              className={saved ? 'btn-secondary text-sm' : 'btn-primary text-sm'}>
              {saved ? 'Sauvegardé ✓' : saving ? 'Enregistrement…' : 'Sauvegarder'}
            </button>
          </div>

          {saved && !feedback && (
            <div className="flex items-center gap-3 pt-3 border-t border-gray-100 mt-3">
              <span className="text-xs text-gray-500">Ça a fonctionné en classe ?</span>
              <button onClick={() => envoyerFeedback('positif')} className="text-xl hover:scale-110 transition-transform" title="Oui">👍</button>
              <button onClick={() => envoyerFeedback('negatif')} className="text-xl hover:scale-110 transition-transform" title="Non">👎</button>
            </div>
          )}
          {feedback && (
            <p className="text-xs text-gray-400 pt-3 border-t border-gray-100 mt-3">
              Feedback enregistré {feedback === 'positif' ? '👍' : '👎'} — merci
            </p>
          )}

          <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-3">
            Sources RISS — Dyscalculie : Thibaut (2016) dumas-01488139 · Le Cam &amp; Toussaint (2017) dumas-01549091 · Mahi Haddad &amp; Beaud (2025) dumas-05106961
          </p>
        </div>
      )}
    </div>
  )
}
