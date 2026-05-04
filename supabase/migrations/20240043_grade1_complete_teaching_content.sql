-- ============================================================================
-- Migration 43: Grade 1 complete teaching content
-- - Grade 1 Social Studies units (missing from prior migrations)
-- - Content library entries for new units
-- - Teaching guides for ALL Grade 1 units (Math, English, Science, Social Studies)
-- ============================================================================

-- ============================================================================
-- 1. Grade 1 Social Studies units
-- ============================================================================
INSERT INTO curriculum_units (course_id, title, description, week_start, week_end, sort_order)
SELECT c.id, u.title, u.description, u.ws, u.we, u.so FROM curriculum_courses c
CROSS JOIN (VALUES
  ('My Family and Community', 'Family roles, community helpers, neighborhoods, and belonging.', 1, 5, 1),
  ('Rules and Laws', 'Classroom rules, school rules, community laws, fairness and safety.', 6, 10, 2),
  ('Maps and Locations', 'Reading simple maps, school and neighborhood maps, cardinal directions.', 11, 15, 3),
  ('American Symbols', 'American flag, Statue of Liberty, bald eagle, national anthem, pledge.', 16, 20, 4),
  ('Needs and Wants', 'Basic needs, wants, goods, services, jobs in the community.', 21, 25, 5),
  ('Holidays and Heroes', 'National holidays, important Americans, celebrating diversity.', 26, 30, 6),
  ('Review and Projects', 'Year-end community project and social studies review.', 31, 36, 7)
) AS u(title, description, ws, we, so) WHERE c.grade = 1 AND c.subject = 'Social Studies'
ON CONFLICT DO NOTHING;

-- Content library entries for new Social Studies units
INSERT INTO content_library (tool_type, grade, subject, topic, title, content, tags, source, quality)
SELECT 'quiz', 1, 'Social Studies', lower(u.title),
  'Quiz: ' || u.title || ' (Grade 1 Social Studies)', '{}',
  ARRAY['quiz', 'social studies', 'grade-1', 'curriculum'], 'admin', 'auto'
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'Social Studies' ON CONFLICT DO NOTHING;

INSERT INTO content_library (tool_type, grade, subject, topic, title, content, tags, source, quality)
SELECT 'flashcards', 1, 'Social Studies', lower(u.title),
  'Flashcards: ' || u.title || ' (Grade 1 Social Studies)', '{}',
  ARRAY['flashcards', 'social studies', 'grade-1', 'curriculum'], 'admin', 'auto'
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'Social Studies' ON CONFLICT DO NOTHING;

INSERT INTO content_library (tool_type, grade, subject, topic, title, content, tags, source, quality)
SELECT 'study-guide', 1, 'Social Studies', lower(u.title),
  'Study Guide: ' || u.title || ' (Grade 1 Social Studies)', '{}',
  ARRAY['study-guide', 'social studies', 'grade-1', 'curriculum'], 'admin', 'auto'
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'Social Studies' ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. Teaching guides for ALL Grade 1 units
-- ============================================================================

-- ── MATH UNIT 1: Counting and Cardinality ──────────────────────────────────
INSERT INTO curriculum_teaching_guides (unit_id, title, objectives, materials, instruction_plan, assessment_ideas, differentiation, standards, duration_minutes)
SELECT u.id,
  'Teaching Guide: Counting and Cardinality',
  ARRAY['Count to 120 starting from any number', 'Read and write numbers to 120', 'Count objects using one-to-one correspondence', 'Understand that the last number counted tells the total'],
  ARRAY['Number line (1-120) poster', 'Counting bears or cubes', 'Number cards (0-20)', 'Ten frames', 'Dry-erase boards and markers', 'Dice', 'Small objects for counting (buttons, beans, coins)', 'Hundreds chart'],
  '{
    "daily_lessons": [
      {"day": 1, "title": "Count to 20 Together", "duration": 30, "description": "Practice counting to 20 using songs and movement. Count fingers, toes, claps. Use a number line poster and point to each number while counting aloud together."},
      {"day": 2, "title": "One-to-One Counting", "duration": 30, "description": "Give your child 10-15 small objects (buttons, beans, blocks). Have them touch each object as they count it. Emphasize: one touch = one number."},
      {"day": 3, "title": "Number Recognition 0-10", "duration": 30, "description": "Use number cards. Show a number, child says it. Reverse: say a number, child finds the card. Play Number Hunt around the house finding numbers on clocks, books, and signs."},
      {"day": 4, "title": "Writing Numbers 0-10", "duration": 30, "description": "Practice writing each number on a dry-erase board. Start with tracing, then freehand. Make it fun with different colored markers."},
      {"day": 5, "title": "Counting Beyond 20", "duration": 30, "description": "Use the number line to count from 1 to 50. Introduce the pattern: after 20 comes 21, 22, 23. Play What Comes Next game."},
      {"day": 6, "title": "Counting Objects to 20", "duration": 30, "description": "Set up counting stations. Station 1: count crackers. Station 2: count crayons. Station 3: count blocks. Record each count on paper."},
      {"day": 7, "title": "Ten Frames Introduction", "duration": 30, "description": "Place objects in ten frames to show numbers. Ask: how many? How many more to make 10? This builds number sense for addition."},
      {"day": 8, "title": "Counting to 100", "duration": 30, "description": "Use a hundreds chart. Count together pointing to each number. Practice counting from different starting points (start at 23, start at 47)."},
      {"day": 9, "title": "Number Writing 11-20", "duration": 30, "description": "Practice writing teen numbers. Explain: 13 is a 1 and a 3 (ten and three). Play write the number I say game."},
      {"day": 10, "title": "Unit Review and Fun Count", "duration": 30, "description": "Play counting board games. Do a counting scavenger hunt: find 7 blue things, find 12 small things. Take the unit quiz."}
    ],
    "hands_on_activities": [
      {"title": "Counting Scavenger Hunt", "type": "game", "description": "Create cards with numbers 1-20. Child draws a card and must find that many objects around the house. Example: draw 8 = find 8 spoons.", "materials": ["Number cards", "Paper bag for collecting"]},
      {"title": "Number Line Hopscotch", "type": "outdoor", "description": "Draw numbers 1-20 on sidewalk with chalk. Call out a number and child hops to it. Then count up or down from that number.", "materials": ["Sidewalk chalk"]},
      {"title": "Bean Counting Jars", "type": "craft", "description": "Label 10 cups with numbers 1-10. Child counts the correct number of beans into each. Great for one-to-one correspondence.", "materials": ["10 cups", "Dried beans", "Number labels"]}
    ],
    "parent_tips": [
      "Count everything during daily life: stairs, grapes at snack, cars in the parking lot",
      "Make sure your child is solid on 1-20 before pushing to higher numbers",
      "If your child reverses numbers when writing (like 3 backwards), that is normal at this age",
      "Use a hundreds chart on the wall - kids absorb number patterns just by seeing it daily"
    ]
  }'::jsonb,
  ARRAY['Count a set of 15-20 objects accurately', 'Read numbers 0-20 from flash cards', 'Write numbers 0-20 from dictation', 'Count forward from any number to 50'],
  '{"struggling": "Start with counting to 10 only. Use larger objects that are easier to touch-count. Pair numbers with pictures.", "advanced": "Challenge to count to 120. Introduce skip counting by 2s and 5s. Write numbers to 50.", "english_learners": "Use visual number cards with the written word. Count real objects rather than abstract numbers."}'::jsonb,
  ARRAY['CCSS.MATH.CONTENT.1.NBT.A.1', 'CCSS.MATH.CONTENT.1.NBT.B.2'],
  30
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'Math' AND u.title = 'Counting and Cardinality';

-- ── MATH UNIT 2: Addition Within 20 ────────────────────────────────────────
INSERT INTO curriculum_teaching_guides (unit_id, title, objectives, materials, instruction_plan, assessment_ideas, differentiation, standards, duration_minutes)
SELECT u.id,
  'Teaching Guide: Addition Within 20',
  ARRAY['Add within 20 using objects, drawings, and equations', 'Solve addition word problems within 20', 'Understand the plus sign and equals sign', 'Use strategies: counting on, making 10, doubles'],
  ARRAY['Counting cubes or blocks', 'Number line', 'Addition flash cards', 'Dry-erase boards', 'Dominos', 'Playing cards (Ace-10)', 'Small toys for word problems'],
  '{
    "daily_lessons": [
      {"day": 1, "title": "Combining Groups", "duration": 30, "description": "Use two groups of blocks. Put 3 red and 4 blue together. Count all. Repeat with different amounts. Introduce the word addition."},
      {"day": 2, "title": "The Plus and Equals Signs", "duration": 30, "description": "Show that + means put together and = means the same as. Write simple equations: 2 + 3 = 5. Use blocks to verify each one."},
      {"day": 3, "title": "Counting On Strategy", "duration": 30, "description": "Instead of counting all, start from the bigger number and count on. For 5 + 3: start at 5, count 6, 7, 8. Practice with number line."},
      {"day": 4, "title": "Doubles Facts", "duration": 30, "description": "Learn doubles: 1+1, 2+2, 3+3 up to 5+5. These are anchor facts. Use mirrors, shoes, and hands as real-world doubles."},
      {"day": 5, "title": "Making 10", "duration": 30, "description": "Use ten frames to find pairs that make 10: 7+3, 6+4, 8+2. This is a key strategy for mental math."},
      {"day": 6, "title": "Addition Word Problems", "duration": 30, "description": "Tell stories using your child''s name: You have 4 apples. Grandma gives you 3 more. How many now? Act them out with toys."},
      {"day": 7, "title": "Domino Addition", "duration": 30, "description": "Turn over a domino. Count dots on each side. Write the addition equation. Great hands-on practice."},
      {"day": 8, "title": "Addition War Card Game", "duration": 30, "description": "Each player flips two cards and adds them. Bigger sum wins the round. Fun competitive practice."},
      {"day": 9, "title": "Three Addends Introduction", "duration": 30, "description": "For advanced practice: 2 + 3 + 1 = ?. Look for pairs that make 10 first. Use cubes in three colors."},
      {"day": 10, "title": "Unit Review and Quiz", "duration": 30, "description": "Play addition bingo. Review all strategies. Take the unit quiz to check mastery."}
    ],
    "hands_on_activities": [
      {"title": "Domino Addition", "type": "game", "description": "Flip dominos face down. Turn one over, add both sides, write the equation. Race to complete 10 equations.", "materials": ["Domino set", "Paper", "Pencil"]},
      {"title": "Addition War", "type": "game", "description": "Use playing cards Ace-10. Each player flips 2 cards and adds. Higher sum wins. Great for fact fluency.", "materials": ["Deck of playing cards"]},
      {"title": "Building Block Towers", "type": "craft", "description": "Build two towers of blocks, count each, combine them, count the total. Write the equation. Try different combinations.", "materials": ["Building blocks or cubes"]}
    ],
    "parent_tips": [
      "Use your child''s name and interests in word problems to make them engaging",
      "Always use manipulatives (physical objects) before moving to abstract numbers on paper",
      "Doubles facts are the most important to memorize - practice them daily",
      "If your child uses fingers to count, that is okay at this stage"
    ]
  }'::jsonb,
  ARRAY['Solve 10 addition problems within 10', 'Solve 5 addition word problems', 'Explain an addition strategy they used', 'Complete addition facts quiz'],
  '{"struggling": "Stay within 10. Always use manipulatives. Focus on counting all before counting on.", "advanced": "Extend to 20. Introduce 3-addend problems. Try missing addend: 5 + ? = 8.", "english_learners": "Use picture-based word problems. Act out scenarios physically before writing equations."}'::jsonb,
  ARRAY['CCSS.MATH.CONTENT.1.OA.A.1', 'CCSS.MATH.CONTENT.1.OA.B.3', 'CCSS.MATH.CONTENT.1.OA.C.6'],
  30
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'Math' AND u.title = 'Addition Within 20';

