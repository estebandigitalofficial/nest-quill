import { createAdminClient } from '@/lib/supabase/admin'
import type { AiWriterConfig } from '@/types/database'
import WriterConfigEditor from './WriterConfigEditor'

export default async function WriterConfigPage() {
  const db = createAdminClient()
  const { data } = await db
    .from('ai_writer_config')
    .select('*')
    .order('key')

  const configs = (data ?? []) as unknown as AiWriterConfig[]

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">AI Writer Config</h1>
        <p className="text-sm text-adm-muted mt-1">
          Edit the prompts, rules, and style hints used by the story generation pipeline.
        </p>
      </div>
      <WriterConfigEditor initialConfigs={configs} />
    </div>
  )
}
