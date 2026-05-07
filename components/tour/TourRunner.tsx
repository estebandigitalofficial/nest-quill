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

  // Resolve target rect; re-measure on resize/scroll/poll. Centred steps
  // and steps whose target isn't on the page yet just leave rect null.
  useEffect(() => {
    if (!step || !step.target_selector) { setTargetRect(null); return }
    const sel = step.target_selector
    let raf = 0
    function measure() {
      const el = document.querySelector(sel)
      if (el instanceof HTMLElement) {
        const r = el.getBoundingClientRect()
        setTargetRect(r)
        if (r.top < 60 || r.bottom > window.innerHeight - 60) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      } else {
        setTargetRect(null)
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
  // advance the tour when it fires. Capture-phase ensures we observe
  // the click even if the target stops propagation.
  useEffect(() => {
    if (!step || step.advance_on !== 'click' || !step.advance_selector) {
      setWaiting(false)
      return
    }
    setWaiting(true)
    const sel = step.advance_selector
    function onDocClick(e: MouseEvent) {
      const path = e.composedPath ? e.composedPath() : []
      // Check the path so a click on a child of the matching element still counts.
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
  }, [step])

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
      onNext={advance}
      onBack={back}
      onSkip={skip}
    />
  )
}
