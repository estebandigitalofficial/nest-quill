-- ============================================================================
-- Migration 42: curriculum_books, curriculum_teaching_guides, remaining units,
-- content_library entries, and recommended books for all courses.
-- ============================================================================

-- ============================================================================
-- 1. Create curriculum_books table
-- ============================================================================

CREATE TABLE IF NOT EXISTS curriculum_books (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     uuid NOT NULL REFERENCES curriculum_courses(id) ON DELETE CASCADE,
  title         text NOT NULL,
  author        text NOT NULL,
  isbn          text,
  publisher     text,
  edition       text,
  purchase_url  text,
  cover_url     text,
  book_type     text NOT NULL DEFAULT 'textbook' CHECK (book_type IN ('textbook','workbook','teacher_guide','supplemental','read_aloud','reference')),
  is_required   boolean NOT NULL DEFAULT false,
  description   text,
  sort_order    smallint NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_curriculum_books_course ON curriculum_books (course_id, sort_order);

ALTER TABLE curriculum_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON curriculum_books FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. Create curriculum_teaching_guides table
-- ============================================================================

CREATE TABLE IF NOT EXISTS curriculum_teaching_guides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       uuid NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
  title         text NOT NULL,
  objectives    text[] NOT NULL DEFAULT '{}',
  materials     text[] NOT NULL DEFAULT '{}',
  instruction_plan jsonb NOT NULL DEFAULT '{}',
  assessment_ideas text[] NOT NULL DEFAULT '{}',
  differentiation jsonb NOT NULL DEFAULT '{}',
  standards     text[] NOT NULL DEFAULT '{}',
  duration_minutes smallint DEFAULT 45,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_curriculum_teaching_guides_unit ON curriculum_teaching_guides (unit_id);

ALTER TABLE curriculum_teaching_guides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON curriculum_teaching_guides FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. Seed ALL missing curriculum units
-- ============================================================================

-- Grade 2 Science
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('States of Matter', 'Solids, liquids, gases, heating and cooling.', 1, 5, 1),
  ('Animal Habitats', 'Where animals live, adaptations to habitat.', 6, 10, 2),
  ('Life Cycles', 'Life cycles of plants, butterflies, frogs, chickens.', 11, 15, 3),
  ('Simple Machines', 'Levers, pulleys, ramps, wheels and axles.', 16, 20, 4),
  ('Earth Materials', 'Rocks, soil, water, natural resources.', 21, 25, 5),
  ('Sound and Light', 'How sound travels, light sources, shadows.', 26, 30, 6),
  ('Review and Projects', 'Hands-on science projects and year-end review.', 31, 36, 7)
) AS u(title, description, ws, we, so) WHERE c.grade = 2 AND c.subject = 'Science'
ON CONFLICT DO NOTHING;

-- Grade 2 Social Studies
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('My Community', 'Types of communities, community helpers, roles.', 1, 5, 1),
  ('Maps and Globes', 'Reading simple maps, continents, oceans, cardinal directions.', 6, 10, 2),
  ('Historical Figures', 'George Washington, Abraham Lincoln, Martin Luther King Jr.', 11, 15, 3),
  ('Citizenship', 'Rules, laws, rights and responsibilities.', 16, 20, 4),
  ('Economics Basics', 'Needs vs wants, goods and services, producers and consumers.', 21, 25, 5),
  ('Cultural Celebrations', 'Holidays and traditions around the world.', 26, 30, 6),
  ('Review and Assessment', 'Year-end review of social studies concepts.', 31, 36, 7)
) AS u(title, description, ws, we, so) WHERE c.grade = 2 AND c.subject = 'Social Studies'
ON CONFLICT DO NOTHING;

