// 3C-4 customer deletion UI logic. Framework-free so the desktop button and the
// later phone presentation (3C-5) share one state model and one request path.
//
// What lives here on purpose:
//   - the narrow PRESENTATION rule for offering "Delete permanently": the
//     feature setting is on, the story is archived, its status is failed.
//     Nothing else: ownership, whether a worker still holds the story, how
//     recently it changed, purchases and clean-up records are decided by the
//     server and the database when the request arrives. A 409 means they said no.
//   - the single sender of DELETE /api/story/[requestId] in the client.
//   - a small state machine (idle → confirming → pending → idle) that makes a
//     duplicate click, a cancel during flight or a second confirm impossible.
//   - the mapping from HTTP status to a customer-facing outcome. The response
//     body is never shown to the customer; copy comes from the dictionary.
//
// Everything here runs in the browser. It must never import server modules.

export type DeleteStoryOutcome =
  /** 200: the story and its files are gone. */
  | 'deleted'
  /** 202: the story is gone from the account; remaining clean-up finishes automatically. */
  | 'cleanup_pending'
  /** 409: the server declined because the story is not currently eligible; the row stays. */
  | 'not_eligible'
  /** 404: the story is no longer available to this account (already deleted, or never reachable); the row is removed. */
  | 'gone'
  /** 401: the session is no longer valid; the account page's own redirect handles it. */
  | 'unauthenticated'
  /** 500 / network / anything else: generic failure, the row stays, the customer may retry. */
  | 'failed'

/** Outcomes after which the story is no longer listed for this customer. */
export type RemovedOutcome = Extract<DeleteStoryOutcome, 'deleted' | 'cleanup_pending' | 'gone'>

export interface StoryPresentation {
  /** Server-resolved value of the customer deletion setting (false when missing, off or unreadable). */
  enabled: boolean
  status: string
  archivedAt: string | null | undefined
}

/**
 * Whether a row may show "Delete permanently". The setting must be on and the
 * story must be archived AND failed. This is a display condition only.
 */
export function canOfferStoryDeletion({ enabled, status, archivedAt }: StoryPresentation): boolean {
  return enabled === true && status === 'failed' && typeof archivedAt === 'string' && archivedAt.length > 0
}

/** Maps the route's HTTP status to an outcome. The body never reaches the UI. */
export function classifyDeleteResponse(status: number, body: unknown): DeleteStoryOutcome {
  const state = body && typeof body === 'object' ? (body as { state?: unknown }).state : undefined
  if (status === 202 || (status === 200 && state === 'cleanup_pending')) return 'cleanup_pending'
  if (status === 200) return 'deleted'
  if (status === 409) return 'not_eligible'
  if (status === 404) return 'gone'
  if (status === 401) return 'unauthenticated'
  return 'failed'
}

export function removesStoryRow(outcome: DeleteStoryOutcome): outcome is RemovedOutcome {
  return outcome === 'deleted' || outcome === 'cleanup_pending' || outcome === 'gone'
}

/** Dictionary key (under `account`) carrying the customer-facing message for an outcome. */
export type DeleteNoticeKey = 'deleteDone' | 'deleteStarted' | 'deleteNotEligible' | 'deleteGone' | 'deleteFailed'

export function deleteNoticeKey(outcome: DeleteStoryOutcome): DeleteNoticeKey | null {
  switch (outcome) {
    case 'deleted': return 'deleteDone'
    case 'cleanup_pending': return 'deleteStarted'
    case 'not_eligible': return 'deleteNotEligible'
    case 'gone': return 'deleteGone'
    case 'failed': return 'deleteFailed'
    case 'unauthenticated': return null
  }
}

/** Path of the existing customer route for one story. The only place the client builds it. */
export function storyDeletePath(requestId: string): string {
  return `/api/story/${encodeURIComponent(requestId)}`
}

