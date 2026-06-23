const MATH_RE = /\$[^$\n]+\$/g

export function protectMath(text) {
  const map = []
  const protected_ = text.replace(MATH_RE, match => {
    const token = `«MATH_${map.length}»`
    map.push(match)
    return token
  })
  return { protected: protected_, map }
}

export function restoreMath(text, map) {
  return text.replace(/«MATH_(\d+)»/g, (_, i) => map[Number(i)] ?? '')
}
