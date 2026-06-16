// Faithful manuscript parser for the Admin Writer PDF import flow.
//
// This is a TRANSCRIPTION helper, not an AI rewrite. It never changes wording —
// it only detects chapter-heading boundaries, SLICES the source text into
// chapters, and removes print-layout artifacts (running headers, page numbers)
// while preserving paragraph breaks. Each chapter body is built from verbatim
// substrings of the source. If it cannot confidently find chapters, it says so
// and the caller falls back to a single-chapter import.
//
// Detection runs in two passes:
//   1. Chapter/Part headings ("Chapter 1", "Chapter One", "Part I").
//   2. Table-of-Contents fallback for titled chapters (memoir/nonfiction, the
//      Reedsy default) — only runs when pass 1 finds fewer than 2 chapters.
//
// The expected input is the paragraph-aware extraction from extractPdfText.ts
// (one paragraph per line). It also tolerates the older flat page-per-line
// format so previously-imported books still parse.

export interface ParsedChapter {
  title: string
  content: string
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

const HEADING_SOURCE =
  `(^|\\n)[ \\t]*((?:chapter|part)\\s+(?:\\d{1,3}|[ivxlcdm]{1,7}|${NUM_WORDS})\\b)`

function titleCase(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => {
      if (/^[ivxlcdm]+$/i.test(w)) return w.toUpperCase()
      if (/^\d+$/.test(w)) return w
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(' ')
}

function countWords(s: string): number {
  const t = s.trim()
  return t ? t.split(/\s+/).length : 0
}

// ---- Layout cleanup (running headers + page numbers; preserves paragraphs) ----
//
// Operates on a chapter body. Input paragraphs are '\n'-separated (paragraph-aware
// extraction); output paragraphs are '\n\n'-separated, ready for scene.content.
// Whitespace/artifact removal only — never alters words.
export function cleanChapterBody(body: string): string {
  const paragraphs: string[] = []
  for (const raw of body.split('\n')) {
    let p = raw.trim()
    if (!p) continue
    // Standalone page number on its own line.
    if (/^\d{1,4}$/.test(p)) continue
    // All-caps running-header line (book title or chapter title in caps).
    if (/^[^a-z]+$/.test(p) && /[A-Z]/.test(p) && p.length <= 60) continue
    // Running header glued to the start of a paragraph: a multi-word ALL-CAPS run
    // immediately followed by a lowercase-containing word. (Single all-caps words
    // like acronyms are left alone.)
    p = p.replace(/^([A-Z][A-Z’'.,&()\-]*(?:\s+[A-Z][A-Z’'.,&()\-]*)+)\s+(?=[A-Za-z]*[a-z])/, '')
    // Trailing page number after sentence-ending punctuation (flat-format pages).
    p = p.replace(/([.!?…"'’)])\s+\d{1,4}$/, '$1')
    p = p.trim()
    if (p) paragraphs.push(p)
  }
  return paragraphs.join('\n\n')
}

// Clean the whole manuscript (used by the single-chapter fallback).
export function cleanManuscriptText(text: string): string {
  return cleanChapterBody(text)
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
    if (re.lastIndex === m.index) re.lastIndex++
  }
  return headings
}

// ---- Pass 2: Table-of-Contents fallback (titled chapters) ----

// Extract ordered titles from TOC text — each title is followed by its page
// number, e.g. "The First Silence 1 Learning to Belong 3". Single or multiple
// spaces between title and number are both accepted.
function parseTocTitles(tocText: string): string[] {
  const titles: string[] = []
  const re = /([^\d\n]+?)\s+\d{1,4}(?=\s|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tocText)) !== null) {
    const t = m[1].trim()
    if (t) titles.push(t)
  }
  return titles
}

// A page-line begins a chapter when it equals the title (paragraph-aware format)
// or starts with the title followed by 2+ spaces (older flat format). Matching is
// case-sensitive, so ALL-CAPS running headers ("A QUIET LIFE, ON PURPOSE") never
// match a Title-Case chapter title.
function lineStartsWithTitle(line: string, title: string): boolean {
  const trimmed = line.replace(/^[ \t]+/, '')
  if (trimmed === title) return true
  if (trimmed.startsWith(title)) return /^[ \t]{2,}/.test(trimmed.slice(title.length))
  return false
}

function detectTocHeadings(text: string): Heading[] {
  const lines = text.split('\n')

  const offsets: number[] = []
  let pos = 0
  for (const l of lines) {
    offsets.push(pos)
    pos += l.length + 1
  }

  const tocIdx = lines.findIndex(l => /^\s*contents\b/i.test(l))
  if (tocIdx === -1) return []

  // Gather the TOC text: the remainder of the Contents line plus following lines
  // that still look like TOC entries (contain a page number). Stops at the first
  // chapter heading line (which has no digits).
  let tocText = lines[tocIdx].replace(/^\s*contents\b/i, '')
  for (let j = tocIdx + 1; j < lines.length; j++) {
    if (/\d/.test(lines[j]) && /[A-Za-z]/.test(lines[j]) && lines[j].length < 600) {
      tocText += ' ' + lines[j]
    } else {
      break
    }
  }

  const titles = parseTocTitles(tocText)
  if (titles.length < 2) return []

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
    if (foundLine === -1) continue

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
    return { title: h.title, content: cleanChapterBody(text.slice(h.end, bodyEnd)) }
  })

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
