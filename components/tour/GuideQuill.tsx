'use client'

// Quill-led tour popover. Renders a soft spotlight ring on the target
// element + a tooltip card anchored relative to it. Centred steps
// (target_selector === null) render as a centred modal-style card.
// Reduced-motion respects the global preference via the existing
// .nq-* animation classes (no JS animation here).

import AnimatedQuill from '@/components/AnimatedQuill'
import type { TourStep } from '@/lib/tours/types'

const POPOVER_W = 320
const SPOTLIGHT_PAD = 8

export default function GuideQuill({
  step, stepIdx, totalSteps, targetRect, isLast,
  onNext, onBack, onSkip,
}: {
  step: TourStep
  stepIdx: number
  totalSteps: number
  targetRect: DOMRect | null
  isLast: boolean
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}) {
  const centred = !targetRect || step.placement === 'center'

  // Compute popover position. Defaults to a viewport-centred card when
  // there's no anchor; otherwise tries to place per the step.placement
  // and falls back to whichever side has the most room.
  const popoverStyle: React.CSSProperties = (() => {
    if (centred) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: POPOVER_W,
        maxWidth: 'calc(100vw - 32px)',
      }
    }
    const r = targetRect!
    const above = r.top
    const below = window.innerHeight - r.bottom
    const placement = step.placement === 'top' || (step.placement === 'bottom' && below < 200 && above > below)
      ? 'top'
      : 'bottom'
    const top = placement === 'top' ? Math.max(16, r.top - 16) : Math.min(window.innerHeight - 16, r.bottom + 16)
    const left = Math.max(16, Math.min(window.innerWidth - POPOVER_W - 16, r.left + r.width / 2 - POPOVER_W / 2))
    return {
      position: 'fixed',
      top: placement === 'top' ? undefined : top,
      bottom: placement === 'top' ? window.innerHeight - top : undefined,
      left,
      width: POPOVER_W,
      maxWidth: 'calc(100vw - 32px)',
    }
  })()

  return (
    <>
      {/* Soft backdrop — slight dim so the tooltip pops, but the page
          stays interactive (the user might need to click the highlighted
          control). pointer-events-none on the dim layer keeps clicks
          flowing through. */}
      <div
        aria-hidden
        className="fixed inset-0 z-[60] pointer-events-none"
        style={{ background: 'rgba(12,35,64,0.18)' }}
      />

      {/* Spotlight ring around the target — non-interactive overlay
          using a box-shadow trick so we don't have to clip anything. */}
      {targetRect && !centred && (
        <div
          aria-hidden
          className="fixed z-[61] rounded-2xl pointer-events-none transition-all"
          style={{
            top: targetRect.top - SPOTLIGHT_PAD,
            left: targetRect.left - SPOTLIGHT_PAD,
            width: targetRect.width + SPOTLIGHT_PAD * 2,
            height: targetRect.height + SPOTLIGHT_PAD * 2,
            boxShadow: '0 0 0 9999px rgba(12,35,64,0.35), 0 0 0 3px #C99700',
          }}
        />
      )}

      {/* Popover card */}
      <div
        role="dialog"
        aria-label={`Tour step ${stepIdx + 1} of ${totalSteps}: ${step.title}`}
        className="z-[62] bg-white rounded-2xl border border-parchment-dark shadow-xl px-5 py-4"
        style={popoverStyle}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center">
            <AnimatedQuill size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-charcoal-light mb-0.5">
              Step {stepIdx + 1} of {totalSteps}
            </p>
            <p className="font-serif text-base text-oxford leading-snug">{step.title}</p>
          </div>
        </div>

        <p className="text-sm text-charcoal mt-3 leading-relaxed">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-charcoal-light hover:text-charcoal underline-offset-2 hover:underline"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <button
                type="button"
                onClick={onBack}
                className="text-xs text-charcoal-light hover:text-charcoal px-2.5 py-1 rounded-md"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              {step.action_label ?? (isLast ? 'Got it' : 'Next')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
