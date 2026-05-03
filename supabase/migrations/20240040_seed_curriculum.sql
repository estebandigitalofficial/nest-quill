-- ============================================================================
-- Seed curriculum structure — Grades 1–8, core subjects
-- ============================================================================

-- Grade 1
INSERT INTO curriculum_courses (grade, subject, title, description, sort_order) VALUES
(1, 'Math', 'Grade 1 Math', 'Counting, addition, subtraction, shapes, measurement, and patterns.', 1),
(1, 'English', 'Grade 1 English Language Arts', 'Letters, phonics, sight words, simple sentences, and reading comprehension.', 2),
(1, 'Science', 'Grade 1 Science', 'Weather, seasons, plants, animals, and basic earth science.', 3),
(1, 'Social Studies', 'Grade 1 Social Studies', 'Community, family, maps, rules, and American symbols.', 4);

-- Grade 2
INSERT INTO curriculum_courses (grade, subject, title, description, sort_order) VALUES
(2, 'Math', 'Grade 2 Math', 'Place value, two-digit addition and subtraction, measurement, time, and money.', 1),
(2, 'English', 'Grade 2 English Language Arts', 'Reading fluency, vocabulary, writing sentences and paragraphs, grammar basics.', 2),
(2, 'Science', 'Grade 2 Science', 'States of matter, animal habitats, life cycles, and simple machines.', 3),
(2, 'Social Studies', 'Grade 2 Social Studies', 'Neighborhoods, geography basics, historical figures, and citizenship.', 4);

-- Grade 3
INSERT INTO curriculum_courses (grade, subject, title, description, sort_order) VALUES
(3, 'Math', 'Grade 3 Math', 'Multiplication, division, fractions, area and perimeter, and data analysis.', 1),
(3, 'English', 'Grade 3 English Language Arts', 'Reading comprehension, writing paragraphs, parts of speech, and research skills.', 2),
(3, 'Science', 'Grade 3 Science', 'Forces and motion, ecosystems, weather patterns, and the water cycle.', 3),
(3, 'Social Studies', 'Grade 3 Social Studies', 'Communities past and present, government basics, economics, and map skills.', 4);

-- Grade 4
INSERT INTO curriculum_courses (grade, subject, title, description, sort_order) VALUES
(4, 'Math', 'Grade 4 Math', 'Multi-digit operations, fractions and decimals, geometry, and measurement conversions.', 1),
(4, 'English', 'Grade 4 English Language Arts', 'Literary analysis, essay writing, grammar and mechanics, vocabulary development.', 2),
(4, 'Science', 'Grade 4 Science', 'Earth science, energy, electricity, plant and animal adaptations.', 3),
(4, 'Social Studies', 'Grade 4 Social Studies', 'State history, regions of the US, Native Americans, and exploration.', 4),
(4, 'History', 'Grade 4 History', 'Early American history, colonization, and the founding of the nation.', 5);

-- Grade 5
INSERT INTO curriculum_courses (grade, subject, title, description, sort_order) VALUES
(5, 'Math', 'Grade 5 Math', 'Decimals, fractions operations, volume, coordinate planes, and order of operations.', 1),
(5, 'English', 'Grade 5 English Language Arts', 'Narrative and opinion writing, literary elements, research projects, advanced grammar.', 2),
(5, 'Science', 'Grade 5 Science', 'Matter and its interactions, earth systems, space and the solar system.', 3),
(5, 'Social Studies', 'Grade 5 Social Studies', 'US history from colonization to westward expansion, government structure.', 4),
(5, 'History', 'Grade 5 History', 'American Revolution, Constitution, and early republic.', 5);

-- Grade 6
INSERT INTO curriculum_courses (grade, subject, title, description, sort_order) VALUES
(6, 'Math', 'Grade 6 Math', 'Ratios, rates, expressions and equations, statistics, and negative numbers.', 1),
(6, 'English', 'Grade 6 English Language Arts', 'Argumentative writing, textual evidence, literary analysis, and research.', 2),
(6, 'Science', 'Grade 6 Science', 'Cells and organisms, earth history, weather and climate, engineering design.', 3),
(6, 'Social Studies', 'Grade 6 Social Studies', 'Ancient civilizations, world geography, cultural studies.', 4),
(6, 'History', 'Grade 6 History', 'Ancient Egypt, Greece, Rome, and early world civilizations.', 5);

