import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { imageId } = await params
  const body = await req.json()
  const { tags } = body

  if (!Array.isArray(tags)) {
    return NextResponse.json({ error: 'tags must be an array' }, { status: 400 })
  }

  const db = createAdminClient()
  const { error } = await db
    .from('image_library')
    .update({ tags })
    .eq('id', imageId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ updated: true })
}