-- ── MATH UNIT 3: Subtraction Within 20 ─────────────────────────────────────
INSERT INTO curriculum_teaching_guides (unit_id, title, objectives, materials, instruction_plan, assessment_ideas, differentiation, standards, duration_minutes)
SELECT u.id,
  'Teaching Guide: Subtraction Within 20',
  ARRAY['Subtract within 20 using objects and drawings', 'Understand subtraction as taking away or finding difference', 'Relate addition and subtraction as inverse operations', 'Solve subtraction word problems'],
  ARRAY['Counting cubes', 'Number line', 'Subtraction flash cards', 'Small toys or snacks', 'Dry-erase boards'],
  '{
    "daily_lessons": [
      {"day": 1, "title": "Taking Away Concept", "duration": 30, "description": "Start with 8 blocks. Take 3 away. Count what is left. Repeat with snacks: you have 6 crackers, eat 2, how many left?"},
      {"day": 2, "title": "The Minus Sign", "duration": 30, "description": "Introduce - as take away. Write equations: 7 - 2 = 5. Use objects to verify every problem."},
      {"day": 3, "title": "Counting Back on Number Line", "duration": 30, "description": "Start at 9, jump back 3 spaces. Where did you land? Practice counting back as a subtraction strategy."},
      {"day": 4, "title": "Subtraction as Difference", "duration": 30, "description": "How many MORE does Sam have than Lily? Line up two groups of blocks and compare. Subtraction finds the difference."},
      {"day": 5, "title": "Relating Addition and Subtraction", "duration": 30, "description": "If 3 + 5 = 8, then 8 - 5 = 3 and 8 - 3 = 5. Introduce fact families with block demonstrations."},
      {"day": 6, "title": "Subtraction Word Problems", "duration": 30, "description": "Tell take-away stories. You had 10 balloons, 4 popped. How many left? Act out each problem."},
      {"day": 7, "title": "Subtraction Bowling", "duration": 30, "description": "Set up 10 paper cups. Roll a ball. Count how many knocked down and how many still standing. Write the equation."},
      {"day": 8, "title": "Fact Families", "duration": 30, "description": "Given 3, 5, 8 - write all four facts: 3+5=8, 5+3=8, 8-3=5, 8-5=3. Use triangle fact cards."},
      {"day": 9, "title": "Mixed Practice", "duration": 30, "description": "Mix addition and subtraction problems. Child must decide which operation to use based on the word problem."},
      {"day": 10, "title": "Unit Review", "duration": 30, "description": "Subtraction relay race with stations. Review games and take unit quiz."}
    ],
    "hands_on_activities": [
      {"title": "Subtraction Bowling", "type": "game", "description": "Set up 10 cups as pins. Roll a ball to knock some down. Write: 10 - (knocked down) = (standing). Play 5 rounds.", "materials": ["10 paper cups", "Small ball"]},
      {"title": "Cookie Jar Subtraction", "type": "game", "description": "Put counters in a jar. Take some out. How many left? Use real cookies for extra motivation.", "materials": ["Jar", "Counters or cookies"]},
      {"title": "Number Line Jump Back", "type": "game", "description": "Draw a number line on the floor with tape. Stand on a number, roll a die, jump back that many. Where did you land?", "materials": ["Masking tape", "Marker", "Die"]}
    ],
    "parent_tips": [
      "Connect subtraction to real life: you had 5 grapes, ate 2, how many now?",
      "Some children find subtraction harder than addition - be patient and use objects longer",
      "Fact families help children see the connection between addition and subtraction",
      "Avoid timed tests at this stage - they create anxiety without building understanding"
    ]
  }'::jsonb,
  ARRAY['Solve 10 subtraction facts within 10', 'Solve 5 subtraction word problems', 'Write a complete fact family for given numbers', 'Explain how addition and subtraction are related'],
  '{"struggling": "Stay within 10. Use concrete objects for every problem. Focus on take-away before comparison.", "advanced": "Extend to within 20. Missing number problems: 8 - ? = 3. Multi-step problems.", "english_learners": "Act out every word problem physically. Use visual cues and picture-based problems."}'::jsonb,
  ARRAY['CCSS.MATH.CONTENT.1.OA.A.1', 'CCSS.MATH.CONTENT.1.OA.B.4', 'CCSS.MATH.CONTENT.1.OA.C.6'],
  30
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'Math' AND u.title = 'Subtraction Within 20';

-- ── MATH UNIT 4: Place Value ────────────────────────────────────────────────
INSERT INTO curriculum_teaching_guides (unit_id, title, objectives, materials, instruction_plan, assessment_ideas, differentiation, standards, duration_minutes)
SELECT u.id,
  'Teaching Guide: Place Value',
  ARRAY['Understand tens and ones', 'Represent two-digit numbers with base-10 blocks', 'Compare two-digit numbers using greater than and less than', 'Count by tens to 100'],
  ARRAY['Base-10 blocks (tens rods and ones cubes)', 'Place value chart', 'Rubber bands and craft sticks', 'Dry-erase boards', 'Hundreds chart'],
  '{
    "daily_lessons": [
      {"day": 1, "title": "Bundling into Tens", "duration": 30, "description": "Give child 30+ craft sticks. Bundle groups of 10 with rubber bands. How many bundles of 10? How many left over?"},
      {"day": 2, "title": "Place Value Chart", "duration": 30, "description": "Draw a tens/ones chart. Show that 14 is 1 ten and 4 ones. Build numbers with base-10 blocks and record on chart."},
      {"day": 3, "title": "Representing Numbers", "duration": 30, "description": "Say a number (e.g., 27). Child builds it with blocks: 2 tens rods and 7 ones cubes. Repeat with 10 different numbers."},
      {"day": 4, "title": "Reading Two-Digit Numbers", "duration": 30, "description": "Build a number with blocks, child reads it. Then say a number, child builds it. Practice back and forth."},
      {"day": 5, "title": "Comparing Numbers", "duration": 30, "description": "Build two numbers with blocks side by side. Which has more tens? Use words greater than, less than, equal to. Introduce alligator mouth symbols > < =."},
      {"day": 6, "title": "Counting by 10s", "duration": 30, "description": "10, 20, 30... to 100. Use the hundreds chart. Add a tens rod each time you count. Sing a skip counting song."},
      {"day": 7, "title": "Ordering Numbers", "duration": 30, "description": "Give 5 number cards. Put them in order least to greatest. Then greatest to least. Use the number line to check."},
      {"day": 8, "title": "Unit Review", "duration": 30, "description": "Place Value Bingo game. Build mystery numbers from clues (I have 3 tens and 7 ones - what am I?). Take unit quiz."}
    ],
    "hands_on_activities": [
      {"title": "Stick Bundling", "type": "craft", "description": "Bundle craft sticks into groups of 10. Build numbers by combining bundles and loose sticks. Great tactile learning.", "materials": ["Craft sticks", "Rubber bands"]},
      {"title": "Place Value Bingo", "type": "game", "description": "Make bingo cards with two-digit numbers. Call out tens and ones: 4 tens and 2 ones. Find 42 on your card.", "materials": ["Bingo cards", "Markers"]},
      {"title": "Human Place Value", "type": "game", "description": "Child holds number cards in tens and ones positions. Change the ones card - how did the number change?", "materials": ["Large number cards 0-9"]}
    ],
    "parent_tips": [
      "Use real objects to show grouping by 10 - this concept is foundational for all future math",
      "The alligator mouth (greater than sign) always opens toward the bigger number",
      "Practice skip counting by 10s during daily routines (climbing stairs, driving)",
      "If your child struggles, spend extra time here - place value underlies everything in math"
    ]
  }'::jsonb,
  ARRAY['Represent 5 numbers with base-10 blocks', 'Compare 5 pairs of two-digit numbers correctly', 'Count by 10s to 100', 'Identify tens and ones digits in any two-digit number'],
  '{"struggling": "Start with numbers under 20 only. Use only physical manipulatives, no abstract. Bundle real objects.", "advanced": "Extend to three-digit numbers. Introduce counting by 5s. Add and subtract 10 from any number mentally.", "english_learners": "Use visual place value mats with clear labels. Pair number words with the written numeral and block representation."}'::jsonb,
  ARRAY['CCSS.MATH.CONTENT.1.NBT.B.2', 'CCSS.MATH.CONTENT.1.NBT.B.3', 'CCSS.MATH.CONTENT.1.NBT.C.5'],
  30
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'Math' AND u.title = 'Place Value';

-- ── MATH UNIT 5: Measurement and Data ───────────────────────────────────────
INSERT INTO curriculum_teaching_guides (unit_id, title, objectives, materials, instruction_plan, assessment_ideas, differentiation, standards, duration_minutes)
SELECT u.id,
  'Teaching Guide: Measurement and Data',
  ARRAY['Measure lengths using non-standard units', 'Tell time to the hour on an analog clock', 'Organize and interpret simple data', 'Compare lengths of objects'],
  ARRAY['Ruler', 'Paper clips for measuring', 'Teaching clock with movable hands', 'Objects of different lengths', 'Graph paper', 'Crayons'],
  '{
    "daily_lessons": [
      {"day": 1, "title": "Comparing Lengths", "duration": 30, "description": "Find objects around the house. Which is longer? Line them up end to end. Use words: longer, shorter, taller, the same as."},
      {"day": 2, "title": "Measuring with Paper Clips", "duration": 30, "description": "Measure objects using paper clips as a unit. Your book is 8 paper clips long. Record measurements."},
      {"day": 3, "title": "Measuring with Cubes", "duration": 30, "description": "Use connecting cubes to measure. Compare: the table is 12 cubes but only 6 paper clips. Why the difference? Unit size matters."},
      {"day": 4, "title": "Introduction to Rulers", "duration": 30, "description": "Show a ruler. Line up the zero with the edge of the object. Read the measurement. Practice with 5 objects."},
      {"day": 5, "title": "Telling Time to the Hour", "duration": 30, "description": "Use a teaching clock. The short hand points to the hour. Show 1 o-clock, 2 o-clock, etc. Practice reading times."},
      {"day": 6, "title": "Telling Time Practice", "duration": 30, "description": "Set the clock, child reads the time. Say a time, child sets the clock. Connect to daily schedule: we eat lunch at 12."},
      {"day": 7, "title": "Collecting Data", "duration": 30, "description": "Survey family: what is your favorite color? Record answers with tally marks. Count the tallies."},
      {"day": 8, "title": "Making Bar Graphs", "duration": 30, "description": "Turn tally data into a bar graph on graph paper. Color one square per vote. Which has the most? The least?"},
      {"day": 9, "title": "Reading Graphs", "duration": 30, "description": "Look at example graphs. Answer questions: how many chose blue? How many more chose red than green?"},
      {"day": 10, "title": "Unit Review", "duration": 30, "description": "Measure Everything Day: measure 10 objects with a ruler. Make a clock from a paper plate. Take unit quiz."}
    ],
    "hands_on_activities": [
      {"title": "Measure Everything Day", "type": "game", "description": "Measure 10 household items with paper clips AND a ruler. Record both measurements. Compare results.", "materials": ["Paper clips", "Ruler", "Recording sheet"]},
      {"title": "Paper Plate Clock", "type": "craft", "description": "Make a clock from a paper plate. Write numbers 1-12. Attach movable hands with a brass fastener. Practice telling time.", "materials": ["Paper plate", "Markers", "Brass fastener", "Cardstock for hands"]},
      {"title": "Family Survey Graph", "type": "game", "description": "Pick a question (favorite animal, ice cream flavor). Survey everyone you can. Make a big colorful bar graph poster.", "materials": ["Large paper", "Markers", "Stickers"]}
    ],
    "parent_tips": [
      "Make time-telling part of daily routine: What time is it now? When do we eat dinner?",
      "Measurement is very hands-on - let kids measure everything they want to",
      "Non-standard units (paper clips, cubes) teach the concept before rulers add complexity",
      "Connect data collection to real decisions: we will make the flavor most people voted for"
    ]
  }'::jsonb,
  ARRAY['Measure 3 objects with a ruler', 'Tell time to the hour for 5 clock faces', 'Read and answer questions about a bar graph', 'Compare the lengths of 3 objects'],
  '{"struggling": "Focus on comparing (longer/shorter) before measuring. Use only one unit type. Limit time to on-the-hour only.", "advanced": "Introduce half-hours. Measure in inches. Create two-question surveys and double bar graphs.", "english_learners": "Use visual comparison mats. Pair time vocabulary with daily schedule pictures."}'::jsonb,
  ARRAY['CCSS.MATH.CONTENT.1.MD.A.1', 'CCSS.MATH.CONTENT.1.MD.B.3', 'CCSS.MATH.CONTENT.1.MD.C.4'],
  30
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'Math' AND u.title = 'Measurement and Data';

