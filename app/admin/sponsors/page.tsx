import Link from 'next/link'
import { getAdminContext } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import SponsorsList from './SponsorsList'

interface SponsorRow {
  id: string
  name: string
  logo_url: string | null
  description: string | null
  contact_email: string | null
  total_budget_cents: number
  is_active: boolean
  created_at: string
}

export default async function AdminSponsorsPage() {
  const ctx = await getAdminContext()
  if (!ctx) return null

  const db = createAdminClient()
  const { data } = await db
    .from('sponsors')
    .select('id, name, logo_url, description, contact_email, total_budget_cents, is_active, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-adm-text">Sponsors</h1>
          <p className="text-sm text-adm-muted mt-1">
            Brand partners that fund rewards and prizes for students. Add sponsors here, then create reward offers tied to each.
          </p>
        </div>
        <Link
          href="/admin/sponsors/new"
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          + New sponsor
        </Link>
      </div>

      <SponsorsList initialSponsors={(data ?? []) as SponsorRow[]} />
    </div>
  )
}