type FetchLike = (input: string, init: { method: 'DELETE' }) => Promise<{ status: number; json(): Promise<unknown> }>

/**
 * Sends exactly one DELETE for the story and classifies the answer. Never
 * throws: a network failure is a generic 'failed' so the row stays and the
 * customer can try again.
 */
export async function requestStoryDeletion(requestId: string, fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<DeleteStoryOutcome> {
  try {
    const res = await fetchImpl(storyDeletePath(requestId), { method: 'DELETE' })
    const body = await res.json().catch(() => null)
    return classifyDeleteResponse(res.status, body)
  } catch {
    return 'failed'
  }
}

// ── Flow state machine ──────────────────────────────────────────────────────

export type DeleteFlowPhase = 'idle' | 'confirming' | 'pending'

export interface DeleteFlowState {
  phase: DeleteFlowPhase
  /** Last outcome that kept the row (not_eligible / failed), shown next to the actions until the next attempt. */
  error: Extract<DeleteStoryOutcome, 'not_eligible' | 'failed'> | null
}

export type DeleteFlowAction =
  | { type: 'open' }
  | { type: 'cancel' }
  | { type: 'confirm' }
  | { type: 'settle'; outcome: DeleteStoryOutcome }

export const INITIAL_DELETE_FLOW: DeleteFlowState = { phase: 'idle', error: null }

export function deleteFlowReducer(state: DeleteFlowState, action: DeleteFlowAction): DeleteFlowState {
  switch (action.type) {
    case 'open':
      return state.phase === 'idle' ? { phase: 'confirming', error: null } : state
    case 'cancel':
      // A request in flight cannot be cancelled; the dialog stays until it settles.
      return state.phase === 'confirming' ? { phase: 'idle', error: state.error } : state
    case 'confirm':
      // Only an open confirmation can start a request, and only once.
      return state.phase === 'confirming' ? { phase: 'pending', error: null } : state
    case 'settle':
      if (state.phase !== 'pending') return state
      if (action.outcome === 'not_eligible' || action.outcome === 'failed') return { phase: 'idle', error: action.outcome }
      return { phase: 'idle', error: null }
  }
}

// ── Controller (what the React hook wraps) ──────────────────────────────────

export interface DeleteFlowCallbacks {
  /** Called on every state change (the hook feeds this to setState). */
  onChange: (state: DeleteFlowState) => void
  /** The story is no longer listed for this customer: remove the row and show the notice for `outcome`. */
  onRemoved: (requestId: string, outcome: RemovedOutcome) => void
  /** 401: let the account page's own session handling take over. */
  onUnauthenticated: () => void
}

export interface DeleteFlowController {
  readonly state: DeleteFlowState
  open(): void
  cancel(): void
  /** Resolves after the request settles; a call while nothing is confirming, or while a request is in flight, does nothing and sends nothing. */
  confirm(): Promise<void>
}

export function createDeleteFlow(requestId: string, callbacks: DeleteFlowCallbacks, fetchImpl?: FetchLike): DeleteFlowController {
  let state: DeleteFlowState = INITIAL_DELETE_FLOW
  let inFlight = false
  const dispatch = (action: DeleteFlowAction) => {
    const next = deleteFlowReducer(state, action)
    if (next === state) return
    state = next
    callbacks.onChange(state)
  }
  return {
    get state() { return state },
    open: () => dispatch({ type: 'open' }),
    cancel: () => dispatch({ type: 'cancel' }),
    async confirm() {
      if (inFlight || state.phase !== 'confirming') return
      inFlight = true
      dispatch({ type: 'confirm' })
      const outcome = await requestStoryDeletion(requestId, fetchImpl)
      inFlight = false
      dispatch({ type: 'settle', outcome })
      if (outcome === 'unauthenticated') callbacks.onUnauthenticated()
      else if (removesStoryRow(outcome)) callbacks.onRemoved(requestId, outcome)
    },
  }
}
