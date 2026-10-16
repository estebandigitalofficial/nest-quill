'use client'

// React binding for the 3C-5 swipe-to-reveal model (lib/account/swipeReveal.ts).
// Attach `handlers` to the sliding row content (which carries
// `touch-action: pan-y`, so the browser keeps vertical scrolling and sends
// `pointercancel` once it takes over) and render `offset` as translateX.
// Only phones (below md, 768px) get a live gesture; everything else keeps
// `enabled` false and the row never moves. Outside taps and Escape close a
// revealed row; a click that follows a horizontal drag, or lands on a
// revealed row, is swallowed so the story link does not open by accident.

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { DEFAULT_SWIPE_CONFIG, RESTING, createSwipeTracker, type SwipeRevealConfig, type SwipeState } from '@/lib/account/swipeReveal'

export const PHONE_MEDIA_QUERY = '(max-width: 767px)'

/** True below the md breakpoint; false on the server and until mounted. */
export function usePhoneViewport(): boolean {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(PHONE_MEDIA_QUERY)
    const update = () => setPhone(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return phone
}

interface Options {
  /** Gesture live (phone viewport, row deletable, no dialog or request in flight). */
  enabled: boolean
  config?: SwipeRevealConfig
}

export function useSwipeReveal({ enabled, config = DEFAULT_SWIPE_CONFIG }: Options) {
  const tracker = useMemo(() => createSwipeTracker(config), [config])
  const [state, setState] = useState<SwipeState>(RESTING)
  const containerRef = useRef<HTMLDivElement>(null)
  const pointerId = useRef<number | null>(null)
  const swallowClick = useRef(false)
  const apply = useCallback((s: SwipeState) => setState({ ...s }), [])

  const close = useCallback(() => { pointerId.current = null; apply(tracker.setRevealed(false)) }, [tracker, apply])
  const open = useCallback(() => { pointerId.current = null; apply(tracker.setRevealed(true)) }, [tracker, apply])

  // Disabling (dialog open, request pending, viewport grew) always rests the row,
  // and forgets any drag that was still waiting to swallow its click.
  useEffect(() => { if (!enabled) { swallowClick.current = false; close() } }, [enabled, close])

  // Outside tap and Escape close a revealed row.
  useEffect(() => {
    if (!state.revealed) return
    const onDown = (e: PointerEvent) => {
      if (containerRef.current && e.target instanceof Node && !containerRef.current.contains(e.target)) close()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [state.revealed, close])

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || pointerId.current !== null) return
    pointerId.current = e.pointerId
    // A new touch starts clean: only a drag in THIS interaction may swallow the click that follows it.
    swallowClick.current = false
    apply(tracker.start(e.clientX, e.clientY))
  }, [enabled, tracker, apply])

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return
    const next = tracker.move(e.clientX, e.clientY)
    if (next.axis === 'y') { pointerId.current = null; apply(tracker.cancel()); return }
    if (next.axis === 'x') swallowClick.current = true
    apply(next)
  }, [tracker, apply])

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return
    pointerId.current = null
    apply(tracker.end())
  }, [tracker, apply])

  const onPointerCancel = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return
    pointerId.current = null
    apply(tracker.cancel())
  }, [tracker, apply])

  // A click after a horizontal drag, or on a revealed row, closes the row instead of following the link.
  const onClickCapture = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (swallowClick.current || state.revealed) {
      e.preventDefault()
      e.stopPropagation()
      swallowClick.current = false
      if (state.revealed) close()
    }
  }, [state.revealed, close])

  return {
    containerRef,
    offset: state.offset,
    revealed: state.revealed,
    dragging: state.dragging,
    open,
    close,
    handlers: enabled
      ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture }
      : { onClickCapture },
  }
}