-- ── MATH UNIT 6: Geometry ───────────────────────────────────────────────────
INSERT INTO curriculum_teaching_guides (unit_id, title, objectives, materials, instruction_plan, assessment_ideas, differentiation, standards, duration_minutes)
SELECT u.id,
  'Teaching Guide: Geometry',
  ARRAY['Identify 2D shapes (circles, triangles, rectangles, squares, hexagons)', 'Identify 3D shapes (cubes, cones, cylinders, spheres)', 'Compose shapes to create new shapes', 'Partition circles and rectangles into halves and quarters'],
  ARRAY['Shape blocks or pattern blocks', 'Construction paper', 'Scissors', 'Real 3D objects (cans, balls, boxes)', 'Play-Doh or clay'],
  '{
    "daily_lessons": [
      {"day": 1, "title": "2D Shape Identification", "duration": 30, "description": "Show circle, square, triangle, rectangle, hexagon. Name attributes: how many sides? How many corners? Sort shape blocks."},
      {"day": 2, "title": "Shape Hunt", "duration": 30, "description": "Walk around the house finding shapes. Door = rectangle. Clock = circle. Record findings with drawings."},
      {"day": 3, "title": "3D Shapes", "duration": 30, "description": "Show real objects: ball = sphere, can = cylinder, box = cube, cone = party hat. Feel edges, faces, vertices."},
      {"day": 4, "title": "Building with Shapes", "duration": 30, "description": "Use pattern blocks to create pictures. How many triangles make a hexagon? Combine shapes to make new ones."},
      {"day": 5, "title": "Symmetry", "duration": 30, "description": "Fold paper in half. Cut a shape from the fold. Open it up - both sides match! Find symmetrical objects around the house."},
      {"day": 6, "title": "Halves and Quarters", "duration": 30, "description": "Cut paper circles and rectangles into 2 equal parts (halves) and 4 equal parts (quarters). Share a snack equally."},
      {"day": 7, "title": "Shape Art Project", "duration": 30, "description": "Create a picture using only shapes: triangle roof, rectangle door, circle sun. Glue shapes on paper."},
      {"day": 8, "title": "Unit Review", "duration": 30, "description": "Shape sorting relay. 3D shape scavenger hunt. Fraction pizza game. Take unit quiz."}
    ],
    "hands_on_activities": [
      {"title": "Shape Collage Art", "type": "craft", "description": "Cut shapes from colored paper and arrange them into a picture (house, robot, animal). Label each shape used.", "materials": ["Construction paper", "Scissors", "Glue", "Markers"]},
      {"title": "3D Shape Sculptures", "type": "craft", "description": "Use Play-Doh to make spheres, cubes, cylinders, and cones. Compare to real objects. Stack them to build structures.", "materials": ["Play-Doh or clay"]},
      {"title": "Fraction Pizza Party", "type": "game", "description": "Cut paper circles into halves and quarters. Decorate as pizza slices. Practice: if we eat 1 quarter, how many are left?", "materials": ["Paper plates", "Markers", "Scissors"]}
    ],
    "parent_tips": [
      "Shapes are everywhere - point them out during daily life to build recognition",
      "Let children handle real 3D objects, not just pictures",
      "Fractions start with equal sharing - split snacks, fold paper, cut sandwiches",
      "Pattern blocks are one of the best math manipulatives - they are worth buying"
    ]
  }'::jsonb,
  ARRAY['Identify and name 6 different shapes', 'Describe attributes (sides, corners) of 3 shapes', 'Partition a circle into halves and quarters', 'Identify 3 real-world 3D shapes'],
  '{"struggling": "Focus on 4 basic shapes first (circle, square, triangle, rectangle). Use large shape cutouts to trace. Skip quarters, focus on halves.", "advanced": "Introduce more shapes (trapezoid, rhombus). Explore thirds. Build complex composite shapes.", "english_learners": "Use shape names in both languages. Physical shape sorting with labels. Match shapes to real objects."}'::jsonb,
  ARRAY['CCSS.MATH.CONTENT.1.G.A.1', 'CCSS.MATH.CONTENT.1.G.A.2', 'CCSS.MATH.CONTENT.1.G.A.3'],
  30
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'Math' AND u.title = 'Geometry';

-- ── MATH UNITS 7 & 8 (Word Problems, Review) ───────────────────────────────
INSERT INTO curriculum_teaching_guides (unit_id, title, objectives, materials, instruction_plan, assessment_ideas, differentiation, standards, duration_minutes)
SELECT u.id, 'Teaching Guide: ' || u.title,
  CASE u.title
    WHEN 'Word Problems' THEN ARRAY['Solve addition and subtraction word problems within 20', 'Use drawings and equations to represent problems', 'Identify whether a problem needs addition or subtraction', 'Write number sentences for word problems']
    ELSE ARRAY['Review all major first grade math concepts', 'Demonstrate mastery of addition and subtraction within 20', 'Show understanding of place value, measurement, and geometry', 'Build confidence for second grade math']
  END,
  ARRAY['Dry-erase boards', 'Counting objects', 'Drawing paper', 'Number line', 'All previously used materials'],
  CASE u.title
    WHEN 'Word Problems' THEN '{
      "daily_lessons": [
        {"day": 1, "title": "Acting Out Problems", "duration": 30, "description": "Read a word problem aloud. Use toys to act it out. Then draw what happened. Finally write the equation."},
        {"day": 2, "title": "Drawing to Solve", "duration": 30, "description": "Draw circles or sticks to represent objects in the problem. Cross out for subtraction. Circle groups for addition."},
        {"day": 3, "title": "Writing Equations from Stories", "duration": 30, "description": "Read a story. Find the numbers. Decide: add or subtract? Write the equation. Solve."},
        {"day": 4, "title": "Add or Subtract?", "duration": 30, "description": "Key words: altogether, total, in all = add. Left, remaining, fewer = subtract. Practice identifying operations."},
        {"day": 5, "title": "Creating Word Problems", "duration": 30, "description": "Child writes their own word problems using their name, friends, and interests. Illustrate and solve each one."},
        {"day": 6, "title": "Two-Step Problems", "duration": 30, "description": "For a challenge: You had 5 apples. Got 3 more. Then ate 2. How many now? Break into two equations."},
        {"day": 7, "title": "Word Problem Book", "duration": 30, "description": "Create a mini-book of 5 original word problems with illustrations and solutions. Great portfolio piece."},
        {"day": 8, "title": "Unit Review", "duration": 30, "description": "Solve 8 mixed word problems. Play Word Problem Theater - act out and solve. Take unit quiz."}
      ],
      "hands_on_activities": [
        {"title": "Word Problem Theater", "type": "game", "description": "Act out word problems with stuffed animals or action figures. Parent reads the problem, child acts it out and solves.", "materials": ["Stuffed animals or toys"]},
        {"title": "Create-a-Problem Book", "type": "craft", "description": "Fold paper into a mini-book. Write and illustrate 5 original word problems. Great for showing understanding.", "materials": ["Paper", "Stapler", "Crayons", "Pencil"]},
        {"title": "Grocery Store Math", "type": "game", "description": "Set up a pretend store with price tags (under 20). Buy 2 items and add the prices. Great real-world practice.", "materials": ["Items from around the house", "Price tag stickers", "Play money"]}
      ],
      "parent_tips": [
        "Use your child''s name and interests in word problems to boost engagement",
        "The progression is: act it out, draw it, write the equation. Do not skip steps.",
        "Having children create their own problems shows deep understanding",
        "Do not worry about spelling in their written problems - focus on the math"
      ]
    }'::jsonb
    ELSE '{
      "daily_lessons": [
        {"day": 1, "title": "Number Review Games", "duration": 30, "description": "Review counting, number recognition, and writing through fun relay races and partner games."},
        {"day": 2, "title": "Addition and Subtraction Review", "duration": 30, "description": "Mixed fact practice with games: addition war, subtraction bowling, fact family triangles."},
        {"day": 3, "title": "Place Value Review", "duration": 30, "description": "Build numbers with base-10 blocks. Compare numbers. Skip count by 10s. Place Value Bingo."},
        {"day": 4, "title": "Measurement Challenge", "duration": 30, "description": "Measure objects around the house. Read clocks. Create a graph from a family survey."},
        {"day": 5, "title": "Geometry Art Project", "duration": 30, "description": "Create a shape masterpiece using all the shapes learned. Label each shape. Cut halves and quarters."},
        {"day": 6, "title": "Math Olympics", "duration": 30, "description": "Set up stations for each math skill. Rotate through them. Earn points. Celebrate achievements."},
        {"day": 7, "title": "Year-End Assessment", "duration": 30, "description": "Comprehensive practice test covering all units. No pressure - this shows how much they have grown."},
        {"day": 8, "title": "Celebration Day", "duration": 30, "description": "Math party! Review what was learned this year. Present math portfolio. Award a certificate of completion."}
      ],
      "hands_on_activities": [
        {"title": "Math Olympics", "type": "game", "description": "Set up 6 stations: counting, addition, subtraction, place value, measurement, geometry. Rotate through each.", "materials": ["All math manipulatives", "Timer", "Score sheet"]},
        {"title": "Math Portfolio", "type": "craft", "description": "Collect best work from each unit into a portfolio binder. Add a cover page. Great keepsake.", "materials": ["Binder or folder", "Saved work from the year"]},
        {"title": "Certificate Ceremony", "type": "craft", "description": "Print or make a Grade 1 Math Completion certificate. Celebrate growth and effort.", "materials": ["Certificate template", "Stickers", "Special treat"]}
      ],
      "parent_tips": [
        "Focus on celebrating what they learned, not what they have not mastered yet",
        "Review should feel like fun games, not stressful tests",
        "The portfolio shows growth over the year - compare early work to recent work",
        "Any areas of weakness will be revisited in Grade 2 - do not stress"
      ]
    }'::jsonb
  END,
  ARRAY['Solve mixed word problems', 'Write and solve original problems', 'Demonstrate mastery across all units'],
  '{"struggling": "Use concrete objects for every problem. Read problems aloud multiple times. Focus on one operation at a time.", "advanced": "Multi-step problems. Create problems for a partner to solve. Mental math challenges.", "english_learners": "Visual word problem mats. Key word charts in both languages. Act out every problem."}'::jsonb,
  ARRAY['CCSS.MATH.CONTENT.1.OA.A.1', 'CCSS.MATH.CONTENT.1.OA.A.2'],
  30
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'Math' AND u.title IN ('Word Problems', 'Review and Assessment');

