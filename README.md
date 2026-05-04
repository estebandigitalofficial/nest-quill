# Nest & Quill

An AI-powered educational platform for K–12 students, homeschool families, and educators. Features personalized illustrated children's books, a complete homeschool curriculum with teaching guides, a suite of AI learning tools, classroom management with assignment tracking, and a gamification layer.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | Supabase (Postgres + RLS) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| AI — text | OpenAI GPT-4o / GPT-4o-mini |
| AI — images | DALL-E 3 (via Edge Function) |
| PDF generation | pdf-lib (Edge Function) + @react-pdf/renderer |
| Email | Resend |
| Payments | Stripe |
| Styling | Tailwind CSS |
| Edge Functions | Supabase (Deno runtime) |

## Project Structure

```
app/
├── (auth)/                  # Login, signup, forgot/reset password
├── (create)/create/         # Story creation wizard
├── account/                 # Subscription, billing, story history
├── admin/                   # Internal admin dashboard
│   ├── stories/             # Story detail + retry/requeue
│   ├── users/               # User lookup
│   ├── university/          # Curriculum management, content library, grade-first dashboard
│   ├── library/             # Story request browser
│   ├── writer/              # AI Writer (adult book generation)
│   ├── reporting/           # Revenue and user analytics
│   ├── settings/            # App configuration hub
│   ├── email-drips/         # Email journey builder
│   └── images/              # Image library management
├── classroom/
│   ├── educator/            # Class management, assignment creation
│   ├── student/             # Student dashboard, quests, XP/level
│   └── assignment/          # Assignment runner (quiz, reading, flashcards, etc.)
├── homeschool/
│   ├── courses/             # Curriculum browser (all grades, subjects, books)
│   └── grade/[grade]/       # Grade-specific dashboard (lessons, planner, supplies, books)
├── learning/                # Public learning tools (8 tools)
│   ├── quiz/
│   ├── flashcards/
│   ├── explain/
│   ├── study-guide/
│   ├── math/
│   ├── reading/
│   ├── spelling/
│   ├── scan-homework/       # Photo → learning tools
│   └── study-helper/        # Paste-your-notes study mode
├── pricing/
├── story/[requestId]/       # Read a generated story (ebook reader)
└── api/
    ├── story/               # submit, status, [requestId] (CRUD + retry + PDF)
    ├── learning/            # quiz, flashcards, explain, study-guide, math, reading, spelling, trivia
    ├── study-helper/        # generate + complete (XP)
    ├── classroom/           # classes, assignments, join, student profile
    ├── curriculum/          # Curriculum courses API (with units + books)
    ├── homeschool/grade/    # Full grade data (courses, units, guides, books, materials)
    ├── admin/
    │   ├── university/      # Content library CRUD + batch generation + grade stats
    │   ├── stories/         # Story detail management, resend email
    │   └── writer/          # Book management
    ├── auth/                # is-admin helper
    ├── chat/                # Story chat assistant
    └── cron/                # drip-emails

components/
├── layout/      # SiteHeader, SiteFooter, LearningDropdown
├── auth/        # Auth form wrappers
├── admin/       # AdminSidebar, AdminRetryButton, AdminStoryActions, etc.
└── story/       # StoryStatusPage, StoryWizard, ebook reader

lib/
├── supabase/    # server.ts (auth-aware), admin.ts (service role)
├── utils/       # xp.ts, rateLimiter.ts, submitAssignment.ts, cn.ts, errors.ts, formatTime.ts
├── services/    # ai.ts, email.ts, images.ts, pdf.ts, storage.ts, storyReward.ts, contentLibrary.ts, assignmentContent.ts, adminNotifications.ts
├── plans/       # config.ts (plan limits), limits.ts
├── admin/       # guard.ts (admin context + role checks)
├── settings/    # appSettings.ts (feature flags)
├── validators/  # Zod schemas
└── writer/      # AI Writer logic

supabase/
├── functions/process-story/   # Edge Function: text → illustrations → PDF → email
└── migrations/                # 43 sequential SQL migrations

scripts/
└── generate-all-content.mjs   # Bulk content generator (fills all empty content_library entries)

types/                         # Shared TypeScript types (database.ts, story.ts, writer.ts, plans.ts)
```

## Key Features

### Story Generation
Users submit a story request (characters, setting, tone, moral, personalization). The submission API queues it, then the Supabase Edge Function handles the full pipeline: GPT-4o generates text → DALL-E 3 generates illustrations → pdf-lib assembles an 8×8 picture book → Resend delivers it by email. Stories are viewable in a full ebook reader at `/story/[requestId]`.

### Homeschool Curriculum (K–12)
A complete standards-aligned curriculum for grades 1–12 across 5 core subjects (Math, English, Science, Social Studies, History).

- **Curriculum structure**: Courses → Units (mapped to 36-week school year) → Lessons
- **Teaching guides**: Day-by-day lesson plans with objectives, activities, parent tips, differentiation strategies (struggling/advanced/ELL), and standards alignment
- **Science experiments**: Step-by-step instructions with materials, observation prompts, and discussion questions
- **Recommended books**: Textbooks, workbooks, supplemental materials with ISBNs and purchase links per course
- **Supply lists**: Aggregated materials checklist per grade and per subject
- **Weekly planner**: 36-week view showing what to teach across all subjects each week
- **Content library**: AI-generated quizzes, flashcards, and study guides for every curriculum unit (cache-first pattern)

