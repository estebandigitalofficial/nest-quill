// Header branding, footer Home links and mobile footer flow (Esteban, 2026-10-15).
// Run: node --experimental-strip-types --test lib/layout/publicShell.test.ts
//
// Three founder requirements, pinned against the source so a later edit
// cannot quietly undo them:
//   1. On phones every public page reaches the footer only by scrolling to
//      the bottom of the document, as the homepage does. The page shells
//      keep their desktop viewport-locked layout (h-dvh plus an inner
//      overflow-y-auto region) but only from md up; below md they are
//      min-h-dvh with no inner scroll region, so the footer sits in normal
//      document flow above the fixed MobileTabBar's spacer.
//   2. The header's top-left branding is the same full-colour graphic the
//      footer uses on its light surface (public/brand/logo.webp), linking
//      to / with an accessible Home label.
//   3. In the footer the graphic logo and the "Nest & Quill" wordmark are
//      two independent Home links and the operator line is plain text.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

// Every current launch surface that renders the canonical SiteFooter inside
// a viewport shell. Deferred products (classroom, homeschool, learning,
// writer, publish) are 404 for the public and deliberately not listed.
const PUBLIC_SHELLS = [
  'components/legal/LegalDocument.tsx',   // /privacy, /terms
  'app/pricing/page.tsx',
  'app/contact/page.tsx',
  'app/(create)/layout.tsx',
  'app/(auth)/layout.tsx',                // /login, /signup, /forgot-password, ...
  'app/unsubscribe/page.tsx',
  'app/account/page.tsx',
  'app/account/archived/page.tsx',
  'components/story/StoryStatusPage.tsx', // /story/[requestId] status and error shells
]

