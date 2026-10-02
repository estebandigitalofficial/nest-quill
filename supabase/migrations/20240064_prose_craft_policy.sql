-- ============================================================
-- PROSE CRAFT POLICY (Stage 2 writing quality)
--
-- Seeds the two admin-editable writing policies the book stage reads
-- (code keeps identical fallbacks), and retires the three young-band
-- seeds that told the model to STATE the moral directly — which
-- contradicted the "show it through action → consequence → change"
-- policy introduced with the story plan. The UPDATEs only touch rows
-- whose value is still the original 20240058 seed, so an admin who has
-- already edited those rules keeps their wording.
--
-- The band_*_words_per_page / vocabulary / tone / ending rules for
-- middle and teen already agree with the new policy and are untouched.
-- ============================================================

INSERT INTO public.ai_writer_config (key, value, description) VALUES
  ('story_prose_craft_rules',
   E'Prose craft: write this book as a real author would, not as a template. SPECIFICITY — use concrete objects, actions, sounds, textures and reactions that belong to this story; replace vague "magical", "sparkling", "amazing" with the actual thing. SHOW CHARACTER — personality appears in what the hero notices, chooses, says and does, never in a list of adjectives; do not tell the reader a feeling the scene has already shown. CAUSAL MOMENTUM — each page grows out of the previous one and gives a reason to turn the page, without ending every page on a tease. ECONOMY — every sentence earns its place; never pad a simple moment to reach a word count, and never restate facts the reader already has. VARIETY — vary sentence length and openings, paragraph shape and how pages end; do not build every page as description, then dialogue, then reaction, then teaser; let pages do different jobs (establish, reveal, complicate, pause, joke, offer a choice, pay something off) as the plan assigns them. DIALOGUE — use it when it reveals character, creates interaction or moves the scene; speakers sound their age and differ from one another; characters never explain the plot to each other; many pages, especially for young children, need no dialogue at all. AVOID THE STOCK PHRASES of generic AI stories: "Once upon a time" (unless the style asks for it), "Little did X know", "With a heart full of", "With newfound confidence", "And so their adventure began", "It was a day X would never forget", "Together, they…", "From that day forward", "And X learned that…", "The real treasure was…"; do not keep characters taking deep breaths, grinning, gasping or widening their eyes; ration exclamation marks and rhetorical questions. LESSONS — if the plan carries a lesson, it arrives as action, then consequence, then changed behaviour; no narrator lecture and no closing moral summary. For the youngest readers one plain, concrete final sentence about what the hero now does is acceptable; for everyone else the ending shows and does not tell. This rule overrides any earlier instruction to state the moral directly.',
   'Stage 2 final-prose craft policy: specificity, showing character, momentum, economy, variety, dialogue, stock-phrase avoidance, demonstrated lessons. One coherent block; edit with care.'),
  ('story_image_separation_rules',
   E'Two different jobs on every page: "text" is the reader-facing prose and must never contain illustration or camera language (no "illustration", "close-up", "in the foreground", style names). "image_description" is a production instruction for the illustrator: one clear moment from that page — who is present, where, what they are doing, key objects, time of day, weather and mood — written as a visual brief, not as a retelling of the page text and not as story prose. Never put words, letters or signs in the image.',
   'Separates reader prose (text) from the illustrator brief (image_description) in the Stage 2 output.')
ON CONFLICT (key) DO NOTHING;

UPDATE public.ai_writer_config
SET value = 'Use very simple, concrete vocabulary that a child can read aloud or hear comfortably. One repeated phrase or action may anchor the story when it serves the plot.'
WHERE key = 'band_young_vocabulary_rules'
  AND value = 'Use very simple, concrete vocabulary that a child can read aloud or hear comfortably. Repeat key phrases and ideas across pages so the lesson sinks in.';

UPDATE public.ai_writer_config
SET value = 'Move slowly and reinforce. Show clear cause and effect so the lesson is felt in what happens, not explained.'
WHERE key = 'band_young_pacing_rules'
  AND value = 'Move slowly and reinforce. Show clear cause and effect. Make the moral or lesson direct and obvious.';

UPDATE public.ai_writer_config
SET value = 'End with a clear, comforting resolution that shows what the hero now does differently. At most one plain, concrete closing sentence may name it — never "and X learned that…".'
WHERE key = 'band_young_ending_rules'
  AND value = 'End with a clear, comforting resolution. The moral should be stated simply and directly.';

UPDATE public.ai_writer_config
SET value = 'Carry one simple, clear lesson. Show it through what the hero does and what happens next; a single concrete closing line may name it for the youngest listeners, but never lecture.'
WHERE key = 'band_young_moral_rules'
  AND value = 'Present one simple, clear moral or lesson. State it directly — young children benefit from explicit takeaways.';

NOTIFY pgrst, 'reload schema';
