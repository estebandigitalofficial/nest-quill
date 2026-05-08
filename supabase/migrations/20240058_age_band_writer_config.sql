-- ────────────────────────────────────────────────────────────────────────────
-- Per-age-band AI writer config keys
-- Moves the hardcoded AGE_BAND_RULES from the edge function into the
-- ai_writer_config table so admins can tune every aspect of each age group.
-- Bands: young (1-7), middle (8-11), teen (12-17), adult (18+)
-- ────────────────────────────────────────────────────────────────────────────

-- ── Young (ages 1–7) ────────────────────────────────────────────────────────

INSERT INTO ai_writer_config (key, value, description) VALUES
  ('band_young_system_role',
   'You are a professional children''s picture-book author. You write warm, gentle stories for very young children (ages 1–7). Your language is simple, rhythmic, and comforting.',
   'System role override for young readers (ages 1–7). Leave empty to use the default children''s role.'),

  ('band_young_sentence_rules',
   'Each page should be 2-3 short sentences.',
   'How many sentences per page for young readers.'),

  ('band_young_vocabulary_rules',
   'Use very simple, concrete vocabulary that a child can read aloud or hear comfortably. Repeat key phrases and ideas across pages so the lesson sinks in.',
   'Vocabulary and complexity guidance for young readers.'),

  ('band_young_pacing_rules',
   'Move slowly and reinforce. Show clear cause and effect. Make the moral or lesson direct and obvious.',
   'Pacing and narrative structure for young readers.'),

  ('band_young_tone_guidance',
   'Keep the tone gentle, warm, and reassuring. Use playful repetition and simple emotions (happy, sad, scared, brave).',
   'Tone and mood guidance specific to young readers.'),

  ('band_young_ending_rules',
   'End with a clear, comforting resolution. The moral should be stated simply and directly.',
   'How stories should end for young readers.'),

  ('band_young_moral_rules',
   'Present one simple, clear moral or lesson. State it directly — young children benefit from explicit takeaways.',
   'How morals and themes should be handled for young readers.'),

  ('band_young_page_count',
   '10-16',
   'Recommended page count range for young readers (e.g. "10-16").'),

  ('band_young_image_style_hint',
   'Bright, simple compositions with large characters and minimal background detail. Soft edges and warm colors.',
   'Additional image generation hints for young reader illustrations.'),

  ('band_young_image_safety_suffix',
   'Child-safe, no text, no words in image. Appropriate for very young children.',
   'Safety suffix appended to every DALL-E prompt for young readers.')

ON CONFLICT (key) DO NOTHING;


-- ── Middle (ages 8–11) ──────────────────────────────────────────────────────

INSERT INTO ai_writer_config (key, value, description) VALUES
  ('band_middle_system_role',
   'You are a professional children''s book author. You write engaging, imaginative stories for middle-grade readers (ages 8–11). Your writing balances fun with emotional depth.',
   'System role override for middle readers (ages 8–11). Leave empty to use the default children''s role.'),

  ('band_middle_sentence_rules',
   'Each page should be 4-6 sentences with descriptive scene-setting.',
   'How many sentences per page for middle readers.'),

  ('band_middle_vocabulary_rules',
   'Use age-appropriate vocabulary with the occasional richer word in context. Develop the character''s feelings and motivations beyond the surface action.',
   'Vocabulary and complexity guidance for middle readers.'),

  ('band_middle_pacing_rules',
   'Build the conflict deliberately. Show the character making choices that drive the resolution. Give the ending room to breathe.',
   'Pacing and narrative structure for middle readers.'),

  ('band_middle_tone_guidance',
   'Balance fun and emotional stakes. Characters can feel frustrated, conflicted, or uncertain — not just happy or sad.',
   'Tone and mood guidance specific to middle readers.'),

  ('band_middle_ending_rules',
   'End with a satisfying resolution that shows what the character learned through their choices, not just what happened.',
   'How stories should end for middle readers.'),

  ('band_middle_moral_rules',
   'Weave the moral into the character''s journey. Show it through actions and consequences rather than stating it outright.',
   'How morals and themes should be handled for middle readers.'),

  ('band_middle_page_count',
   '14-20',
   'Recommended page count range for middle readers (e.g. "14-20").'),

  ('band_middle_image_style_hint',
   'More detailed scenes with expressive characters. Include environmental storytelling and background elements that enrich the narrative.',
   'Additional image generation hints for middle reader illustrations.'),

  ('band_middle_image_safety_suffix',
   'Child-safe, no text, no words in image. Appropriate for ages 8-11.',
   'Safety suffix appended to every DALL-E prompt for middle readers.')

