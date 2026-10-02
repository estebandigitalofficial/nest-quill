// Deterministic prose-quality signals for the Stage 2 book.
//
// Pure module: no Deno / Supabase / network. Imported by the Edge Function
// and exercised by Node tests (quality.test.ts).
//
// This is NOT a literary judge. It flags a small set of pathological,
// mechanically detectable patterns that generic AI picture books fall into:
//   errors   → fed back once through the existing bounded repair
//   warnings → logged only (signal names, never text)
// Thresholds are deliberately conservative: one legitimate occurrence of
// any phrase never triggers a repair, and the young band is allowed its
// refrains.

export type AgeBand = 'young' | 'middle' | 'teen' | 'adult'

export interface QualityIssue {
  /** Stable signal name. The only thing that reaches processing_logs. */
  code: string
  /** Specific instruction for the repair prompt. May quote a short fragment. */
  message: string
}

export interface QualityReport {
  errors: QualityIssue[]
  warnings: QualityIssue[]
}

export interface QualityPage { page: number; text: string; image_description: string }
export interface QualityBook { pages: QualityPage[] }

/** Target words per page by band (mirrors the band_*_words_per_page seeds). */
export const WORD_RANGES: Record<AgeBand, [number, number]> = {
  young: [20, 40],
  middle: [60, 100],
  teen: [100, 160],
  adult: [80, 150],
}
/** Only gross violations count: below 40% of the minimum or above 200% of the maximum. */
const LENGTH_LOW_FACTOR = 0.4
const LENGTH_HIGH_FACTOR = 2.0