-- ── ENGLISH UNIT 1: Letter Recognition ──────────────────────────────────────
INSERT INTO curriculum_teaching_guides (unit_id, title, objectives, materials, instruction_plan, assessment_ideas, differentiation, standards, duration_minutes)
SELECT u.id,
  'Teaching Guide: Letter Recognition',
  ARRAY['Identify all 26 uppercase and lowercase letters', 'Associate letters with their sounds', 'Write all letters legibly', 'Put letters in alphabetical order'],
  ARRAY['Alphabet chart', 'Letter magnets', 'Letter tracing worksheets', 'Sandpaper letters or tactile cards', 'Alphabet books', 'Dry-erase boards', 'Play-Doh'],
  '{
    "daily_lessons": [
      {"day": 1, "title": "Alphabet Song and Chart", "duration": 30, "description": "Sing the ABC song while pointing to each letter on the chart. Point to random letters and name them."},
      {"day": 2, "title": "Uppercase Letter Hunt", "duration": 30, "description": "Find uppercase letters around the house: cereal boxes, mail, books. Make a letter collage by cutting letters from magazines."},
      {"day": 3, "title": "Lowercase Letters", "duration": 30, "description": "Match uppercase to lowercase using letter cards. Focus on tricky pairs: b/d, p/q, g/q."},
      {"day": 4, "title": "Letter Sounds A-M", "duration": 30, "description": "Each letter makes a sound. A says ah as in apple. Practice first 13 letters with picture cards."},
      {"day": 5, "title": "Letter Sounds N-Z", "duration": 30, "description": "Continue with remaining letters. Play I Spy with letter sounds: I spy something that starts with sss."},
      {"day": 6, "title": "Writing Letters A-M", "duration": 30, "description": "Practice writing on dry-erase boards. Trace first, then freehand. Use big arm movements before small pencil writing."},
      {"day": 7, "title": "Writing Letters N-Z", "duration": 30, "description": "Continue writing practice. Roll Play-Doh into letter shapes for tactile learning."},
      {"day": 8, "title": "Alphabetical Order", "duration": 30, "description": "Put letter cards in order. Sing the song to check. Find a letter - what comes before? What comes after?"},
      {"day": 9, "title": "Letter Assessment Games", "duration": 30, "description": "Letter Bingo. Alphabet Scavenger Hunt. Letter Sound Matching. Review tricky letters."},
      {"day": 10, "title": "Unit Celebration", "duration": 30, "description": "Read an alphabet book together. Make an ABC mini-book with drawings for each letter. Take letter recognition quiz."}
    ],
    "hands_on_activities": [
      {"title": "Letter Magazine Collage", "type": "craft", "description": "Cut letters from magazines and newspapers. Sort them into alphabet order. Glue onto a large poster.", "materials": ["Magazines", "Scissors", "Glue", "Large paper"]},
      {"title": "Play-Doh Letters", "type": "craft", "description": "Roll Play-Doh into snakes and form each letter. Great for kinesthetic learners and fine motor development.", "materials": ["Play-Doh"]},
      {"title": "Alphabet Scavenger Hunt", "type": "game", "description": "Find something in the house that starts with each letter: A = apple, B = book, C = cup. How many can you find?", "materials": ["Alphabet checklist"]}
    ],
    "parent_tips": [
      "Focus on lowercase letters since that is what children read most in books",
      "Do not worry about perfect handwriting - legibility is the goal at this age",
      "Letter reversals (writing b as d) are normal through age 7",
      "Read alphabet books daily - the repetition builds automatic recognition"
    ]
  }'::jsonb,
  ARRAY['Identify all 26 uppercase letters', 'Identify all 26 lowercase letters', 'Name the sound for 20+ letters', 'Write first and last name correctly'],
  '{"struggling": "Focus on 5-8 letters at a time. Use multisensory techniques: trace in sand, form with clay, write in shaving cream.", "advanced": "Introduce digraphs (sh, ch, th). Begin blending CVC words. Start a sight word list.", "english_learners": "Connect English letters to home language alphabet. Focus on sounds not letter names first."}'::jsonb,
  ARRAY['CCSS.ELA-LITERACY.RF.1.1', 'CCSS.ELA-LITERACY.RF.1.2'],
  30
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'English' AND u.title = 'Letter Recognition';

-- ── ENGLISH UNITS 2-8 (batch insert for remaining English units) ────────────
INSERT INTO curriculum_teaching_guides (unit_id, title, objectives, materials, instruction_plan, assessment_ideas, differentiation, standards, duration_minutes)
SELECT u.id, 'Teaching Guide: ' || u.title,
  CASE u.title
    WHEN 'Phonics and Word Families' THEN ARRAY['Blend consonant-vowel-consonant (CVC) words', 'Identify short vowel sounds', 'Read word families (-at, -an, -ig, -op, -ug)', 'Sound out unfamiliar words']
    WHEN 'Sight Words' THEN ARRAY['Read 50+ high-frequency sight words automatically', 'Write common sight words from memory', 'Use sight words in simple sentences', 'Build reading fluency']
    WHEN 'Reading Comprehension' THEN ARRAY['Identify the main idea of a story', 'Recall key details (who, what, where, when)', 'Make predictions about what will happen next', 'Retell a story in order']
    WHEN 'Writing Sentences' THEN ARRAY['Write complete sentences with capitals and periods', 'Use finger spaces between words', 'Write about a topic using 2-3 sentences', 'Use inventive spelling for unknown words']
    WHEN 'Grammar Basics' THEN ARRAY['Identify nouns (person, place, thing)', 'Identify action verbs', 'Use adjectives to describe', 'Understand singular and plural nouns']
    WHEN 'Stories and Poetry' THEN ARRAY['Identify story elements (characters, setting, events)', 'Recognize and create rhyming words', 'Listen to and retell stories', 'Begin to write simple stories']
    ELSE ARRAY['Review all Grade 1 ELA skills', 'Demonstrate reading growth', 'Complete writing portfolio', 'Celebrate learning achievements']
  END,
  ARRAY['Decodable readers', 'Sight word flash cards', 'Picture books', 'Writing journals', 'Dry-erase boards', 'Sentence strips', 'Word cards', 'Drawing supplies'],
  (CASE u.title
    WHEN 'Phonics and Word Families' THEN '{
      "daily_lessons": [
        {"day": 1, "title": "Short A Words", "duration": 30, "description": "Introduce the short a sound. Build words: cat, hat, bat, mat, sat. Read the -at family."},
        {"day": 2, "title": "Short I Words", "duration": 30, "description": "Short i sound. Build: pig, big, dig, wig, fig. Use magnetic letters to swap beginning sounds."},
        {"day": 3, "title": "Short O Words", "duration": 30, "description": "Short o sound. Build: hop, mop, top, pop, stop. Notice the pattern: same ending, different beginning."},
        {"day": 4, "title": "Short U Words", "duration": 30, "description": "Short u sound. Build: bug, rug, hug, mug, tug. Play rhyming games with word families."},
        {"day": 5, "title": "Short E Words", "duration": 30, "description": "Short e sound. Build: bed, red, fed, led, pet, set. Read a decodable book with short e words."},
        {"day": 6, "title": "Blending CVC Words", "duration": 30, "description": "Stretch out sounds: c-a-t. Blend them together: cat! Practice with 10 new words. Use letter tiles."},
        {"day": 7, "title": "Word Family Wheels", "duration": 30, "description": "Make spinning word family wheels. Inner circle has beginning letters, outer ring has the ending. Spin and read."},
        {"day": 8, "title": "Decodable Book Reading", "duration": 30, "description": "Read a Bob Books or similar decodable reader. Sound out each word. Celebrate reading a whole book."},
        {"day": 9, "title": "Mixed Word Families", "duration": 30, "description": "Mix all word families together. Sort words by family. Read mixed lists. Play word family bingo."},
        {"day": 10, "title": "Unit Review", "duration": 30, "description": "Phonics relay race. Read 3 decodable books. Take phonics assessment."}
      ],
      "hands_on_activities": [
        {"title": "Word Family Wheels", "type": "craft", "description": "Cut two circles of different sizes. Write word endings on the big circle and beginning letters on the small one. Pin together and spin to make words.", "materials": ["Cardstock", "Brass fastener", "Markers"]},
        {"title": "Magnetic Letter Word Building", "type": "game", "description": "Use magnetic letters on the fridge. Build a word, then swap the first letter to make a new word. How many can you make?", "materials": ["Magnetic letters", "Magnetic surface"]},
        {"title": "Phonics Bingo", "type": "game", "description": "Make bingo cards with CVC words. Call out the word slowly (sound by sound). Child finds and covers the word.", "materials": ["Bingo cards with CVC words", "Counters"]}
      ],
      "parent_tips": ["Decodable books (not regular picture books) are essential for reading practice at this stage", "Let your child sound out words even if it is slow - resist the urge to tell them the word", "Word families help children see patterns in reading and spelling", "5-10 minutes of phonics practice daily is more effective than one long session"]
    }'
    WHEN 'Sight Words' THEN '{
      "daily_lessons": [
        {"day": 1, "title": "First 5 Sight Words", "duration": 30, "description": "Introduce: the, and, a, to, is. Read them, spell them, write them, find them in a book."},
        {"day": 2, "title": "Practice and Add 5 More", "duration": 30, "description": "Review first 5. Add: I, it, in, was, for. Use flash cards for rapid recognition practice."},
        {"day": 3, "title": "Sight Word Sentences", "duration": 30, "description": "Build simple sentences with word cards: I can see the cat. Rearrange words to make new sentences."},
        {"day": 4, "title": "Sight Word Games", "duration": 30, "description": "Play Memory Match with sight words. Sight Word Hopscotch outside. Sight Word Go Fish card game."},
        {"day": 5, "title": "Add 5 More Words", "duration": 30, "description": "Review all 10 words. Add: he, she, you, we, they. Practice reading them in sentences."},
        {"day": 6, "title": "Sight Word Writing", "duration": 30, "description": "Write each sight word 3 times. Use rainbow writing: write in red, trace in blue, trace in green."},
        {"day": 7, "title": "Reading Fluency Practice", "duration": 30, "description": "Read sight word sentences and simple books. Focus on smooth, not choppy, reading."},
        {"day": 8, "title": "Add 5 More Words", "duration": 30, "description": "Add: said, have, are, but, not. Review all 20. Timed flash card practice (no pressure, just for fun)."},
        {"day": 9, "title": "Sight Word Stories", "duration": 30, "description": "Read a simple reader full of sight words. Highlight or circle sight words you know. Count them."},
        {"day": 10, "title": "Unit Review", "duration": 30, "description": "Sight Word Bingo. Flash card assessment. Read a book and count how many sight words are recognized."}
      ],
      "hands_on_activities": [
        {"title": "Sight Word Bingo", "type": "game", "description": "Create bingo cards with sight words. Call out words and child covers them. Five in a row wins!", "materials": ["Bingo cards", "Counters"]},
        {"title": "Sight Word Hopscotch", "type": "outdoor", "description": "Write sight words in chalk squares outside. Hop to each word and read it aloud.", "materials": ["Sidewalk chalk"]},
        {"title": "Rainbow Writing", "type": "craft", "description": "Write each sight word in pencil, then trace over it in 3 different colors. Beautiful and builds muscle memory.", "materials": ["Paper", "Colored pencils or crayons"]}
      ],
      "parent_tips": ["Practice 3-5 new words per week while reviewing old ones daily", "Make it a game not a drill - if it feels like work, try a different approach", "Sight words must be memorized by shape, not sounded out", "Post sight words around the house on sticky notes for constant exposure"]
    }'
    WHEN 'Reading Comprehension' THEN '{
      "daily_lessons": [
        {"day": 1, "title": "Who, What, Where", "duration": 30, "description": "Read a picture book. Ask: Who is the story about? What happened? Where does it take place?"},
        {"day": 2, "title": "Main Idea", "duration": 30, "description": "Read a short story. Ask: What is this story mostly about? Say it in one sentence."},
        {"day": 3, "title": "Making Predictions", "duration": 30, "description": "Before reading: look at the cover and pictures. What do you think will happen? Read to find out."},
        {"day": 4, "title": "Retelling a Story", "duration": 30, "description": "After reading, retell the story: First... Then... Next... Finally. Use story map graphic organizer."},
        {"day": 5, "title": "Story Elements", "duration": 30, "description": "Characters, setting, problem, solution. Read a book and identify all four elements."},
        {"day": 6, "title": "Connections", "duration": 30, "description": "Text-to-self: Has anything like this happened to you? Text-to-text: Does this remind you of another book?"},
        {"day": 7, "title": "Asking Questions While Reading", "duration": 30, "description": "Teach children to wonder while reading. Why did the character do that? What will happen next?"},
        {"day": 8, "title": "Puppet Show Retelling", "duration": 30, "description": "After reading a favorite book, retell it using puppets or stuffed animals. Great for comprehension and fun."},
        {"day": 9, "title": "Nonfiction Comprehension", "duration": 30, "description": "Read a simple nonfiction book. What did you learn? What was the most interesting fact?"},
        {"day": 10, "title": "Unit Review", "duration": 30, "description": "Read a new book and answer comprehension questions independently. Complete story map. Take assessment."}
      ],
      "hands_on_activities": [
        {"title": "Story Map Drawing", "type": "craft", "description": "Draw the beginning, middle, and end of a story in three boxes. Write one sentence under each drawing.", "materials": ["Paper divided into 3 sections", "Crayons", "Pencil"]},
        {"title": "Puppet Show Retelling", "type": "game", "description": "Make simple stick puppets of book characters. Retell the story using the puppets as actors.", "materials": ["Craft sticks", "Paper", "Tape", "Markers"]},
        {"title": "Book Review Poster", "type": "craft", "description": "Make a poster about a favorite book: title, author, main character, what happened, and a rating (stars).", "materials": ["Large paper", "Markers", "Star stickers"]}
      ],
      "parent_tips": ["Read aloud to your child daily, even after they can read on their own", "Ask open-ended questions, not just yes/no", "Let your child hold the book and turn the pages - it builds ownership", "Re-reading favorite books is great - comprehension deepens with each reading"]
    }'
    WHEN 'Writing Sentences' THEN '{
      "daily_lessons": [
        {"day": 1, "title": "What Is a Sentence?", "duration": 30, "description": "A sentence tells a complete thought. It starts with a capital letter and ends with a period. Model writing 3 sentences."},
        {"day": 2, "title": "Capital Letters and Periods", "duration": 30, "description": "Practice adding capital letters and periods to sentences. Edit sentences that are missing them."},
        {"day": 3, "title": "Finger Spaces", "duration": 30, "description": "Put a finger between words when writing. Practice with 5 sentences. No scrunched up writing!"},
        {"day": 4, "title": "Writing About a Picture", "duration": 30, "description": "Look at a picture. Write 2 sentences about what you see. Draw your own picture and write about it."},
        {"day": 5, "title": "Daily Journal", "duration": 30, "description": "Start a daily journal. Write about what happened today, what you ate, or what you want to do. 2-3 sentences."},
        {"day": 6, "title": "Inventive Spelling", "duration": 30, "description": "Write the sounds you hear in words. If you do not know how to spell a word, try your best. Practice stretching out sounds."},
        {"day": 7, "title": "Writing a Letter", "duration": 30, "description": "Write a letter to a family member. Include greeting, 2-3 sentences, and closing. Mail it for real!"},
        {"day": 8, "title": "How-To Writing", "duration": 30, "description": "Write steps for something: How to make a sandwich. First... Next... Then... Last. Simple procedural writing."},
        {"day": 9, "title": "Opinion Writing", "duration": 30, "description": "Write about a favorite thing: My favorite animal is ___ because ___. Support your opinion with a reason."},
        {"day": 10, "title": "Unit Review", "duration": 30, "description": "Write independently on a topic of choice. Check for capitals, periods, spaces. Celebrate writing growth!"}
      ],
      "hands_on_activities": [
        {"title": "Letter to Grandma", "type": "craft", "description": "Write a real letter to a family member. Decorate the envelope. Walk to the mailbox together.", "materials": ["Paper", "Envelope", "Stamp", "Crayons"]},
        {"title": "Picture Prompt Stories", "type": "craft", "description": "Cut out interesting pictures from magazines. Glue to paper. Write 2 sentences about each picture.", "materials": ["Magazines", "Scissors", "Glue", "Lined paper"]},
        {"title": "Daily Journal", "type": "craft", "description": "Staple paper together to make a journal. Decorate the cover. Write in it every day - even one sentence counts!", "materials": ["Paper", "Stapler", "Pencil", "Crayons"]}
      ],
      "parent_tips": ["Praise the effort and ideas, not spelling perfection", "Inventive spelling is developmentally appropriate and encouraged", "Writing every day builds fluency even if entries are short", "Display their writing on the fridge to show it is valued"]
    }'
    ELSE '{
      "daily_lessons": [
        {"day": 1, "title": "Introduction and Review", "duration": 30, "description": "Begin the unit with an engaging introduction. Connect to prior knowledge and set learning goals."},
        {"day": 2, "title": "Core Concept Exploration", "duration": 30, "description": "Explore the main concept through read-alouds, discussions, and hands-on activities."},
        {"day": 3, "title": "Guided Practice", "duration": 30, "description": "Work together on practice activities. Provide support and feedback as needed."},
        {"day": 4, "title": "Independent Practice", "duration": 30, "description": "Child works independently while parent observes and assists as needed."},
        {"day": 5, "title": "Creative Application", "duration": 30, "description": "Apply learning through a creative project: art, writing, or performance."},
        {"day": 6, "title": "Games and Review", "duration": 30, "description": "Review through fun games and activities. Reinforce key concepts."},
        {"day": 7, "title": "Assessment and Reflection", "duration": 30, "description": "Check understanding through quiz or portfolio work. Reflect on what was learned."},
        {"day": 8, "title": "Extension and Celebration", "duration": 30, "description": "Extend learning for interested students. Celebrate achievements and growth."}
      ],
      "hands_on_activities": [
        {"title": "Creative Project", "type": "craft", "description": "Create a project that demonstrates understanding of the unit concepts.", "materials": ["Art supplies", "Writing materials"]},
        {"title": "Learning Game", "type": "game", "description": "Play a game that reinforces the key skills from this unit.", "materials": ["Game materials as needed"]}
      ],
      "parent_tips": ["Follow your child''s interests within the topic", "Read related books from the library", "Keep sessions short and engaging - 30 minutes is plenty", "Celebrate effort and growth, not just correct answers"]
    }'
  END)::jsonb,
  ARRAY['Demonstrate understanding of unit concepts', 'Complete unit assessment', 'Show growth in skills'],
  '{"struggling": "Slow the pace. Use more hands-on activities. Focus on core skills.", "advanced": "Extend with additional reading and writing challenges. Introduce more complex texts.", "english_learners": "Use visual supports. Build vocabulary with pictures. Allow responses in home language."}'::jsonb,
  ARRAY['CCSS.ELA-LITERACY.RF.1.2', 'CCSS.ELA-LITERACY.RF.1.3', 'CCSS.ELA-LITERACY.W.1.1', 'CCSS.ELA-LITERACY.RL.1.1'],
  30
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'English' AND u.title IN ('Phonics and Word Families', 'Sight Words', 'Reading Comprehension', 'Writing Sentences', 'Grammar Basics', 'Stories and Poetry', 'Review and Assessment');

