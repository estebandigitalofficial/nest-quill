import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'
import { assembleBook, SECTION_LABELS } from '@/lib/writer/assembleBook'
import JSZip from 'jszip'

export const maxDuration = 60

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function textToXhtml(text: string): string {
  return text.split(/\n\n+/).filter(p => p.trim())
    .map(p => `  <p>${esc(p.replace(/\n/g, ' ').trim())}</p>`).join('\n')
}

function xhtmlPage(title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${esc(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
${body}
</body>
</html>`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId } = await params
  if (!await checkBookOwner(bookId, ctx)) return adminGuardResponse()

  const url = new URL(req.url)
  const book = await assembleBook(bookId, {
    includeFrontMatter: url.searchParams.get('frontMatter') !== 'false',
    includeBackMatter: url.searchParams.get('backMatter') !== 'false',
    includeCopyright: url.searchParams.get('copyright') !== 'false',
  })

  const zip = new JSZip()
  const slug = book.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  const bookUid = `urn:uuid:${bookId}`

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`)

  zip.file('OEBPS/styles.css', `
body { font-family: Georgia, serif; font-size: 1em; line-height: 1.75; margin: 5% 8%; color: #1a1a1a; }
h1.chapter-title { font-size: 1.8em; text-align: center; margin-top: 3em; margin-bottom: 1.5em; page-break-before: always; font-weight: bold; }
h1.section-title { font-size: 1.5em; text-align: center; margin-top: 2em; margin-bottom: 1.5em; page-break-before: always; }
p { margin: 0 0 0.6em 0; text-indent: 1.5em; }
p.no-indent { text-indent: 0; }
p.centered { text-align: center; text-indent: 0; }
.title-page { text-align: center; margin-top: 4em; }
.title-page h1 { font-size: 2.5em; margin-bottom: 0.3em; }
.title-page h2 { font-size: 1.3em; font-style: italic; color: #555; margin-bottom: 2em; }
.title-page .author { font-size: 1.1em; letter-spacing: 0.1em; }
.copyright { font-size: 0.8em; color: #555; line-height: 1.6; margin-top: 6em; }
.copyright p { text-indent: 0; margin-bottom: 0.3em; }
.toc { margin-top: 2em; }
.toc h1 { text-align: center; font-size: 1.5em; margin-bottom: 1.5em; }
.toc ol { list-style: none; padding: 0; }
.toc li { margin-bottom: 0.5em; }
.toc a { text-decoration: none; color: inherit; }
.epigraph { text-align: center; font-style: italic; margin: 4em 2em; color: #555; }
`)

  type ManifestItem = { id: string; href: string; type: string; properties?: string }
  const manifest: ManifestItem[] = []
  const spineIds: string[] = []
  // TOC entries: { id, href, label }
  const tocEntries: { id: string; href: string; label: string }[] = []

  function addPage(id: string, href: string, title: string, body: string, addToToc = false, tocLabel?: string) {
    zip.file(`OEBPS/${href}`, xhtmlPage(title, body))
    manifest.push({ id, href, type: 'application/xhtml+xml' })
    spineIds.push(id)
    if (addToToc) tocEntries.push({ id, href, label: tocLabel ?? title })
  }

  // 1. Title page
  addPage('title', 'title.xhtml', book.title,
    `<div class="title-page">
  <h1>${esc(book.title)}</h1>
  ${book.subtitle ? `<h2>${esc(book.subtitle)}</h2>` : ''}
  <p class="author">${esc(book.authorName)}</p>
</div>`)

  // 2. Copyright
  if (book.copyrightText) {
    const copyrightLines = book.copyrightText.split('\n').filter(l => l.trim())
    addPage('copyright', 'copyright.xhtml', 'Copyright',
      `<div class="copyright">\n${copyrightLines.map(l =>
        `  <p class="no-indent">${esc(l)}</p>`
      ).join('\n')}\n</div>`)
  }

  // 3. Pre-TOC front matter (dedication, epigraph)
  for (const s of book.preTocSections) {
    const id = `fm-${s.type}`
    const isEpigraph = s.type === 'epigraph'
    addPage(id, `${id}.xhtml`, s.label,
      isEpigraph
        ? `<div class="epigraph">\n${textToXhtml(s.content)}\n</div>`
        : `<h1 class="section-title">${esc(s.label)}</h1>\n${textToXhtml(s.content)}`)
  }

  // 4. Table of contents (placeholder — filled after we know all entries)
  const tocPlaceholder = 'toc-content'
  spineIds.push('toc-nav')
  manifest.push({ id: 'toc-nav', href: 'toc.xhtml', type: 'application/xhtml+xml' })

  // 5. Post-TOC front matter (foreword, preface, acknowledgments, prologue, introduction)
  for (const s of book.postTocSections) {
    const id = `fm-${s.type}`
    addPage(id, `${id}.xhtml`, s.label,
      `<h1 class="section-title">${esc(s.label)}</h1>\n${textToXhtml(s.content)}`,
      true, s.label)
  }

  // 6. Chapters
  for (const ch of book.chapters) {
    const id = `ch${String(ch.number).padStart(2, '0')}`
    const href = `${id}.xhtml`
    const label = `Chapter ${ch.number}: ${ch.title}`
    const paragraphs = ch.content.split(/\n\n+/).filter(p => p.trim())
    const chapterHtml = paragraphs.map((p, pi) =>
      `  <p${pi === 0 ? ' class="no-indent"' : ''}>${esc(p.trim())}</p>`
    ).join('\n')
    addPage(id, href, ch.title,
      `<h1 class="chapter-title">Chapter ${ch.number}<br/>${esc(ch.title)}</h1>\n${chapterHtml}`,
      true, label)
  }

  // 7. Back matter
  for (const s of book.backMatter) {
    const id = `bm-${s.type}`
    addPage(id, `${id}.xhtml`, s.label,
      `<h1 class="section-title">${esc(s.label)}</h1>\n${textToXhtml(s.content)}`,
      true, s.label)
  }

  // Now build the actual TOC page with all entries
  const tocItems = tocEntries.map(e =>
    `    <li><a href="${e.href}">${esc(e.label)}</a></li>`
  ).join('\n')
  zip.file('OEBPS/toc.xhtml', xhtmlPage('Contents',
    `<div class="toc">
  <h1>Contents</h1>
  <ol>\n${tocItems}\n  </ol>
</div>`))

  // nav.xhtml (epub nav)
  const navItems = tocEntries.map(e =>
    `      <li><a href="${e.href}">${esc(e.label)}</a></li>`
  ).join('\n')
  zip.file('OEBPS/nav.xhtml', xhtmlPage('Navigation',
    `<nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc">
  <h1>Table of Contents</h1>
  <ol>\n${navItems}\n  </ol>
</nav>`))
  manifest.push({ id: 'nav', href: 'nav.xhtml', type: 'application/xhtml+xml', properties: 'nav' })

  // NCX
  const ncxPoints = spineIds.filter(id => id !== 'nav').map((id, i) => {
    const item = manifest.find(m => m.id === id)!
    const toc = tocEntries.find(t => t.id === id)
    const label = toc?.label ?? id
    return `  <navPoint id="${id}" playOrder="${i + 1}">
    <navLabel><text>${esc(label)}</text></navLabel>
    <content src="${item.href}"/>
  </navPoint>`
  }).join('\n')
  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${bookUid}"/></head>
  <docTitle><text>${esc(book.title)}</text></docTitle>
  <navMap>\n${ncxPoints}\n  </navMap>
</ncx>`)
  manifest.push({ id: 'ncx', href: 'toc.ncx', type: 'application/x-dtbncx+xml' })
  manifest.push({ id: 'css', href: 'styles.css', type: 'text/css' })

  // OPF
  const manifestXml = manifest.map(m =>
    `    <item id="${m.id}" href="${m.href}" media-type="${m.type}"${m.properties ? ` properties="${m.properties}"` : ''}/>`
  ).join('\n')
  const spineXml = spineIds.filter(id => id !== 'nav').map(id => `    <itemref idref="${id}"/>`).join('\n')

  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookUid}</dc:identifier>
    <dc:title>${esc(book.title)}</dc:title>
    <dc:creator>${esc(book.authorName)}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>\n${manifestXml}\n  </manifest>
  <spine toc="ncx">\n${spineXml}\n  </spine>
</package>`)

  const buffer = await zip.generateAsync({ type: 'arraybuffer' })
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/epub+zip',
      'Content-Disposition': `attachment; filename="${slug}.epub"`,
    },
  })
}
