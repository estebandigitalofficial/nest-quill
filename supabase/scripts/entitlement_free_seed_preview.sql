-- ============================================================
-- ENTITLEMENT FOUNDATION — historical Free usage seed: PREVIEW (read-only)
--
-- Run AFTER migration 20240068 and BEFORE entitlement_free_seed_apply.sql.
-- Shows, per profile (no emails), what free_books_used would become.
--
-- Rule (Founder-approved):
--   free_books_used = LEAST(2,
--       non-failed Free rows already owned by the account (story_requests.user_id)
--     + LEAST(1, completed Free guest rows reconcilable by VERIFIED email))
-- Guest rows count only when the profile's auth email is confirmed, by
-- normalized exact equality (lower(btrim())), and never more than one.
-- Paid-looking labels (single, story_pack, story_pro, educator) grant nothing.
-- Failed Free rows are not counted.
-- ============================================================
WITH owned AS (
  SELECT p.id,
         COUNT(r.id) FILTER (WHERE r.plan_tier = 'free' AND r.status <> 'failed') AS owned_free
  FROM public.profiles p
  LEFT JOIN public.story_requests r ON r.user_id = p.id
  GROUP BY p.id
), guest AS (
  SELECT p.id,
         COUNT(r.id) FILTER (WHERE r.status = 'complete' AND r.plan_tier = 'free') AS guest_complete_free,
         COUNT(r.id) AS guest_rows_attachable
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id AND u.email_confirmed_at IS NOT NULL
  LEFT JOIN public.story_requests r
    ON r.user_id IS NULL AND r.guest_token IS NOT NULL
   AND lower(btrim(r.user_email)) = lower(btrim(p.email))
  GROUP BY p.id
)
SELECT p.id AS profile_id,
       p.is_admin,
       p.free_books_used AS current_value,
       o.owned_free,
       LEAST(1, COALESCE(g.guest_complete_free, 0)) AS guest_credit,
       COALESCE(g.guest_rows_attachable, 0) AS guest_rows_attachable,
       LEAST(2, o.owned_free + LEAST(1, COALESCE(g.guest_complete_free, 0))) AS proposed_free_books_used
FROM public.profiles p
JOIN owned o ON o.id = p.id
LEFT JOIN guest g ON g.id = p.id
ORDER BY proposed_free_books_used DESC, p.created_at;

-- Summary (the three counts the Founder reviews):
-- SELECT proposed_free_books_used, COUNT(*) FROM (<query above>) t GROUP BY 1 ORDER BY 1;
