// ─── App roles ────────────────────────────────────────────────────────────────
// Every user in the system is exactly one of these.
// Stored on profiles.role in the database.
export type AppRole = 'guest' | 'creator' | 'admin'

// ─── Permissions ──────────────────────────────────────────────────────────────
// Permissions are binary (on/off). They control what a role can ACCESS.
// Plan limits are separate — they control QUANTITY and FEATURES within access.
// Example: a creator can create_story (role permission) but only 3/month (plan limit).
export type Permission =
  // User-facing creation
  | 'create_story'
  | 'view_own_stories'
  | 'download_pdf'
  | 'access_creator_dashboard'
  | 'add_dedication'      // also plan-gated (plan.canAddDedication)
  | 'order_print'         // also plan-gated (plan.canOrderPrint)

  // Admin controls
  | 'view_all_submissions'
  | 'manage_users'
  | 'view_processing_logs'
  | 'retry_failed_jobs'
  | 'manage_prompt_templates'
  | 'manage_plans'
  | 'manage_feature_flags'