-- ── SCIENCE UNIT 1: Weather and Seasons ─────────────────────────────────────
INSERT INTO curriculum_teaching_guides (unit_id, title, objectives, materials, instruction_plan, assessment_ideas, differentiation, standards, duration_minutes)
SELECT u.id,
  'Teaching Guide: Weather and Seasons',
  ARRAY['Describe different types of weather (sunny, rainy, cloudy, snowy, windy)', 'Identify the four seasons and their characteristics', 'Use a thermometer to measure temperature', 'Record daily weather observations'],
  ARRAY['Outdoor thermometer', 'Weather chart poster', 'Cotton balls and glue', 'Rain gauge or clear jar with ruler', 'Crayons and drawing paper', 'Weather-related picture books'],
  '{
    "daily_lessons": [
      {"day": 1, "title": "What Is Weather?", "duration": 30, "description": "Go outside. Describe what you see and feel. Is it sunny? Cloudy? Windy? Introduce weather vocabulary."},
      {"day": 2, "title": "Types of Weather", "duration": 30, "description": "Draw pictures of sunny, rainy, cloudy, snowy, windy weather. Discuss what clothing you wear for each."},
      {"day": 3, "title": "Daily Weather Chart", "duration": 30, "description": "Start a weather journal. Each day, look outside and record the weather with a symbol and words."},
      {"day": 4, "title": "Temperature", "duration": 30, "description": "Read an outdoor thermometer. Is it warm or cold? Record the temperature daily. Notice: sunny days are warmer."},
      {"day": 5, "title": "The Four Seasons", "duration": 30, "description": "Spring, summer, fall, winter. What weather happens in each? What do trees look like? What do we wear?"},
      {"day": 6, "title": "Seasons Art", "duration": 30, "description": "Fold paper into 4 sections. Draw the same tree in each season showing different leaves, weather, and activities."},
      {"day": 7, "title": "Clouds", "duration": 30, "description": "Go outside and observe clouds. Learn 3 types: fluffy cumulus, flat stratus, wispy cirrus. Draw what you see."},
      {"day": 8, "title": "Rain in a Jar Experiment", "duration": 30, "description": "Demonstrate the water cycle: boil water, hold ice over steam, watch droplets form and drip. This is how rain works!"},
      {"day": 9, "title": "Wind Exploration", "duration": 30, "description": "Make a pinwheel. Take it outside. Which direction does it spin? Make a wind sock from a paper bag."},
      {"day": 10, "title": "Unit Review", "duration": 30, "description": "Review weather journal. Discuss patterns you noticed. Take weather quiz. Share favorite weather facts."}
    ],
    "science_experiments": [
      {"title": "Rain in a Jar", "description": "Demonstrate how rain forms through condensation. Boil water in a pot, hold a plate of ice cubes above the steam. Watch water droplets form and drip down like rain.", "materials": ["Pot of hot water (adult supervised)", "Plate", "Ice cubes"], "steps": ["Boil water in a pot (adult does this)", "Hold a cold plate with ice cubes above the steam", "Watch water droplets form on the bottom of the plate", "See the drops fall back down - just like rain!"], "what_to_observe": "Droplets forming on the cold plate and dripping down", "discussion_questions": ["Where did the water droplets come from?", "Why did they form on the cold plate?", "How is this like real rain?"]},
      {"title": "DIY Rain Gauge", "description": "Measure rainfall by making your own rain gauge. Place outside before a rainstorm and check the next day.", "materials": ["Clear jar or plastic bottle", "Ruler", "Tape", "Marker"], "steps": ["Tape a ruler to the outside of a clear jar", "Place it outside in an open area before rain", "After the rain, check how much water collected", "Record the measurement in your weather journal"], "what_to_observe": "How much rain fell and how it compares to other days", "discussion_questions": ["Was that a lot of rain or a little?", "What would happen if it rained this much every day?"]},
      {"title": "Pinwheel Wind Tester", "description": "Make a pinwheel to observe wind speed and direction.", "materials": ["Square paper", "Scissors", "Pin", "Pencil with eraser", "Straw"], "steps": ["Cut from each corner toward center (don''t cut all the way)", "Fold alternating corners to center", "Push a pin through all layers and into pencil eraser", "Take outside and observe how it spins in the wind"], "what_to_observe": "How fast it spins on calm vs windy days", "discussion_questions": ["Does it always spin the same direction?", "What makes it spin faster?"]}
    ],
    "hands_on_activities": [
      {"title": "Four Seasons Tree", "type": "craft", "description": "Draw 4 copies of the same tree. Decorate each for a different season: green leaves, flowers, orange leaves, bare branches with snow.", "materials": ["Paper", "Crayons", "Cotton balls for snow", "Tissue paper for leaves"]},
      {"title": "Cloud Watching Journal", "type": "outdoor", "description": "Lie on a blanket and observe clouds. Draw what you see. Try to identify cumulus, stratus, and cirrus clouds.", "materials": ["Blanket", "Drawing journal", "Crayons"]},
      {"title": "Weather Reporter", "type": "game", "description": "Child gives a daily weather report like a TV meteorologist. Report temperature, clouds, wind, and forecast for tomorrow.", "materials": ["Pointer or stick for pointing at weather chart"]}
    ],
    "parent_tips": [
      "Make weather observation a daily morning routine - it takes just 2 minutes",
      "Keep the weather journal going throughout the year to see seasonal changes",
      "The rain experiment requires adult supervision with hot water - make it a special parent-child activity",
      "Connect weather to daily decisions: what should we wear today based on the weather?"
    ]
  }'::jsonb,
  ARRAY['Name 5 types of weather', 'Describe characteristics of all 4 seasons', 'Read a thermometer', 'Record weather observations for a week'],
  '{"struggling": "Focus on 3 weather types first. Use picture cards for matching. Skip thermometer reading.", "advanced": "Research extreme weather (hurricanes, tornadoes). Track weather patterns over a month. Compare weather in different cities.", "english_learners": "Weather picture cards with labels in both languages. Daily weather reporting builds speaking skills."}'::jsonb,
  ARRAY['1-ESS1-2', 'K-ESS2-1'],
  30
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'Science' AND u.title = 'Weather and Seasons';

