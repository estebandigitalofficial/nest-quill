// Shared row markup for the account "Your stories" and the
// "Archived stories" pages. Server component — accepts a pre-resolved
// thumbnail URL so the parent owns the signed-URL lifecycle.

import Link from 'next/link'
import StoryRowActions from './StoryRowActions'

const COVER_COLORS = [
  'bg-brand-100',
  'bg-blue-100',
  'bg-violet-100',
  'bg-teal-100',
  'bg-rose-100',
  'bg-green-100',
  'bg-amber-100',
]
function coverColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return COVER_COLORS[hash % COVER_COLORS.length]
}

interface Story {
  id: string
  child_name: string
  story_theme: string
  status: string
  created_at: string
  archived_at?: string | null
}

interface Props {
  story: Story
  thumbUrl?: string
  /** archive on the active list, restore on the archived list */
  mode: 'archive' | 'restore'
}

export default function StoryRow({ story, thumbUrl, mode }: Props) {
  return (
    <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 hover:border-brand-200 transition-colors">
      <Link href={`/story/${story.id}`} className="flex items-center gap-4 flex-1 min-w-0">
        <div className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center ${thumbUrl ? '' : coverColor(story.id)}`}>
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbUrl} alt={`Cover for ${story.child_name}'s story`} className="w-full h-full object-cover" />
          ) : (
            <span className="font-serif text-2xl font-bold text-gray-400 select-none">
              {story.child_name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-oxford truncate">
            {story.child_name}&apos;s story
          </p>
          <p className="text-xs text-charcoal-light mt-0.5 truncate">{story.story_theme}</p>
        </div>
      </Link>

      <div className="flex items-center gap-3 shrink-0">
        <StatusBadge status={story.status} />
        <span className="text-xs text-gray-400 hidden sm:block">
          {new Date(story.created_at).toLocaleDateString()}
        </span>
        <StoryRowActions requestId={story.id} mode={mode} />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    complete: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    queued: 'bg-gray-100 text-gray-500',
    generating_text: 'bg-brand-100 text-brand-700',
    generating_images: 'bg-brand-100 text-brand-700',
    assembling_pdf: 'bg-brand-100 text-brand-700',
  }
  const labels: Record<string, string> = {
    complete: 'Complete',
    failed: 'Failed',
    queued: 'Queued',
    generating_text: 'Writing…',
    generating_images: 'Illustrating…',
    assembling_pdf: 'Assembling…',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${styles[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {labels[status] ?? status}
    </span>
  )
}
