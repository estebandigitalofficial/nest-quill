'use client'

// React binding for the 3C-4 deletion flow (lib/account/storyDeletion.ts).
// One controller per story row; the controller owns the duplicate-request
// guard, this hook only mirrors its state into React and routes the two
// side effects:
//   - a removed story → the list drops the row and shows the outcome notice;
//   - a 401 → router.refresh(), which re-runs the account page on the server
//     and lands on its existing redirect('/login') for an expired session.
// 3C-5 (phone presentation) reuses this hook unchanged.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  INITIAL_DELETE_FLOW,
  createDeleteFlow,
  type DeleteFlowState,
  type RemovedOutcome,
} from '@/lib/account/storyDeletion'

interface Options {
  requestId: string
  onRemoved: (requestId: string, outcome: RemovedOutcome) => void
}

export function useStoryDeletion({ requestId, onRemoved }: Options) {
  const router = useRouter()
  const [state, setState] = useState<DeleteFlowState>(INITIAL_DELETE_FLOW)
  // Latest callbacks without recreating the controller mid-flight.
  const removedRef = useRef(onRemoved)
  useEffect(() => { removedRef.current = onRemoved }, [onRemoved])
  const refreshRef = useRef(router.refresh)
  useEffect(() => { refreshRef.current = router.refresh }, [router])

  const flow = useMemo(() => createDeleteFlow(requestId, {
    onChange: setState,
    onRemoved: (id, outcome) => removedRef.current(id, outcome),
    onUnauthenticated: () => refreshRef.current(),
  }), [requestId])

  const open = useCallback(() => flow.open(), [flow])
  const cancel = useCallback(() => flow.cancel(), [flow])
  const confirm = useCallback(() => { void flow.confirm() }, [flow])

  return {
    confirming: state.phase === 'confirming',
    pending: state.phase === 'pending',
    error: state.error,
    open,
    cancel,
    confirm,
  }
}
