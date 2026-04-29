-- Admin notification settings per admin user and notification type
CREATE TABLE IF NOT EXISTS admin_notification_settings (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text      NOT NULL,
  enabled         boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(admin_user_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_admin_notif_settings_user
  ON admin_notification_settings(admin_user_id);

ALTER TABLE admin_notification_settings ENABLE ROW LEVEL SECURITY;

-- Admins can only read/write their own settings (service-role key bypasses RLS)
CREATE POLICY "admin_notif_own_select" ON admin_notification_settings
  FOR SELECT USING (auth.uid() = admin_user_id);

CREATE POLICY "admin_notif_own_insert" ON admin_notification_settings
  FOR INSERT WITH CHECK (auth.uid() = admin_user_id);

CREATE POLICY "admin_notif_own_update" ON admin_notification_settings
  FOR UPDATE USING (auth.uid() = admin_user_id);

CREATE POLICY "admin_notif_own_delete" ON admin_notification_settings
  FOR DELETE USING (auth.uid() = admin_user_id);
