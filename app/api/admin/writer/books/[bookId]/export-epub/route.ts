import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'
import { assembleBook } from '@/lib/writer/assembleBook'
import JSZip from 'jszip'

export const maxDuration = 60

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function textToXhtml(text: string): string {
  return text
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => `    <p>${escapeXml(p.replace(/\n/g, ' ').trim())}</p>`)
    .join('\n')
}

function makeXhtml(title: string, bodyContent: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body>
${bodyContent}
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

  zip.file('OEBPS/styles.css', `body { font-family: Georgia, serif; font-size: 1em; line-height: 1.7; margin: 5% 8%; }
h1 { font-size: 1.8em; margin-top: 2em; margin-bottom: 0.5em; page-break-before: always; }
h2 { font-size: 1.1em; font-style: italic; margin-top: 0; color: #555; }
p { margin: 0 0 0.7em 0; text-indent: 1.5em; }
p:first-of-type { text-indent: 0; }
.copyright { font-size: 0.8em; color: #555; line-height: 1.5; }
`)

  // Manifest items collected as we add files
  type ManifestItem = { id: string; href: string; type: string; properties?: string }
  const manifest: ManifestItem[] = []
  const spineIds: string[] = []

  function addPage(id: string, href: string, title: string, body: string) {
    zip.file(`OEBPS/${href}`, makeXhtml(title, body))
    manifest.push({ id, href, type: 'application/xhtml+xml' })
    spineIds.push(id)
  }

  // Title page
  addPage('title', 'title.xhtml', book.title,
    `  <h1 style="text-align:center;margin-top:3em">${escapeXml(book.title)}</h1>
  ${book.subtitle ? `  <h2 style="text-align:center">${escapeXml(book.subtitle)}</h2>` : ''}
  <p style="text-align:center;margin-top:1em">${escapeXml(book.authorName)}</p>`)

  // Copyright
  if (book.copyrightText) {
    addPage('copyright', 'copyright.xhtml', 'Copyright',
      `  <div class="copyright">\n${book.copyrightText.split('\n').map(l => `    <p>${escapeXml(l) || '&nbsp;'}</p>`).join('\n')}\n  </div>`)
  }

  // Front matter
  for (const section of book.frontMatter) {
    const id = `fm-${section.type}`
    addPage(id, `${id}.xhtml`, section.label,
      `  <h1>${escapeXml(section.label)}</h1>\n${textToXhtml(section.content)}`)
  }

  // Chapters
  for (const ch of book.chapters) {
    const id = `ch${String(ch.number).padStart(2, '0')}`
    addPage(id, `${id}.xhtml`, ch.title,
      `  <h1>Chapter ${ch.number}: ${escapeXml(ch.title)}</h1>\n${textToXhtml(ch.content)}`)
  }

  // Back matter
  for (const section of book.backMatter) {
    const id = `bm-${section.type}`
    addPage(id, `${id}.xhtml`, section.label,
      `  <h1>${escapeXml(section.label)}</h1>\n${textToXhtml(section.content)}`)
  }

  // Nav
  const navItems = spineIds.map(id => {
    const item = manifest.find(m => m.id === id)!
    const title = id === 'title' ? book.title : id === 'copyright' ? 'Copyright' : item.href.replace('.xhtml', '')
    return `      <li><a href="${item.href}">${escapeXml(title)}</a></li>`
  }).join('\n')

  zip.file('OEBPS/nav.xhtml', makeXhtml('Contents',
    `  <nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc">
    <h1>Contents</h1>
    <ol>\n${navItems}\n    </ol>
  </nav>`))
  manifest.push({ id: 'nav', href: 'nav.xhtml', type: 'application/xhtml+xml', properties: 'nav' })

  // NCX
  const ncxPoints = spineIds.map((id, i) => {
    const item = manifest.find(m => m.id === id)!
    return `  <navPoint id="${id}" playOrder="${i + 1}">
    <navLabel><text>${escapeXml(id)}</text></navLabel>
    <content src="${item.href}"/>
  </navPoint>`
  }).join('\n')
  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${bookUid}"/></head>
  <docTitle><text>${escapeXml(book.title)}</text></docTitle>
  <navMap>\n${ncxPoints}\n  </navMap>
</ncx>`)
  manifest.push({ id: 'ncx', href: 'toc.ncx', type: 'application/x-dtbncx+xml' })
  manifest.push({ id: 'css', href: 'styles.css', type: 'text/css' })

  // OPF
  const manifestXml = manifest.map(m =>
    `    <item id="${m.id}" href="${m.href}" media-type="${m.type}"${m.properties ? ` properties="${m.properties}"` : ''}/>`
  ).join('\n')
  const spineXml = spineIds.map(id => `    <itemref idref="${id}"/>`).join('\n')

  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookUid}</dc:identifier>
    <dc:title>${escapeXml(book.title)}</dc:title>
    <dc:creator>${escapeXml(book.authorName)}</dc:creator>
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
