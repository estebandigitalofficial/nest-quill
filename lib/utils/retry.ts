/**
 * Exponential backoff retry wrapper.
 *
 * Why this exists: OpenAI and image APIs sometimes return temporary errors
 * (rate limits, timeouts). Rather than failing instantly, we wait and retry.
 *
 * Example usage:
 *   const result = await withRetry(() => openai.chat.completions.create(...))
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    baseDelayMs?: number
    onRetry?: (attempt: number, error: Error) => void
  } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000, onRetry } = options

  let lastError: Error = new Error('Unknown error')

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempt === maxAttempts) break

      const delay = baseDelayMs * Math.pow(2, attempt - 1)  // 1s, 2s, 4s...
      onRetry?.(attempt, lastError)
      await sleep(delay)
    }
  }

  throw lastError
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
