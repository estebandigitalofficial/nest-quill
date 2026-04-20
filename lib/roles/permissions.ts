import { ROLE_PERMISSIONS } from './config'
import type { AppRole, Permission } from './types'

// ─── Core check ───────────────────────────────────────────────────────────────

export function hasPermission(role: AppRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

// ─── Route guards (server-side) ───────────────────────────────────────────────
// Use these in Route Handlers and Server Components to protect pages/APIs.

export function requirePermission(role: AppRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Role '${role}' does not have permission: ${permission}`)
  }
}

export function isAdmin(role: AppRole): boolean {
  return role === 'admin'
}

export function isCreatorOrAdmin(role: AppRole): boolean {
  return role === 'creator' || role === 'admin'
}

// ─── Supabase profile helper ──────────────────────────────────────────────────
// Reads the role from a Supabase profile row.
// Falls back to 'guest' for unauthenticated users or if the profile has no role.
export function getRoleFromProfile(
  profile: { is_admin: boolean } | null | undefined
): AppRole {
  if (!profile) return 'guest'
  if (profile.is_admin) return 'admin'
  return 'creator'
}

// ─── Client-side helpers ──────────────────────────────────────────────────────
// Safe to use in 'use client' components (no server imports).

export function getPermissionsForRole(role: AppRole): Permission[] {
  return ROLE_PERMISSIONS[role]
}
