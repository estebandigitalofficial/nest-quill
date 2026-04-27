# Nest & Quill

An AI-powered platform for K-8 students and educators. Parents and teachers can generate personalized illustrated children's books; students use a suite of AI learning tools (quizzes, flashcards, concept explainer, study guide, math practice, reading comprehension, spelling practice, and a study helper) with classroom assignment tracking and a gamification layer.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | Supabase (Postgres + RLS) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| AI — text | OpenAI GPT-4o |
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
│   ├── stories/             # Story queue management + retry
│   ├── users/               # User lookup
│   └── writer/              # AI Writer (book generation tool)
├── classroom/
│   ├── educator/            # Class management, assignment creation
│   └── student/             # Student dashboard, quests, XP/level
├── learning/                # Public learning tools (8 tools)
│   ├── quiz/
│   ├── flashcards/
│   ├── explain/
│   ├── study-guide/
│   ├── math/
│   ├── reading/
│   ├── spelling/
│   └── study-helper/        # Paste-your-notes study mode
├── pricing/
├── story/[requestId]/       # Read a generated story
└── api/
    ├── story/               # submit, status, [requestId] (CRUD + retry)
    ├── learning/            # quiz, flashcards, explain, study-guide, math, reading
    ├── study-helper/        # generate + complete (XP)
    ├── classroom/           # classes, assignments, join, student profile
    ├── admin/               # stories, users, writer (is_admin gated)
    ├── auth/                # is-admin helper
    ├── chat/                # Story chat assistant
    └── cron/                # drip-emails

components/
├── layout/      # SiteHeader, SiteFooter, LearningDropdown
├── auth/        # Auth form wrappers
├── admin/       # Admin-specific UI
└── story/       # Story reader components

lib/
├── supabase/    # server.ts (auth-aware), admin.ts (service role)
├── utils/       # xp.ts, rateLimiter.ts, submitAssignment.ts, cn.ts, errors.ts
├── services/    # ai.ts, email.ts, images.ts, pdf.ts, storage.ts, storyReward.ts
├── plans/       # config.ts (plan limits), limits.ts
├── validators/  # Zod schemas
└── writer/      # AI Writer logic

supabase/
├── functions/process-story/   # Edge Function: text → illustrations → PDF → email
└── migrations/                # 21 sequential SQL migrations

types/                         # Shared TypeScript types (database.ts generated)
```

## Key Features

### Story Generation
Users submit a story request (characters, setting, tone, moral, personalization). The submission API queues it, then the Supabase Edge Function handles the full pipeline: GPT-4o generates text → DALL-E 3 generates illustrations → pdf-lib assembles an 8×8 picture book → Resend delivers it by email. Stories are viewable at `/story/[requestId]`.

### Learning Mode (8 tools)
All tools live at `/learning/*` and are publicly accessible without an account:
- **Quiz** — 5 multiple-choice questions; image upload supported; correct answers stored server-side in `quiz_sessions` (never sent to client)
- **Flashcards** — AI-generated term/definition cards
- **Concept Explainer** — Simple explanations with real-world analogies
- **Study Guide** — Key terms, main concepts, practice questions
- **Math Practice** — AI-generated problems with step-by-step solutions
- **Reading Comprehension** — Passage + comprehension questions
- **Spelling Practice** — Custom word list dictation
- **Study Helper** — Paste any notes/material, choose quiz/flashcards/explain/study-guide mode; content is generated grounded in the pasted text

### Classroom
Educators (on the `educator` plan) create classes, assign learning tools with pre-configured topics/grades, and share a 6-character join code. Students complete assignments and earn XP. The submission flow: student completes tool → auto-calls `/api/classroom/assignments/[id]/submit` → XP awarded, streak updated, badges checked, story milestone rewards triggered.

### Gamification
Students have a profile with XP, level (1–10), coins, and streak days. XP sources: assignment completion (50 base), score bonuses (25–75), streak bonuses (50–100%). Study Helper awards 20–30 XP per session, capped at 2 sessions/day. Badges are awarded for milestones (first quest, quiz master, streaks, completionist, etc.). Leveling thresholds: 0 / 100 / 250 / 500 / 900 / 1400 / 2000 / 2800 / 4000 / 6000 XP.

### Plans
Five tiers: `free` (1 story, 8 pages), `single` ($7.99 one-time), `story_pack` ($9.99/mo, 3 stories), `story_pro` ($24.99/mo, 10 stories), `educator` ($59/mo, 40 stories + classroom). Plan limits are defined in `lib/plans/config.ts` — single source of truth for all enforcement.

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

Migrations are in `supabase/migrations/` and run sequentially. Notable tables:

| Table | Purpose |
|---|---|
| `story_requests` | Story queue and status |
| `quiz_sessions` | Server-side quiz answers (correct_index never sent to client) |
| `learning_rate_limits` | Per-IP rate limiting for learning tool API routes |
| `classrooms` | Educator classes |
| `assignments` | Classroom assignments (tool + config) |
| `assignment_submissions` | Student completions with score |
| `student_profiles` | XP, level, coins, streak |
| `xp_log` | Audit trail for every XP award |
| `badges` / `student_badges` | Badge definitions and earned badges |
| `study_sessions` | Study Helper completions (client-generated UUID for idempotency) |

## API Conventions

- All learning generation routes use `checkLearningRateLimit(request, routeName)` from `lib/utils/rateLimiter.ts` (sliding 1-hour window per IP).
- Server-side auth uses `createClient()` (RLS-aware). Admin operations use `createAdminClient()` (service role — never expose to browser).
- Story pages use `async searchParams: Promise<{...}>` (Next.js 15 App Router convention).
- Assignment submission is handled by the shared `lib/utils/submitAssignment.ts` helper which also writes celebration data to `sessionStorage` for the post-redirect modal.

## Admin Access

Routes under `/admin/*` and `/api/admin/*` are protected by `lib/admin/isAdmin.ts`, which checks `auth.users.email` against the `ADMIN_EMAILS` environment variable.
