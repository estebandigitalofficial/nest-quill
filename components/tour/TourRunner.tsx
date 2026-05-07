'use client'

// Reusable guided-tour runner. Mount once on a page with a tourKey;
// it fetches the tour, checks per-user progress (or sessionStorage for
// guests), and presents a quill-led popover anchored to each step's
// target selector. Skip / Replay / Complete all flow through PATCH.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Tour, TourStep } from '@/lib/tours/types'
import GuideQuill from './GuideQuill'

interface Props {
  tourKey: string
  /** When set, forces the tour to start from step 0 even if previously dismissed. */
  forceReplay?: boolean
}

const GUEST_DISMISS_PREFIX = 'nq:tour:dismissed:'

export default function TourRunner({ tourKey, forceReplay = false }: Props) {
  const [tour, setTour] = useState<Tour | null>(null)
  const [active, setActive] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
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
          // Clear guest dismissal too.
          try { sessionStorage.removeItem(`${GUEST_DISMISS_PREFIX}${tourKey}`) } catch { /* ignore */ }
          return
        }

        // Auth path: don't auto-start a completed/skipped tour.
        if (data.progress) {
          if (data.progress.completed || data.progress.skipped) return
          setStepIdx(Math.max(0, Math.min(data.progress.last_step, data.tour.steps.length - 1)))
          setActive(true)
          return
        }

        // Guest path: respect a session-scope dismissal so the tour
        // doesn't restart on every step navigation.
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

  // Resolve the target element + position. Re-measures on resize and
  // when the active step changes. For null selectors we render the
  // popover centred without an anchor.
  useEffect(() => {
    if (!step || !step.target_selector) { setTargetRect(null); return }
    const sel = step.target_selector
    let raf = 0
    function measure() {
      const el = document.querySelector(sel)
      if (el instanceof HTMLElement) {
        const r = el.getBoundingClientRect()
        setTargetRect(r)
        // Scroll into view if it's off-screen.
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
    const interval = window.setInterval(measure, 500) // catch DOM shifts
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
      window.clearInterval(interval)
      cancelAnimationFrame(raf)
    }
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

  function next() {
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
      onNext={next}
      onBack={back}
      onSkip={skip}
    />
  )
}
