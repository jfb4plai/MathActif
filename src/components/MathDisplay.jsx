/**
 * Rend un texte contenant des blocs $LaTeX$ avec KaTeX.
 * Lecture seule — pas d'édition in-app.
 */
import katex from 'katex'

function renderSegment(segment, index) {
  if (segment.startsWith('$') && segment.endsWith('$') && segment.length > 2) {
    const latex = segment.slice(1, -1)
    try {
      const html = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
        output: 'html',
      })
      return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />
    } catch {
      return <span key={index} style={{ color: '#ef4444', fontFamily: 'monospace' }}>{segment}</span>
    }
  }
  return segment ? <span key={index}>{segment}</span> : null
}

export default function MathDisplay({ text, className = '' }) {
  if (!text) return null

  return (
    <div className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {text.split('\n').map((line, li) => (
        <div key={li}>
          {line.split(/(\$[^$\n]+\$)/g).map((seg, si) => renderSegment(seg, si))}
        </div>
      ))}
    </div>
  )
}
