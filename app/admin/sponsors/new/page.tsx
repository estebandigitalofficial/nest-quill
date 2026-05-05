import Link from 'next/link'
import { getAdminContext } from '@/lib/admin/guard'
import NewSponsorForm from './NewSponsorForm'

export default async function NewSponsorPage() {
  const ctx = await getAdminContext()
  if (!ctx) return null

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link href="/admin/sponsors" className="text-xs text-adm-muted hover:text-adm-text">← Sponsors</Link>
        <h1 className="text-xl font-semibold text-adm-text mt-2">New sponsor</h1>
        <p className="text-sm text-adm-muted mt-1">Capture the basics — you can adjust budget allocations and rewards on the next screen.</p>
      </div>
      <NewSponsorForm />
    </div>
  )
}
