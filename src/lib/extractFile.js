/**
 * Extraction client-side pour MathActif.
 * PDF / image → base64 JPEG → /api/extract (Vision OCR maths)
 * DOCX → géré séparément via extractDocxMath (JSZip + /api/extract-math)
 */

import * as pdfjsLib from 'pdfjs-dist'
import PDFWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWorker

const MAX_PAGES = 6

function imageFileToBase64Jpeg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.92).split(',')[1])
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Impossible de charger l\'image.')) }
    img.src = url
  })
}

async function renderPagesToBase64(pdf) {
  const count = Math.min(pdf.numPages, MAX_PAGES)
  const images = []
  for (let i = 1; i <= count; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
    images.push(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
  }
  return images
}

export async function extractFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'pdf') {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const totalPages = pdf.numPages
    const pageWarning = totalPages > MAX_PAGES ? { total: totalPages, extracted: MAX_PAGES } : null
    const images = await renderPagesToBase64(pdf)
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erreur OCR')
    return { text: data.text, pageWarning }
  }

  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    const base64 = await imageFileToBase64Jpeg(file)
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [base64] }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erreur OCR')
    return { text: data.text }
  }

  throw new Error('Format non supporté — utilisez PDF, image JPG/PNG/WebP, ou .docx.')
}