-- Grade 7
INSERT INTO curriculum_courses (grade, subject, title, description, sort_order) VALUES
(7, 'Math', 'Grade 7 Math', 'Proportional relationships, geometry, probability, and expressions and equations.', 1),
(7, 'English', 'Grade 7 English Language Arts', 'Complex texts, persuasive writing, literary criticism, and media literacy.', 2),
(7, 'Science', 'Grade 7 Science', 'Life science, human body systems, genetics, ecosystems and ecology.', 3),
(7, 'Social Studies', 'Grade 7 Social Studies', 'Medieval world history, age of exploration, and early modern period.', 4),
(7, 'History', 'Grade 7 History', 'Medieval period through the Renaissance and Reformation.', 5);

-- Grade 8
INSERT INTO curriculum_courses (grade, subject, title, description, sort_order) VALUES
(8, 'Math', 'Grade 8 Math', 'Linear equations, functions, Pythagorean theorem, transformations, and systems of equations.', 1),
(8, 'English', 'Grade 8 English Language Arts', 'Advanced literary analysis, research papers, rhetoric, and communication skills.', 2),
(8, 'Science', 'Grade 8 Science', 'Physical science, chemistry basics, waves, forces, and energy.', 3),
(8, 'Social Studies', 'Grade 8 Social Studies', 'US history from Civil War to modern era, civics, and current events.', 4),
(8, 'History', 'Grade 8 History', 'Civil War, Reconstruction, industrialization, and the modern United States.', 5);

-- ============================================================================
-- Seed units for Grade 4 Math as a template (other grades follow same pattern)
-- ============================================================================

INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.week_start, u.week_end, u.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Place Value and Rounding', 'Understanding place value to millions, rounding to nearest 10, 100, and 1000.', 1, 3, 1),
  ('Addition and Subtraction', 'Multi-digit addition and subtraction with regrouping, estimation, and word problems.', 4, 6, 2),
  ('Multiplication', 'Multiplication facts, multi-digit multiplication, area models, and word problems.', 7, 10, 3),
  ('Division', 'Long division, remainders, interpreting remainders in word problems.', 11, 14, 4),
  ('Fractions', 'Equivalent fractions, comparing fractions, adding and subtracting fractions with like denominators.', 15, 19, 5),
  ('Decimals', 'Decimal notation, comparing decimals, adding and subtracting decimals, money.', 20, 23, 6),
  ('Measurement and Data', 'Units of measurement, conversions, line plots, and data interpretation.', 24, 27, 7),
  ('Geometry', 'Lines, angles, symmetry, area and perimeter, classifying shapes.', 28, 31, 8),
  ('Patterns and Problem Solving', 'Number patterns, input-output tables, multi-step word problems.', 32, 35, 9)
) AS u(title, description, week_start, week_end, sort_order)
WHERE c.grade = 4 AND c.subject = 'Math';

-- ============================================================================
-- Seed units for Grade 4 English as another template
-- ============================================================================

INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.week_start, u.week_end, u.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Reading Fiction', 'Story elements, character development, plot structure, and making inferences.', 1, 4, 1),
  ('Reading Nonfiction', 'Main idea, supporting details, text features, and summarizing.', 5, 8, 2),
  ('Vocabulary and Word Study', 'Context clues, prefixes, suffixes, root words, and dictionary skills.', 9, 12, 3),
  ('Grammar and Mechanics', 'Parts of speech, sentence structure, punctuation, and capitalization.', 13, 17, 4),
  ('Narrative Writing', 'Writing personal narratives with dialogue, descriptive details, and sequence.', 18, 22, 5),
  ('Informational Writing', 'Research skills, organizing information, writing reports and essays.', 23, 27, 6),
  ('Opinion Writing', 'Forming and supporting opinions with evidence, persuasive techniques.', 28, 31, 7),
  ('Poetry and Literary Devices', 'Figurative language, rhyme, rhythm, stanzas, and writing poems.', 32, 35, 8)
) AS u(title, description, week_start, week_end, sort_order)
WHERE c.grade = 4 AND c.subject = 'English';