-- ── SCIENCE UNIT 2: Plants ──────────────────────────────────────────────────
INSERT INTO curriculum_teaching_guides (unit_id, title, objectives, materials, instruction_plan, assessment_ideas, differentiation, standards, duration_minutes)
SELECT u.id,
  'Teaching Guide: Plants',
  ARRAY['Name the parts of a plant (roots, stem, leaves, flower)', 'Explain what plants need to grow (water, sunlight, soil, air)', 'Observe and record plant growth over time', 'Understand seeds and how plants reproduce'],
  ARRAY['Bean seeds or sunflower seeds', 'Small pots or cups', 'Soil', 'Magnifying glass', 'Ruler for measuring', 'Plant parts diagram', 'Garden journal', 'Ziplock bags', 'Paper towels', 'Celery stalk', 'Food coloring'],
  '{
    "daily_lessons": [
      {"day": 1, "title": "Parts of a Plant", "duration": 30, "description": "Look at a real plant. Identify: roots (anchor and drink water), stem (highway for water), leaves (make food from sun), flower (makes seeds)."},
      {"day": 2, "title": "What Do Plants Need?", "duration": 30, "description": "Four things: water, sunlight, soil, air. Set up experiment: plant 2 seeds, one with sun, one without."},
      {"day": 3, "title": "Plant a Seed", "duration": 30, "description": "Plant bean seeds in cups with soil. Water them. Place in sunny window. Start a growth journal."},
      {"day": 4, "title": "Bean in a Bag", "duration": 30, "description": "Put a wet paper towel in a ziplock bag with a bean. Tape to window. Watch roots and sprout appear over days."},
      {"day": 5, "title": "Observing Growth", "duration": 30, "description": "Check plants and bag bean daily. Draw what you see. Measure with a ruler. Record in journal."},
      {"day": 6, "title": "Celery Dye Experiment", "duration": 30, "description": "Put a celery stalk in water with food coloring. Wait a few hours. See colored water travel up the stem into leaves!"},
      {"day": 7, "title": "Seed Investigation", "duration": 30, "description": "Open different seeds (bean, apple, avocado). Look inside with magnifying glass. Find the tiny plant inside."},
      {"day": 8, "title": "Nature Walk", "duration": 30, "description": "Walk outside. Identify plant parts on real plants. Collect different leaves. Press them in a book."},
      {"day": 9, "title": "Plant Life Cycle", "duration": 30, "description": "Seed, sprout, seedling, adult plant, flower, new seeds. Draw the life cycle in a circle. Connect to our growing plants."},
      {"day": 10, "title": "Unit Review", "duration": 30, "description": "Present plant journal. Label plant parts on a diagram. Share experiment results. Take plant quiz."}
    ],
    "science_experiments": [
      {"title": "Bean in a Bag", "description": "Observe seed germination up close by growing a bean in a clear bag taped to a window.", "materials": ["Ziplock bag", "Paper towel", "Bean seed", "Tape", "Water"], "steps": ["Wet a paper towel and fold it into the bag", "Place a bean seed on the towel", "Seal the bag and tape to a sunny window", "Observe daily for 7-10 days", "Draw what you see each day in your journal"], "what_to_observe": "Root growing down first, then stem growing up, then leaves opening", "discussion_questions": ["Which grew first, the root or the stem?", "Why do you think the root grows down?", "What would happen without water?"]},
      {"title": "Sunlight Test", "description": "Test whether plants need sunlight by growing two identical plants in different conditions.", "materials": ["2 cups with soil", "Seeds", "Water", "Dark closet"], "steps": ["Plant seeds in both cups the same way", "Place one in a sunny window", "Place one in a dark closet", "Water both the same amount", "Compare after 1-2 weeks"], "what_to_observe": "The sun plant grows tall and green while the dark plant is pale and weak", "discussion_questions": ["Why does the dark plant look different?", "What does sunlight give plants?"]},
      {"title": "Celery Dye Experiment", "description": "Watch water travel through a plant stem using food coloring.", "materials": ["Fresh celery stalk with leaves", "Cup of water", "Food coloring (red or blue work best)"], "steps": ["Add 10 drops of food coloring to a cup of water", "Cut the bottom of a celery stalk at an angle", "Place celery in the colored water", "Wait 2-4 hours (or overnight)", "Check the leaves for color change"], "what_to_observe": "Colored streaks in the leaves showing the path water travels through the stem", "discussion_questions": ["How did the color get into the leaves?", "What part of the plant carried the water up?"]}
    ],
    "hands_on_activities": [
      {"title": "Plant Parts Collage", "type": "craft", "description": "Draw or cut out pictures of roots, stems, leaves, and flowers. Label each part. Glue onto a large paper plant.", "materials": ["Construction paper", "Scissors", "Glue", "Markers"]},
      {"title": "Garden Planting", "type": "outdoor", "description": "Plant a small garden (even a container garden). Choose fast-growing plants: beans, sunflowers, lettuce. Tend daily.", "materials": ["Seeds", "Soil", "Pots or garden bed", "Water"]},
      {"title": "Leaf Collection and Press", "type": "outdoor", "description": "Collect different leaves on a nature walk. Press between heavy books for a week. Create a leaf identification journal.", "materials": ["Collection bag", "Heavy books", "Paper", "Glue"]}
    ],
    "parent_tips": [
      "Even a small windowsill garden teaches responsibility and patience",
      "The bean bag experiment is the most dramatic - kids love watching roots appear",
      "Take photos of plant growth to compare over time",
      "Connect to food: the vegetables we eat were once tiny seeds just like these"
    ]
  }'::jsonb,
  ARRAY['Label the 4 main parts of a plant', 'List what plants need to grow', 'Record plant growth observations for 2 weeks', 'Describe the plant life cycle'],
  '{"struggling": "Focus on the 4 parts only. Use real plants to touch and see. Draw rather than write observations.", "advanced": "Research unusual plants (Venus flytrap, cactus). Compare monocots and dicots. Start a larger garden project.", "english_learners": "Label plant parts in both languages. Use visual growth charts. Real specimens are better than pictures."}'::jsonb,
  ARRAY['1-LS1-1', '1-LS3-1'],
  30
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'Science' AND u.title = 'Plants';