-- Grade 3 English
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Reading Comprehension', 'Main idea, supporting details, summarizing fiction and nonfiction.', 1, 5, 1),
  ('Vocabulary and Context Clues', 'Using context to determine word meanings, prefixes, suffixes.', 6, 10, 2),
  ('Parts of Speech', 'Nouns, verbs, adjectives, adverbs, pronouns.', 11, 15, 3),
  ('Writing Paragraphs', 'Topic sentences, supporting details, transitions, conclusions.', 16, 20, 4),
  ('Research Skills', 'Finding information, taking notes, simple reports.', 21, 25, 5),
  ('Narrative Writing', 'Story writing with beginning, middle, end, dialogue.', 26, 30, 6),
  ('Poetry and Figurative Language', 'Similes, metaphors, rhyme, rhythm, writing poems.', 31, 33, 7),
  ('Review and Assessment', 'Year-end reading and writing review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 3 AND c.subject = 'English'
ON CONFLICT DO NOTHING;

-- Grade 3 Science
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Forces and Motion', 'Push, pull, speed, direction, friction.', 1, 5, 1),
  ('Ecosystems', 'Food chains, food webs, producers, consumers, decomposers.', 6, 10, 2),
  ('Weather Patterns', 'Cloud types, precipitation, severe weather, forecasting.', 11, 15, 3),
  ('Water Cycle', 'Evaporation, condensation, precipitation, collection.', 16, 19, 4),
  ('Rocks and Minerals', 'Types of rocks, properties, fossils.', 20, 24, 5),
  ('Plant and Animal Adaptations', 'How organisms survive in their environments.', 25, 28, 6),
  ('Engineering Design', 'Simple engineering challenges, testing solutions.', 29, 32, 7),
  ('Review and Projects', 'Science fair projects and year-end review.', 33, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 3 AND c.subject = 'Science'
ON CONFLICT DO NOTHING;

-- Grade 3 Social Studies
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Communities Past and Present', 'How communities change over time.', 1, 5, 1),
  ('Government Basics', 'Local, state, federal government, elected officials.', 6, 10, 2),
  ('Economics', 'Supply and demand, trade, saving and spending.', 11, 15, 3),
  ('Geography and Map Skills', 'Map keys, scale, physical and political maps.', 16, 20, 4),
  ('Native Americans', 'Regional Native American groups, cultures, traditions.', 21, 25, 5),
  ('Explorers', 'Early explorers of North America.', 26, 29, 6),
  ('Citizenship and Civic Values', 'Voting, volunteering, community service.', 30, 33, 7),
  ('Review and Assessment', 'Year-end social studies review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 3 AND c.subject = 'Social Studies'
ON CONFLICT DO NOTHING;

-- Grade 4 Science
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Earth Science', 'Layers of the earth, plate tectonics, earthquakes, volcanoes.', 1, 5, 1),
  ('Energy', 'Forms of energy, energy transfer, conservation.', 6, 10, 2),
  ('Electricity', 'Circuits, conductors, insulators, static electricity.', 11, 15, 3),
  ('Plant Adaptations', 'Photosynthesis, plant structures, seed dispersal.', 16, 20, 4),
  ('Animal Adaptations', 'Behavioral and physical adaptations, migration, hibernation.', 21, 25, 5),
  ('Weather and Climate', 'Climate zones, weather instruments, data collection.', 26, 30, 6),
  ('Engineering Design Process', 'Define problems, design solutions, test and improve.', 31, 33, 7),
  ('Review and Assessment', 'Year-end science review and assessment.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 4 AND c.subject = 'Science'
ON CONFLICT DO NOTHING;

-- Grade 4 Social Studies
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('State History', 'Your state history, symbols, geography, and government.', 1, 5, 1),
  ('Regions of the United States', 'Northeast, Southeast, Midwest, Southwest, West.', 6, 10, 2),
  ('Native Americans', 'Major Native American groups, culture, and impact.', 11, 15, 3),
  ('Age of Exploration', 'European explorers, motivations, and consequences.', 16, 20, 4),
  ('Colonial America', 'Thirteen colonies, daily life, government.', 21, 25, 5),
  ('American Revolution', 'Causes, key events, Declaration of Independence.', 26, 30, 6),
  ('Map Skills and Geography', 'Latitude, longitude, physical features, climate.', 31, 33, 7),
  ('Review and Assessment', 'Year-end social studies review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 4 AND c.subject = 'Social Studies'
ON CONFLICT DO NOTHING;

-- Grade 4 History
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Early Americans', 'First peoples of North America, migration, settlements.', 1, 5, 1),
  ('European Exploration', 'Columbus, Spanish conquistadors, French explorers.', 6, 10, 2),
  ('Colonial Life', 'New England, Middle, and Southern colonies.', 11, 15, 3),
  ('Road to Revolution', 'Taxes, protests, Boston Tea Party, First Continental Congress.', 16, 20, 4),
  ('American Revolution', 'Key battles, leaders, Treaty of Paris.', 21, 25, 5),
  ('Creating a Nation', 'Constitutional Convention, Bill of Rights.', 26, 30, 6),
  ('Early Republic', 'First presidents, westward expansion begins.', 31, 33, 7),
  ('Review and Assessment', 'Year-end history review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 4 AND c.subject = 'History'
ON CONFLICT DO NOTHING;

-- Grade 5 English
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Literary Elements', 'Theme, point of view, character development, setting.', 1, 5, 1),
  ('Narrative Writing', 'Personal narratives, fiction writing, dialogue, pacing.', 6, 10, 2),
  ('Opinion Writing', 'Argumentative essays, supporting claims with evidence.', 11, 15, 3),
  ('Informational Writing', 'Research papers, citing sources, organizing information.', 16, 20, 4),
  ('Advanced Grammar', 'Complex sentences, verb tenses, subject-verb agreement.', 21, 25, 5),
  ('Vocabulary Development', 'Greek and Latin roots, context clues, word relationships.', 26, 29, 6),
  ('Poetry and Drama', 'Analyzing poetry, reading plays, figurative language.', 30, 33, 7),
  ('Review and Assessment', 'Year-end reading and writing assessment.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 5 AND c.subject = 'English'
ON CONFLICT DO NOTHING;

-- Grade 5 Science
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Matter and Its Interactions', 'Properties of matter, mixtures, solutions, chemical changes.', 1, 5, 1),
  ('Earth Systems', 'Water cycle, weathering, erosion, deposition.', 6, 10, 2),
  ('Space and Solar System', 'Planets, stars, moon phases, gravity, orbits.', 11, 15, 3),
  ('Ecosystems', 'Energy flow, food webs, human impact on ecosystems.', 16, 20, 4),
  ('Forces and Motion', 'Gravity, friction, balanced and unbalanced forces.', 21, 25, 5),
  ('Engineering and Technology', 'Design process, prototyping, testing.', 26, 30, 6),
  ('Life Science Review', 'Plant and animal cells, heredity basics.', 31, 33, 7),
  ('Review and Assessment', 'Year-end science review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 5 AND c.subject = 'Science'
ON CONFLICT DO NOTHING;

-- Grade 5 Social Studies
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Colonization to Revolution', 'Colonial America, causes of the Revolution.', 1, 5, 1),
  ('American Revolution', 'Key battles, important figures, independence.', 6, 10, 2),
  ('Constitution and Government', 'Three branches, checks and balances, amendments.', 11, 15, 3),
  ('Westward Expansion', 'Louisiana Purchase, Lewis and Clark, Manifest Destiny.', 16, 20, 4),
  ('Civil War', 'Causes, key events, Reconstruction.', 21, 25, 5),
  ('Immigration and Industrialization', 'Industrial revolution, immigration waves.', 26, 30, 6),
  ('Geography', 'US physical geography, regions, resources.', 31, 33, 7),
  ('Review and Assessment', 'Year-end social studies review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 5 AND c.subject = 'Social Studies'
ON CONFLICT DO NOTHING;

-- Grade 5 History
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('American Revolution', 'Causes, battles, Declaration of Independence, Treaty of Paris.', 1, 5, 1),
  ('Constitution', 'Constitutional Convention, ratification, Bill of Rights.', 6, 10, 2),
  ('Early Republic', 'Washington through Monroe, War of 1812.', 11, 15, 3),
  ('Westward Expansion', 'Oregon Trail, Gold Rush, Native American removal.', 16, 20, 4),
  ('Slavery and Abolition', 'Slavery in America, abolitionist movement, Underground Railroad.', 21, 25, 5),
  ('Civil War', 'Key causes, major battles, Emancipation Proclamation.', 26, 30, 6),
  ('Reconstruction', 'Rebuilding the nation, amendments, challenges.', 31, 33, 7),
  ('Review and Assessment', 'Year-end history review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 5 AND c.subject = 'History'
ON CONFLICT DO NOTHING;

-- Grade 6 English
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Literary Analysis', 'Analyzing fiction themes, author purpose, narrative structure.', 1, 5, 1),
  ('Argumentative Writing', 'Claims, evidence, counterarguments, persuasive techniques.', 6, 10, 2),
  ('Textual Evidence', 'Citing evidence, making inferences, drawing conclusions.', 11, 15, 3),
  ('Research Skills', 'Evaluating sources, note-taking, bibliography.', 16, 20, 4),
  ('Grammar and Style', 'Sentence variety, voice, tone, punctuation.', 21, 25, 5),
  ('Nonfiction Reading', 'Text structures, author perspective, bias.', 26, 30, 6),
  ('Creative Writing', 'Short stories, poetry, personal essays.', 31, 33, 7),
  ('Review and Assessment', 'Year-end ELA review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 6 AND c.subject = 'English'
ON CONFLICT DO NOTHING;

-- Grade 6 Science
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Cells and Organisms', 'Cell structure, cell functions, single-celled vs multicellular.', 1, 5, 1),
  ('Earth History', 'Geologic time, fossils, rock layers, plate tectonics.', 6, 10, 2),
  ('Weather and Climate', 'Atmosphere, climate zones, weather systems, climate change intro.', 11, 15, 3),
  ('Energy Transfer', 'Heat, light, sound energy, waves.', 16, 20, 4),
  ('Ecosystems and Biodiversity', 'Biomes, biodiversity, human impact.', 21, 25, 5),
  ('Engineering Design', 'Engineering challenges, constraints, optimization.', 26, 30, 6),
  ('Space Science', 'Solar system review, moon phases, seasons, eclipses.', 31, 33, 7),
  ('Review and Assessment', 'Year-end science review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 6 AND c.subject = 'Science'
ON CONFLICT DO NOTHING;

-- Grade 6 Social Studies
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Ancient Civilizations Overview', 'Mesopotamia, early river valley civilizations.', 1, 5, 1),
  ('Ancient Egypt', 'Pharaohs, pyramids, hieroglyphics, daily life.', 6, 10, 2),
  ('Ancient Greece', 'Democracy, philosophy, Olympics, mythology.', 11, 15, 3),
  ('Ancient Rome', 'Republic to Empire, law, engineering, fall of Rome.', 16, 20, 4),
  ('World Geography', 'Continents, regions, cultural geography.', 21, 25, 5),
  ('Cultural Studies', 'World religions, cultural diffusion, trade routes.', 26, 30, 6),
  ('Current Events', 'Connecting ancient civilizations to modern world.', 31, 33, 7),
  ('Review and Assessment', 'Year-end review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 6 AND c.subject = 'Social Studies'
ON CONFLICT DO NOTHING;

-- Grade 6 History
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Ancient Mesopotamia', 'Sumer, Babylon, Assyria, writing, law.', 1, 5, 1),
  ('Ancient Egypt', 'Old Kingdom through New Kingdom, religion, achievements.', 6, 10, 2),
  ('Ancient India and China', 'Indus Valley, Hindu and Buddhist traditions, Dynasties.', 11, 15, 3),
  ('Ancient Greece', 'City-states, Persian Wars, Golden Age of Athens.', 16, 20, 4),
  ('Ancient Rome', 'From Republic to Empire, Christianity, fall.', 21, 25, 5),
  ('Early Americas', 'Maya, Aztec, Inca civilizations.', 26, 29, 6),
  ('Trade and Cultural Exchange', 'Silk Road, spread of ideas and technology.', 30, 33, 7),
  ('Review and Assessment', 'Year-end history review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 6 AND c.subject = 'History'
ON CONFLICT DO NOTHING;

-- Grade 7 English
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Complex Texts', 'Analyzing complex fiction and nonfiction, multiple perspectives.', 1, 5, 1),
  ('Persuasive Writing', 'Argumentative essays, debate, rhetorical strategies.', 6, 10, 2),
  ('Literary Criticism', 'Analyzing author craft, literary movements, criticism.', 11, 15, 3),
  ('Media Literacy', 'Evaluating media, digital literacy, bias in media.', 16, 20, 4),
  ('Research Writing', 'Extended research papers, MLA format, citations.', 21, 25, 5),
  ('Vocabulary and Etymology', 'Word origins, academic vocabulary, connotation vs denotation.', 26, 29, 6),
  ('Creative Expression', 'Memoir, spoken word, dramatic writing.', 30, 33, 7),
  ('Review and Assessment', 'Year-end ELA review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 7 AND c.subject = 'English'
ON CONFLICT DO NOTHING;

-- Grade 7 Science
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Life Science', 'Classification of organisms, taxonomy, biodiversity.', 1, 5, 1),
  ('Human Body Systems', 'Skeletal, muscular, circulatory, respiratory, digestive.', 6, 10, 2),
  ('Genetics', 'DNA, heredity, Punnett squares, traits.', 11, 15, 3),
  ('Ecosystems and Ecology', 'Population dynamics, symbiosis, succession.', 16, 20, 4),
  ('Cells and Cell Processes', 'Mitosis, photosynthesis, cellular respiration.', 21, 25, 5),
  ('Evolution and Natural Selection', 'Adaptation, speciation, fossil evidence.', 26, 30, 6),
  ('Engineering and Biotechnology', 'Biotech applications, genetic engineering basics.', 31, 33, 7),
  ('Review and Assessment', 'Year-end life science review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 7 AND c.subject = 'Science'
ON CONFLICT DO NOTHING;

-- Grade 7 Social Studies
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Medieval World', 'Feudalism, medieval society, castles, daily life.', 1, 5, 1),
  ('Islam and the Arab World', 'Rise of Islam, Islamic Golden Age, contributions.', 6, 10, 2),
  ('Asian Civilizations', 'China dynasties, Japan feudalism, Mongol Empire.', 11, 15, 3),
  ('African Kingdoms', 'Ghana, Mali, Songhai, Great Zimbabwe, trade.', 16, 20, 4),
  ('Renaissance', 'Art, science, humanism, key figures.', 21, 25, 5),
  ('Reformation', 'Protestant Reformation, Counter-Reformation, religious wars.', 26, 29, 6),
  ('Age of Exploration', 'European exploration, colonization, Columbian Exchange.', 30, 33, 7),
  ('Review and Assessment', 'Year-end review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 7 AND c.subject = 'Social Studies'
ON CONFLICT DO NOTHING;

-- Grade 7 History
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Fall of Rome and Byzantine Empire', 'Decline of Rome, rise of Byzantium, Justinian.', 1, 5, 1),
  ('Medieval Europe', 'Feudalism, Crusades, Black Plague, Magna Carta.', 6, 10, 2),
  ('Islamic Civilizations', 'Muhammad, expansion, Golden Age, trade.', 11, 15, 3),
  ('East Asian Civilizations', 'Tang and Song China, Samurai Japan.', 16, 20, 4),
  ('Renaissance and Reformation', 'Cultural rebirth, printing press, Martin Luther.', 21, 25, 5),
  ('Age of Exploration', 'Motives, routes, consequences, Columbian Exchange.', 26, 30, 6),
  ('Early Modern Period', 'Scientific Revolution, Enlightenment beginnings.', 31, 33, 7),
  ('Review and Assessment', 'Year-end history review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 7 AND c.subject = 'History'
ON CONFLICT DO NOTHING;

-- Grade 8 English
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Advanced Literary Analysis', 'Symbolism, irony, unreliable narrator, allegory.', 1, 5, 1),
  ('Research Papers', 'Extended research, thesis development, source evaluation.', 6, 10, 2),
  ('Rhetoric and Persuasion', 'Ethos, pathos, logos, analyzing speeches.', 11, 15, 3),
  ('Communication Skills', 'Public speaking, debate, presentation skills.', 16, 20, 4),
  ('Comparative Literature', 'Comparing texts across genres, time periods, cultures.', 21, 25, 5),
  ('Writing Workshop', 'Revision, peer review, portfolio development.', 26, 30, 6),
  ('High School Readiness', 'Academic writing, annotation, close reading.', 31, 33, 7),
  ('Review and Assessment', 'Year-end ELA review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 8 AND c.subject = 'English'
ON CONFLICT DO NOTHING;

-- Grade 8 Science
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Physical Science', 'Motion, speed, velocity, acceleration.', 1, 5, 1),
  ('Chemistry Basics', 'Elements, compounds, periodic table, chemical reactions.', 6, 10, 2),
  ('Waves', 'Sound waves, light waves, electromagnetic spectrum.', 11, 15, 3),
  ('Forces and Energy', 'Newton laws, kinetic and potential energy, work.', 16, 20, 4),
  ('Electricity and Magnetism', 'Electric circuits, electromagnets, motors.', 21, 25, 5),
  ('Earth and Space', 'Plate tectonics, natural disasters, space exploration.', 26, 30, 6),
  ('Engineering Design', 'Complex engineering challenges, optimization.', 31, 33, 7),
  ('Review and Assessment', 'Year-end physical science review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 8 AND c.subject = 'Science'
ON CONFLICT DO NOTHING;

-- Grade 8 Social Studies
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Civil War', 'Causes, major battles, key figures, turning points.', 1, 5, 1),
  ('Reconstruction', 'Rebuilding the South, amendments, Jim Crow.', 6, 10, 2),
  ('Industrialization', 'Factories, labor, immigration, urbanization.', 11, 15, 3),
  ('Progressive Era', 'Reform movements, womens suffrage, trust-busting.', 16, 20, 4),
  ('World Wars', 'WWI and WWII causes, US involvement, impact.', 21, 25, 5),
  ('Cold War and Civil Rights', 'Cold War tensions, Civil Rights Movement.', 26, 30, 6),
  ('Modern America', 'Technology, globalization, current events.', 31, 33, 7),
  ('Review and Assessment', 'Year-end social studies review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 8 AND c.subject = 'Social Studies'
ON CONFLICT DO NOTHING;

-- Grade 8 History
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Civil War', 'Secession, key battles, Gettysburg, Appomattox.', 1, 5, 1),
  ('Reconstruction Era', 'Freedmens Bureau, 13th-15th Amendments, sharecropping.', 6, 10, 2),
  ('Gilded Age', 'Industrialization, robber barons, labor unions, immigration.', 11, 15, 3),
  ('Progressive Era', 'Muckrakers, reform, amendments, Theodore Roosevelt.', 16, 20, 4),
  ('World War I', 'Causes, US entry, Treaty of Versailles.', 21, 25, 5),
  ('Roaring Twenties and Great Depression', 'Cultural change, stock market crash, New Deal.', 26, 30, 6),
  ('World War II', 'Rise of fascism, Pearl Harbor, D-Day, atomic bomb.', 31, 33, 7),
  ('Cold War to Present', 'Cold War, Civil Rights, modern challenges.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 8 AND c.subject = 'History'
ON CONFLICT DO NOTHING;

-- Grade 9 Math (Algebra I)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Foundations of Algebra', 'Variables, expressions, order of operations, properties.', 1, 4, 1),
  ('Linear Equations', 'Solving one-step and multi-step equations.', 5, 9, 2),
  ('Inequalities', 'Solving and graphing inequalities, compound inequalities.', 10, 13, 3),
  ('Functions', 'Function notation, domain and range, evaluating functions.', 14, 18, 4),
  ('Linear Functions', 'Slope, intercepts, graphing lines, parallel and perpendicular.', 19, 23, 5),
  ('Systems of Equations', 'Graphing, substitution, elimination methods.', 24, 27, 6),
  ('Polynomials', 'Adding, subtracting, multiplying polynomials, factoring.', 28, 32, 7),
  ('Quadratics', 'Quadratic equations, factoring, quadratic formula, graphing parabolas.', 33, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 9 AND c.subject = 'Math'
ON CONFLICT DO NOTHING;

-- Grade 9 English
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Literary Analysis', 'Close reading, theme, symbolism, character analysis.', 1, 5, 1),
  ('Argumentative Essays', 'Thesis statements, evidence, counterarguments, conclusions.', 6, 10, 2),
  ('Rhetoric', 'Rhetorical devices, analyzing persuasive texts and speeches.', 11, 15, 3),
  ('Research Writing', 'Research methods, MLA citations, annotated bibliography.', 16, 20, 4),
  ('World Literature', 'Reading texts from diverse cultures and time periods.', 21, 25, 5),
  ('Vocabulary and Language', 'SAT-level vocabulary, etymology, academic language.', 26, 29, 6),
  ('Creative Writing', 'Short fiction, poetry, personal narrative.', 30, 33, 7),
  ('Review and Assessment', 'Year-end reading and writing assessment.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 9 AND c.subject = 'English'
ON CONFLICT DO NOTHING;

-- Grade 9 Science (Biology)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Introduction to Biology', 'Scientific method, characteristics of life, biochemistry.', 1, 4, 1),
  ('Cell Biology', 'Cell structure, organelles, membrane transport, cell division.', 5, 9, 2),
  ('Genetics', 'Mendelian genetics, DNA replication, protein synthesis, mutations.', 10, 15, 3),
  ('Evolution', 'Natural selection, speciation, evidence for evolution, Hardy-Weinberg.', 16, 20, 4),
  ('Ecology', 'Ecosystems, biomes, population dynamics, human impact.', 21, 25, 5),
  ('Human Body Systems', 'Major organ systems, homeostasis, disease.', 26, 30, 6),
  ('Biotechnology', 'Genetic engineering, cloning, bioethics.', 31, 33, 7),
  ('Review and Assessment', 'Year-end biology review and assessment.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 9 AND c.subject = 'Science'
ON CONFLICT DO NOTHING;

-- Grade 9 Social Studies (World Geography)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Physical Geography', 'Landforms, climate, water systems, natural resources.', 1, 5, 1),
  ('Human Geography', 'Population, migration, urbanization, cultural geography.', 6, 10, 2),
  ('North America and South America', 'Physical and human geography of the Americas.', 11, 15, 3),
  ('Europe and Russia', 'Geography, cultures, economies of Europe.', 16, 20, 4),
  ('Africa and Middle East', 'Diverse landscapes, cultures, challenges.', 21, 25, 5),
  ('Asia and Oceania', 'Diverse regions, economies, populations.', 26, 30, 6),
  ('Global Issues', 'Climate change, globalization, sustainable development.', 31, 33, 7),
  ('Review and Assessment', 'Year-end geography review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 9 AND c.subject = 'Social Studies'
ON CONFLICT DO NOTHING;

-- Grade 9 History (World History I)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Early Civilizations', 'Mesopotamia, Egypt, Indus Valley, early China.', 1, 5, 1),
  ('Classical Civilizations', 'Greece, Rome, Persia, Maurya and Gupta India.', 6, 10, 2),
  ('World Religions', 'Judaism, Christianity, Islam, Hinduism, Buddhism origins.', 11, 15, 3),
  ('Medieval Period', 'Feudalism, Crusades, Byzantine Empire, Islamic Golden Age.', 16, 20, 4),
  ('African and American Civilizations', 'Ghana, Mali, Maya, Aztec, Inca.', 21, 25, 5),
  ('Renaissance and Reformation', 'Cultural rebirth, religious reform, humanism.', 26, 30, 6),
  ('Age of Exploration', 'European exploration, colonization, Columbian Exchange.', 31, 33, 7),
  ('Review and Assessment', 'Year-end world history review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 9 AND c.subject = 'History'
ON CONFLICT DO NOTHING;

-- Grade 10 Math (Geometry)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Foundations of Geometry', 'Points, lines, planes, angles, postulates.', 1, 4, 1),
  ('Proofs and Reasoning', 'Inductive and deductive reasoning, two-column proofs.', 5, 9, 2),
  ('Congruence', 'Triangle congruence, CPCTC, congruence transformations.', 10, 14, 3),
  ('Similarity', 'Similar triangles, proportions, scale factor.', 15, 18, 4),
  ('Right Triangles and Trigonometry', 'Pythagorean theorem, special right triangles, sin/cos/tan.', 19, 23, 5),
  ('Circles', 'Arcs, chords, tangent lines, inscribed angles, arc length.', 24, 28, 6),
  ('Area and Volume', 'Area of polygons, surface area, volume of 3D shapes.', 29, 32, 7),
  ('Transformations and Coordinate Geometry', 'Translations, rotations, reflections, coordinate proofs.', 33, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 10 AND c.subject = 'Math'
ON CONFLICT DO NOTHING;

-- Grade 10 English
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('World Literature', 'Major works from diverse world traditions.', 1, 5, 1),
  ('Analytical Writing', 'Literary analysis essays, thesis-driven writing.', 6, 10, 2),
  ('Speech and Rhetoric', 'Public speaking, debate, rhetorical analysis.', 11, 15, 3),
  ('Media Literacy', 'Evaluating media sources, digital citizenship, propaganda.', 16, 20, 4),
  ('Research and Argument', 'Extended argument papers, source evaluation.', 21, 25, 5),
  ('Dramatic Literature', 'Reading and analyzing plays, Shakespeare.', 26, 30, 6),
  ('Vocabulary and Test Prep', 'Advanced vocabulary, standardized test reading skills.', 31, 33, 7),
  ('Review and Assessment', 'Year-end ELA assessment.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 10 AND c.subject = 'English'
ON CONFLICT DO NOTHING;

-- Grade 10 Science (Chemistry)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Atomic Structure', 'Atoms, subatomic particles, electron configuration, periodic trends.', 1, 5, 1),
  ('The Periodic Table', 'Groups, periods, metals, nonmetals, metalloids.', 6, 9, 2),
  ('Chemical Bonding', 'Ionic, covalent, metallic bonds, Lewis structures.', 10, 14, 3),
  ('Chemical Reactions', 'Types of reactions, balancing equations, predicting products.', 15, 19, 4),
  ('Stoichiometry', 'Mole concept, molar mass, stoichiometric calculations.', 20, 24, 5),
  ('Solutions and Acids/Bases', 'Solubility, concentration, pH, acid-base reactions.', 25, 29, 6),
  ('Gas Laws', 'Boyles, Charles, combined and ideal gas laws.', 30, 33, 7),
  ('Review and Assessment', 'Year-end chemistry review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 10 AND c.subject = 'Science'
ON CONFLICT DO NOTHING;

-- Grade 10 Social Studies (World History II)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Enlightenment', 'Key thinkers, natural rights, impact on government.', 1, 5, 1),
  ('Age of Revolutions', 'American, French, Latin American revolutions.', 6, 10, 2),
  ('Industrial Revolution', 'Industrialization, urbanization, labor movements.', 11, 15, 3),
  ('Imperialism', 'European imperialism in Africa, Asia, and Americas.', 16, 20, 4),
  ('World War I', 'Causes, trench warfare, Treaty of Versailles.', 21, 25, 5),
  ('World War II', 'Rise of totalitarianism, Holocaust, major battles.', 26, 30, 6),
  ('Cold War', 'Superpowers, proxy wars, space race, fall of USSR.', 31, 33, 7),
  ('Globalization', 'Modern world, technology, global challenges.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 10 AND c.subject = 'Social Studies'
ON CONFLICT DO NOTHING;

-- Grade 10 History (World History II)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Age of Revolutions', 'Enlightenment ideas, American and French Revolutions.', 1, 5, 1),
  ('Napoleonic Era', 'Napoleon, Congress of Vienna, balance of power.', 6, 9, 2),
  ('Nationalism and Unification', 'Italian and German unification, nation-states.', 10, 14, 3),
  ('Imperialism and Its Effects', 'Scramble for Africa, Opium Wars, Indian resistance.', 15, 19, 4),
  ('World War I', 'Alliance system, trench warfare, aftermath.', 20, 24, 5),
  ('Interwar Period and WWII', 'Great Depression, fascism, Holocaust, atomic age.', 25, 30, 6),
  ('Cold War', 'Iron Curtain, Korean War, Vietnam, Cuba, Berlin Wall.', 31, 33, 7),
  ('Modern World', 'Decolonization, globalization, terrorism, digital age.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 10 AND c.subject = 'History'
ON CONFLICT DO NOTHING;

-- Grade 11 Math (Algebra II)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Polynomials', 'Polynomial operations, factoring, remainder and factor theorems.', 1, 4, 1),
  ('Rational Expressions', 'Simplifying, multiplying, dividing rational expressions and equations.', 5, 9, 2),
  ('Radical Functions', 'Radical expressions, rational exponents, solving radical equations.', 10, 13, 3),
  ('Exponential and Logarithmic Functions', 'Exponential growth/decay, logarithms, solving equations.', 14, 19, 4),
  ('Sequences and Series', 'Arithmetic and geometric sequences, summation notation.', 20, 24, 5),
  ('Probability and Statistics', 'Counting principles, probability, normal distribution.', 25, 29, 6),
  ('Trigonometric Functions', 'Unit circle, graphing trig functions, identities intro.', 30, 33, 7),
  ('Review and Assessment', 'Year-end review and assessment.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 11 AND c.subject = 'Math'
ON CONFLICT DO NOTHING;

-- Grade 11 English (American Literature)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Colonial and Revolutionary Literature', 'Puritans, Franklin, Paine, founding documents.', 1, 5, 1),
  ('American Romanticism', 'Emerson, Thoreau, Hawthorne, Poe, Whitman, Dickinson.', 6, 10, 2),
  ('Realism and Naturalism', 'Twain, Crane, London, Chopin.', 11, 15, 3),
  ('Harlem Renaissance', 'Hughes, Hurston, Jazz Age literature.', 16, 20, 4),
  ('Modern American Literature', 'Fitzgerald, Hemingway, Steinbeck, Faulkner.', 21, 25, 5),
  ('Contemporary Voices', 'Morrison, Cisneros, Alexie, diverse perspectives.', 26, 30, 6),
  ('Critical Essays and Research', 'Literary criticism, extended research paper.', 31, 33, 7),
  ('Review and Assessment', 'Year-end American literature review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 11 AND c.subject = 'English'
ON CONFLICT DO NOTHING;

-- Grade 11 Science (Physics)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Motion and Kinematics', 'Displacement, velocity, acceleration, projectile motion.', 1, 5, 1),
  ('Forces and Newton Laws', 'Newton three laws, friction, free-body diagrams.', 6, 10, 2),
  ('Energy and Work', 'Kinetic energy, potential energy, conservation, power.', 11, 15, 3),
  ('Momentum and Collisions', 'Linear momentum, impulse, elastic and inelastic collisions.', 16, 20, 4),
  ('Waves and Sound', 'Wave properties, sound waves, Doppler effect, resonance.', 21, 25, 5),
  ('Light and Optics', 'Reflection, refraction, lenses, mirrors, electromagnetic spectrum.', 26, 30, 6),
  ('Electricity and Magnetism', 'Electric charge, circuits, Ohm law, magnetic fields.', 31, 33, 7),
  ('Review and Assessment', 'Year-end physics review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 11 AND c.subject = 'Science'
ON CONFLICT DO NOTHING;

-- Grade 11 Social Studies (US History)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Founding and Constitution', 'Constitutional principles, federalism, Bill of Rights.', 1, 5, 1),
  ('Expansion and Sectionalism', 'Manifest Destiny, slavery debate, compromises.', 6, 10, 2),
  ('Civil War and Reconstruction', 'Causes, battles, aftermath, amendments.', 11, 15, 3),
  ('Industrialization and Progressive Era', 'Growth, reform, labor, immigration.', 16, 20, 4),
  ('World Wars and Interwar', 'WWI, Roaring Twenties, Depression, WWII.', 21, 25, 5),
  ('Cold War and Civil Rights', 'Cold War policy, Civil Rights Movement, Vietnam.', 26, 30, 6),
  ('Modern America', 'Post-Cold War, 9/11, technology, current events.', 31, 33, 7),
  ('Review and Assessment', 'Year-end US history review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 11 AND c.subject = 'Social Studies'
ON CONFLICT DO NOTHING;

-- Grade 11 History (US History)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Constitutional Era', 'Ratification debates, early presidency, Jeffersonian era.', 1, 5, 1),
  ('Jacksonian Democracy and Expansion', 'Jackson, Trail of Tears, Manifest Destiny.', 6, 10, 2),
  ('Civil War', 'Secession, major battles, Emancipation, Reconstruction.', 11, 15, 3),
  ('Gilded Age and Progressivism', 'Industrialists, labor, muckrakers, womens suffrage.', 16, 20, 4),
  ('America as World Power', 'Spanish-American War, WWI, interwar period.', 21, 25, 5),
  ('WWII and Cold War', 'Pearl Harbor, atomic bomb, containment, Korea, Vietnam.', 26, 30, 6),
  ('Civil Rights and Social Change', 'MLK, Malcolm X, feminist movement, counterculture.', 31, 33, 7),
  ('Modern America', 'Watergate, Reagan era, 9/11, Obama, technology.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 11 AND c.subject = 'History'
ON CONFLICT DO NOTHING;

-- Grade 12 Math (Pre-Calculus)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Functions Review', 'Polynomial, rational, radical functions and their graphs.', 1, 4, 1),
  ('Exponential and Logarithmic Functions', 'Properties, equations, real-world applications.', 5, 9, 2),
  ('Trigonometric Functions', 'Unit circle, graphs, identities, inverse trig functions.', 10, 15, 3),
  ('Analytic Trigonometry', 'Trig equations, sum/difference formulas, double angle.', 16, 20, 4),
  ('Sequences, Series, and Induction', 'Arithmetic/geometric series, mathematical induction, binomial theorem.', 21, 25, 5),
  ('Limits and Introduction to Calculus', 'Limits, continuity, rates of change, derivatives preview.', 26, 30, 6),
  ('Vectors and Parametric Equations', 'Vector operations, parametric curves, polar coordinates.', 31, 33, 7),
  ('Review and Assessment', 'Year-end pre-calculus review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 12 AND c.subject = 'Math'
ON CONFLICT DO NOTHING;

-- Grade 12 English (British Literature)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Anglo-Saxon and Medieval', 'Beowulf, Canterbury Tales, medieval poetry.', 1, 5, 1),
  ('Renaissance Literature', 'Shakespeare sonnets and plays, Marlowe, Spenser.', 6, 10, 2),
  ('Restoration and 18th Century', 'Swift, Pope, Defoe, early novel.', 11, 15, 3),
  ('Romantic Period', 'Blake, Wordsworth, Coleridge, Shelley, Keats, Byron.', 16, 20, 4),
  ('Victorian Literature', 'Dickens, Bronte sisters, Tennyson, Browning.', 21, 25, 5),
  ('Modern British Literature', 'Joyce, Woolf, Orwell, Heaney, postcolonial voices.', 26, 30, 6),
  ('Senior Thesis and Communication', 'Extended literary analysis, presentation skills.', 31, 33, 7),
  ('Review and Assessment', 'Year-end British literature assessment.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 12 AND c.subject = 'English'
ON CONFLICT DO NOTHING;

-- Grade 12 Science (Environmental Science)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Ecosystems', 'Ecosystem structure, energy flow, nutrient cycles.', 1, 5, 1),
  ('Biodiversity', 'Species diversity, threats, conservation strategies.', 6, 10, 2),
  ('Water Resources', 'Freshwater systems, water pollution, water management.', 11, 15, 3),
  ('Air and Climate', 'Atmosphere, air pollution, greenhouse effect, climate change.', 16, 20, 4),
  ('Land and Soil', 'Soil formation, agriculture, deforestation, mining.', 21, 25, 5),
  ('Energy Resources', 'Fossil fuels, renewable energy, nuclear power.', 26, 30, 6),
  ('Sustainability', 'Sustainable development, waste management, green solutions.', 31, 33, 7),
  ('Review and Assessment', 'Year-end environmental science review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 12 AND c.subject = 'Science'
ON CONFLICT DO NOTHING;

-- Grade 12 Social Studies (Government & Economics)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Foundations of Government', 'Political philosophy, social contract, types of government.', 1, 5, 1),
  ('US Constitution', 'Structure, amendments, Supreme Court cases.', 6, 10, 2),
  ('Branches of Government', 'Congress, presidency, judiciary, checks and balances.', 11, 15, 3),
  ('Civil Liberties and Rights', 'Bill of Rights, civil rights, landmark cases.', 16, 20, 4),
  ('Economics Fundamentals', 'Supply and demand, market structures, GDP.', 21, 25, 5),
  ('Personal Finance', 'Budgeting, banking, credit, investing, taxes.', 26, 30, 6),
  ('Civic Participation', 'Voting, political parties, media, civic duty.', 31, 33, 7),
  ('Review and Assessment', 'Year-end government and economics review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 12 AND c.subject = 'Social Studies'
ON CONFLICT DO NOTHING;

-- Grade 12 History (Government & Economics)
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Democratic Principles', 'Enlightenment roots, Declaration of Independence, social contract.', 1, 5, 1),
  ('Constitutional Framework', 'Federalism, separation of powers, amendment process.', 6, 10, 2),
  ('Political Parties and Elections', 'Party system, electoral process, campaign finance.', 11, 15, 3),
  ('Economic Systems', 'Capitalism, socialism, mixed economies, global trade.', 16, 20, 4),
  ('Fiscal and Monetary Policy', 'Federal Reserve, taxation, government spending, debt.', 21, 25, 5),
  ('International Relations', 'Foreign policy, diplomacy, international organizations.', 26, 29, 6),
  ('Civic Responsibility', 'Volunteering, advocacy, informed citizenship.', 30, 33, 7),
  ('Review and Assessment', 'Year-end review.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 12 AND c.subject = 'History'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. Seed content_library entries for all new units
-- ============================================================================

-- Insert quiz topics for all curriculum units (one quiz per unit)
INSERT INTO content_library (tool_type, grade, subject, topic, title, content, tags, source, quality)
SELECT
  'quiz',
  c.grade,
  c.subject,
  lower(u.title),
  'Quiz: ' || u.title || ' (Grade ' || c.grade || ' ' || c.subject || ')',
  '{}',
  ARRAY['quiz', lower(c.subject), 'grade-' || c.grade, 'curriculum'],
  'admin',
  'auto'
FROM curriculum_units u
JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.is_active = true AND u.is_active = true
ON CONFLICT DO NOTHING;

-- Insert flashcard topics for all units
INSERT INTO content_library (tool_type, grade, subject, topic, title, content, tags, source, quality)
SELECT
  'flashcards',
  c.grade,
  c.subject,
  lower(u.title),
  'Flashcards: ' || u.title || ' (Grade ' || c.grade || ' ' || c.subject || ')',
  '{}',
  ARRAY['flashcards', lower(c.subject), 'grade-' || c.grade, 'curriculum'],
  'admin',
  'auto'
FROM curriculum_units u
JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.is_active = true AND u.is_active = true
ON CONFLICT DO NOTHING;

-- Insert study guide topics for all units
INSERT INTO content_library (tool_type, grade, subject, topic, title, content, tags, source, quality)
SELECT
  'study-guide',
  c.grade,
  c.subject,
  lower(u.title),
  'Study Guide: ' || u.title || ' (Grade ' || c.grade || ' ' || c.subject || ')',
  '{}',
  ARRAY['study-guide', lower(c.subject), 'grade-' || c.grade, 'curriculum'],
  'admin',
  'auto'
FROM curriculum_units u
JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.is_active = true AND u.is_active = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. Seed recommended books for all courses
-- ============================================================================

-- Grade 1 Math
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Go Math! Grade 1', 'Houghton Mifflin Harcourt', '9780544432734', 'HMH', 'https://www.amazon.com/dp/0544432738', 'textbook', true, 'Common Core aligned math curriculum for first grade.', 1),
  ('Math in Focus Grade 1', 'Marshall Cavendish', '9780544193543', 'HMH', 'https://www.amazon.com/dp/0544193547', 'supplemental', false, 'Singapore Math approach workbook.', 2)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 1 AND c.subject = 'Math';

-- Grade 1 English
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Journeys Grade 1', 'Houghton Mifflin Harcourt', '9780547251530', 'HMH', 'https://www.amazon.com/dp/0547251539', 'textbook', true, 'Comprehensive reading and language arts program.', 1),
  ('Bob Books Set 1', 'Bobby Lynn Maslen', '9780439845007', 'Scholastic', 'https://www.amazon.com/dp/0439845009', 'supplemental', false, 'Beginning readers phonics set.', 2)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 1 AND c.subject = 'English';

-- Grade 1 Science
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('National Geographic Science Grade 1', 'National Geographic', '9781133168126', 'Cengage', 'https://www.amazon.com/dp/1133168124', 'textbook', true, 'Hands-on science exploration for young learners.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 1 AND c.subject = 'Science';

-- Grade 1 Social Studies
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('myWorld Interactive Grade 1', 'Pearson', '9780328973095', 'Pearson', 'https://www.amazon.com/dp/0328973092', 'textbook', true, 'Interactive social studies with digital resources.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 1 AND c.subject = 'Social Studies';

-- Grade 2 Math
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Go Math! Grade 2', 'Houghton Mifflin Harcourt', '9780544432741', 'HMH', 'https://www.amazon.com/dp/0544432746', 'textbook', true, 'Common Core aligned math curriculum.', 1),
  ('Math in Focus Grade 2', 'Marshall Cavendish', '9780544193550', 'HMH', 'https://www.amazon.com/dp/0544193555', 'supplemental', false, 'Singapore Math approach workbook.', 2)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 2 AND c.subject = 'Math';

-- Grade 2 English
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Journeys Grade 2', 'Houghton Mifflin Harcourt', '9780547251547', 'HMH', 'https://www.amazon.com/dp/0547251548', 'textbook', true, 'Reading and language arts program.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 2 AND c.subject = 'English';

-- Grade 2 Science
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Mystery Science Grade 2', 'Mystery Science', '9781543353648', 'Mystery.org', 'https://www.amazon.com/dp/1543353649', 'textbook', true, 'Inquiry-based science curriculum.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 2 AND c.subject = 'Science';

-- Grade 2 Social Studies
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('myWorld Interactive Grade 2', 'Pearson', '9780328973101', 'Pearson', 'https://www.amazon.com/dp/0328973106', 'textbook', true, 'Interactive social studies program.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 2 AND c.subject = 'Social Studies';

-- Grade 3 Math
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Go Math! Grade 3', 'Houghton Mifflin Harcourt', '9780544432758', 'HMH', 'https://www.amazon.com/dp/0544432754', 'textbook', true, 'Common Core aligned math.', 1),
  ('Multiplication Facts That Stick', 'Kate Snow', '9781933339900', 'Well-Trained Mind', 'https://www.amazon.com/dp/1933339900', 'supplemental', false, 'Fun strategies for mastering multiplication.', 2)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 3 AND c.subject = 'Math';

-- Grade 3 English
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Journeys Grade 3', 'Houghton Mifflin Harcourt', '9780547251554', 'HMH', 'https://www.amazon.com/dp/0547251556', 'textbook', true, 'Reading and language arts program.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 3 AND c.subject = 'English';

-- Grade 3 Science
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Elevate Science Grade 3', 'Pearson', '9780328948765', 'Pearson', 'https://www.amazon.com/dp/0328948764', 'textbook', true, 'NGSS-aligned science curriculum.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 3 AND c.subject = 'Science';

-- Grade 3 Social Studies
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('myWorld Interactive Grade 3', 'Pearson', '9780328973118', 'Pearson', 'https://www.amazon.com/dp/0328973114', 'textbook', true, 'Interactive social studies program.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 3 AND c.subject = 'Social Studies';

-- Grade 4 Math
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Go Math! Grade 4', 'Houghton Mifflin Harcourt', '9780544432765', 'HMH', 'https://www.amazon.com/dp/0544432762', 'textbook', true, 'Common Core aligned math.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 4 AND c.subject = 'Math';

-- Grade 4 English
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Journeys Grade 4', 'Houghton Mifflin Harcourt', '9780547251561', 'HMH', 'https://www.amazon.com/dp/0547251564', 'textbook', true, 'Reading and language arts program.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 4 AND c.subject = 'English';

-- Grade 4 Science
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Elevate Science Grade 4', 'Pearson', '9780328948772', 'Pearson', 'https://www.amazon.com/dp/0328948772', 'textbook', true, 'NGSS-aligned science curriculum.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 4 AND c.subject = 'Science';

-- Grade 4 Social Studies
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('myWorld Interactive Grade 4', 'Pearson', '9780328973125', 'Pearson', 'https://www.amazon.com/dp/0328973122', 'textbook', true, 'State and US regions social studies.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 4 AND c.subject = 'Social Studies';

-- Grade 4 History
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('A History of US Book 1-3', 'Joy Hakim', '9780195327151', 'Oxford', 'https://www.amazon.com/dp/0195327152', 'textbook', true, 'Engaging narrative American history series.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 4 AND c.subject = 'History';

-- Grade 5 Math
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Go Math! Grade 5', 'Houghton Mifflin Harcourt', '9780544432772', 'HMH', 'https://www.amazon.com/dp/0544432770', 'textbook', true, 'Common Core aligned math.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 5 AND c.subject = 'Math';

-- Grade 5 English
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Journeys Grade 5', 'Houghton Mifflin Harcourt', '9780547251578', 'HMH', 'https://www.amazon.com/dp/0547251572', 'textbook', true, 'Reading and language arts program.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 5 AND c.subject = 'English';

-- Grade 5 Science
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Elevate Science Grade 5', 'Pearson', '9780328948789', 'Pearson', 'https://www.amazon.com/dp/0328948780', 'textbook', true, 'NGSS-aligned science curriculum.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 5 AND c.subject = 'Science';

-- Grade 5 Social Studies
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('myWorld Interactive Grade 5', 'Pearson', '9780328973132', 'Pearson', 'https://www.amazon.com/dp/0328973130', 'textbook', true, 'US history social studies.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 5 AND c.subject = 'Social Studies';

-- Grade 5 History
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('A History of US Book 4-6', 'Joy Hakim', '9780195327168', 'Oxford', 'https://www.amazon.com/dp/0195327160', 'textbook', true, 'American Revolution through Civil War.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 5 AND c.subject = 'History';

-- Grade 6 Math
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Big Ideas Math Grade 6', 'Ron Larson', '9781642087161', 'Big Ideas Learning', 'https://www.amazon.com/dp/1642087165', 'textbook', true, 'Standards-aligned middle school math.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 6 AND c.subject = 'Math';

-- Grade 6 English
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Collections Grade 6', 'Houghton Mifflin Harcourt', '9780544087606', 'HMH', 'https://www.amazon.com/dp/0544087607', 'textbook', true, 'Literature and language arts anthology.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 6 AND c.subject = 'English';

-- Grade 6 Science
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('CK-12 Earth Science for Middle School', 'CK-12 Foundation', '9781935983019', 'CK-12', 'https://www.ck12.org/earth-science/', 'textbook', true, 'Free open-source earth and life science.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 6 AND c.subject = 'Science';

-- Grade 6 Social Studies
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('myWorld Interactive Ancient Civilizations', 'Pearson', '9780328973149', 'Pearson', 'https://www.amazon.com/dp/0328973148', 'textbook', true, 'Ancient world social studies.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 6 AND c.subject = 'Social Studies';

-- Grade 6 History
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('The Story of the World Vol 1', 'Susan Wise Bauer', '9781933339009', 'Well-Trained Mind', 'https://www.amazon.com/dp/1933339004', 'textbook', true, 'Ancient times narrative history.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 6 AND c.subject = 'History';

-- Grade 7 Math
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Big Ideas Math Grade 7', 'Ron Larson', '9781642087178', 'Big Ideas Learning', 'https://www.amazon.com/dp/1642087173', 'textbook', true, 'Standards-aligned middle school math.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 7 AND c.subject = 'Math';

-- Grade 7 English
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Collections Grade 7', 'Houghton Mifflin Harcourt', '9780544087613', 'HMH', 'https://www.amazon.com/dp/0544087615', 'textbook', true, 'Literature and language arts anthology.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 7 AND c.subject = 'English';

-- Grade 7 Science
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('CK-12 Life Science for Middle School', 'CK-12 Foundation', '9781935983026', 'CK-12', 'https://www.ck12.org/life-science/', 'textbook', true, 'Free open-source life science.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 7 AND c.subject = 'Science';

-- Grade 7 Social Studies
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('myWorld Interactive Medieval and Modern Times', 'Pearson', '9780328973156', 'Pearson', 'https://www.amazon.com/dp/0328973156', 'textbook', true, 'Medieval to early modern social studies.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 7 AND c.subject = 'Social Studies';

-- Grade 7 History
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('The Story of the World Vol 2', 'Susan Wise Bauer', '9781933339016', 'Well-Trained Mind', 'https://www.amazon.com/dp/1933339012', 'textbook', true, 'Middle Ages narrative history.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 7 AND c.subject = 'History';

-- Grade 8 Math
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Big Ideas Math Grade 8', 'Ron Larson', '9781642087185', 'Big Ideas Learning', 'https://www.amazon.com/dp/1642087181', 'textbook', true, 'Pre-algebra and algebra readiness.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 8 AND c.subject = 'Math';

-- Grade 8 English
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Collections Grade 8', 'Houghton Mifflin Harcourt', '9780544087620', 'HMH', 'https://www.amazon.com/dp/0544087623', 'textbook', true, 'Literature and language arts anthology.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 8 AND c.subject = 'English';

-- Grade 8 Science
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('CK-12 Physical Science for Middle School', 'CK-12 Foundation', '9781935983033', 'CK-12', 'https://www.ck12.org/physical-science/', 'textbook', true, 'Free open-source physical science.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 8 AND c.subject = 'Science';

-- Grade 8 Social Studies
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('The American Journey', 'McGraw-Hill', '9780076681433', 'McGraw-Hill', 'https://www.amazon.com/dp/0076681432', 'textbook', true, 'US history Civil War to modern era.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 8 AND c.subject = 'Social Studies';

-- Grade 8 History
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('A History of US Book 7-10', 'Joy Hakim', '9780195327175', 'Oxford', 'https://www.amazon.com/dp/0195327179', 'textbook', true, 'Reconstruction through modern America.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 8 AND c.subject = 'History';

-- Grade 9 Math (Algebra I)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Algebra 1', 'Ron Larson', '9781642088052', 'Big Ideas Learning', 'https://www.amazon.com/dp/1642088056', 'textbook', true, 'Common Core algebra textbook.', 1),
  ('Algebra 1 Workbook', 'Reza Nazari', '9781637191460', 'Effortless Math', 'https://www.amazon.com/dp/1637191464', 'workbook', false, 'Practice problems and exercises.', 2)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 9 AND c.subject = 'Math';

-- Grade 9 English
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('The Language of Composition', 'Renee Shea', '9781319056148', 'Bedford/St. Martins', 'https://www.amazon.com/dp/1319056148', 'textbook', true, 'AP-level reading and writing.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 9 AND c.subject = 'English';

-- Grade 9 Science (Biology)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Biology', 'Kenneth Miller', '9780133669510', 'Pearson', 'https://www.amazon.com/dp/0133669513', 'textbook', true, 'Miller and Levine Biology textbook.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 9 AND c.subject = 'Science';

-- Grade 9 Social Studies (World Geography)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('World Geography', 'McDougal Littell', '9780618689989', 'McDougal Littell', 'https://www.amazon.com/dp/0618689982', 'textbook', true, 'Comprehensive world geography.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 9 AND c.subject = 'Social Studies';

-- Grade 9 History (World History I)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('World History: Patterns of Interaction', 'McDougal Littell', '9780547491127', 'HMH', 'https://www.amazon.com/dp/0547491123', 'textbook', true, 'Ancient civilizations through Renaissance.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 9 AND c.subject = 'History';

-- Grade 10 Math (Geometry)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Geometry', 'Ron Larson', '9781642088069', 'Big Ideas Learning', 'https://www.amazon.com/dp/1642088064', 'textbook', true, 'Common Core geometry textbook.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 10 AND c.subject = 'Math';

-- Grade 10 English
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('World Literature', 'Holt McDougal', '9780547618418', 'HMH', 'https://www.amazon.com/dp/054761841X', 'textbook', true, 'World literature anthology.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 10 AND c.subject = 'English';

-- Grade 10 Science (Chemistry)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Chemistry: A Molecular Approach', 'Nivaldo Tro', '9780134874371', 'Pearson', 'https://www.amazon.com/dp/0134874374', 'textbook', true, 'Introductory chemistry textbook.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 10 AND c.subject = 'Science';

-- Grade 10 Social Studies (World History II)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('World History: Patterns of Interaction', 'McDougal Littell', '9780547491127', 'HMH', 'https://www.amazon.com/dp/0547491123', 'textbook', true, 'Enlightenment through modern world.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 10 AND c.subject = 'Social Studies';

-- Grade 10 History (World History II)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('The Story of the World Vol 4', 'Susan Wise Bauer', '9781933339023', 'Well-Trained Mind', 'https://www.amazon.com/dp/1933339020', 'textbook', true, 'Modern age narrative history.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 10 AND c.subject = 'History';

-- Grade 11 Math (Algebra II)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Algebra 2', 'Ron Larson', '9781642088076', 'Big Ideas Learning', 'https://www.amazon.com/dp/1642088072', 'textbook', true, 'Common Core Algebra 2.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 11 AND c.subject = 'Math';

-- Grade 11 English (American Literature)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('The Norton Anthology of American Literature', 'Robert Levine', '9780393264548', 'Norton', 'https://www.amazon.com/dp/0393264548', 'textbook', true, 'Comprehensive American literature collection.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 11 AND c.subject = 'English';

-- Grade 11 Science (Physics)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Physics: Principles with Applications', 'Douglas Giancoli', '9780321625922', 'Pearson', 'https://www.amazon.com/dp/0321625927', 'textbook', true, 'Introductory physics textbook.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 11 AND c.subject = 'Science';

-- Grade 11 Social Studies (US History)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('The Americans', 'McDougal Littell', '9780547491189', 'HMH', 'https://www.amazon.com/dp/0547491182', 'textbook', true, 'Comprehensive US history textbook.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 11 AND c.subject = 'Social Studies';

-- Grade 11 History (US History)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('The Americans', 'McDougal Littell', '9780547491189', 'HMH', 'https://www.amazon.com/dp/0547491182', 'textbook', true, 'Standard US history textbook.', 1),
  ('A Peoples History of the United States', 'Howard Zinn', '9780062397348', 'Harper', 'https://www.amazon.com/dp/0062397346', 'supplemental', false, 'Alternative perspective on American history.', 2)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 11 AND c.subject = 'History';

-- Grade 12 Math (Pre-Calculus)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Precalculus', 'Ron Larson', '9781337271073', 'Cengage', 'https://www.amazon.com/dp/1337271071', 'textbook', true, 'Comprehensive pre-calculus textbook.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 12 AND c.subject = 'Math';

-- Grade 12 English (British Literature)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('The Norton Anthology of English Literature', 'Stephen Greenblatt', '9780393603125', 'Norton', 'https://www.amazon.com/dp/0393603121', 'textbook', true, 'Comprehensive British literature collection.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 12 AND c.subject = 'English';

-- Grade 12 Science (Environmental Science)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Environmental Science', 'Andrew Friedland', '9781319065669', 'W.H. Freeman', 'https://www.amazon.com/dp/1319065666', 'textbook', true, 'AP Environmental Science textbook.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 12 AND c.subject = 'Science';

-- Grade 12 Social Studies (Government & Economics)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Government in America', 'George Edwards', '9780134586571', 'Pearson', 'https://www.amazon.com/dp/0134586573', 'textbook', true, 'US government and politics.', 1),
  ('Economics: Principles in Action', 'Arthur OSullivan', '9780133680195', 'Pearson', 'https://www.amazon.com/dp/0133680193', 'supplemental', false, 'Economics principles textbook.', 2)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 12 AND c.subject = 'Social Studies';

-- Grade 12 History (Government & Economics)
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('We the People', 'Benjamin Ginsberg', '9780393679670', 'Norton', 'https://www.amazon.com/dp/0393679675', 'textbook', true, 'Introduction to American politics.', 1)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 12 AND c.subject = 'History';
