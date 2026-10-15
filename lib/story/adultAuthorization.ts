/**
 * Privacy Foundation 2 (2026-10-15): parent / guardian authorization.
 *
 * Nest & Quill is used by adults who enter personalization details about
 * a child (and sometimes other people). Before a story is submitted the
 * user affirms, with an un-pre-checked checkbox on the Review step, that:
 *   - they are an adult authorized to use Nest & Quill;
 *   - they are the child's parent or legal guardian, or have that person's
 *     permission to provide the child's information;
 *   - they have permission to include any other people named in the story.
 *
 * This is a user representation. Nest & Quill does not verify identity or
 * legal authority, and nothing here should be described as "verifiable
 * parental consent" or any other legal standard.
 *
 * The API route checks the affirmation BEFORE identifying the user,
 * before rate limits, before the idempotency reservation, before the
 * entitlement reservation and before the story row is inserted, so a
 * missing or false affirmation costs nothing: no row, no consumed
 * allowance, no job. The wizard's zod schema enforces the same rule on the
 * client; the server check is the one that counts.
 *
 * Dependency-free so the policy tests can import it under node:test.
 */

/** Request-body field the wizard sends. Must be the JSON boolean `true`. */
export const ADULT_AUTHORIZATION_FIELD = 'adultAuthorizationConfirmed' as const

/**
 * Wording version persisted with every affirmed story request. Bump this
 * (date-stamped) whenever the checkbox sentence in lib/i18n/dict/{en,es}.ts
 * changes in a way that matters; old rows keep the version they were shown.
 */
export const ADULT_AUTHORIZATION_VERSION = '2026-10-15' as const

export const ADULT_AUTHORIZATION_ERROR_CODE = 'ADULT_AUTHORIZATION_REQUIRED' as const

/** English API message; the wizard shows a localized line for the code. */
export const ADULT_AUTHORIZATION_ERROR_MESSAGE =
  'Please confirm that you are an adult with permission to provide this information before creating the story.'

export type AdultAuthorizationCheck =
  | { ok: true }
  | { ok: false; status: 400; code: typeof ADULT_AUTHORIZATION_ERROR_CODE; message: string }

/**
 * Strict: only the JSON boolean `true` passes. Strings ("true"), numbers
 * (1), objects and a missing field are all rejected, so a forged or stale
 * client cannot slip past with a truthy value.
 */
export function checkAdultAuthorization(body: unknown): AdultAuthorizationCheck {
  const value = body && typeof body === 'object'
    ? (body as Record<string, unknown>)[ADULT_AUTHORIZATION_FIELD]
    : undefined
  if (value === true) return { ok: true }
  return { ok: false, status: 400, code: ADULT_AUTHORIZATION_ERROR_CODE, message: ADULT_AUTHORIZATION_ERROR_MESSAGE }
}

export interface AdultAuthorizationEvidence {
  adult_authorization_confirmed: true
  adult_authorization_confirmed_at: string
  adult_authorization_version: typeof ADULT_AUTHORIZATION_VERSION
}

/**
 * The three columns written on the story row. The timestamp is the
 * server's clock at submission, never a client-supplied value. Nothing
 * else (IP, location, birth date, legal text) is recorded.
 */
export function adultAuthorizationEvidence(now: Date = new Date()): AdultAuthorizationEvidence {
  return {
    adult_authorization_confirmed: true,
    adult_authorization_confirmed_at: now.toISOString(),
    adult_authorization_version: ADULT_AUTHORIZATION_VERSION,
  }
}