-- ── SCIENCE UNITS 3-7 (batch insert for remaining Science units) ────────────
INSERT INTO curriculum_teaching_guides (unit_id, title, objectives, materials, instruction_plan, assessment_ideas, differentiation, standards, duration_minutes)
SELECT u.id, 'Teaching Guide: ' || u.title,
  CASE u.title
    WHEN 'Animals' THEN ARRAY['Classify animals by type (mammals, birds, fish, reptiles, insects)', 'Identify basic animal needs (food, water, shelter)', 'Describe different animal habitats', 'Compare animal features and behaviors']
    WHEN 'Earth and Sky' THEN ARRAY['Describe the day and night cycle', 'Identify the sun, moon, and stars', 'Understand that Earth rotates', 'Describe basic properties of rocks and soil']
    WHEN 'Senses and Body' THEN ARRAY['Name and describe the five senses', 'Identify body parts associated with each sense', 'Use senses to make scientific observations', 'Understand basics of staying healthy']
    WHEN 'Push and Pull' THEN ARRAY['Understand that forces make things move', 'Identify pushes and pulls in everyday life', 'Explore how magnets attract and repel', 'Predict how objects will move when a force is applied']
    ELSE ARRAY['Review all Grade 1 science concepts', 'Complete a science fair project', 'Present findings to family', 'Celebrate scientific thinking']
  END,
  ARRAY['Animal picture cards', 'Magnifying glass', 'Flashlight and globe', 'Rock collection', 'Magnets (bar and horseshoe)', 'Toy cars', 'Ramp materials', 'Blindfolds', 'Drawing supplies', 'Science journal'],
  (CASE u.title
    WHEN 'Animals' THEN '{
      "daily_lessons": [
        {"day": 1, "title": "Animal Groups", "duration": 30, "description": "Introduce mammals, birds, fish, reptiles, amphibians, insects. Sort animal picture cards into groups."},
        {"day": 2, "title": "Mammals", "duration": 30, "description": "Mammals have fur/hair, are warm-blooded, feed babies milk. Examples: dog, cat, whale, bat. We are mammals too!"},
        {"day": 3, "title": "Birds, Fish, Reptiles", "duration": 30, "description": "Birds have feathers and lay eggs. Fish have scales and gills. Reptiles have scales and are cold-blooded."},
        {"day": 4, "title": "Insects", "duration": 30, "description": "6 legs, 3 body parts, antenna. Go on a bug hunt with a magnifying glass. Draw what you find."},
        {"day": 5, "title": "Animal Needs", "duration": 30, "description": "All animals need food, water, air, and shelter. Compare what different animals eat (herbivore, carnivore, omnivore)."},
        {"day": 6, "title": "Habitats", "duration": 30, "description": "Where animals live: forest, ocean, desert, arctic, grassland. Match animals to their habitats."},
        {"day": 7, "title": "Habitat Diorama", "duration": 30, "description": "Choose a habitat. Build a diorama in a shoebox with paper animals, painted background, and natural materials."},
        {"day": 8, "title": "Animal Research", "duration": 30, "description": "Pick a favorite animal. Find 5 facts about it. Draw it. Where does it live? What does it eat?"},
        {"day": 9, "title": "Animal Adaptations", "duration": 30, "description": "Why do polar bears have thick fur? Why do fish have gills? Animals are built for where they live."},
        {"day": 10, "title": "Unit Review", "duration": 30, "description": "Present habitat diorama and animal research. Animal sorting game. Take unit quiz."}
      ],
      "hands_on_activities": [
        {"title": "Habitat Diorama", "type": "craft", "description": "Build an animal habitat in a shoebox. Paint the background, add paper animals, and natural materials.", "materials": ["Shoebox", "Paint", "Construction paper", "Glue", "Natural materials"]},
        {"title": "Bug Hunt", "type": "outdoor", "description": "Explore outside with a magnifying glass. Find and observe insects. Draw them in a science journal. Count legs.", "materials": ["Magnifying glass", "Science journal", "Pencil"]},
        {"title": "Animal Sorting Game", "type": "game", "description": "Sort animal cards by group (mammal, bird, fish, reptile, insect), by habitat, or by what they eat.", "materials": ["Animal picture cards", "Sorting mats"]}
      ],
      "parent_tips": ["Visit a local zoo, aquarium, or nature center as a field trip", "Library has great animal books and DVDs", "A pet store visit can teach about animal needs", "Connect to conservation: how can we help animals?"]
    }'
    WHEN 'Earth and Sky' THEN '{
      "daily_lessons": [
        {"day": 1, "title": "Day and Night", "duration": 30, "description": "Why do we have day and night? Use a flashlight and a ball: the light side is day, the dark side is night."},
        {"day": 2, "title": "The Sun", "duration": 30, "description": "The sun is a star that gives us light and heat. NEVER look directly at the sun. Track shadows throughout the day."},
        {"day": 3, "title": "The Moon", "duration": 30, "description": "The moon changes shape! Introduce phases. Start a moon journal: draw the moon shape each night for a month."},
        {"day": 4, "title": "Stars", "duration": 30, "description": "Stars are suns far away. We see them at night. Learn one constellation: the Big Dipper. Go stargazing."},
        {"day": 5, "title": "Earth Rotates", "duration": 30, "description": "Use globe and flashlight. Slowly spin the globe: day turns to night. One full spin = one day."},
        {"day": 6, "title": "Rocks", "duration": 30, "description": "Collect 10 rocks. Sort by color, size, texture, and hardness. Examine with magnifying glass. Start a rock collection."},
        {"day": 7, "title": "Soil Investigation", "duration": 30, "description": "Dig up some soil. What do you see? Soil has tiny rocks, dead leaves, and living things. Compare soil from different spots."},
        {"day": 8, "title": "Soil Layers Experiment", "duration": 30, "description": "Put rocks, sand, soil, and water in a jar. Shake it up. Watch layers settle. Heaviest at bottom!"},
        {"day": 9, "title": "Earth and Sky Art", "duration": 30, "description": "Create a day/night split artwork. One side shows daytime sky, other side shows nighttime with moon and stars."},
        {"day": 10, "title": "Unit Review", "duration": 30, "description": "Present rock collection and moon journal. Day/night demonstration. Take unit quiz."}
      ],
      "science_experiments": [
        {"title": "Day and Night Demonstration", "description": "Show why we have day and night using a flashlight and globe.", "materials": ["Flashlight", "Globe or ball", "Dark room"], "steps": ["Darken the room", "Shine flashlight on the globe (this is the sun)", "Point to where you live on the globe", "Slowly spin the globe", "Watch your location go from light (day) to dark (night)"], "what_to_observe": "Only half the Earth has light at any time", "discussion_questions": ["When it is day where we live, what is it on the other side?", "Why does the sun seem to move across the sky?"]},
        {"title": "Soil Layers in a Jar", "description": "See how different earth materials settle into layers.", "materials": ["Clear jar with lid", "Rocks", "Sand", "Soil", "Water"], "steps": ["Put small rocks in the jar", "Add a layer of sand", "Add a layer of soil", "Fill with water", "Seal and shake vigorously", "Let it sit for an hour and observe layers"], "what_to_observe": "Heavy rocks settle first, then sand, then soil, with water on top", "discussion_questions": ["Why did the rocks sink to the bottom?", "What does this tell us about how Earth layers formed?"]}
      ],
      "parent_tips": ["Nighttime observation is magical for kids - even 10 minutes of stargazing counts", "Moon phase tracking teaches patience and observation skills over weeks", "Rock collecting is a hobby many kids love - get a magnifying glass", "The flashlight/globe demo is one of the most effective science demonstrations for this age"]
    }'
    WHEN 'Senses and Body' THEN '{
      "daily_lessons": [
        {"day": 1, "title": "The Five Senses", "duration": 30, "description": "See, hear, smell, taste, touch. Name the body part for each sense. Play I spy using each sense."},
        {"day": 2, "title": "Sight Exploration", "duration": 30, "description": "Use a magnifying glass to look at things up close. Play color matching games. What can you see that I cannot?"},
        {"day": 3, "title": "Hearing Exploration", "duration": 30, "description": "Close eyes and identify sounds. Go on a listening walk outside. How many different sounds can you count?"},
        {"day": 4, "title": "Smell and Taste Tests", "duration": 30, "description": "Blindfolded smell test: vanilla, lemon, cinnamon, soap. Taste test: sweet, salty, sour, bitter. Record reactions."},
        {"day": 5, "title": "Touch Exploration", "duration": 30, "description": "Mystery bag: reach in and describe the texture. Smooth, rough, bumpy, soft, hard. Guess the object by touch alone."},
        {"day": 6, "title": "Body Parts", "duration": 30, "description": "Trace your body on a large paper. Label major body parts. Discuss what each part does."},
        {"day": 7, "title": "Staying Healthy", "duration": 30, "description": "Healthy habits: hand washing, brushing teeth, eating fruits and vegetables, exercise, sleep. Make a healthy habits chart."},
        {"day": 8, "title": "Five Senses Walk", "duration": 30, "description": "Go for a walk using ALL senses. Record 2 things you saw, heard, smelled, touched, and tasted (like fresh air)."},
        {"day": 9, "title": "Senses Science Fair", "duration": 30, "description": "Set up 5 sense stations for family. Each station tests a different sense. Child leads the experiments."},
        {"day": 10, "title": "Unit Review", "duration": 30, "description": "Review all senses with games. Present healthy habits chart. Take unit quiz."}
      ],
      "science_experiments": [
        {"title": "Mystery Smell Test", "description": "Test the sense of smell by identifying scents while blindfolded.", "materials": ["Blindfold", "Small cups", "Various scented items: vanilla extract, lemon, cinnamon, coffee, soap, peppermint"], "steps": ["Blindfold the child", "Hold each scent near their nose", "Ask them to describe and guess what it is", "Record correct and incorrect guesses", "Remove blindfold and reveal answers"], "what_to_observe": "Which scents were easiest to identify and which were hardest", "discussion_questions": ["Which sense did you use?", "Can you think of a time when smell warned you of danger?", "Why is smell important?"]},
        {"title": "Texture Touch Bag", "description": "Identify objects using only the sense of touch.", "materials": ["Paper bag or pillowcase", "Various textured objects: cotton ball, rock, sandpaper, silk, sponge, coin, pinecone"], "steps": ["Place objects in the bag without child seeing", "Child reaches in and feels one object", "Describe the texture: smooth, rough, bumpy, soft, hard", "Guess what it is before pulling it out", "Record guesses and results"], "what_to_observe": "How well can we identify objects without seeing them", "discussion_questions": ["Which textures were easiest to guess?", "Could you tell the difference between similar objects?", "When might you need to identify things by touch?"]}
      ],
      "parent_tips": ["The senses unit is super fun - lean into messy, hands-on exploration", "Food allergy check before any taste tests", "The five senses walk is a great mindfulness activity too", "Body tracing is a memorable activity kids will want to keep"]
    }'
    WHEN 'Push and Pull' THEN '{
      "daily_lessons": [
        {"day": 1, "title": "What Are Forces?", "duration": 30, "description": "A force is a push or pull. Demonstrate: push a toy car, pull a wagon, push a door, pull a drawer."},
        {"day": 2, "title": "Push and Pull Sort", "duration": 30, "description": "Look at pictures of actions. Sort into push or pull. Some things need both! Discuss examples."},
        {"day": 3, "title": "Ramp Races", "duration": 30, "description": "Build ramps with books and cardboard. Roll toy cars down. Steeper ramp = faster car. Measure distances."},
        {"day": 4, "title": "Changing Direction and Speed", "duration": 30, "description": "Push a ball softly vs hard. What happens? Push from different angles. Forces change speed and direction."},
        {"day": 5, "title": "Friction", "duration": 30, "description": "Slide a toy car on carpet vs tile vs ice (cookie sheet). Where does it go farthest? Friction slows things down."},
        {"day": 6, "title": "Introduction to Magnets", "duration": 30, "description": "Magnets push (repel) and pull (attract). Test: what sticks to a magnet? Sort objects into magnetic/not magnetic."},
        {"day": 7, "title": "Magnet Exploration", "duration": 30, "description": "Can magnets work through paper? Water? Fabric? Test and record results. Discover that magnets work through some materials."},
        {"day": 8, "title": "Magnet Poles", "duration": 30, "description": "Every magnet has a north and south pole. Put two norths together: they push away. North and south: they snap together!"},
        {"day": 9, "title": "Push and Pull Scavenger Hunt", "duration": 30, "description": "Find 5 things you push and 5 things you pull around the house. Draw and label them. Present findings."},
        {"day": 10, "title": "Unit Review", "duration": 30, "description": "Build the best ramp for distance. Magnet challenge course. Push/pull sorting game. Take unit quiz."}
      ],
      "science_experiments": [
        {"title": "Ramp Races", "description": "Test how ramp height affects how far a toy car travels.", "materials": ["Books for ramp height", "Cardboard or wood plank", "Toy car", "Ruler or tape measure"], "steps": ["Stack 2 books and lean cardboard against them to make a ramp", "Roll a toy car from the top", "Measure how far the car goes from the bottom of the ramp", "Add more books to make the ramp steeper", "Roll again and measure", "Compare the distances"], "what_to_observe": "Higher ramps make cars go farther because the push (gravity) is stronger", "discussion_questions": ["Which ramp height made the car go farthest?", "What force is pulling the car down the ramp?", "What force eventually stops the car?"]},
        {"title": "Magnet Material Test", "description": "Discover which materials are magnetic and which are not.", "materials": ["Magnet", "Various objects: paperclip, coin, pencil, foil, rubber band, nail, plastic spoon, fabric"], "steps": ["Make a prediction chart: will it stick or not?", "Test each object with the magnet", "Record results: attracted or not attracted", "Look at the attracted items: what do they have in common?"], "what_to_observe": "Magnetic objects contain iron or steel; plastic, wood, paper are not magnetic", "discussion_questions": ["Are all metals magnetic?", "What material do all the magnetic objects share?", "Can you find anything else in the house that is magnetic?"]}
      ],
      "parent_tips": ["The playground is a perfect science lab for forces - swings, slides, seesaws all demonstrate push and pull", "Magnets are endlessly fascinating for kids - invest in a good set", "Connect to everyday life: opening doors, riding bikes, throwing balls - all forces", "Let kids build ramps and test them as long as they want - this is real engineering"]
    }'
    ELSE '{
      "daily_lessons": [
        {"day": 1, "title": "Science Year in Review", "duration": 30, "description": "Look through the science journal from the whole year. What was your favorite experiment? What surprised you most?"},
        {"day": 2, "title": "Choose a Science Fair Topic", "duration": 30, "description": "Pick a topic from this year to investigate further. What question do you want to answer?"},
        {"day": 3, "title": "Plan Your Experiment", "duration": 30, "description": "What will you test? What materials do you need? What do you think will happen (hypothesis)?"},
        {"day": 4, "title": "Conduct the Experiment", "duration": 30, "description": "Do the experiment! Record what happens. Take photos if possible."},
        {"day": 5, "title": "Record Results", "duration": 30, "description": "Draw and write about what happened. Was your hypothesis correct? What did you learn?"},
        {"day": 6, "title": "Make a Poster", "duration": 30, "description": "Create a science fair poster: Question, Hypothesis, Materials, Steps, Results, Conclusion."},
        {"day": 7, "title": "Practice Presenting", "duration": 30, "description": "Practice explaining your experiment to a family member. Answer questions about it."},
        {"day": 8, "title": "Science Fair and Celebration", "duration": 30, "description": "Present to family. Celebrate all the science learned this year! Award a science certificate."}
      ],
      "hands_on_activities": [
        {"title": "Science Fair Project", "type": "experiment", "description": "Choose a question, form a hypothesis, conduct an experiment, record results, and present findings.", "materials": ["Poster board", "Markers", "Experiment materials (varies)"]},
        {"title": "Science Portfolio", "type": "craft", "description": "Compile best work from each unit into a science portfolio. Add a cover and table of contents.", "materials": ["Binder or folder", "Saved work from the year"]},
        {"title": "Nature Journal Review", "type": "outdoor", "description": "Take one final nature walk. Draw and write about what you observe. Compare to early-year observations.", "materials": ["Science journal", "Pencil", "Magnifying glass"]}
      ],
      "parent_tips": ["The science fair project is a wonderful way to practice the scientific method", "Keep it simple - one clear question with a testable experiment", "Help with setup but let the child do the work and draw conclusions", "Presenting builds confidence and communication skills"]
    }'
  END)::jsonb,
  ARRAY['Demonstrate understanding through hands-on activities', 'Complete unit assessment', 'Present findings from experiments'],
  '{"struggling": "Use more visual and hands-on approaches. Focus on observation over vocabulary. Simplify classification.", "advanced": "Independent research projects. More complex experiments. Science reading at higher level.", "english_learners": "Visual vocabulary cards. Hands-on experiments are universal. Label specimens in both languages."}'::jsonb,
  ARRAY['1-LS1-1', '1-LS3-1', '1-ESS1-1', '1-PS4-1'],
  30
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'Science' AND u.title IN ('Animals', 'Earth and Sky', 'Senses and Body', 'Push and Pull', 'Review and Projects');

