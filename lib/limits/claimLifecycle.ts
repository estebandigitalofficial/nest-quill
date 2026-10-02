// Pure claim lifecycle for side effects that must happen at most once per
// key (ready email, PDF assembly) but must stay RETRYABLE after a failed
// attempt.
//
//   claim → run side effect → success: keep the claim (durable dedupe)
//                           → failure: release the claim (next caller retries)
//
// No framework or Supabase imports: the store is injected so the lifecycle
// is exercised by plain Node tests (claimLifecycle.test.ts) and backed by
// idempotency_keys in production (lib/limits/idempotency.ts).

export type ClaimResult =
  /** We hold the claim; nobody else may run the effect until we release it. */
  | 'claimed'
  /** Someone else holds (or completed) the claim. */
  | 'duplicate'
  /** The store could not answer (table missing / transient error). The
   *  caller proceeds under the existing fail-open policy, without a claim
   *  to release afterwards. */
  | 'unavailable'

export interface ClaimStore {
  claim(key: string, scope: string, requestId?: string): Promise<ClaimResult>
  /** Remove the claim identified by key AND scope. Must never touch other rows. */
  release(key: string, scope: string): Promise<void>
}

export type ClaimedRun<T> =
  | { outcome: 'done'; result: T; claim: ClaimResult }
  | { outcome: 'already_claimed' }
  | { outcome: 'failed'; error: unknown; released: boolean }

/**
 * Acquire the claim, run the effect, and release the claim only if the
 * effect throws. Acquisition is as atomic as the store makes it (a UNIQUE
 * index in production), so two concurrent callers can never both run the
 * effect: exactly one sees 'claimed', the other 'duplicate'.
 */
export async function runClaimed<T>(
  store: ClaimStore,
  key: string,
  scope: string,
  requestId: string | undefined,
  effect: () => Promise<T>,
): Promise<ClaimedRun<T>> {
  const claim = await store.claim(key, scope, requestId)
  if (claim === 'duplicate') return { outcome: 'already_claimed' }
  try {
    const result = await effect()
    return { outcome: 'done', result, claim }
  } catch (error) {
    let released = false
    if (claim === 'claimed') {
      try {
        await store.release(key, scope)
        released = true
      } catch {
        // Leave the claim in place rather than risk a duplicate; the
        // failure is still recorded by the caller.
      }
    }
    return { outcome: 'failed', error, released }
  }
}

/** In-memory store with the same semantics as idempotency_keys (tests + local tooling). */
export function memoryClaimStore(): ClaimStore & { held(): string[] } {
  const rows = new Map<string, { scope: string; requestId?: string }>()
  return {
    async claim(key, scope, requestId) {
      if (rows.has(key)) return 'duplicate'
      rows.set(key, { scope, requestId })
      return 'claimed'
    },
    async release(key, scope) {
      const row = rows.get(key)
      if (row && row.scope === scope) rows.delete(key)
    },
    held() {
      return [...rows.keys()]
    },
  }
}
