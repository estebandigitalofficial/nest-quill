/**
 * Server-only. Never import this in client components or browser code.
 * All reads/writes use the Supabase service role — RLS is bypassed.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export type AppSetting = {
  key: string
  value: unknown
  category: string
  label: string
  description: string | null
  updated_at: string
  updated_by: string | null
}

/**
 * Returns the parsed JSONB value for a single setting key.
 * Falls back to `fallback` when the key is missing or the query fails.
 */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .single()

  if (error || !data) return fallback
  return data.value as T
}

/**
 * Returns all settings rows for the given category, ordered by key.
 */
export async function getSettingsByCategory(category: string): Promise<AppSetting[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('app_settings')
    .select('key, value, category, label, description, updated_at, updated_by')
    .eq('category', category)
    .order('key')

  if (error) {
    console.error('[appSettings.getSettingsByCategory]', { category, error })
    return []
  }
  return data ?? []
}

/**
 * Returns every settings row ordered by category then key.
 */
export async function getAllSettings(): Promise<AppSetting[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('app_settings')
    .select('key, value, category, label, description, updated_at, updated_by')
    .order('category')
    .order('key')

  if (error) {
    console.error('[appSettings.getAllSettings]', error)
    return []
  }
  return data ?? []
}

/**
 * Updates the value for an existing setting key.
 * Throws if the key does not exist or the update fails.
 * `value` must be a JSON-serialisable type.
 */
export async function updateSetting(
  key: string,
  value: unknown,
  adminUserId: string,
): Promise<void> {
  const db = createAdminClient()
  const { error } = await db
    .from('app_settings')
    .update({
      value,
      updated_at: new Date().toISOString(),
      updated_by: adminUserId,
    })
    .eq('key', key)

  if (error) {
    console.error('[appSettings.updateSetting]', { key, error })
    throw new Error(`Failed to update setting "${key}": ${error.message}`)
  }
}
