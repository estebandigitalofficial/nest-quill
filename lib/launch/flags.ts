// Server-side reader for the launch flags (one app_settings row per area).
// Missing rows resolve to the launch default (OFF for hidden areas).

import { getSetting } from '@/lib/settings/appSettings'
import { LAUNCH_DEFAULTS, LAUNCH_FLAG_KEYS, type LaunchFlags } from './scope'

export async function getLaunchFlags(): Promise<LaunchFlags> {
  const entries = await Promise.all(
    (Object.keys(LAUNCH_FLAG_KEYS) as Array<keyof LaunchFlags>).map(async area => {
      const v = await getSetting<unknown>(LAUNCH_FLAG_KEYS[area], LAUNCH_DEFAULTS[area])
      return [area, v === true] as const
    }),
  )
  return Object.fromEntries(entries) as unknown as LaunchFlags
}
