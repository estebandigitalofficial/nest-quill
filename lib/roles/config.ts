import type { AppRole, Permission } from './types'

// ─── Role → Permission map ────────────────────────────────────────────────────
// To grant a role a new permission, add it here. Nothing else changes.
// To revoke a permission, remove it here.
const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  guest: [
    'create_story',
    // Guests can submit but cannot access a dashboard or download.
    // They receive their book only via the delivery email.
  ],

  creator: [
    'create_story',
    'view_own_stories',
    'download_pdf',
    'access_creator_dashboard',
    // add_dedication and order_print are gated by BOTH role AND plan.
    // Creators get the role permission here; plan.canAddDedication checks the plan side.
    'add_dedication',
    'order_print',
  ],

  admin: [
    // Admins get every permission — creator features plus platform management.
    'create_story',
    'view_own_stories',
    'download_pdf',
    'access_creator_dashboard',
    'add_dedication',
    'order_print',
    'view_all_submissions',
    'manage_users',
    'view_processing_logs',
    'retry_failed_jobs',
    'manage_prompt_templates',
    'manage_plans',
    'manage_feature_flags',
  ],
}

export { ROLE_PERMISSIONS }