export function wordCount(text: string): number {
  return (text.match(/[A-Za-zÀ-ÿ0-9'’]+/g) ?? []).length
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+(?=["'“‘(]?[A-ZÀ-Ý0-9])/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-zà-ÿ0-9' ]+/gi, ' ').replace(/\s+/g, ' ').trim()
}

function firstWords(s: string, n: number): string {
  return normalize(s).split(' ').filter(Boolean).slice(0, n).join(' ')
}

/** Stock constructions that mark a generic AI children's story. Label → pattern. */
export const STOCK_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'once upon a time', re: /\bonce upon a time\b/i },
  { label: 'little did X know', re: /\blittle did \w+ know\b/i },
  { label: 'with a heart full of', re: /\bwith a heart full of\b/i },
  { label: 'with newfound', re: /\bwith newfound\b/i },
  { label: 'and so the adventure began', re: /\band so (?:their|the|his|her|its) (?:\w+ )?adventure (?:began|had begun)\b/i },
  { label: 'a day X would never forget', re: /\ba day \w+ would never forget\b/i },
  { label: 'from that day forward', re: /\bfrom that day (?:forward|on|onward|onwards)\b/i },
  { label: 'the real treasure was', re: /\bthe real treasure (?:was|had been|is)\b/i },
  { label: 'together, they', re: /(?:^|[.!?]\s+)together,? they\b/i },
]

/** Explicit moral announcements, checked on the final pages only. */
export const ANNOUNCED_MORAL_RE = /\b(?:learned|learnt|realized|realised|understood|discovered|knew now) that\b|\bthe (?:moral|lesson) (?:of|is|was)\b|\bfrom that day (?:forward|on|onward)\b/i

/** Visual-production language that should never appear in reader prose. */
export const IMAGE_DIRECTION_RE = /\b(?:illustration|illustrated|illustrator|close-up|wide shot|camera|watercolou?r style|cartoon style|digital art|pencil sketch|the image shows|this image|depicts|rendered in|in the style of|foreground|background)\b/i

/** Overused reaction tics and sparkle words. Warning-only. */
export const TIC_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'deep breath', re: /\b(?:took|takes|taking|take) a deep breath\b/gi },
  { label: 'eyes widened', re: /\beyes (?:widened|went wide|grew wide)\b/gi },
  { label: 'grinned', re: /\bgrinn(?:ed|ing)\b/gi },
  { label: 'gasped', re: /\bgasp(?:ed|ing)\b/gi },
  { label: 'smiled', re: /\bsmil(?:ed|ing)\b/gi },
  { label: 'sparkle/glow/shimmer', re: /\b(?:sparkl|glow|shimmer|twinkl)\w*\b/gi },
]

const TEASER_RE = /(?:what (?:would|could|might) happen next|little did|was about to|but (?:then|that was)|\.\.\.$|…$)/i

export function assessBookQuality(book: QualityBook, opts: { ageBand: AgeBand; pageCount: number }): QualityReport {
  const errors: QualityIssue[] = []
  const warnings: QualityIssue[] = []
  const pages = [...book.pages].sort((a, b) => a.page - b.page)
  const n = pages.length
  if (n === 0) return { errors, warnings }
  const young = opts.ageBand === 'young'

  // ── A. near-empty pages (repair) ──────────────────────────────────────
  const nearEmpty = pages.filter(p => wordCount(p.text) < 5).map(p => p.page)
  if (nearEmpty.length > 0) {
    errors.push({ code: 'near_empty_page', message: `page${nearEmpty.length > 1 ? 's' : ''} ${nearEmpty.join(', ')} ${nearEmpty.length > 1 ? 'have' : 'has'} almost no text — write the full page` })
  }

  // ── B. gross word-count extremes by band ──────────────────────────────
  const [lo, hi] = WORD_RANGES[opts.ageBand]
  const tooShort = pages.filter(p => wordCount(p.text) < lo * LENGTH_LOW_FACTOR && wordCount(p.text) >= 5).map(p => p.page)
  const tooLong = pages.filter(p => wordCount(p.text) > hi * LENGTH_HIGH_FACTOR).map(p => p.page)
  const extreme = tooShort.length + tooLong.length
  if (extreme > 0) {
    const detail = [
      tooShort.length ? `far too short: page ${tooShort.join(', ')}` : '',
      tooLong.length ? `far too long: page ${tooLong.join(', ')}` : '',
    ].filter(Boolean).join('; ')
    const msg = `${detail} — this age expects about ${lo}-${hi} words per page`
    if (extreme >= Math.max(3, Math.ceil(n * 0.25))) errors.push({ code: 'page_length_extreme', message: msg })
    else warnings.push({ code: 'page_length_outlier', message: msg })
  }

  // ── C. repeated sentence openings ─────────────────────────────────────
  const sentencesByPage = pages.map(p => splitSentences(p.text))
  const allSentences = sentencesByPage.flat()
  const S = allSentences.length
  const openerCounts = new Map<string, number>()
  for (const s of allSentences) {
    if (wordCount(s) < 3) continue
    const key = firstWords(s, 2)
    if (!key) continue
    openerCounts.set(key, (openerCounts.get(key) ?? 0) + 1)
  }
  let topOpener = ''
  let topCount = 0
  for (const [k, c] of openerCounts) if (c > topCount) { topOpener = k; topCount = c }
  if (S >= 8 && topCount >= 5 && topCount / S >= 0.3) {
    errors.push({ code: 'repeated_openings', message: `${topCount} of ${S} sentences begin with "${topOpener}" — vary how sentences start` })
  } else if (topCount >= 4 && topCount / S >= 0.2) {
    warnings.push({ code: 'repeated_openings_mild', message: `${topCount} of ${S} sentences begin with "${topOpener}"` })
  }

  // page openings: same first three words on many pages
  const pageStarts = new Map<string, number[]>()
  for (const p of pages) {
    const k = firstWords(p.text, 3)
    if (!k) continue
    pageStarts.set(k, [...(pageStarts.get(k) ?? []), p.page])
  }
  for (const [k, pg] of pageStarts) {
    if (pg.length >= 4 && pg.length / n >= 0.3) {
      const issue = { code: 'repeated_page_openings', message: `pages ${pg.join(', ')} all open with "${k}" — give pages different openings` }
      if (young) warnings.push(issue); else errors.push(issue)
    }
  }

  // ── D. verbatim repeated sentences across pages ───────────────────────
  const sentencePages = new Map<string, Set<number>>()
  sentencesByPage.forEach((sentences, i) => {
    for (const s of sentences) {
      if (wordCount(s) < 7) continue
      const k = normalize(s)
      if (!sentencePages.has(k)) sentencePages.set(k, new Set())
      sentencePages.get(k)!.add(pages[i].page)
    }
  })
  const repeated = [...sentencePages.entries()].filter(([, pg]) => pg.size >= 3)
  if (repeated.length > 0) {
    const worst = repeated.sort((a, b) => b[1].size - a[1].size)[0]
    const issue = { code: 'repeated_sentences', message: `the sentence "${worst[0].slice(0, 60)}…" appears on ${worst[1].size} pages — keep a refrain only if the story truly needs it, otherwise rewrite` }
    if (young) warnings.push({ ...issue, code: 'refrain_detected' })
    else if (repeated.length >= 2 || worst[1].size >= 4) errors.push(issue)
    else warnings.push(issue)
  }

  // ── E. stock phrases ──────────────────────────────────────────────────
  const fullText = pages.map(p => p.text).join('\n')
  const stockHits: string[] = []
  for (const { label, re } of STOCK_PATTERNS) {
    const count = (fullText.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) ?? []).length
    for (let i = 0; i < count; i++) stockHits.push(label)
  }
  if (stockHits.length >= 2) {
    errors.push({ code: 'stock_phrases', message: `stock phrases used: ${[...new Set(stockHits)].slice(0, 4).join('; ')} — replace with specific, earned sentences` })
  } else if (stockHits.length === 1) {
    warnings.push({ code: 'stock_phrase_once', message: `one stock phrase: ${stockHits[0]}` })
  }

  // ── F. announced moral on the final pages ─────────────────────────────
  const lastTwo = pages.slice(-2).map(p => p.text).join(' ')
  if (ANNOUNCED_MORAL_RE.test(lastTwo)) {
    const issue = { code: 'announced_moral', message: 'the ending announces the lesson ("…learned that…" / "the moral is…") — show it through what the hero now does differently instead' }
    if (young) warnings.push(issue); else errors.push(issue)
  }

  // ── G. exclamation marks ──────────────────────────────────────────────
  const bangs = (fullText.match(/!/g) ?? []).length
  if (S >= 8 && bangs >= 8 && bangs / S > 0.35) {
    errors.push({ code: 'exclamation_excess', message: `${bangs} exclamation marks across ${S} sentences — keep only the few that matter` })
  } else if (bangs >= 5 && S > 0 && bangs / S > 0.2) {
    warnings.push({ code: 'exclamation_heavy', message: `${bangs} exclamation marks across ${S} sentences` })
  }

  // ── H. image directions leaking into prose ────────────────────────────
  const leakPages = pages.filter(p => IMAGE_DIRECTION_RE.test(p.text)).map(p => p.page)
  if (leakPages.length >= 2) {
    errors.push({ code: 'prose_contains_image_directions', message: `page ${leakPages.join(', ')} read like illustration instructions — page text must be story prose only; put visual direction in image_description` })
  } else if (leakPages.length === 1) {
    warnings.push({ code: 'prose_image_language_once', message: `page ${leakPages[0]} contains illustration-style wording` })
  }

  // ── I. image description quality (warning only — image pipeline unchanged) ──
  const repeatsText = pages.filter(p => {
    const t = normalize(p.text)
    const d = normalize(p.image_description)
    if (d.length < 40) return false
    return t === d || t.includes(d) || d.includes(t)
  }).map(p => p.page)
  if (repeatsText.length >= 2) {
    warnings.push({ code: 'image_description_repeats_text', message: `page ${repeatsText.join(', ')} image descriptions repeat the page text` })
  }
  const thinDesc = pages.filter(p => wordCount(p.image_description) < 6).map(p => p.page)
  if (thinDesc.length > 0) {
    warnings.push({ code: 'image_description_thin', message: `page ${thinDesc.join(', ')} image descriptions are too thin to illustrate` })
  }

  // ── J. reaction tics and sparkle words (warning only) ─────────────────
  const ticThreshold = Math.max(4, Math.ceil(n * 0.25))
  const tics: string[] = []
  for (const { label, re } of TIC_PATTERNS) {
    const c = (fullText.match(re) ?? []).length
    if (c >= ticThreshold) tics.push(`${label} ×${c}`)
  }
  if (tics.length > 0) warnings.push({ code: 'reaction_tics', message: `overused: ${tics.join(', ')}` })

  // ── K. page-ending teasers and rhetorical questions (warning only) ────
  const lastSentences = sentencesByPage.map(s => s[s.length - 1] ?? '')
  const teasers = lastSentences.filter(s => TEASER_RE.test(s)).length
  if (n >= 4 && teasers >= 3 && teasers / n >= 0.4) {
    warnings.push({ code: 'teaser_endings', message: `${teasers} of ${n} pages end on a cliff-hanger tease` })
  }
  const questions = lastSentences.filter(s => s.trim().endsWith('?')).length
  if (n >= 4 && questions >= 3 && questions / n >= 0.4) {
    warnings.push({ code: 'rhetorical_endings', message: `${questions} of ${n} pages end with a question` })
  }

  return { errors, warnings }
}
