import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind classes safely.
 *
 * Why this exists: Tailwind generates classes by name, so if you have
 * "text-red-500" and "text-blue-500" in the same element, you get both
 * and the result is unpredictable. twMerge resolves conflicts properly.
 *
 * Usage:
 *   cn('px-4 py-2', isActive && 'bg-blue-500', className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
