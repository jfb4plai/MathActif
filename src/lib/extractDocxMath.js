/**
 * Extraction côté navigateur d'un fichier DOCX.
 * Ouvre le ZIP, extrait word/document.xml, envoie à /api/extract-math.
 * Retourne { text: string }
 */
import JSZip from 'jszip'

export async function extractDocxMath(file) {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Fichier trop lourd (max 10 Mo).')
  }

  const arrayBuffer = await file.arrayBuffer()
  let zip
  try {
    zip = await JSZip.loadAsync(arrayBuffer)
  } catch {
    throw new Error('Fichier DOCX invalide ou corrompu.')
  }

  const xmlFile = zip.file('word/document.xml')
  if (!xmlFile) {
    throw new Error('Structure DOCX invalide — word/document.xml introuvable.')
  }

  const xml = await xmlFile.async('string')

  const res = await fetch('/api/extract-math', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ xml }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erreur extraction DOCX')
  return { text: data.text }
}
