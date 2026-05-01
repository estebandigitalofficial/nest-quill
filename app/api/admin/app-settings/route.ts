import { NextRequest, NextResponse } from 'next/server'
import { getAdminContext, adminGuardResponse } from '@/lib/admin/guard'
import { getAllSettings, updateSetting, type AppSetting } from '@/lib/settings/appSettings'

// ─── GET — return all settings grouped by category ────────────────────────

export async function GET() {
  const ctx = await getAdminContext()
  if (!ctx) return adminGuardResponse()

  const rows = await getAllSettings()

  // Group into { category: AppSetting[] }
  const grouped = rows.reduce<Record<string, AppSetting[]>>((acc, row) => {
    if (!acc[row.category]) acc[row.category] = []
    acc[row.category].push(row)
    return acc
  }, {})

  return NextResponse.json({ settings: grouped })
}

// ─── PATCH — update a single setting ─────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx) return adminGuardResponse()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be a JSON object.' }, { status: 400 })
  }

  const { key, value } = body as Record<string, unknown>

  if (typeof key !== 'string' || !key.trim()) {
    return NextResponse.json({ error: '`key` must be a non-empty string.' }, { status: 400 })
  }
  if (value === undefined) {
    return NextResponse.json({ error: '`value` is required.' }, { status: 400 })
  }

  // Fetch the current row to (a) confirm the key exists and (b) infer the expected type
  const rows = await getAllSettings()
  const existing = rows.find(r => r.key === key)

  if (!existing) {
    return NextResponse.json(
      { error: `Setting "${key}" not found. Use the migration to register new keys.` },
      { status: 404 },
    )
  }

  // Validate incoming value type matches the stored JSONB type
  const typeError = checkType(existing.value, value, key)
  if (typeError) {
    return NextResponse.json({ error: typeError }, { status: 422 })
  }

  try {
    await updateSetting(key, value, ctx.userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, key })
}

// ─── Type guard ───────────────────────────────────────────────────────────

/**
 * Returns an error string when `incoming` does not match the primitive type
 * of `existing`. Null values and objects/arrays skip the strict check.
 */
function checkType(existing: unknown, incoming: unknown, key: string): string | null {
  // No constraint when the stored value is null or a complex type
  if (existing === null || typeof existing === 'object') return null

  const want = typeof existing   // 'boolean' | 'number' | 'string'
  const got  = typeof incoming

  if (want !== got) {
    return `Type mismatch for "${key}": expected ${want}, got ${got}.`
  }
  return null
}
