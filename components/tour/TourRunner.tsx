'use client'

// Reusable guided-tour runner. Mount once on a page with a tourKey;
// it fetches the tour, decides whether to start from saved progress,
// and presents a quill-led overlay anchored to each step's target.
//
// Step advancement:
//   advance_on='next_button' (default) — user taps the popover's Next.
//   advance_on='click' — runner attaches a capture-phase document
//     click listener and advances when the click matches advance_selector.
//
// Skip + Replay flow through PATCH /api/tours/<key>/progress.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Tour, TourStep } from '@/lib/tours/types'
import GuideQuill from './GuideQuill'

interface Props {
  tourKey: string
  /** When true, force-start from step 0 even if previously dismissed. */
  forceReplay?: boolean
}

const GUEST_DISMISS_PREFIX = 'nq:tour:dismissed:'

export default function TourRunner({ tourKey, forceReplay = false }: Props) {
  const [tour, setTour] = useState<Tour | null>(null)
  const [active, setActive] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  // True when the real target wasn't on screen and we pivoted to spotlighting
  // the wizard's Next button instead. The popover swaps copy in this mode.
  const [pendingNext, setPendingNext] = useState(false)
  const [waiting, setWaiting] = useState(false) // true while we're listening for a click
  const cancelledRef = useRef(false)

  // Fetch the tour and decide whether to start.
  useEffect(() => {
    cancelledRef.current = false
    fetch(`/api/tours/${tourKey}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { tour: Tour | null; progress: { completed: boolean; skipped: boolean; last_step: number } | null } | null) => {
        if (cancelledRef.current || !data?.tour) return
        setTour(data.tour)

        if (forceReplay) {
          setStepIdx(0)
          setActive(true)
          try { sessionStorage.removeItem(`${GUEST_DISMISS_PREFIX}${tourKey}`) } catch { /* ignore */ }
          return
        }

        if (data.progress) {
          if (data.progress.completed || data.progress.skipped) return
          setStepIdx(Math.max(0, Math.min(data.progress.last_step, data.tour.steps.length - 1)))
          setActive(true)
          return
        }

        try {
          if (sessionStorage.getItem(`${GUEST_DISMISS_PREFIX}${tourKey}`) === '1') return
        } catch { /* ignore */ }

        setActive(true)
      })
      .catch(() => { /* swallow — tour is non-essential */ })

    return () => { cancelledRef.current = true }
  }, [tourKey, forceReplay])

  const step: TourStep | null = useMemo(() => {
    if (!tour || !active) return null
    return tour.steps[stepIdx] ?? null
  }, [tour, active, stepIdx])

  // Resolve target rect; re-measure on resize/scroll/poll.
  //
  // Resolution order, per measurement:
  //   1. The step's real target_selector. If it resolves, spotlight that
  //      and clear the pendingNext flag.
  //   2. The wizard's Next button (data-tour-id="wizard-next"). Used when
  //      the real target hasn't appeared yet because the wizard is on an
  //      earlier step. We spotlight Next so the user knows what to click;
  //      the popover swaps to "Click Next to continue" copy.
  //   3. Nothing — for centred steps (target_selector === null) and
  //      genuine missing-target situations (logged in dev).
  useEffect(() => {
    // Centred steps short-circuit immediately.
    if (!step || !step.target_selector) {
      setTargetRect(null)
      setPendingNext(false)
      return
    }
    const sel = step.target_selector
    let raf = 0
    let warnedMissing = false

    function measure() {
      const el = document.querySelector(sel)
      if (el instanceof HTMLElement) {
        const r = el.getBoundingClientRect()
        setTargetRect(r)
        setPendingNext(false)
        if (r.top < 60 || r.bottom > window.innerHeight - 60) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        return
      }
      // Real target missing → try the wizard-next fallback so the tour
      // can guide the user one screen further instead of going centred.
      const nextBtn = document.querySelector('[data-tour-id="wizard-next"]')
      if (nextBtn instanceof HTMLElement) {
        setTargetRect(nextBtn.getBoundingClientRect())
        setPendingNext(true)
        return
      }
      setTargetRect(null)
      setPendingNext(false)
      if (process.env.NODE_ENV !== 'production' && !warnedMissing) {
        warnedMissing = true
        // eslint-disable-next-line no-console
        console.warn(`[TourRunner] selector did not resolve and no wizard-next fallback present: ${sel}`)
      }
    }

    measure()
    function onResize() {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    const interval = window.setInterval(measure, 400)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
      window.clearInterval(interval)
      cancelAnimationFrame(raf)
    }
  }, [step])

  // Click-advance: when the active step says advance_on='click', listen
  // capture-phase for any click that matches advance_selector, and
  // advance the tour when it fires.
  //
  // Two important suppressions:
  //   1. pendingNext mode (target not on screen yet) — a stray click
  //      shouldn't skip the action the user actually needs to perform.
  //   2. The final step. The last step typically wraps the submit
  //      button, but submission can fail validation server-side; we
  //      don't want a click on Submit to mark the tour completed when
  //      the story didn't actually go through. Completion of the last
  //      step flows through the 'nq-tour-complete' window event,
  //      dispatched by the page after a confirmed successful submit.
  useEffect(() => {
    const isLastNow = !!tour && stepIdx === tour.steps.length - 1
    if (!step || step.advance_on !== 'click' || !step.advance_selector || pendingNext || isLastNow) {
      setWaiting(step?.advance_on === 'click' && isLastNow ? true : false)
      return
    }
    setWaiting(true)
    const sel = step.advance_selector
    function onDocClick(e: MouseEvent) {
      const path = e.composedPath ? e.composedPath() : []
      const matched = (path.length > 0 ? path : [e.target as EventTarget])
        .some(node => node instanceof Element && node.matches?.(sel))
      if (!matched) return
      // Tiny delay so the user sees their click register before we advance.
      window.setTimeout(() => advance(), 120)
    }
    document.addEventListener('click', onDocClick, true)
    return () => document.removeEventListener('click', onDocClick, true)
    // advance closes over stepIdx; we re-bind whenever step changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pendingNext, tour, stepIdx])

  // Submit-success completion. Pages that own a tour-terminal action
  // (e.g. StoryWizard's POST /api/story/submit) dispatch
  //   window.dispatchEvent(new CustomEvent('nq-tour-complete', { detail: { tourKey } }))
  // after the action succeeds. The runner only acts when the event
  // matches the active tourKey, so multiple tours on the same page (or
  // unrelated dispatches) are safe.
  useEffect(() => {
    if (!active) return
    function onComplete(e: Event) {
      const detail = (e as CustomEvent<{ tourKey?: string }>).detail
      if (!detail || detail.tourKey !== tourKey) return
      setActive(false)
      setGuestDismissed()
      persist({ last_step: stepIdx + 1, completed: true })
    }
    window.addEventListener('nq-tour-complete', onComplete as EventListener)
    return () => window.removeEventListener('nq-tour-complete', onComplete as EventListener)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tourKey, stepIdx])

  if (!tour || !active || !step) return null

  const totalSteps = tour.steps.length
  const isLast = stepIdx === totalSteps - 1

  function persist(progress: { last_step?: number; completed?: boolean; skipped?: boolean }) {
    fetch(`/api/tours/${tourKey}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progress),
    }).catch(() => { /* swallow */ })
  }

  function setGuestDismissed() {
    try { sessionStorage.setItem(`${GUEST_DISMISS_PREFIX}${tourKey}`, '1') } catch { /* ignore */ }
  }

  function advance() {
    if (isLast) {
      setActive(false)
      setGuestDismissed()
      persist({ last_step: stepIdx + 1, completed: true })
      return
    }
    const nextIdx = stepIdx + 1
    setStepIdx(nextIdx)
    persist({ last_step: nextIdx })
  }

  function back() {
    setStepIdx(i => Math.max(0, i - 1))
  }

  function skip() {
    setActive(false)
    setGuestDismissed()
    persist({ last_step: stepIdx, skipped: true })
  }

  return (
    <GuideQuill
      step={step}
      stepIdx={stepIdx}
      totalSteps={totalSteps}
      targetRect={targetRect}
      isLast={isLast}
      waitingForClick={waiting}
      pendingNext={pendingNext}
      onNext={advance}
      onBack={back}
      onSkip={skip}
    />
  )
}
