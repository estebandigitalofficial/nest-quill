// Faithful manuscript parser for the Admin Writer PDF import flow.
//
// This is a TRANSCRIPTION helper, not an AI rewrite. It never changes wording —
// it only detects chapter-heading boundaries and SLICES the source text into
// chapters. Each chapter body is a verbatim substring of the source (whitespace
// trimmed at the edges only). If it cannot confidently find chapters, it says so
// and the caller falls back to a single-chapter import.
//
// Detection runs in two passes:
//   1. Chapter/Part headings ("Chapter 1", "Chapter One", "Part I").
//   2. Table-of-Contents fallback for titled chapters (memoir/nonfiction, the
//      Reedsy default) — only runs when pass 1 finds fewer than 2 chapters.

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

interface Heading {
  start: number // offset of the heading in source_text
  end: number // offset where the body begins (just after the heading text)
  title: string
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

// ---- Pass 1: explicit Chapter/Part headings ----
function detectChapterHeadings(text: string): Heading[] {
  const re = new RegExp(HEADING_SOURCE, 'gi')
  const headings: Heading[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const headingText = m[2]
    const start = m.index + m[0].indexOf(headingText)
    headings.push({ start, end: start + headingText.length, title: titleCase(headingText) })
    if (re.lastIndex === m.index) re.lastIndex++ // zero-width guard
  }
  return headings
}

// ---- Pass 2: Table-of-Contents fallback (titled chapters) ----

// Extract ordered titles from a "Contents …" line. The TOC lists each title
// followed by its page number, e.g. "The First Silence   1 Learning to Belong   3".
// We split on the "<title>  <pagenumber>" shape.
function parseTocTitles(contentsLine: string): string[] {
  const body = contentsLine.replace(/^\s*contents\b/i, '')
  const titles: string[] = []
  const re = /([^\d]+?)\s{2,}\d+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const t = m[1].trim()
    if (t) titles.push(t)
  }
  return titles
}

// A page-line begins a chapter when (case-sensitively) it starts with the exact
// TOC title followed by two or more spaces. Case-sensitivity is deliberate: it
// excludes ALL-CAPS running headers ("A QUIET LIFE, ON PURPOSE") which are not
// chapter starts.
function lineStartsWithTitle(line: string, title: string): boolean {
  const trimmed = line.replace(/^[ \t]+/, '')
  if (!trimmed.startsWith(title)) return false
  return /^[ \t]{2,}/.test(trimmed.slice(title.length))
}

function detectTocHeadings(text: string): Heading[] {
  const lines = text.split('\n')

  // Character offset of the start of each line.
  const offsets: number[] = []
  let pos = 0
  for (const l of lines) {
    offsets.push(pos)
    pos += l.length + 1 // account for the '\n'
  }

  const tocIdx = lines.findIndex(l => /^\s*contents\b/i.test(l))
  if (tocIdx === -1) return []

  const titles = parseTocTitles(lines[tocIdx])
  if (titles.length < 2) return []

  // Locate each title (in order) at a chapter-start page-line after the TOC.
  const headings: Heading[] = []
  let searchFrom = tocIdx + 1
  for (const title of titles) {
    let foundLine = -1
    for (let li = searchFrom; li < lines.length; li++) {
      if (lineStartsWithTitle(lines[li], title)) {
        foundLine = li
        break
      }
    }
    if (foundLine === -1) continue // title never appears as a chapter start — skip it

    const leading = lines[foundLine].length - lines[foundLine].replace(/^[ \t]+/, '').length
    const start = offsets[foundLine] + leading
    headings.push({ start, end: start + title.length, title })
    searchFrom = foundLine + 1
  }

  return headings
}

export function parseManuscript(sourceText: string): ManuscriptParseResult {
  const text = sourceText ?? ''
  const warnings: string[] = []

  // Pass 1: explicit Chapter/Part headings.
  let headings = detectChapterHeadings(text)

  // Pass 2: Table-of-Contents fallback for titled chapters.
  if (headings.length < 2) {
    const toc = detectTocHeadings(text)
    if (toc.length >= 2) headings = toc
  }

  // Neither pass found a usable structure → caller uses single-chapter fallback.
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
