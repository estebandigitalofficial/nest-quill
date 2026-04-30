import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

export async function GET() {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('ai_writer_config')
    .select('*')
    .order('key')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const updates: { key: string; value: string }[] = body.updates
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }

  const db = createAdminClient()
  const errors: string[] = []

  for (const { key, value } of updates) {
    const { error } = await db
      .from('ai_writer_config')
      .update({
        value,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('key', key)

    if (error) errors.push(`${key}: ${error.message}`)
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 500 })
  }

  return NextResponse.json({ updated: updates.length })
}
