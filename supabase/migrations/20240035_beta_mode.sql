INSERT INTO app_settings (key, value, category, label, description) VALUES
  ('beta_mode_enabled',
   'false',
   'system', 'Beta Mode', 'When enabled: bypasses guest/free story limits, skips DALL-E image generation (uses placeholders), and skips PDF generation. Story text is still real. Use for cost-safe testing.')
ON CONFLICT (key) DO NOTHING;
