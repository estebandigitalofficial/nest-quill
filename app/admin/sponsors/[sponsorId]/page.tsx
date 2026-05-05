import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAdminContext } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import SponsorDetail from './SponsorDetail'

type PageProps = { params: Promise<{ sponsorId: string }> }

export default async function SponsorDetailPage({ params }: PageProps) {
  const ctx = await getAdminContext()
  if (!ctx) return null

  const { sponsorId } = await params
  const db = createAdminClient()

  const [{ data: sponsor }, { data: allocations }, { data: rewards }] = await Promise.all([
    db.from('sponsors').select('*').eq('id', sponsorId).single(),
    db.from('sponsor_allocations').select('*').eq('sponsor_id', sponsorId).order('category'),
    db.from('sponsor_rewards').select('*').eq('sponsor_id', sponsorId).order('created_at', { ascending: false }),
  ])

  if (!sponsor) notFound()

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link href="/admin/sponsors" className="text-xs text-adm-muted hover:text-adm-text">← Sponsors</Link>
        <h1 className="text-xl font-semibold text-adm-text mt-2">{sponsor.name}</h1>
        <p className="text-sm text-adm-muted mt-1">Edit sponsor details, set budget allocations, and manage reward offers.</p>
      </div>
      <SponsorDetail
        sponsor={sponsor}
        initialAllocations={allocations ?? []}
        initialRewards={rewards ?? []}
      />
    </div>
  )
}
