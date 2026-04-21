import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'
import JSZip from 'jszip'

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId } = await params
  if (!await checkBookOwner(bookId, ctx)) return adminGuardResponse()

  const supabase = createAdminClient()

  const { data: book } = await supabase
    .from('writer_books')
    .select('*')
    .eq('id', bookId)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: chapters } = await supabase
    .from('writer_chapters')
    .select('*, writer_scenes(*)')
    .eq('book_id', bookId)
    .order('chapter_number', { ascending: true })

  const chapterList = (chapters ?? []).map((ch: Record<string, unknown>) => ({
    id: ch.id as string,
    number: ch.chapter_number as number,
    title: ch.title as string,
    scenes: ((ch.writer_scenes as unknown[]) ?? [])
      .filter((s: unknown) => (s as { content: string | null }).content)
      .sort((a: unknown, b: unknown) =>
        (a as { scene_number: number }).scene_number - (b as { scene_number: number }).scene_number
      )
      .map((s: unknown) => (s as { content: string }).content),
  }))

  const zip = new JSZip()
  const slug = book.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  const bookId2 = `urn:uuid:${bookId}`

  // mimetype — must be first and uncompressed
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

  // META-INF/container.xml
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`)

  // CSS
  zip.file('OEBPS/styles.css', `body { font-family: Georgia, serif; font-size: 1em; line-height: 1.6; margin: 5% 8%; }
h1 { font-size: 1.8em; margin-bottom: 0.3em; }
h2 { font-size: 1.1em; font-style: italic; margin-top: 0; color: #555; }
p { margin: 0 0 0.8em 0; text-indent: 1.5em; }
p:first-of-type { text-indent: 0; }
.chapter-title { margin-top: 3em; margin-bottom: 1.5em; page-break-before: always; }
`)

  // Title page
  zip.file('OEBPS/title.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(book.title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body>
  <h1>${escapeXml(book.title)}</h1>
  ${book.subtitle ? `<h2>${escapeXml(book.subtitle)}</h2>` : ''}
</body>
</html>`)

  // Chapter files
  for (const ch of chapterList) {
    const content = ch.scenes.join('\n\n')
    zip.file(`OEBPS/chapter-${String(ch.number).padStart(2, '0')}.xhtml`, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(ch.title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body>
  <div class="chapter-title">
    <h1>Chapter ${ch.number}: ${escapeXml(ch.title)}</h1>
  </div>
${textToXhtml(content)}
</body>
</html>`)
  }

  // nav.xhtml
  const navItems = chapterList.map(ch =>
    `      <li><a href="chapter-${String(ch.number).padStart(2, '0')}.xhtml">Chapter ${ch.number}: ${escapeXml(ch.title)}</a></li>`
  ).join('\n')

  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${escapeXml(book.title)}</title></head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
      <li><a href="title.xhtml">Title Page</a></li>
${navItems}
    </ol>
  </nav>
</body>
</html>`)

  // toc.ncx
  const ncxItems = chapterList.map((ch, i) => `
  <navPoint id="ch${ch.number}" playOrder="${i + 2}">
    <navLabel><text>Chapter ${ch.number}: ${escapeXml(ch.title)}</text></navLabel>
    <content src="chapter-${String(ch.number).padStart(2, '0')}.xhtml"/>
  </navPoint>`).join('')

  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookId2}"/>
  </head>
  <docTitle><text>${escapeXml(book.title)}</text></docTitle>
  <navMap>
  <navPoint id="title" playOrder="1">
    <navLabel><text>Title Page</text></navLabel>
    <content src="title.xhtml"/>
  </navPoint>${ncxItems}
  </navMap>
</ncx>`)

  // content.opf (manifest + spine)
  const manifestItems = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `<item id="css" href="styles.css" media-type="text/css"/>`,
    `<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>`,
    ...chapterList.map(ch =>
      `<item id="ch${ch.number}" href="chapter-${String(ch.number).padStart(2, '0')}.xhtml" media-type="application/xhtml+xml"/>`
    ),
  ].join('\n    ')

  const spineItems = [
    `<itemref idref="title"/>`,
    ...chapterList.map(ch => `<itemref idref="ch${ch.number}"/>`),
  ].join('\n    ')

  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookId2}</dc:identifier>
    <dc:title>${escapeXml(book.title)}</dc:title>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${spineItems}
  </spine>
</package>`)

  const buffer = await zip.generateAsync({ type: 'nodebuffer' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/epub+zip',
      'Content-Disposition': `attachment; filename="${slug}.epub"`,
    },
  })
}
