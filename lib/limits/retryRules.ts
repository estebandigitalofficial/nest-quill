// Centralized retry rules. The Edge Function and the user-facing retry
// route both consult this so behavior stays consistent.
//
// Rules per failure_code:
//   - retryable    boolean — whether retry is permitted at all
//   - maxAttempts  total attempts before hard-stop (retry_count + 1 >= max)
//   - backoffMs    function returning the delay before the Nth retry
//
// Defaults handle UNKNOWN / unset failure_code gracefully.
//
// Server-only.

export interface RetryRule {
  retryable: boolean
  maxAttempts: number
  backoff: (attempt: number) => number  // milliseconds before the Nth retry
}

/** Exponential-ish backoff with a cap. */
function expBackoff(attempt: number): number {
  // 1m, 5m, 15m, 30m, 30m...
  const ladder = [60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000]
  return ladder[Math.min(attempt, ladder.length - 1)] ?? 30 * 60_000
}

/** Quick backoff for transient provider hiccups. */
function quickBackoff(attempt: number): number {
  // 30s, 2m, 5m, 10m
  const ladder = [30_000, 2 * 60_000, 5 * 60_000, 10 * 60_000]
  return ladder[Math.min(attempt, ladder.length - 1)] ?? 10 * 60_000
}

const RULES: Record<string, RetryRule> = {
  RATE_LIMIT:               { retryable: true,  maxAttempts: 5, backoff: quickBackoff },
  OPENAI_TIMEOUT:           { retryable: true,  maxAttempts: 4, backoff: quickBackoff },
  IMAGE_TIMEOUT:            { retryable: true,  maxAttempts: 4, backoff: quickBackoff },
  EDGE_FUNCTION_TIMEOUT:    { retryable: true,  maxAttempts: 3, backoff: expBackoff   },
  IMAGE_GENERATION_FAILED:  { retryable: true,  maxAttempts: 3, backoff: expBackoff   },
  OPENAI_ERROR:             { retryable: true,  maxAttempts: 3, backoff: expBackoff   },
  STORAGE_ERROR:            { retryable: true,  maxAttempts: 3, backoff: expBackoff   },
  PDF_ASSEMBLY_FAILED:      { retryable: true,  maxAttempts: 3, backoff: expBackoff   },

  INVALID_INPUT:            { retryable: false, maxAttempts: 0, backoff: () => 0 },
  AUTH_ERROR:               { retryable: false, maxAttempts: 0, backoff: () => 0 },
  CANCELLED_BY_ADMIN:       { retryable: false, maxAttempts: 0, backoff: () => 0 },

  UNKNOWN:                  { retryable: true,  maxAttempts: 3, backoff: expBackoff   },
}

const DEFAULT_RULE: RetryRule = RULES.UNKNOWN

export function ruleFor(code: string | null | undefined): RetryRule {
  if (!code) return DEFAULT_RULE
  return RULES[code] ?? DEFAULT_RULE
}

/**
 * Compute the next retry_after timestamp given the current attempt
 * count + failure code. Returns null when the row should NOT be set
 * up for another automatic retry (caller can still admin-force).
 */
export function computeRetryAfter(failureCode: string | null | undefined, retryCount: number): string | null {
  const rule = ruleFor(failureCode)
  if (!rule.retryable) return null
  if (retryCount + 1 >= rule.maxAttempts) return null
  return new Date(Date.now() + rule.backoff(retryCount)).toISOString()
}

export interface RetryEligibility {
  eligible: boolean
  reason?: string
  /** When `retry_after` is in the future, how long to wait. */
  retryAfterSeconds?: number
}

/**
 * Decide whether a user-driven retry should be accepted. Admins bypass.
 */
export function checkRetryEligibility(args: {
  failureCode: string | null | undefined
  retryable: boolean | null
  retryCount: number
  retryAfter: string | null
  isAdmin: boolean
}): RetryEligibility {
  if (args.isAdmin) return { eligible: true }
  // Explicit admin signal beats any rule (force mark-failed → retryable=false).
  if (args.retryable === false) {
    return { eligible: false, reason: 'This story has been marked permanently failed.' }
  }
  const rule = ruleFor(args.failureCode)
  if (!rule.retryable) {
    return { eligible: false, reason: 'This failure type is not retryable.' }
  }
  if (args.retryCount >= rule.maxAttempts) {
    return { eligible: false, reason: 'Maximum retry attempts reached.' }
  }
  if (args.retryAfter) {
    const wait = new Date(args.retryAfter).getTime() - Date.now()
    if (wait > 0) {
      return {
        eligible: false,
        reason: `Please wait ${Math.ceil(wait / 1000)}s before retrying.`,
        retryAfterSeconds: Math.ceil(wait / 1000),
      }
    }
  }
  return { eligible: true }
}
