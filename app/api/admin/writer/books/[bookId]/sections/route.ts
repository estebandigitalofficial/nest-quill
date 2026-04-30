import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'
import type { BookSectionType } from '@/types/writer'

const DEFAULT_FRONT: { type: BookSectionType; position: number }[] = [
  { type: 'dedication', position: 0 },
  { type: 'epigraph', position: 1 },
  { type: 'foreword', position: 2 },
  { type: 'preface', position: 3 },
  { type: 'acknowledgments', position: 4 },
  { type: 'prologue', position: 5 },
  { type: 'introduction', position: 6 },
]

const DEFAULT_BACK: { type: BookSectionType; position: number }[] = [
  { type: 'conclusion', position: 0 },
  { type: 'notes', position: 1 },
  { type: 'about_author', position: 2 },
  { type: 'also_by', position: 3 },
]

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try { await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId } = await params

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('writer_book_sections')
    .select('*')
    .eq('book_id', bookId)
    .order('position', { ascending: true })

  // If no sections exist yet, seed defaults (disabled by default)
  if (!data || data.length === 0) {
    const defaults = [
      ...DEFAULT_FRONT.map(s => ({ ...s, book_id: bookId, zone: 'front', enabled: false })),
      ...DEFAULT_BACK.map(s => ({ ...s, book_id: bookId, zone: 'back', enabled: false })),
    ]
    const { data: seeded } = await supabase
      .from('writer_book_sections')
      .insert(defaults)
      .select()
    return NextResponse.json(seeded ?? [])
  }

  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId } = await params
  if (!await checkBookOwner(bookId, ctx)) return adminGuardResponse()

  const body = await req.json()
  // body: { id, ...fields } or array of { id, ...fields } for bulk position updates
  const supabase = createAdminClient()

  if (Array.isArray(body)) {
    // Bulk position update
    await Promise.all(body.map(({ id, position }: { id: string; position: number }) =>
      supabase.from('writer_book_sections').update({ position, updated_at: new Date().toISOString() }).eq('id', id).eq('book_id', bookId)
    ))
    return NextResponse.json({ ok: true })
  }

  const { id, ...fields } = body
  const { data, error } = await supabase
    .from('writer_book_sections')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('book_id', bookId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
