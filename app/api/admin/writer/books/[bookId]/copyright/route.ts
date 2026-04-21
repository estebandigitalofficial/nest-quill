import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'

const DEFAULT_CLAUSES = [
  { key: 'all_rights_reserved', label: 'All rights reserved', enabled: true },
  { key: 'fiction_disclaimer', label: 'This is a work of fiction. Names, characters, places, and incidents are products of the author\'s imagination or are used fictitiously.', enabled: false },
  { key: 'moral_rights', label: 'The moral rights of the author have been asserted.', enabled: true },
  { key: 'external_content', label: 'No part of this publication may be reproduced without the prior written permission of the publisher.', enabled: true },
  { key: 'trademark', label: 'All brand names and product names used in this book are trademarks or registered trademarks of their respective holders.', enabled: false },
]

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId } = await params
  if (!await checkBookOwner(bookId, ctx)) return adminGuardResponse()

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('writer_copyright')
    .select('*')
    .eq('book_id', bookId)
    .single()

  if (!data) {
    // Seed default record
    const { data: book } = await supabase.from('writer_books').select('title, author_name, pen_name, publisher_name, year_published').eq('id', bookId).single()
    const { data: seeded } = await supabase
      .from('writer_copyright')
      .insert({
        book_id: bookId,
        author_name: book?.author_name ?? null,
        pen_name: book?.pen_name ?? null,
        publisher_name: book?.publisher_name ?? null,
        year: book?.year_published ?? String(new Date().getFullYear()),
        clauses: DEFAULT_CLAUSES,
        collaborators: [],
      })
      .select()
      .single()
    return NextResponse.json(seeded)
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
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('writer_copyright')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('book_id', bookId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
