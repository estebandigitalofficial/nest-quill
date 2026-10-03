-- ============================================================
-- ENTITLEMENT FOUNDATION — historical Free usage seed: APPLY
--
-- Run ONCE, explicitly, after migration 20240068 and after the Founder has
-- reviewed entitlement_free_seed_preview.sql. Idempotent: step 1 only raises
-- a profile's counter (never lowers one that was already raised), step 2
-- only attaches rows that are still unowned.
--
-- Step 1 — owned rows: non-failed Free requests already on the account.
-- Step 2 — verified-email reconciliation through the same function the
--          auth callback uses (cap 1 completed Free book per profile).
-- ============================================================
BEGIN;

-- Step 1
UPDATE public.profiles p
SET free_books_used = GREATEST(p.free_books_used, LEAST(2, o.owned_free))
FROM (
  SELECT p2.id, COUNT(r.id) FILTER (WHERE r.plan_tier = 'free' AND r.status <> 'failed') AS owned_free
  FROM public.profiles p2
  LEFT JOIN public.story_requests r ON r.user_id = p2.id
  GROUP BY p2.id
) o
WHERE o.id = p.id AND o.owned_free > 0;

-- Step 2 (confirmed emails only; function is a no-op for rows already owned)
SELECT p.id, public.claim_guest_stories_by_verified_email(p.id, p.email, 1, 2) AS attached
FROM public.profiles p
JOIN auth.users u ON u.id = p.id AND u.email_confirmed_at IS NOT NULL;

COMMIT;
