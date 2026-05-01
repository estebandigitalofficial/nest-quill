-- Email journey templates: no-activity, learning, engagement, re-engagement, upgrade, free-limit
-- Adds comprehensive email drip templates and matching trigger rules

-- No-activity sequence for users who sign up but do nothing
INSERT INTO email_drip_templates (sequence, step, delay_days, subject, body_html, trigger_condition) VALUES
  ('no_activity', 1, 3,
   'Still thinking about it?',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;">Your story is waiting</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">Creating a personalized storybook takes about 5 minutes — and it''s free to try. Your child will love seeing themselves as the hero of their own adventure.</p>',
   'signup_no_story'),
  ('no_activity', 2, 7,
   'Here''s what families are saying',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;">Real families, real stories</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">Every day, parents and kids are reading stories made just for them. Your free story is still waiting to be written.</p>',
   'signup_no_story'),
  ('no_activity', 3, 14,
   'We miss you at Nest & Quill',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;">It''s not too late</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">Your free story is still waiting. Create a personalized adventure for your child — it only takes a few minutes.</p>',
   'signup_no_story')
ON CONFLICT (sequence, step) DO NOTHING;

-- Learning engagement sequence
INSERT INTO email_drip_templates (sequence, step, delay_days, subject, body_html, trigger_condition) VALUES
  ('learning', 1, 1,
   'Great start with learning tools!',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;">Learning just got fun</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">You''ve started exploring our learning tools — quizzes, flashcards, and more. Keep the momentum going!</p>',
   'learning_tool_used'),
  ('learning', 2, 5,
   'Keep the learning going',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;">New tools to explore</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">Have you tried our study guides and concept explainer? They''re perfect for building on what you''ve already learned.</p>',
   'learning_tool_used')
ON CONFLICT (sequence, step) DO NOTHING;

-- Post-first-story engagement
INSERT INTO email_drip_templates (sequence, step, delay_days, subject, body_html, trigger_condition) VALUES
  ('engagement', 1, 1,
   'You''re on a roll!',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;">Another adventure awaits</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">You''ve created multiple stories — your kids must love them! Here are some new themes to try.</p>',
   'second_story_created')
ON CONFLICT (sequence, step) DO NOTHING;

-- Re-engagement for inactive users who had a story
INSERT INTO email_drip_templates (sequence, step, delay_days, subject, body_html, trigger_condition) VALUES
  ('re_engagement', 1, 7,
   'New story themes just dropped',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;">Fresh adventures await</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">We''ve added new themes and illustration styles. Come back and create something new for your little reader.</p>',
   'post_story_inactive'),
  ('re_engagement', 2, 14,
   'A special story is waiting',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;">We saved something for you</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">It''s been a while since your last story. Your child would love a new adventure — and it only takes minutes to create.</p>',
   'post_story_inactive')
ON CONFLICT (sequence, step) DO NOTHING;

-- Plan upgrade welcome
INSERT INTO email_drip_templates (sequence, step, delay_days, subject, body_html, trigger_condition) VALUES
  ('upgrade', 1, 0,
   'Welcome to {plan_name}!',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;">Your new plan is active</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">Thank you for upgrading! You now have access to more stories, all illustration styles, and PDF downloads. Start creating!</p>',
   'plan_upgraded')
ON CONFLICT (sequence, step) DO NOTHING;

-- Free tier limit approaching / reached
INSERT INTO email_drip_templates (sequence, step, delay_days, subject, body_html, trigger_condition) VALUES
  ('free_limit', 1, 0,
   'You''ve used your free stories',
   '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#0C2340;">Ready for more?</p><p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">You''ve enjoyed your free stories. Upgrade to keep creating — plans start at just $7.99 and include PDF downloads, all styles, and longer stories.</p>',
   'free_limit_reached')
ON CONFLICT (sequence, step) DO NOTHING;

-- Trigger rules for all journey sequences
INSERT INTO email_drip_rules (name, trigger_type, delay_days, conditions, enabled) VALUES
  ('No activity — 3 day nudge', 'no_activity', 3, '{"min_days_inactive": 3}', true),
  ('No activity — 7 day nudge', 'no_activity', 7, '{"min_days_inactive": 7}', true),
  ('No activity — 14 day win-back', 'no_activity', 14, '{"min_days_inactive": 14}', true),
  ('Learning tool first use', 'first_learning', 1, '{}', true),
  ('Second story engagement', 'second_story', 1, '{}', true),
  ('Re-engagement — 7 day inactive', 'post_story_inactive', 7, '{"min_days_inactive": 7, "has_story": true}', true),
  ('Re-engagement — 14 day inactive', 'post_story_inactive', 14, '{"min_days_inactive": 14, "has_story": true}', true),
  ('Plan upgrade welcome', 'plan_upgraded', 0, '{}', true),
  ('Free limit reached', 'free_limit_reached', 0, '{}', true)
ON CONFLICT DO NOTHING;