-- ── SOCIAL STUDIES UNITS 1-7 (all new) ──────────────────────────────────────
INSERT INTO curriculum_teaching_guides (unit_id, title, objectives, materials, instruction_plan, assessment_ideas, differentiation, standards, duration_minutes)
SELECT u.id, 'Teaching Guide: ' || u.title,
  CASE u.title
    WHEN 'My Family and Community' THEN ARRAY['Describe family roles and relationships', 'Identify community helpers and their jobs', 'Understand what makes a neighborhood', 'Show respect for different family structures']
    WHEN 'Rules and Laws' THEN ARRAY['Understand why we have rules', 'Identify rules at home, school, and in community', 'Explain the difference between rules and laws', 'Understand fairness and safety']
    WHEN 'Maps and Locations' THEN ARRAY['Read a simple map', 'Identify cardinal directions (N, S, E, W)', 'Create a simple map of a familiar place', 'Understand land and water on a globe']
    WHEN 'American Symbols' THEN ARRAY['Identify the American flag and its meaning', 'Recognize the Statue of Liberty and bald eagle', 'Learn the Pledge of Allegiance', 'Understand why symbols matter']
    WHEN 'Needs and Wants' THEN ARRAY['Distinguish between needs and wants', 'Identify goods and services', 'Understand basic jobs in a community', 'Learn about saving and spending']
    WHEN 'Holidays and Heroes' THEN ARRAY['Learn about national holidays and why we celebrate', 'Identify important Americans and their contributions', 'Celebrate cultural diversity', 'Connect past heroes to present values']
    ELSE ARRAY['Review all social studies concepts from the year', 'Complete a community project', 'Present learning to family', 'Celebrate growth']
  END,
  ARRAY['Family photos', 'Community helper cards', 'Globe or world map', 'Construction paper', 'Drawing supplies', 'American flag image', 'Play money', 'Picture books about holidays'],
  (CASE u.title
    WHEN 'My Family and Community' THEN '{
      "daily_lessons": [
        {"day": 1, "title": "My Family", "duration": 30, "description": "Draw your family. Name each person and their role. Talk about what makes your family special."},
        {"day": 2, "title": "Family Tree", "duration": 30, "description": "Create a simple family tree with photos or drawings. Include parents, grandparents, siblings."},
        {"day": 3, "title": "Community Helpers - Safety", "duration": 30, "description": "Police officers, firefighters, paramedics. What do they do? How do they help us stay safe?"},
        {"day": 4, "title": "Community Helpers - Health", "duration": 30, "description": "Doctors, nurses, dentists. How do they help us stay healthy? Role-play a doctor visit."},
        {"day": 5, "title": "Community Helpers - Services", "duration": 30, "description": "Mail carriers, teachers, librarians, trash collectors. Every job matters. Who helps our community?"},
        {"day": 6, "title": "My Neighborhood", "duration": 30, "description": "Walk around your neighborhood. What do you see? Homes, stores, parks, schools. Draw what you find."},
        {"day": 7, "title": "Neighborhood Map", "duration": 30, "description": "Draw a simple map of your neighborhood. Include your house, nearby places, and streets."},
        {"day": 8, "title": "How We Help Each Other", "duration": 30, "description": "How does your family help the community? How do neighbors help each other? Plan a kind act."},
        {"day": 9, "title": "Different Families", "duration": 30, "description": "Families come in all shapes and sizes. Read books about different family structures. All families are special."},
        {"day": 10, "title": "Unit Review", "duration": 30, "description": "Present family tree and neighborhood map. Community helper matching game. Take unit quiz."}
      ],
      "hands_on_activities": [
        {"title": "Family Tree Craft", "type": "craft", "description": "Draw a tree trunk with branches. Add photos or drawings of family members on each branch. Label relationships.", "materials": ["Large paper", "Photos or drawings", "Glue", "Markers"]},
        {"title": "Community Helper Dress-Up", "type": "game", "description": "Use costumes or props to pretend to be different community helpers. Act out what they do.", "materials": ["Dress-up clothes or props", "Imagination"]},
        {"title": "Neighborhood Walk and Map", "type": "outdoor", "description": "Walk your neighborhood and note landmarks. Return home and draw a map from memory.", "materials": ["Paper", "Crayons", "Walking shoes"]}
      ],
      "parent_tips": ["Celebrate your unique family structure", "Invite a community helper to visit or do a virtual meet", "The neighborhood walk teaches observation and spatial awareness", "Use community outings (grocery store, post office) as learning opportunities"]
    }'
    WHEN 'Rules and Laws' THEN '{
      "daily_lessons": [
        {"day": 1, "title": "Why Do We Have Rules?", "duration": 30, "description": "What would happen if there were no rules? Discuss safety and fairness. Rules help everyone get along."},
        {"day": 2, "title": "Home Rules", "duration": 30, "description": "What rules does your family have? List them together. Why does each rule exist? Create a family rules poster."},
        {"day": 3, "title": "School Rules", "duration": 30, "description": "What rules would a classroom need? Raise hand, take turns, be kind, clean up. Why do these matter?"},
        {"day": 4, "title": "Community Rules", "duration": 30, "description": "Traffic lights, crosswalks, speed limits, quiet in libraries. Walk around and find rules in your community."},
        {"day": 5, "title": "Rules vs Laws", "duration": 30, "description": "Rules are agreements. Laws are rules made by the government that everyone must follow. Breaking laws has consequences."},
        {"day": 6, "title": "Fairness", "duration": 30, "description": "What does fair mean? Is fair always equal? Discuss scenarios. Practice taking turns and sharing."},
        {"day": 7, "title": "Safety Rules", "duration": 30, "description": "Fire safety, stranger safety, water safety, bike safety. Role-play emergency situations."},
        {"day": 8, "title": "Traffic Signs", "duration": 30, "description": "Learn stop, yield, crosswalk, speed limit signs. Make mini signs from paper. Play traffic sign matching."},
        {"day": 9, "title": "Being a Good Citizen", "duration": 30, "description": "Following rules, being kind, helping others, taking care of shared spaces. How can YOU be a good citizen?"},
        {"day": 10, "title": "Unit Review", "duration": 30, "description": "Present family rules poster. Role-play scenarios: what rule applies here? Take unit quiz."}
      ],
      "hands_on_activities": [
        {"title": "Family Rules Poster", "type": "craft", "description": "Create a colorful poster of your family rules. Let the child help decide the rules. Hang it up.", "materials": ["Poster board", "Markers", "Stickers"]},
        {"title": "Traffic Sign Matching", "type": "game", "description": "Make mini traffic signs from paper. Match signs to their meanings. Play red light, green light.", "materials": ["Paper", "Markers", "Popsicle sticks"]},
        {"title": "Safety Role-Play", "type": "game", "description": "Act out safety scenarios: what do you do if there is a fire? If you get lost? If a stranger approaches?", "materials": ["Props as needed"]}
      ],
      "parent_tips": ["Let your child help create household rules - they follow rules they helped make", "Use real-world moments to discuss rules: why do we stop at red lights?", "Praise rule-following behavior specifically", "Discuss consequences naturally without being punitive"]
    }'
    ELSE '{
      "daily_lessons": [
        {"day": 1, "title": "Introduction", "duration": 30, "description": "Introduce the unit topic with an engaging read-aloud, discussion, and preview of what we will learn."},
        {"day": 2, "title": "Exploration Day 1", "duration": 30, "description": "Explore key concepts through hands-on activities, pictures, and discussion."},
        {"day": 3, "title": "Exploration Day 2", "duration": 30, "description": "Continue exploring with new activities and deeper questions."},
        {"day": 4, "title": "Creative Project", "duration": 30, "description": "Create a project that demonstrates understanding: art, poster, map, or model."},
        {"day": 5, "title": "Read-Aloud and Discussion", "duration": 30, "description": "Read a related picture book. Discuss connections to what we have been learning."},
        {"day": 6, "title": "Real-World Connection", "duration": 30, "description": "Connect learning to the real world through a walk, outing, or hands-on experience."},
        {"day": 7, "title": "Review Games", "duration": 30, "description": "Review through sorting games, matching activities, and discussion."},
        {"day": 8, "title": "Assessment and Celebration", "duration": 30, "description": "Show what you know through a quiz, project presentation, or portfolio entry."}
      ],
      "hands_on_activities": [
        {"title": "Creative Project", "type": "craft", "description": "Create a project that shows understanding of the topic. Could be a poster, diorama, book, or presentation.", "materials": ["Art supplies", "Construction paper", "Markers", "Glue"]},
        {"title": "Learning Game", "type": "game", "description": "Play a matching, sorting, or trivia game related to the unit topic.", "materials": ["Cards or game materials as needed"]}
      ],
      "parent_tips": ["Use picture books from the library to supplement each topic", "Field trips - even to local places - make social studies come alive", "Connect history to your own family stories when possible", "Celebrate cultural diversity in your community"]
    }'
  END)::jsonb,
  ARRAY['Demonstrate understanding through discussion and projects', 'Complete unit assessment', 'Connect learning to real life'],
  '{"struggling": "Use more pictures and hands-on activities. Focus on key vocabulary. Simplify projects.", "advanced": "Independent research on topics of interest. Write reports. Compare past and present.", "english_learners": "Visual vocabulary cards. Cultural connections to home country. Act out scenarios."}'::jsonb,
  ARRAY['NCSS.D2.Civ.2.K-2', 'NCSS.D2.Geo.1.K-2', 'NCSS.D2.His.3.K-2'],
  30
FROM curriculum_units u JOIN curriculum_courses c ON u.course_id = c.id
WHERE c.grade = 1 AND c.subject = 'Social Studies';

-- ============================================================================
-- Grade 1 Social Studies books (missing from migration 42)
-- ============================================================================
INSERT INTO curriculum_books (course_id, title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
SELECT c.id, b.title, b.author, b.isbn, b.publisher, b.purchase_url, b.book_type::text, b.is_required, b.description, b.sort_order
FROM curriculum_courses c
CROSS JOIN (VALUES
  ('myWorld Interactive Grade 1', 'Pearson', '9780328973095', 'Pearson', 'https://www.amazon.com/dp/0328973092', 'textbook', true, 'Interactive social studies with digital resources.', 1),
  ('If You Lived 100 Years Ago', 'Ann McGovern', '9780590960007', 'Scholastic', 'https://www.amazon.com/dp/0590960008', 'read_aloud', false, 'Engaging look at life long ago for young learners.', 2)
) AS b(title, author, isbn, publisher, purchase_url, book_type, is_required, description, sort_order)
WHERE c.grade = 1 AND c.subject = 'Social Studies';