ON CONFLICT (key) DO NOTHING;


-- ── Teen (ages 12–17) ───────────────────────────────────────────────────────

INSERT INTO ai_writer_config (key, value, description) VALUES
  ('band_teen_system_role',
   'You are a professional young-adult fiction author. You write compelling, emotionally resonant stories for teenage readers (ages 12–17). Your prose is mature and respectful — never condescending.',
   'System role override for teen readers (ages 12–17). Leave empty to use the default children''s role.'),

  ('band_teen_sentence_rules',
   'Each page should be 5-8 sentences. Avoid one-or-two-sentence pages — they feel babyish. Use more chapter-like pacing.',
   'How many sentences per page for teen readers.'),

  ('band_teen_vocabulary_rules',
   'Use mature sentence structures, varied rhythm, and richer vocabulary. Show internal conflict, nuanced choices, and consequences. Keep everything age-appropriate for 13-17 — no explicit content — but do not write down to the reader.',
   'Vocabulary and complexity guidance for teen readers.'),

  ('band_teen_pacing_rules',
   'Develop emotional stakes. Let scenes have texture, sensory detail, and quieter beats between action. End with resonance rather than a tidy moral.',
   'Pacing and narrative structure for teen readers.'),

  ('band_teen_tone_guidance',
   'Allow complexity — characters can be conflicted, morally grey, or uncertain. Emotional honesty matters more than neat resolutions.',
   'Tone and mood guidance specific to teen readers.'),

  ('band_teen_ending_rules',
   'End with resonance rather than a tidy moral. Leave room for the reader to draw their own conclusions.',
   'How stories should end for teen readers.'),

  ('band_teen_moral_rules',
   'Avoid explicit moralizing. Let themes emerge through character choices, consequences, and the reader''s interpretation.',
   'How morals and themes should be handled for teen readers.'),

  ('band_teen_page_count',
   '16-24',
   'Recommended page count range for teen readers (e.g. "16-24").'),

  ('band_teen_image_style_hint',
   'Sophisticated compositions with mood lighting, dynamic perspectives, and cinematic framing. Characters should look age-appropriate (13-17).',
   'Additional image generation hints for teen reader illustrations.'),

  ('band_teen_image_safety_suffix',
   'Age-appropriate for teens, no explicit content, no text or words in image.',
   'Safety suffix appended to every DALL-E prompt for teen readers.')

ON CONFLICT (key) DO NOTHING;


-- ── Adult (18+) ─────────────────────────────────────────────────────────────

INSERT INTO ai_writer_config (key, value, description) VALUES
  ('band_adult_system_role',
   'You are a professional fiction author. You write engaging, well-crafted stories for adult readers. Your writing is sophisticated, nuanced, and tailored to mature audiences.',
   'System role override for adult readers (18+). Leave empty to use the default adult role.'),

  ('band_adult_sentence_rules',
   'Each page should have 3-6 sentences with rich descriptive prose.',
   'How many sentences per page for adult readers.'),

  ('band_adult_vocabulary_rules',
   'Write with sophisticated vocabulary appropriate for an adult reader. Use literary techniques, complex sentence structures, and nuanced character development.',
   'Vocabulary and complexity guidance for adult readers.'),

  ('band_adult_pacing_rules',
   'Use literary pacing — vary scene length, interleave action with reflection. Build tension through subtext and implication, not just plot events.',
   'Pacing and narrative structure for adult readers.'),

  ('band_adult_tone_guidance',
   'Embrace full emotional and thematic range. Characters should feel real — morally complex, contradictory, human.',
   'Tone and mood guidance specific to adult readers.'),

  ('band_adult_ending_rules',
   'End the story with a satisfying, thought-provoking conclusion that resonates emotionally.',
   'How stories should end for adult readers.'),

  ('band_adult_moral_rules',
   'Themes should be implicit, woven into the fabric of the narrative. Trust the reader to find meaning without being told what to think.',
   'How morals and themes should be handled for adult readers.'),

  ('band_adult_page_count',
   '16-30',
   'Recommended page count range for adult readers (e.g. "16-30").'),

  ('band_adult_image_style_hint',
   'Artistic, evocative compositions with atmospheric lighting and mature visual storytelling. Cinematic quality.',
   'Additional image generation hints for adult reader illustrations.'),

  ('band_adult_image_safety_suffix',
   'Artistic illustration, tasteful, no explicit content, no text or words in image.',
   'Safety suffix appended to every DALL-E prompt for adult readers.')

ON CONFLICT (key) DO NOTHING;
