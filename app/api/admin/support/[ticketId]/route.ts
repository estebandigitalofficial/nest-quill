import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import type { SupportTicketStatus, SupportTicketPriority } from '@/types/database'

const STATUSES = new Set<SupportTicketStatus>(['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'])
const PRIORITIES = new Set<SupportTicketPriority>(['low', 'normal', 'high', 'urgent'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ticketId } = await params
  const body = await req.json().catch(() => null) as
    | { status?: string; priority?: string; admin_notes?: string }
    | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (body.status && STATUSES.has(body.status as SupportTicketStatus)) update.status = body.status
  if (body.priority && PRIORITIES.has(body.priority as SupportTicketPriority)) update.priority = body.priority
  if (typeof body.admin_notes === 'string') update.admin_notes = body.admin_notes

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const db = createAdminClient()
  const { error } = await db.from('support_tickets').update(update).eq('id', ticketId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