Access at `/homeschool` (landing), `/homeschool/courses` (catalog), `/homeschool/grade/[grade]` (grade dashboard).

### Admin University Dashboard
Grade-card-first interface for managing curriculum and content:

- **Grade cards**: Overview of all 12 grades with unit/guide/book counts and content completion %
- **Subject drill-down**: Click a grade → see subjects → click a subject
- **Educator Materials tab**: Teaching guides, lesson plans, objectives, assessments, parent tips
- **Student Materials tab**: Per-unit content status with "Preview" links that auto-load the student-facing tool
- **Supplies & Books tab**: Books with purchase links and checkable supply lists
- **Content generation**: Per-grade and per-subject batch generation, or global "Generate All"
- **Content Library view**: Flat table with filters, search, and pagination

### Learning Mode (8 tools)
All tools live at `/learning/*` and are publicly accessible without an account:
- **Quiz** — 5 multiple-choice questions; image upload supported; correct answers stored server-side
- **Flashcards** — AI-generated term/definition cards with flip interaction
- **Concept Explainer** — Simple explanations with real-world analogies
- **Study Guide** — Key terms, main concepts, memory tips, practice questions
- **Math Practice** — AI-generated problems with step-by-step solutions
- **Reading Comprehension** — Passage + comprehension questions
- **Spelling Practice** — Custom word list dictation
- **Scan Homework** — Photograph any worksheet → generate quiz/flashcards/study guide/trivia
- **Study Helper** — Paste notes, choose output mode; content grounded in pasted text

Content is served cache-first from the `content_library` table. If a matching entry exists, it's returned instantly. Otherwise, new content is generated via AI and stored for future use.

### Classroom
Educators create classes, assign learning tools with pre-configured topics/grades, and share a 6-character join code. Students complete assignments and earn XP. The submission flow: student completes tool → auto-calls submit API → XP awarded, streak updated, badges checked, story milestone rewards triggered.

### Gamification
Students have a profile with XP, level (1–10), coins, and streak days. XP sources: assignment completion (50 base), score bonuses (25–75), streak bonuses (50–100%). Badges are awarded for milestones (first quest, quiz master, streaks, completionist, etc.).

### Plans
Five tiers: `free` (1 story, 8 pages), `single` ($7.99 one-time), `story_pack` ($9.99/mo, 3 stories), `story_pro` ($24.99/mo, 10 stories), `educator` ($59/mo, 40 stories + classroom). Plan limits are defined in `lib/plans/config.ts`.

## Local Development

```bash
# Install dependencies
pnpm install

# Start Supabase locally (requires Supabase CLI)
supabase start

# Apply migrations
supabase db reset

# Generate TypeScript types from local DB
pnpm run types

# Start dev server
pnpm dev

# Bulk generate content library (fills all empty entries via OpenAI)
node scripts/generate-all-content.mjs
```

### Required Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Resend (email)
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# App
NEXT_PUBLIC_APP_URL=
EDGE_FUNCTION_BASE_URL=
EDGE_FUNCTION_SECRET=

# Admin (comma-separated emails)
ADMIN_EMAILS=
```

## Database Migrations

43 migrations in `supabase/migrations/`. Key tables:

| Table | Purpose |
|---|---|
| `story_requests` | Story queue and status tracking |
| `generated_stories` | Completed story text (JSON pages) |
| `story_scenes` | Per-page illustrations with storage paths |
| `book_exports` | PDF exports with signed URLs |
| `profiles` | User accounts, plan tier, admin flag |
| `plans` | Subscription tier definitions |
| `content_library` | Cached AI-generated learning content (quizzes, flashcards, study guides) |
| `content_usage` | Usage tracking and score analytics |
| `curriculum_courses` | Grade + subject course definitions (grades 1–12) |
| `curriculum_units` | Units within courses (mapped to school weeks) |
| `curriculum_lessons` | Lessons within units (linked to content library) |
| `curriculum_books` | Recommended textbooks per course with ISBNs and purchase links |
| `curriculum_teaching_guides` | Detailed teaching guides per unit (lesson plans, activities, experiments) |
| `classrooms` | Educator classes with join codes |
| `assignments` | Classroom assignments (tool + config + pre-generated content) |
| `assignment_submissions` | Student completions with scores |
| `student_profiles` | XP, level, coins, streak |
| `student_badges` | Earned badges |
| `quiz_sessions` | Server-side quiz answers (correct_index never sent to client) |
| `delivery_logs` | Email delivery tracking |
| `processing_logs` | Story pipeline logs |
| `writer_books` / `writer_chapters` / `writer_scenes` | Admin book writing module |

## API Conventions

- Learning routes use `checkLearningRateLimit(request, routeName)` (sliding 1-hour window per IP)
- Server-side auth uses `createClient()` (RLS-aware). Admin operations use `createAdminClient()` (service role)
- Admin access checks both `profiles.is_admin` database field and `ADMIN_EMAILS` env var
- Content library uses cache-first pattern: exact match → fuzzy search → generate + store
- Story pages use `async searchParams: Promise<{...}>` (Next.js 15 convention)

## Admin Access

Routes under `/admin/*` are protected by `lib/admin/guard.ts`, which checks `profiles.is_admin` in the database with `ADMIN_EMAILS` env var as fallback. API routes under `/api/admin/*` use the same guard. Story viewing APIs also check admin status for non-complete stories.
