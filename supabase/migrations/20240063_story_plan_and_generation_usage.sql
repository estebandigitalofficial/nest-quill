-- ============================================================
-- TWO-STAGE STORY GENERATION — checkpoint + telemetry
--
-- story_requests.story_plan      internal Stage 1 plan (JSONB). Written
--                                 by the worker once the plan validates so
--                                 a worker that dies before Stage 2 (or a
--                                 self-dispatched continuation) reuses it
--                                 instead of paying for it again. Never
--                                 returned by the public story API.
-- story_requests.generation_usage per-stage token/latency telemetry
--                                 (JSONB) — { plan: {...}, book: {...} }.
-- generated_stories.prompt_tokens / completion_tokens (already exist since
--                                 20240001) now receive the summed totals.
--
-- Worker code tolerates these columns being absent (it logs and continues),
-- so applying this migration is required for checkpointing and telemetry
-- columns but not for generation itself.
--
-- Also seeds the two admin-editable prompt-policy keys the two-stage
-- engine reads (code keeps identical fallbacks).
-- ============================================================

ALTER TABLE public.story_requests
  ADD COLUMN IF NOT EXISTS story_plan        JSONB,
  ADD COLUMN IF NOT EXISTS generation_usage  JSONB;

COMMENT ON COLUMN public.story_requests.story_plan IS
  'Internal Stage 1 story plan (outline + page beats). Generation metadata; not customer-facing.';
COMMENT ON COLUMN public.story_requests.generation_usage IS
  'Per-stage OpenAI usage: { plan: {prompt_tokens, completion_tokens, total_tokens, ms, attempts, model}, book: {...} }.';

INSERT INTO public.ai_writer_config (key, value, description) VALUES
  ('story_plan_rules',
   E'Plan the story before any prose is written. Every event must happen BECAUSE of an earlier event or a choice the protagonist makes; never a string of unrelated obstacles. The conflict must escalate or deepen, the climax must resolve the central problem using something set up earlier (not a new rescue, gadget or stranger), and the ending must show the changed state of the protagonist or their world. Give the protagonist real choices that change what happens next. If a lesson exists, plan how it is demonstrated through a choice or consequence, never announced. The title must come from a distinctive object, problem, place, action or idea in THIS story — never a generic phrase like "The Magical Adventure" or "A Journey of Friendship".',
   'Stage 1 planning rules: causality, escalation, climax, ending, title. Appended to the planning system prompt.'),
  ('story_book_from_plan_rules',
   E'Write the book from the STORY PLAN in the user message. Page N of your prose must realise page beat N: keep the sequence of events, the central conflict, the protagonist''s goal, every named character fact, the resolution and the planned lesson exactly as planned. Do not add, remove or reorder plot events. You may improve wording, dialogue, imagery and the transitions between pages. Each page''s image_description must depict that page''s beat with the same characters, place and objects the plan names.',
   'Stage 2 fidelity rule: how the final book must follow the validated plan. Appended to the book system prompt.')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
