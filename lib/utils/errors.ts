/**
 * Typed error classes for the app.
 *
 * Why custom error classes?
 * When something goes wrong (invalid form, missing payment, rate limit)
 * we want to return the right HTTP status code and a clear message.
 * A generic Error() doesn't carry that context.
 */

export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: string

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTH_ERROR')
    this.name = 'AuthError'
  }
}

export class PlanLimitError extends AppError {
  constructor(message: string) {
    super(message, 403, 'PLAN_LIMIT_EXCEEDED')
    this.name = 'PlanLimitError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

// ─── API error response helper ────────────────────────────────────────────────
// Converts any error into a consistent JSON response shape
export function toApiError(err: unknown): { message: string; code: string; statusCode: number } {
  if (err instanceof AppError) {
    return {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
    }
  }

  if (err instanceof Error) {
    return {
      message: err.message,
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    }
  }

  return {
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    statusCode: 500,
  }
}
