// 3C-5 swipe-to-reveal gesture model, framework-free so the thresholds and
// direction lock are testable without a browser. The React hook
// (components/account/useSwipeReveal.ts) feeds it pointer coordinates and
// renders the offset it returns.
//
// Behaviour:
//   - nothing happens until the pointer has moved `lockThreshold` px; the
//     first axis to pass it locks the gesture ('x' = the row follows the
//     finger horizontally, 'y' = the browser scrolls and the row stays put);
//   - the row never slides past the action panel (`offset` ∈ [-width, 0]) and
//     never to the right of its resting position;
//   - releasing after a left movement of at least `revealFraction * width`
//     reveals the panel; a right movement of at least `closeDistance` closes
//     it; anything shorter snaps back to the state the gesture started in;
//   - revealing never activates the action: the panel's button needs its own tap.

export interface SwipeRevealConfig {
  /** Width of the revealed action panel in px (also the maximum slide). */
  width: number
  /** Movement before the axis is locked (px). Below this a touch is a tap. */
  lockThreshold: number
  /** Fraction of `width` the finger must travel left to reveal on release. */
  revealFraction: number
  /** Rightward movement (px) that closes a revealed row on release. */
  closeDistance: number
}

export const DEFAULT_SWIPE_CONFIG: SwipeRevealConfig = {
  width: 104,
  lockThreshold: 8,
  revealFraction: 0.4,
  closeDistance: 24,
}

export type SwipeAxis = 'x' | 'y' | null

export interface SwipeState {
  /** Horizontal translation of the row content in px (0 = resting, -width = fully revealed). */
  offset: number
  /** The action panel is open (after release or via the accessible control). */
  revealed: boolean
  /** A horizontal drag is in progress (no transition while true). */
  dragging: boolean
  /** Axis locked for the current touch; null until the threshold is passed. */
  axis: SwipeAxis
}

export const RESTING: SwipeState = { offset: 0, revealed: false, dragging: false, axis: null }

export function clampOffset(offset: number, width: number): number {
  return Math.min(0, Math.max(-width, offset))
}

/** Pure gesture tracker: one instance per row. */
export interface SwipeTracker {
  readonly state: SwipeState
  /** Finger down at (x, y). Ignored while a drag is already active. */
  start(x: number, y: number): SwipeState
  /** Finger moved to (x, y). Returns the new state; axis 'y' means "let the browser scroll". */
  move(x: number, y: number): SwipeState
  /** Finger lifted: settle to revealed or resting. */
  end(): SwipeState
  /** Gesture cancelled (the browser took over scrolling, or the row lost the pointer): snap back. */
  cancel(): SwipeState
  /** Open or close the panel without a gesture (More actions, outside tap, Escape, right swipe). */
  setRevealed(revealed: boolean): SwipeState
}

export function createSwipeTracker(config: SwipeRevealConfig = DEFAULT_SWIPE_CONFIG): SwipeTracker {
  const { width, lockThreshold, revealFraction, closeDistance } = config
  let state: SwipeState = RESTING
  let origin: { x: number; y: number; offset: number; revealed: boolean } | null = null

  const settle = (revealed: boolean): SwipeState => {
    state = { offset: revealed ? -width : 0, revealed, dragging: false, axis: null }
    origin = null
    return state
  }

  return {
    get state() { return state },
    start(x, y) {
      if (origin) return state
      origin = { x, y, offset: state.revealed ? -width : 0, revealed: state.revealed }
      state = { ...state, axis: null, dragging: false }
      return state
    },
    move(x, y) {
      if (!origin) return state
      const dx = x - origin.x
      const dy = y - origin.y
      if (state.axis === 'y') return state
      if (state.axis === null) {
        if (Math.abs(dx) < lockThreshold && Math.abs(dy) < lockThreshold) return state
        const axis: SwipeAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
        if (axis === 'y') {
          // Vertical intent: the row stays where it was; the browser scrolls.
          state = { ...state, axis: 'y', dragging: false, offset: origin.offset }
          return state
        }
        state = { ...state, axis: 'x', dragging: true }
      }
      state = { ...state, offset: clampOffset(origin.offset + dx, width) }
      return state
    },
    end() {
      if (!origin) return state
      if (state.axis !== 'x') {
        // A tap or a vertical scroll: nothing changes.
        const revealed = origin.revealed
        return settle(revealed)
      }
      const travelled = state.offset - origin.offset // negative = moved left
      if (!origin.revealed && travelled <= -(width * revealFraction)) return settle(true)
      if (origin.revealed && travelled >= closeDistance) return settle(false)
      return settle(origin.revealed)
    },
    cancel() {
      const revealed = origin ? origin.revealed : state.revealed
      return settle(revealed)
    },
    setRevealed(revealed) {
      return settle(revealed)
    },
  }
}
