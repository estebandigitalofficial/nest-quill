-- ── 20240034_image_library_unique_scene ──────────────────────────────────────
-- Fix: image_library allowed duplicate rows per scene_id because there was no
-- UNIQUE constraint and ON CONFLICT DO NOTHING in the trigger was inert.
--
-- Steps:
--   1. Add updated_at column
--   2. Deduplicate existing rows before adding constraint
--   3. Add UNIQUE constraint on scene_id
--   4. Replace trigger with proper upsert

-- ── Step 1: Add updated_at ────────────────────────────────────────────────────

ALTER TABLE image_library
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill from created_at so existing rows have a valid updated_at
UPDATE image_library
SET updated_at = created_at
WHERE updated_at IS NULL;

-- ── Step 2: Deduplicate existing rows ────────────────────────────────────────
-- Keep the best row per scene_id:
--   - tagged rows win over untagged (preserve curated data)
--   - newest by created_at wins within same tag status
-- NULL scene_id rows are left untouched (they are orphans, not duplicates).

DELETE FROM image_library
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY scene_id
        ORDER BY
          CASE WHEN cardinality(tags) > 0 THEN 0 ELSE 1 END,  -- tagged first
          created_at DESC                                        -- newest first
      ) AS rn
    FROM image_library
    WHERE scene_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- ── Step 3: Add unique constraint ────────────────────────────────────────────
-- NULL values are treated as distinct by PostgreSQL, so multiple orphan rows
-- with scene_id = NULL are still allowed.

ALTER TABLE image_library
  DROP CONSTRAINT IF EXISTS unique_scene_image;

ALTER TABLE image_library
  ADD CONSTRAINT unique_scene_image UNIQUE (scene_id);

-- ── Step 4: Replace trigger with upsert ──────────────────────────────────────
-- On conflict (retry completing same scene), update mutable fields only.
-- Tags, illustration_style, theme, child_age_range are NOT overwritten —
-- those are curator-managed and must survive retries.

CREATE OR REPLACE FUNCTION fn_image_library_auto_populate()
RETURNS trigger AS $$
BEGIN
  IF NEW.image_status = 'complete' AND (OLD.image_status IS DISTINCT FROM 'complete') THEN
    INSERT INTO image_library (
      scene_id,
      request_id,
      storage_path,
      storage_bucket,
      image_url,
      prompt_used,
      revised_prompt
    )
    VALUES (
      NEW.id,
      NEW.request_id,
      NEW.storage_path,
      COALESCE(NEW.storage_bucket, 'story-images'),
      NEW.image_url,
      NEW.image_prompt,
      NEW.image_revised_prompt
    )
    ON CONFLICT (scene_id) DO UPDATE SET
      storage_path   = EXCLUDED.storage_path,
      image_url      = EXCLUDED.image_url,
      revised_prompt = EXCLUDED.revised_prompt,
      updated_at     = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition is unchanged — just the function body updated above.
-- Re-declare defensively in case it was ever dropped.
DROP TRIGGER IF EXISTS trg_image_library_auto_populate ON story_scenes;
CREATE TRIGGER trg_image_library_auto_populate
  AFTER UPDATE ON story_scenes
  FOR EACH ROW
  EXECUTE FUNCTION fn_image_library_auto_populate();
