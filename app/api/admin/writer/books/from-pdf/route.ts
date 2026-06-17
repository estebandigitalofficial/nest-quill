import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, adminGuardResponse } from '@/lib/admin/guard'

// Lowercase words that stay lowercase in title case (unless first/last).
const SMALL_WORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'of', 'on', 'in',
  'to', 'with', 'at', 'by', 'from', 'as', 'vs',
])

// Trailing build/version tags to strip (e.g. "...-TRADE", "...-PRINT-READY", "...-v2").
const TRAILING_TAG = /\s+(trade|print[\s-]?ready|print|ready|interior|final|draft|proof|rev(?:ision)?\d*|v\d+(?:\.\d+)*|version\s*\d+|ebook|epub|kindle|paperback|hardcover|copy)$/i

// Derive a clean, readable book title from an imported PDF filename. The original
// filename is still stored separately in source_pdf_name.
function titleFromFileName(fileName: string | undefined): string {
  const original = (fileName ?? 'Untitled').replace(/\.pdf$/i, '')
  let base = original.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()

  // Strip trailing build/version tags repeatedly (e.g. "Book TRADE PRINT READY").
  let prev: string
  do {
    prev = base
    base = base.replace(TRAILING_TAG, '').trim()
  } while (base !== prev && base.length > 0)

  if (!base) base = original.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()

  const words = base.toLowerCase().split(' ').filter(Boolean)
  const titled = words
    .map((w, i) =>
      i > 0 && i < words.length - 1 && SMALL_WORDS.has(w)
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join(' ')

  return titled || 'Untitled'
}

// Text is extracted client-side (PDF.js in browser) and sent as JSON
export async function POST(request: NextRequest) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { text, fileName, owner_id } = await request.json()

  if (!text || text.length < 50) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  const title = titleFromFileName(fileName as string | undefined)
  const ownerId = ctx.isSuperAdmin && owner_id ? owner_id : ctx.userId
  const supabase = createAdminClient()

  const { data: book, error } = await supabase
    .from('writer_books')
    .insert({
      title,
      subtitle: null,
      genre: '',
      tone: '',
      premise: '',
      target_chapters: 10,
      target_words_per_chapter: 2000,
      owner_id: ownerId,
      source_text: text,
      source_pdf_name: fileName,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(book, { status: 201 })
}
