-- ============================================================================
-- Full curriculum seed — Grades 1–12, all subjects, all units
-- Replaces partial seed from 20240040
-- ============================================================================

-- Allow grade up to 12 (was 1-12 already in schema)
-- Add high school courses (grades 9-12)

INSERT INTO curriculum_courses (grade, subject, title, description, sort_order) VALUES
-- Grade 9
(9, 'Math', 'Algebra I', 'Linear equations, inequalities, functions, polynomials, and quadratics.', 1),
(9, 'English', 'Grade 9 English', 'Literary analysis, argumentative essays, rhetoric, and research writing.', 2),
(9, 'Science', 'Biology', 'Cell biology, genetics, evolution, ecology, and human body systems.', 3),
(9, 'Social Studies', 'World Geography', 'Physical and human geography, cultures, regions, and global issues.', 4),
(9, 'History', 'World History I', 'Ancient civilizations through the Renaissance.', 5),

-- Grade 10
(10, 'Math', 'Geometry', 'Proofs, congruence, similarity, circles, area, volume, and trigonometry intro.', 1),
(10, 'English', 'Grade 10 English', 'World literature, analytical writing, speech, and media literacy.', 2),
(10, 'Science', 'Chemistry', 'Atoms, periodic table, bonding, reactions, stoichiometry, and solutions.', 3),
(10, 'Social Studies', 'World History II', 'Enlightenment through modern era, world wars, and globalization.', 4),
(10, 'History', 'World History II', 'Age of Revolutions through the Cold War and modern world.', 5),

-- Grade 11
(11, 'Math', 'Algebra II', 'Polynomials, rational expressions, logarithms, sequences, and probability.', 1),
(11, 'English', 'American Literature', 'Colonial to contemporary American literature, critical essays, and research.', 2),
(11, 'Science', 'Physics', 'Motion, forces, energy, waves, electricity, and magnetism.', 3),
(11, 'Social Studies', 'US History', 'Founding through modern America, government, economics, and civics.', 4),
(11, 'History', 'US History', 'Constitutional era through present day.', 5),

-- Grade 12
(12, 'Math', 'Pre-Calculus', 'Functions, trigonometry, limits, sequences, and introduction to calculus.', 1),
(12, 'English', 'British Literature', 'Beowulf through modern British literature, senior thesis, and communication.', 2),
(12, 'Science', 'Environmental Science', 'Ecosystems, biodiversity, climate, pollution, and sustainability.', 3),
(12, 'Social Studies', 'Government & Economics', 'US government, Constitution, economics, personal finance, and civics.', 4),
(12, 'History', 'Government & Economics', 'Democratic principles, economic systems, and civic responsibility.', 5)
ON CONFLICT (grade, subject) DO NOTHING;

-- ============================================================================
-- Units for ALL grades — comprehensive unit structure
-- ============================================================================

