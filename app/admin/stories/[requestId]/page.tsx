import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import AdminStoryActions from '@/components/admin/AdminStoryActions'
import type { StoryRequest, GeneratedStory, StoryScene, ProcessingLog } from '@/types/database'
import { formatAZTime, formatAZTimeOnly } from '@/lib/utils/formatTime'

interface PageProps {
  params: Promise<{ requestId: string }>
}

export default async function AdminStoryDetailPage({ params }: PageProps) {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  const { requestId } = await params
  const supabase = createAdminClient()

  // Fetch everything in parallel
  const [reqResult, storyResult, scenesResult, logsResult] = await Promise.all([
    supabase.from('story_requests').select('*').eq('id', requestId).single(),
    supabase.from('generated_stories').select('*').eq('request_id', requestId).maybeSingle(),
    supabase.from('story_scenes').select('*').eq('request_id', requestId).order('page_number'),
    supabase.from('processing_logs').select('*').eq('request_id', requestId).order('created_at', { ascending: true }),
  ])

  if (reqResult.error || !reqResult.data) notFound()

  const req = reqResult.data as unknown as StoryRequest
  const story = storyResult.data as unknown as GeneratedStory | null
  const scenes = (scenesResult.data ?? []) as unknown as StoryScene[]
  const logs = (logsResult.data ?? []) as unknown as ProcessingLog[]

  // Sign image URLs for scenes that have a storage_path
  const paths = scenes.filter(s => s.storage_path).map(s => s.storage_path as string)
  const signedMap: Record<string, string> = {}
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('story-images')
      .createSignedUrls(paths, 60 * 60 * 2)
    signed?.forEach(item => {
      if (item.signedUrl && item.path) signedMap[item.path] = item.signedUrl
    })
  }

  const stuckMin = ['generating_text', 'generating_images', 'assembling_pdf'].includes(req.status)
    ? Math.round((Date.now() - new Date(req.updated_at).getTime()) / 60000)
    : null

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <header className="border-b border-gray-800 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="font-serif text-lg font-semibold text-white">Nest &amp; Quill</Link>
          <span className="text-xs font-semibold bg-brand-500 text-white px-2 py-0.5 rounded-full">Admin</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">Stories</Link>
          <Link href="/admin/library" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">Library</Link>
          <Link href="/admin/users" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">Users</Link>
          <Link href="/admin/guests" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">Guests</Link>
          <Link href="/admin/settings" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">Settings</Link>
          <Link href="/admin/writer" className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors">Writer →</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Breadcrumb + title */}
        <div>
          <Link href="/admin" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            ← Back to stories
          </Link>
          <div className="flex items-start justify-between mt-3 gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-white">
                {story?.title ?? `${req.child_name}'s Story`}
              </h1>
              <p className="text-sm text-gray-500 mt-1 font-mono">{req.id}</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={req.status} />
              {stuckMin !== null && stuckMin > 10 && (
                <span className="text-xs text-red-400 font-mono">stuck {stuckMin}m</span>
              )}
              <AdminStoryActions requestId={req.id} status={req.status} />
            </div>
          </div>
        </div>

        {/* Request fields */}
        <Section title="Request">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            <Field label="Child name" value={req.child_name} />
            <Field label="Child age" value={String(req.child_age)} />
            <Field label="Email" value={req.user_email} />
            <Field label="Plan" value={req.plan_tier} mono />
            <Field label="Theme" value={req.story_theme} />
            <Field label="Tone" value={req.story_tone?.join(', ') || '—'} />
            <Field label="Moral" value={req.story_moral ?? '—'} />
            <Field label="Illustration style" value={req.illustration_style} />
            <Field label="Story length" value={`${req.story_length} pages`} />
            <Field label="Status" value={req.status} mono />
            <Field label="Progress" value={`${req.progress_pct}%`} />
            <Field label="Retry count" value={String(req.retry_count)} />
            <Field label="Worker ID" value={req.worker_id ?? '—'} mono />
            <Field label="Created (AZ)" value={formatAZTime(req.created_at)} />
            <Field label="Updated (AZ)" value={formatAZTime(req.updated_at)} />
            {req.completed_at && <Field label="Completed (AZ)" value={formatAZTime(req.completed_at)} />}
            {req.ip_address && <Field label="IP address" value={req.ip_address} mono />}
            {(req.geo_city || req.geo_country) && (
              <Field label="Location" value={[req.geo_city, req.geo_region, req.geo_country].filter(Boolean).join(', ')} />
            )}
            {req.child_description && <Field label="Child description" value={req.child_description} wide />}
            {req.custom_notes && <Field label="Custom notes" value={req.custom_notes} wide />}
            {req.supporting_characters && <Field label="Supporting characters" value={req.supporting_characters} wide />}
            {req.dedication_text && <Field label="Dedication" value={req.dedication_text} wide />}
          </div>
          {req.last_error && (
            <div className="mt-4 bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-red-400 mb-1">Last error</p>
              <p className="text-xs text-red-300 font-mono break-all">{req.last_error}</p>
            </div>
          )}
        </Section>

        {/* Scenes */}
        <Section title={`Scenes (${scenes.length})`}>
          {scenes.length === 0 ? (
            <p className="text-sm text-gray-600">No scenes yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider">
                    <th className="text-left pb-2 pr-4">Page</th>
                    <th className="text-left pb-2 pr-4">Image</th>
                    <th className="text-left pb-2 pr-4">Status</th>
                    <th className="text-left pb-2 pr-4">Attempts</th>
                    <th className="text-left pb-2">Text excerpt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {scenes.map(scene => {
                    const imgUrl = scene.storage_path ? signedMap[scene.storage_path] : null
                    return (
                      <tr key={scene.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="py-2.5 pr-4 font-mono text-gray-400">{scene.page_number}</td>
                        <td className="py-2.5 pr-4">
                          {imgUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imgUrl} alt={`Page ${scene.page_number}`} className="w-12 h-12 rounded-lg object-cover border border-gray-700" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-600 text-[10px]">
                              {scene.image_status === 'pending' ? '…' : '✕'}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          <ImageStatusBadge status={scene.image_status} />
                          {scene.last_error && (
                            <p className="text-[10px] text-red-400 mt-1 max-w-[160px] truncate" title={scene.last_error}>
                              {scene.last_error}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-500 font-mono">{scene.generation_attempts}</td>
                        <td className="py-2.5 text-gray-400 max-w-xs truncate">{scene.page_text}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Generated story */}
        {story && (
          <Section title="Generated story">
            <div className="space-y-3 mb-4">
              <Field label="Title" value={story.title} />
              {story.subtitle && <Field label="Subtitle" value={story.subtitle} />}
              <Field label="Author line" value={story.author_line} />
              {story.synopsis && <Field label="Synopsis" value={story.synopsis} />}
              <Field label="Model" value={story.model_used} mono />
              <Field label="Tokens" value={`${story.prompt_tokens ?? 0} prompt / ${story.completion_tokens ?? 0} completion`} />
              {story.generation_time_ms && <Field label="Generation time" value={`${(story.generation_time_ms / 1000).toFixed(1)}s`} />}
            </div>
            {story.full_text_json?.length > 0 && (
              <div className="space-y-3 mt-4 border-t border-gray-800 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Pages</p>
                {story.full_text_json.map(page => (
                  <div key={page.page} className="bg-gray-900 rounded-xl px-4 py-3 border border-gray-800">
                    <p className="text-[10px] text-gray-600 font-mono mb-1">Page {page.page}</p>
                    <p className="text-sm text-gray-300 leading-relaxed">{page.text}</p>
                    {page.image_description && (
                      <p className="text-[11px] text-gray-600 mt-2 italic">↳ {page.image_description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Pipeline logs */}
        <Section title={`Pipeline logs (${logs.length})`}>
          {logs.length === 0 ? (
            <p className="text-sm text-gray-600">No logs for this request.</p>
          ) : (
            <div className="space-y-1 font-mono text-xs">
              {logs.map(log => (
                <div key={log.id} className={`flex gap-3 px-3 py-2 rounded-lg ${log.level === 'error' ? 'bg-red-950/40' : 'hover:bg-gray-800/40'}`}>
                  <span className={`shrink-0 font-bold uppercase w-12 ${log.level === 'error' ? 'text-red-400' : log.level === 'warning' ? 'text-amber-400' : 'text-blue-400'}`}>
                    {log.level}
                  </span>
                  <span className="shrink-0 text-gray-600 w-28 truncate">{log.stage}</span>
                  <span className="text-gray-300 flex-1">{log.message}</span>
                  {log.duration_ms != null && (
                    <span className="shrink-0 text-gray-600">{log.duration_ms}ms</span>
                  )}
                  <span className="shrink-0 text-gray-700">{formatAZTimeOnly(log.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">{title}</h2>
      <div className="bg-gray-900 rounded-2xl border border-gray-800 px-6 py-5">
        {children}
      </div>
    </div>
  )
}

function Field({ label, value, mono, wide }: { label: string; value: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">{label}</p>
      <p className={`text-sm text-gray-200 break-all ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    complete: 'bg-green-900 text-green-400',
    failed: 'bg-red-900 text-red-400',
    queued: 'bg-gray-800 text-gray-400',
    generating_text: 'bg-brand-900 text-brand-400',
    generating_images: 'bg-brand-900 text-brand-400',
    assembling_pdf: 'bg-brand-900 text-brand-400',
  }
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[status] ?? 'bg-gray-800 text-gray-400'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function ImageStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    complete: 'text-green-400',
    failed: 'text-red-400',
    pending: 'text-gray-500',
    generating: 'text-amber-400',
  }
  return (
    <span className={`text-[10px] font-semibold uppercase ${styles[status] ?? 'text-gray-500'}`}>
      {status}
    </span>
  )
}
