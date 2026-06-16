// Faithful manuscript parser for the Admin Writer PDF import flow.
//
// This is a TRANSCRIPTION helper, not an AI rewrite. It never changes wording —
// it only detects chapter-heading boundaries and SLICES the source text into
// chapters. Each chapter body is a verbatim substring of the source (whitespace
// trimmed at the edges only). If it cannot confidently find chapters, it says so
// and the caller falls back to a single-chapter import.

export interface ParsedChapter {
  title: string
  content: string // verbatim slice of source_text (edge-trimmed only)
}

export interface ManuscriptParseResult {
  chapters: ParsedChapter[]
  confidence: 'high' | 'low'
  warnings: string[]
  /** Text before the first detected chapter (front matter, copyright, TOC) — NOT imported. */
  droppedPreamble: string
}

const NUM_WORDS =
  'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|' +
  'fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|' +
  'fifty|sixty|seventy|eighty|ninety'

// A heading is "Chapter <n>" / "Part <n>" at the start of a line (or page break),
// where <n> is a digit run, a roman numeral, or a spelled-out number. Conservative
// on purpose: false positives are worse than a clean single-chapter fallback.
const HEADING_SOURCE =
  `(^|\\n)[ \\t]*((?:chapter|part)\\s+(?:\\d{1,3}|[ivxlcdm]{1,7}|${NUM_WORDS})\\b)`

function titleCase(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => {
      if (/^[ivxlcdm]+$/i.test(w)) return w.toUpperCase() // roman numerals
      if (/^\d+$/.test(w)) return w
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(' ')
}

function countWords(s: string): number {
  const t = s.trim()
  return t ? t.split(/\s+/).length : 0
}

export function parseManuscript(sourceText: string): ManuscriptParseResult {
  const text = sourceText ?? ''
  const warnings: string[] = []

  // Find all heading positions.
  const re = new RegExp(HEADING_SOURCE, 'gi')
  const headings: { start: number; end: number; title: string }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const headingText = m[2]
    const start = m.index + m[0].indexOf(headingText)
    headings.push({ start, end: start + headingText.length, title: titleCase(headingText) })
    if (re.lastIndex === m.index) re.lastIndex++ // zero-width guard
  }

  // Need at least two headings to trust the structure.
  if (headings.length < 2) {
    return {
      chapters: [],
      confidence: 'low',
      warnings: ['Could not confidently detect chapter headings in this manuscript.'],
      droppedPreamble: text.trim(),
    }
  }

  const droppedPreamble = text.slice(0, headings[0].start).trim()

  const chapters: ParsedChapter[] = headings.map((h, i) => {
    const bodyEnd = i + 1 < headings.length ? headings[i + 1].start : text.length
    return { title: h.title, content: text.slice(h.end, bodyEnd).trim() }
  })

  // Confidence + warnings.
  const nonEmpty = chapters.filter(c => c.content.length > 0)
  const confidence: 'high' | 'low' = nonEmpty.length >= 2 ? 'high' : 'low'

  const totalLen = chapters.reduce((sum, c) => sum + c.content.length, 0)
  const maxLen = Math.max(...chapters.map(c => c.content.length))
  if (chapters.length > 2 && totalLen > 0 && maxLen / totalLen > 0.9) {
    warnings.push('One chapter contains almost all of the text — detection may have missed headings. Review the preview.')
  }
  if (chapters.some(c => c.content.length === 0)) {
    warnings.push('Some detected chapters have no text.')
  }
  if (droppedPreamble.length > 40) {
    warnings.push(
      `${droppedPreamble.length.toLocaleString()} characters before the first chapter (title page, copyright, table of contents) were not imported.`
    )
  }

  return { chapters, confidence, warnings, droppedPreamble }
}

export { countWords }
