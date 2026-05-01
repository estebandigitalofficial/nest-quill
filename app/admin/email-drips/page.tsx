import { createAdminClient } from '@/lib/supabase/admin'
import type { EmailDripTemplate, EmailDripRule } from '@/types/database'
import DripSequenceView from './DripSequenceView'
import JourneyFlowchart from './JourneyFlowchart'

export default async function AdminEmailDripsPage() {
  const db = createAdminClient()

  const [{ data: templates }, { data: rules }] = await Promise.all([
    db.from('email_drip_templates').select('*').order('sequence').order('step'),
    db.from('email_drip_rules').select('*').order('trigger_type'),
  ])

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Email Drip Templates</h1>
        <p className="text-sm text-adm-muted mt-1">
          Manage automated email sequences and trigger rules.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <DripSequenceView
          initialTemplates={(templates ?? []) as unknown as EmailDripTemplate[]}
          initialRules={(rules ?? []) as unknown as EmailDripRule[]}
        />
        <JourneyFlowchart />
      </div>
    </div>
  )
}
