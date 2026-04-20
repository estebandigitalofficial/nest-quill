-- Rename existing plan_tier enum values to match new pricing model
ALTER TYPE plan_tier RENAME VALUE 'starter'    TO 'story_pack';
ALTER TYPE plan_tier RENAME VALUE 'pro'        TO 'story_pro';
ALTER TYPE plan_tier RENAME VALUE 'enterprise' TO 'educator';

-- Add the new single (one-time purchase) tier
ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'single';
