'use client'

// Quill-led tour overlay. Two pieces are rendered:
//
//   1. The floating Quill mascot — a small, animated avatar that
//      physically moves to the side of the spotlighted target, acting
//      as the "pointer".
//   2. The popover card — anchored just below or above the target
//      (whichever has more room), with a directional arrow so the
//      relationship between text and target is unambiguous.
//
// Both elements use CSS transforms with a transition so movement
// between steps feels guided rather than teleported. Reduced-motion
// users get instant repositioning via the existing media-query rules.

import AnimatedQuill from '@/components/AnimatedQuill'
import type { TourStep } from '@/lib/tours/types'

const POPOVER_W = 320
const SPOTLIGHT_PAD = 8
const QUILL_SIZE = 44

interface Props {
  step: TourStep
  stepIdx: number
  totalSteps: number
  targetRect: DOMRect | null
  isLast: boolean
  /** True when the tour is listening for a click on advance_selector. */
  waitingForClick: boolean
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

type Placement = 'top' | 'bottom' | 'center'

export default function GuideQuill(props: Props) {
  const { step, stepIdx, totalSteps, targetRect, isLast, waitingForClick, onNext, onBack, onSkip } = props
  const centred = !targetRect || step.placement === 'center'

  // Pick a placement (top vs bottom) based on available room.
  const placement: Placement = (() => {
    if (centred) return 'center'
    const r = targetRect!
    if (step.placement === 'top') return r.top > 240 ? 'top' : 'bottom'
    if (step.placement === 'bottom') return (window.innerHeight - r.bottom) > 220 ? 'bottom' : 'top'
    // Default decision: prefer the side with more room.
    return (window.innerHeight - r.bottom) >= r.top ? 'bottom' : 'top'
  })()

  // Compute popover and quill positions. Quill sits on the same side as
  // the popover but pulled slightly toward the target so it visually
  // points at it.
  const { popoverStyle, quillStyle, arrowStyle } = positions(targetRect, placement)

  return (
    <>
      {/* Soft dim layer. pointer-events-none so the user can still
          click the highlighted control. */}
      <div
        aria-hidden
        className="fixed inset-0 z-[60] pointer-events-none"
        style={{ background: 'rgba(12,35,64,0.18)' }}
      />

      {/* Spotlight ring */}
      {targetRect && !centred && (
        <div
          aria-hidden
          className="fixed z-[61] rounded-2xl pointer-events-none transition-all duration-300 motion-reduce:transition-none"
          style={{
            top: targetRect.top - SPOTLIGHT_PAD,
            left: targetRect.left - SPOTLIGHT_PAD,
            width: targetRect.width + SPOTLIGHT_PAD * 2,
            height: targetRect.height + SPOTLIGHT_PAD * 2,
            boxShadow: '0 0 0 9999px rgba(12,35,64,0.35), 0 0 0 3px #C99700',
          }}
        />
      )}

      {/* Floating quill mascot — moves with each step */}
      <div
        aria-hidden
        className="fixed z-[63] pointer-events-none transition-all duration-500 ease-out motion-reduce:transition-none"
        style={quillStyle}
      >
        <div
          className="rounded-full bg-white border-2 border-brand-500 shadow-lg flex items-center justify-center"
          style={{ width: QUILL_SIZE, height: QUILL_SIZE }}
        >
          <AnimatedQuill size={QUILL_SIZE - 16} />
        </div>
      </div>

      {/* Popover card */}
      <div
        role="dialog"
        aria-label={`Tour step ${stepIdx + 1} of ${totalSteps}: ${step.title}`}
        className="z-[62] bg-white rounded-2xl border border-parchment-dark shadow-xl px-5 py-4 transition-all duration-300 ease-out motion-reduce:transition-none"
        style={popoverStyle}
      >
        {arrowStyle && (
          <div
            aria-hidden
            className="absolute w-3 h-3 bg-white border border-parchment-dark rotate-45"
            style={arrowStyle}
          />
        )}

        <div>
          <p className="text-[10px] uppercase tracking-widest text-charcoal-light mb-0.5">
            Step {stepIdx + 1} of {totalSteps}
          </p>
          <p className="font-serif text-base text-oxford leading-snug">{step.title}</p>
        </div>

        <p className="text-sm text-charcoal mt-2 leading-relaxed">{step.body}</p>

        {waitingForClick && step.wait_message && (
          <p className="mt-3 text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 mr-1.5 align-middle nq-twinkle" />
            {step.wait_message}
          </p>
        )}

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
            {step.advance_on === 'next_button' && (
              <button
                type="button"
                onClick={onNext}
                className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              >
                {step.action_label ?? (isLast ? 'Got it' : 'Next')}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function positions(targetRect: DOMRect | null, placement: Placement): {
  popoverStyle: React.CSSProperties
  quillStyle: React.CSSProperties
  arrowStyle: React.CSSProperties | null
} {
  if (!targetRect || placement === 'center') {
    return {
      popoverStyle: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: POPOVER_W,
        maxWidth: 'calc(100vw - 32px)',
      },
      quillStyle: {
        position: 'fixed',
        top: `calc(50% - ${POPOVER_W / 2}px - ${QUILL_SIZE + 12}px)`,
        left: '50%',
        transform: 'translate(-50%, 0)',
      },
      arrowStyle: null,
    }
  }

  const r = targetRect
  const popoverLeft = Math.max(16, Math.min(window.innerWidth - POPOVER_W - 16, r.left + r.width / 2 - POPOVER_W / 2))
  const targetCenterX = r.left + r.width / 2

  if (placement === 'bottom') {
    const popoverTop = Math.min(window.innerHeight - 16, r.bottom + 18)
    return {
      popoverStyle: {
        position: 'fixed',
        top: popoverTop,
        left: popoverLeft,
        width: POPOVER_W,
        maxWidth: 'calc(100vw - 32px)',
      },
      quillStyle: {
        position: 'fixed',
        top: r.bottom + 4,
        left: targetCenterX - QUILL_SIZE / 2,
      },
      arrowStyle: {
        top: -7,
        left: Math.max(20, Math.min(POPOVER_W - 20, targetCenterX - popoverLeft)),
        borderRight: 'transparent',
        borderBottom: 'transparent',
      },
    }
  }

  // placement === 'top'
  const popoverHeightGuess = 180
  const popoverTop = Math.max(16, r.top - 18 - popoverHeightGuess)
  return {
    popoverStyle: {
      position: 'fixed',
      top: popoverTop,
      left: popoverLeft,
      width: POPOVER_W,
      maxWidth: 'calc(100vw - 32px)',
    },
    quillStyle: {
      position: 'fixed',
      top: r.top - QUILL_SIZE - 4,
      left: targetCenterX - QUILL_SIZE / 2,
    },
    arrowStyle: {
      bottom: -7,
      left: Math.max(20, Math.min(POPOVER_W - 20, targetCenterX - popoverLeft)),
      borderLeft: 'transparent',
      borderTop: 'transparent',
    },
  }
}
