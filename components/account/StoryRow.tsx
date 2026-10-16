'use client'

// Shared row markup for the account "Your stories" and the
// "Archived stories" pages. Receives a pre-resolved thumbnail URL so the
// parent owns the signed-URL lifecycle.
//
// 3C-4/3C-5: the row owns one deletion flow (useStoryDeletion) and one
// DeleteStoryDialog, reached from three presentations of the same action:
//   - desktop (md and up): the "Delete permanently" text button in StoryRowActions;
//   - phones: a deliberate swipe-left that slides the row content over a red
//     "Delete permanently" panel (useSwipeReveal; touch-action pan-y keeps
//     vertical scrolling native, the swipe itself never deletes anything);
//   - phones, without a gesture: the "More actions" button in StoryRowActions
//     reveals the same panel for keyboard and assistive-technology users.
// Each path ends in the same confirmation dialog and the same request.

import Link from 'next/link'
import { useCallback, useRef } from 'react'
import StoryRowActions from './StoryRowActions'
import DeleteStoryDialog from './DeleteStoryDialog'
import { useStoryDeletion } from './useStoryDeletion'
import { usePhoneViewport, useSwipeReveal } from './useSwipeReveal'
import { useLanguage } from '@/lib/i18n/context'
import { fill } from '@/lib/i18n'
import { canOfferStoryDeletion, deleteNoticeKey, type RemovedOutcome } from '@/lib/account/storyDeletion'
import { DEFAULT_SWIPE_CONFIG } from '@/lib/account/swipeReveal'

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
  /** 3C-4: server-resolved customer deletion setting; false when missing, off or unreadable. */
  deletionEnabled?: boolean
  /** 3C-4: the story is no longer listed for this customer. */
  onRemoved?: (requestId: string, outcome: RemovedOutcome) => void
}

export default function StoryRow({ story, thumbUrl, mode, deletionEnabled = false, onRemoved }: Props) {
  const { lang, t } = useLanguage()
  const a = t.account
  // Presentation only: archived + failed + setting on. The server decides eligibility.
  const deletable = mode === 'restore' && canOfferStoryDeletion({ enabled: deletionEnabled, status: story.status, archivedAt: story.archived_at })

  const del = useStoryDeletion({ requestId: story.id, onRemoved: (id, outcome) => onRemoved?.(id, outcome) })
  const dialogOpen = del.confirming || del.pending
  const phone = usePhoneViewport()
  const swipe = useSwipeReveal({ enabled: deletable && phone && !dialogOpen })
  const panelButton = useRef<HTMLButtonElement>(null)
  const moreButton = useRef<HTMLButtonElement>(null)
  // The element that opened the dialog gets focus back when it closes.
  const trigger = useRef<HTMLElement | null>(null)

  const openDelete = useCallback((from: HTMLElement | null) => {
    trigger.current = from
    swipe.close()
    del.open()
  }, [swipe, del])

  const cancelDelete = useCallback(() => {
    del.cancel()
    trigger.current?.focus()
  }, [del])

  const toggleReveal = useCallback(() => {
    if (swipe.revealed) {
      swipe.close()
      moreButton.current?.focus()
    } else {
      swipe.open()
      // Keyboard users land on the revealed destructive action next.
      requestAnimationFrame(() => panelButton.current?.focus())
    }
  }, [swipe])

  const showPanel = deletable && swipe.offset < 0
  const errorKey = del.error ? deleteNoticeKey(del.error) : null

  return (
    <div
      ref={swipe.containerRef}
      className="relative rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-brand-200 transition-colors"
    >
      {/* Phone-only action panel behind the sliding content. Hidden from everyone until revealed. */}
      {deletable && (
        <div
          className="absolute inset-y-0 right-0 flex md:hidden"
          style={{ width: DEFAULT_SWIPE_CONFIG.width }}
          aria-hidden={!swipe.revealed}
        >
          <button
            ref={panelButton}
            type="button"
            tabIndex={swipe.revealed ? 0 : -1}
            onClick={e => openDelete(moreButton.current ?? e.currentTarget)}
            disabled={del.pending || !showPanel}
            aria-label={a.deleteAria}
            className="h-full w-full min-h-11 bg-red-600 text-white text-sm font-semibold px-3 leading-tight hover:bg-red-700 disabled:opacity-50"
          >
            {a.deleteForever}
          </button>
        </div>
      )}

      <div
        {...swipe.handlers}
        style={{ transform: `translateX(${swipe.offset}px)`, touchAction: 'pan-y' }}
        className={`relative flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1.5 bg-white px-3.5 sm:px-4 py-3.5 sm:py-4 ${swipe.dragging ? 'transition-none' : 'transition-transform duration-200 ease-out motion-reduce:transition-none'}`}
      >
        <Link href={`/story/${story.id}`} draggable={false} className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <div className={`shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex items-center justify-center ${thumbUrl ? '' : coverColor(story.id)}`}>
            {thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbUrl} alt={fill(a.coverAlt, { name: story.child_name })} draggable={false} className="w-full h-full object-cover" />
            ) : (
              <span className="font-serif text-2xl font-bold text-gray-400 select-none">
                {story.child_name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-oxford truncate">{fill(a.storyOf, { name: story.child_name })}</p>
            <p className="text-xs text-charcoal-light mt-0.5 truncate">{story.story_theme}</p>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <StatusBadge status={story.status} labels={a.statuses} />
          <span className="text-xs text-gray-400 hidden sm:block">
            {new Date(story.created_at).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US')}
          </span>
          <StoryRowActions
            requestId={story.id}
            mode={mode}
            deletable={deletable}
            deletePending={del.pending}
            deleteError={del.error}
            onDelete={openDelete}
            revealed={swipe.revealed}
            onToggleReveal={toggleReveal}
            moreButtonRef={moreButton}
          />
        </div>

        {/* Phones: a kept-row outcome (409/500) reads on its own line under the content, so the
            message can never widen the row or sit over the revealed panel. md and up keeps the
            3C-4 placement beside the buttons (StoryRowActions). */}
        {deletable && errorKey && (
          <p role="alert" className="basis-full md:hidden text-[10px] leading-tight text-red-500 text-right">
            {a[errorKey]}
          </p>
        )}
      </div>

      {deletable && (
        <DeleteStoryDialog
          open={dialogOpen}
          pending={del.pending}
          onCancel={cancelDelete}
          onConfirm={del.confirm}
        />
      )}
    </div>
  )
}

function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  const styles: Record<string, string> = {
    complete: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    queued: 'bg-gray-100 text-gray-500',
    generating_text: 'bg-brand-100 text-brand-700',
    generating_images: 'bg-brand-100 text-brand-700',
    assembling_pdf: 'bg-brand-100 text-brand-700',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${styles[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {labels[status] ?? status}
    </span>
  )
}