-- Helper: insert units for a course identified by grade + subject
-- Grade 1 Math
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Counting and Cardinality', 'Count to 120, read and write numbers, count objects.', 1, 4, 1),
  ('Addition Within 20', 'Add within 20, word problems, strategies for adding.', 5, 9, 2),
  ('Subtraction Within 20', 'Subtract within 20, relate addition and subtraction.', 10, 14, 3),
  ('Place Value', 'Tens and ones, compare two-digit numbers.', 15, 18, 4),
  ('Measurement and Data', 'Length, time to the hour, organize data.', 19, 23, 5),
  ('Geometry', 'Shapes, attributes, composing shapes, halves and quarters.', 24, 27, 6),
  ('Word Problems', 'Addition and subtraction word problems, drawings and equations.', 28, 32, 7),
  ('Review and Assessment', 'Year-end review, cumulative practice, and assessment.', 33, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 1 AND c.subject = 'Math'
ON CONFLICT DO NOTHING;

-- Grade 1 English
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Letter Recognition', 'Uppercase and lowercase letters, letter sounds, alphabetical order.', 1, 4, 1),
  ('Phonics and Word Families', 'Short vowels, consonant blends, CVC words, word families.', 5, 9, 2),
  ('Sight Words', 'High-frequency words, reading fluency with sight words.', 10, 14, 3),
  ('Reading Comprehension', 'Main idea, details, sequencing, making predictions.', 15, 19, 4),
  ('Writing Sentences', 'Capital letters, periods, writing complete sentences.', 20, 24, 5),
  ('Grammar Basics', 'Nouns, verbs, adjectives, singular and plural.', 25, 28, 6),
  ('Stories and Poetry', 'Story elements, rhyming words, listening to and retelling stories.', 29, 32, 7),
  ('Review and Assessment', 'Year-end reading and writing review.', 33, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 1 AND c.subject = 'English'
ON CONFLICT DO NOTHING;

-- Grade 1 Science
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Weather and Seasons', 'Types of weather, four seasons, temperature.', 1, 5, 1),
  ('Plants', 'Parts of a plant, what plants need, seeds and growth.', 6, 10, 2),
  ('Animals', 'Animal types, habitats, needs of living things.', 11, 15, 3),
  ('Earth and Sky', 'Day and night, sun and moon, rocks and soil.', 16, 20, 4),
  ('Senses and Body', 'Five senses, body parts, staying healthy.', 21, 25, 5),
  ('Push and Pull', 'Forces, motion, magnets.', 26, 30, 6),
  ('Review and Projects', 'Science projects and year-end review.', 31, 36, 7)
) AS u(title, description, ws, we, so) WHERE c.grade = 1 AND c.subject = 'Science'
ON CONFLICT DO NOTHING;

-- Grade 2 Math
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Place Value to 1000', 'Hundreds, tens, ones, expanded form, comparing numbers.', 1, 4, 1),
  ('Addition with Regrouping', 'Two-digit and three-digit addition with carrying.', 5, 9, 2),
  ('Subtraction with Regrouping', 'Two-digit and three-digit subtraction with borrowing.', 10, 14, 3),
  ('Measurement', 'Inches, feet, centimeters, measuring objects.', 15, 18, 4),
  ('Time and Money', 'Telling time to 5 minutes, coins, counting money.', 19, 23, 5),
  ('Data and Graphs', 'Picture graphs, bar graphs, collecting and interpreting data.', 24, 27, 6),
  ('Geometry', 'Shapes and their attributes, partitioning rectangles.', 28, 31, 7),
  ('Word Problems and Review', 'Two-step word problems, year-end review.', 32, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 2 AND c.subject = 'Math'
ON CONFLICT DO NOTHING;

-- Grade 2 English
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Phonics and Decoding', 'Long vowels, vowel teams, silent e, blending.', 1, 5, 1),
  ('Reading Fluency', 'Read aloud practice, expression, pacing.', 6, 10, 2),
  ('Vocabulary Building', 'Context clues, compound words, word meanings.', 11, 15, 3),
  ('Comprehension Strategies', 'Cause and effect, compare and contrast, summarizing.', 16, 20, 4),
  ('Writing Paragraphs', 'Topic sentences, supporting details, concluding sentences.', 21, 25, 5),
  ('Grammar and Punctuation', 'Nouns, verbs, adjectives, commas, apostrophes.', 26, 30, 6),
  ('Creative Writing', 'Personal narratives, stories, journal writing.', 31, 34, 7),
  ('Review and Assessment', 'Year-end reading and writing assessment.', 35, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 2 AND c.subject = 'English'
ON CONFLICT DO NOTHING;

-- Grade 3 Math
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Multiplication Facts', 'Times tables 0-10, arrays, equal groups.', 1, 5, 1),
  ('Division Facts', 'Division as sharing, relationship to multiplication.', 6, 10, 2),
  ('Fractions', 'Unit fractions, fractions on a number line, comparing fractions.', 11, 15, 3),
  ('Area and Perimeter', 'Measuring area with unit squares, calculating perimeter.', 16, 19, 4),
  ('Multi-Digit Arithmetic', 'Adding and subtracting within 1000, rounding.', 20, 24, 5),
  ('Data and Measurement', 'Bar graphs, line plots, mass, volume, time.', 25, 28, 6),
  ('Geometry', 'Quadrilaterals, partitioning shapes, attributes of shapes.', 29, 32, 7),
  ('Problem Solving', 'Multi-step word problems, patterns, review.', 33, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 3 AND c.subject = 'Math'
ON CONFLICT DO NOTHING;

-- Grade 5 Math
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Place Value and Decimals', 'Place value to billions, decimal place value, comparing decimals.', 1, 4, 1),
  ('Multi-Digit Operations', 'Multi-digit multiplication and division, estimation.', 5, 9, 2),
  ('Fraction Operations', 'Add, subtract, multiply fractions, mixed numbers.', 10, 15, 3),
  ('Decimal Operations', 'Add, subtract, multiply, divide decimals.', 16, 20, 4),
  ('Volume', 'Volume of rectangular prisms, unit cubes.', 21, 24, 5),
  ('Coordinate Plane', 'Ordered pairs, graphing points, patterns.', 25, 28, 6),
  ('Order of Operations', 'PEMDAS, expressions, evaluating expressions.', 29, 32, 7),
  ('Review and Assessment', 'Cumulative review and year-end assessment.', 33, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 5 AND c.subject = 'Math'
ON CONFLICT DO NOTHING;

-- Grade 6 Math
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Ratios and Rates', 'Ratios, unit rates, equivalent ratios, ratio tables.', 1, 5, 1),
  ('Fractions and Decimals', 'Dividing fractions, decimal operations, conversions.', 6, 10, 2),
  ('Expressions and Equations', 'Variables, writing and evaluating expressions, one-step equations.', 11, 15, 3),
  ('Negative Numbers', 'Integers, absolute value, number line, ordering.', 16, 20, 4),
  ('Geometry', 'Area of polygons, surface area, volume, nets.', 21, 25, 5),
  ('Statistics', 'Mean, median, mode, range, dot plots, histograms.', 26, 30, 6),
  ('Inequalities', 'Writing and graphing inequalities.', 31, 33, 7),
  ('Review and Assessment', 'Year-end review and assessment.', 34, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 6 AND c.subject = 'Math'
ON CONFLICT DO NOTHING;

-- Grade 7 Math
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Proportional Relationships', 'Proportions, constant of proportionality, graphs.', 1, 5, 1),
  ('Operations with Integers', 'Adding, subtracting, multiplying, dividing integers.', 6, 10, 2),
  ('Expressions and Equations', 'Multi-step equations, combining like terms, distributive property.', 11, 15, 3),
  ('Inequalities', 'Solving and graphing inequalities.', 16, 19, 4),
  ('Geometry', 'Angle relationships, area, circumference, volume.', 20, 24, 5),
  ('Probability', 'Experimental vs theoretical probability, compound events.', 25, 28, 6),
  ('Statistics', 'Sampling, comparing populations, inferences.', 29, 32, 7),
  ('Review and Assessment', 'Year-end review and assessment.', 33, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 7 AND c.subject = 'Math'
ON CONFLICT DO NOTHING;

-- Grade 8 Math
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('Real Numbers', 'Rational and irrational numbers, square roots, cube roots.', 1, 4, 1),
  ('Exponents and Scientific Notation', 'Laws of exponents, scientific notation, operations.', 5, 8, 2),
  ('Linear Equations', 'Slope, y-intercept, graphing lines, solving equations.', 9, 14, 3),
  ('Systems of Equations', 'Solving systems graphically and algebraically.', 15, 18, 4),
  ('Functions', 'Function notation, linear vs nonlinear, comparing functions.', 19, 23, 5),
  ('Geometry and Pythagorean Theorem', 'Pythagorean theorem, distance, transformations.', 24, 28, 6),
  ('Statistics and Scatter Plots', 'Scatter plots, line of best fit, two-way tables.', 29, 32, 7),
  ('Review and Assessment', 'Year-end review and high school readiness.', 33, 36, 8)
) AS u(title, description, ws, we, so) WHERE c.grade = 8 AND c.subject = 'Math'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Seed content_library with topics for every unit across all grades
-- These are metadata entries — content JSON is populated on first access or batch generation
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