test('1. mobile footer is in document flow on every public shell; desktop shell unchanged', () => {
  for (const f of PUBLIC_SHELLS) {
    const src = read(f)
    assert.match(src, /SiteFooter|\{footer\}/, `${f} renders the shared footer`)
    const shells = [...src.matchAll(/className="([^"]*\bh-dvh\b[^"]*)"/g)].map(m => m[1])
    assert.ok(shells.length > 0, `${f} has a page shell`)
    for (const cls of shells) {
      assert.match(cls, /\bmin-h-dvh\b/, `${f}: shell grows with its content on phones (${cls})`)
      assert.match(cls, /\bmd:h-dvh\b/, `${f}: desktop keeps the viewport-locked shell (${cls})`)
      assert.doesNotMatch(cls, /(^|\s)h-dvh\b/, `${f}: no unprefixed h-dvh, which would pin the footer on phones (${cls})`)
    }
    // No inner scroll region below md: the document itself scrolls, so the
    // footer is reached only at the real bottom of the page.
    assert.doesNotMatch(src, /(^|[\s"])overflow-y-auto\b/m, `${f}: an unprefixed overflow-y-auto would scroll the content behind a pinned footer on phones`)
    assert.match(src, /\bmd:overflow-y-auto\b/, `${f}: desktop keeps its inner scroll region`)
  }
})

test('2. the footer itself is never fixed, sticky or pinned', () => {
  const footer = read('components/layout/SiteFooter.tsx')
  const tag = footer.match(/<footer className=\{`([^`]*)`\}/)?.[1] ?? footer.match(/<footer className="([^"]*)"/)?.[1]
  assert.ok(tag, 'footer element found')
  assert.doesNotMatch(tag!, /\b(fixed|sticky|absolute|bottom-0|inset)\b/, `footer is in normal flow (${tag})`)
  // The spacer that keeps the fixed tab bar off the footer on phones stays.
  assert.match(footer, /\{tabBar && <div className="h-\[calc\(3\.5rem\+1px\)\] md:hidden"/, 'tab-bar spacer (56px tab bar plus its 1px border) follows the footer on phones')
  // The homepage is the behavioural reference and stays in plain flow, light surface, no tab bar.
  assert.match(read('app/page.tsx'), /<SiteFooter tabBar=\{false\} surface="light" \/>/)
})

test('3. header branding is the footer logo, linking home with an accessible label', () => {
  const header = read('components/layout/SiteHeader.tsx')
  const brand = header.match(/<Link href="\/"[^>]*>\s*<Image[^>]*\/>\s*<\/Link>/)?.[0]
  assert.ok(brand, 'the header has exactly one brand link wrapping one image')
  assert.match(brand!, /aria-label=\{`Nest & Quill — \$\{t\.nav\.home\}`\}/, 'the Home link is labelled in the site language')
  assert.match(brand!, /src="\/brand\/logo\.webp"/, 'same graphic as the light footer')
  assert.match(brand!, /alt="Nest & Quill"/)
  assert.match(brand!, /width=\{800\} height=\{800\}/, 'intrinsic size declared, so the ratio is preserved')
  assert.match(brand!, /object-cover/, 'the square file is cropped to its artwork band, not stretched')
  assert.doesNotMatch(header, /fav\.webp|<span>Nest &amp; Quill<\/span>/, 'the old quill + text wordmark is gone')
  // The header shell is unchanged: 60px row, sticky, same nav, controls and menu.
  assert.match(header, /h-\[60px\]/)
  for (const part of ['<LanguageSwitcher', '<UserControls flags={flags} />', '<MobileMenu flags={flags} />', 'navLinks(flags).map']) assert.ok(header.includes(part), part)
  // The light footer uses the very same file, so there is one brand graphic, not two.
  assert.match(read('components/layout/SiteFooter.tsx'), /<Image src="\/brand\/logo\.webp"/)
})

test('4. footer logo and wordmark are independent Home links; the operator line is plain text', () => {
  const footer = read('components/layout/SiteFooter.tsx')
  const lockup = footer.slice(footer.indexOf('<div className="flex ls:hidden items-center gap-3 text-left">'), footer.indexOf('<p className="order-last'))
  assert.ok(lockup.length > 0, 'brand lockup found')
  const links = [...lockup.matchAll(/<Link href="\/"/g)]
  assert.equal(links.length, 2, 'exactly two Home links in the lockup')
  // Link 1 wraps only the image (both surfaces), with an accessible label.
  assert.match(lockup, /<Link href="\/" aria-label=\{`Nest & Quill — \$\{t\.nav\.home\}`\} className="shrink-0">\s*\{surface === 'dark'\s*\? <Image src=\{footerLogoUrl\}[^\n]*\n\s*: <Image src="\/brand\/logo\.webp"[^\n]*\}\s*<\/Link>/)
  // Link 2 wraps only the wordmark text.
  assert.match(lockup, /<Link href="\/" className=\{`\$\{c\.link\} transition-colors`\}>Nest &amp; Quill<\/Link>/)
  // The operator line is outside both links and still the approved wording.
  const operator = lockup.match(/<p className=\{`text-xs mt-0\.5 \$\{c\.product\}`\}>\{t\.footer\.product\}<\/p>/)
  assert.ok(operator, 'operator line rendered from the dictionary')
  assert.doesNotMatch(lockup, /<Link[^>]*>[^<]*\{t\.footer\.product\}/, 'operator line is not inside a link')
  const afterWordmark = lockup.slice(lockup.indexOf('Nest &amp; Quill</Link>'))
  assert.ok(afterWordmark.indexOf('</Link>') < afterWordmark.indexOf('{t.footer.product}'), 'wordmark link closes before the operator line')
  // Footer navigation unchanged: still sourced from lib/launch/scope, nothing hard-coded.
  assert.match(footer, /footerLinks\(flags\)\.map/)
  assert.equal([...footer.matchAll(/href="\/(account|classroom|homeschool|learning|writer|publish)"/g)].length, 0, 'no extra footer destinations')
})

test('5. signed-in header fits a 320px phone without clipping or smaller touch targets', () => {
  // Esteban, 2026-10-15: at 320px the signed-in header (logo, EN|ES pill, three
  // 36px icon buttons, hamburger) needed 368px and the layout viewport grew
  // wider than the screen. The fix is responsive spacing and a CSS fold, never
  // overflow clipping, and nothing changes from sm (640px) up.
  const header = read('components/layout/SiteHeader.tsx')
  const bar = header.match(/<div className="max-w-6xl mx-auto ([^"]*)h-\[60px\][^"]*"/)?.[1]
  assert.ok(bar, 'header bar found')
  assert.match(bar!, /\bpx-4 sm:px-6 lg:px-8\b/, '16px gutters on phones, desktop gutters unchanged')
  assert.match(header, /<div className="flex items-center gap-1 sm:gap-3 shrink-0">/, 'control cluster never shrinks its children (no crushed touch targets)')
  assert.match(header, /\{right && <div className="hidden sm:flex items-center gap-4 min-w-0">\{right\}<\/div>\}/, 'per-page Back links fold away on phones (logo Home link and Home tab remain)')
  assert.doesNotMatch(header, /overflow-(x-)?(hidden|clip)/, 'no clipping in the header')
  // Logo and branding untouched.
  assert.match(header, /className="shrink-0 block h-12 w-20 sm:h-\[52px\] sm:w-\[87px\]"/)

  const controls = read('components/layout/UserControls.tsx')
  assert.match(controls, /<div ref=\{wrapperRef\} className="flex items-center gap-1 relative shrink-0">/)
  assert.match(controls, /className="hidden xs:flex"/, 'the Help button folds only below 360px')
  const fallback = controls.match(/<div className="xs:hidden">[\s\S]*?\{helpLinks\}\s*<\/div>/)?.[0]
  assert.ok(fallback, 'the account menu carries the Help links while the button is folded')
  assert.match(fallback!, /\{m\.helpTitle\}/)
  assert.equal([...controls.matchAll(/\{helpLinks\}/g)].length, 2, 'one list of Help links, rendered in the Help menu and in the fold-away fallback')
  assert.match(controls, /className=\{`relative w-9 h-9 shrink-0 items-center justify-center rounded-full/, 'icon buttons stay 36px and never shrink')
  assert.match(read('components/layout/MobileMenu.tsx'), /className="md:hidden shrink-0 flex flex-col justify-center items-center gap-1\.5 w-10 h-10 -mr-1 text-oxford"/, 'hamburger stays 40px and never shrinks')
  // The xs screen exists, is 360px, and is ordered before sm so it can never
  // outrank sm/md rules on the same element.
  const tw = read('tailwind.config.ts')
  const screens = tw.match(/screens: \{([\s\S]*?)\n    \}/)?.[1]
  assert.ok(screens, 'screens block found')
  assert.match(screens!, /^\s*xs: '360px',\s*\n\s*\.\.\.defaultTheme\.screens,/m, 'xs is 360px and listed before the default screens')
})
