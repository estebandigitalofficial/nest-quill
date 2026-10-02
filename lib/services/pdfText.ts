// Text safety for pdf-lib's standard (WinAnsi-encoded) fonts.
//
// The 14 standard PDF fonts can only encode the WinAnsi character set. Any
// other code point makes pdf-lib throw ("WinAnsi cannot encode ...") and the
// whole render fails. This keeps every WinAnsi character (accents, curly
// quotes, dashes, ellipsis, euro ...) and drops the rest (emoji, dingbats
// such as U+2726, CJK) so a decorative or pasted character can never take
// the book down with it. Pure; see pdfText.test.ts. Source is ASCII-only on
// purpose: characters are built from code points.

const WINANSI_EXTRA = new Set<number>([
  0x152, 0x153, 0x160, 0x161, 0x178, 0x17d, 0x17e, 0x192, 0x2c6, 0x2dc,
  0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2020, 0x2021,
  0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac, 0x2122,
])

const cp = (n: number) => String.fromCodePoint(n)
// U+2010..U+2012 (hyphen, non-breaking hyphen, figure dash) and U+2212 (minus) -> "-"
const HYPHEN_LIKE = new RegExp('[' + cp(0x2010) + '-' + cp(0x2012) + cp(0x2212) + ']', 'g')
// U+00A0 no-break space -> " "
const NBSP = new RegExp(cp(0xa0), 'g')
// U+2028 / U+2029 line and paragraph separators -> newline
const LINE_SEPARATORS = new RegExp('[' + cp(0x2028) + cp(0x2029) + ']', 'g')

export function isWinAnsiChar(code: number): boolean {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return true
  if (code >= 0x20 && code <= 0x7e) return true
  if (code >= 0xa0 && code <= 0xff) return true
  return WINANSI_EXTRA.has(code)
}

/** Replace a few common look-alikes, then drop anything the standard fonts cannot encode. */
export function toWinAnsiSafe(text: string | null | undefined): string {
  if (!text) return ''
  const replaced = text
    .normalize('NFC')
    .replace(HYPHEN_LIKE, '-')
    .replace(NBSP, ' ')
    .replace(LINE_SEPARATORS, '\n')
  let out = ''
  for (const ch of replaced) {
    const code = ch.codePointAt(0) ?? 0
    if (isWinAnsiChar(code)) out += ch
  }
  return out.replace(/[ \t]{2,}/g, ' ').trim()
}

/** The back-page closing line: plain text, standard-font safe. */
export const PDF_END_TEXT = 'The End'
