# Nest & Quill — Educator Product Track

## Overview

The Educator track treats teachers and classroom instructors as a distinct product lane — not just a pricing tier. A teacher generating 25 personalized storybooks for their class has fundamentally different needs than a parent making one for their child. This document defines those differences and proposes how to build the Educator track correctly within the existing Nest & Quill system.

**Core thesis:** Educator is a B2B-adjacent lane. The customer is the teacher (or school), the end recipients are students. Stories are created on behalf of children, not by the children themselves.

---

## Role Definitions

### Guest
- No account required
- Identified by `guest_token` cookie
- Can create 1 free story
- No persistent library, no history after cookie expires
- Use case: parent trying the product before committing

### Creator (Parent / Personal User)
- Authenticated account
- Creates stories for their own child or family
- Personal library of their own stories
- Plans: `free`, `story_pro`, `family`
- Use case: parent, grandparent, gift-giver

### Educator
- Authenticated account with `educator` plan tier
- Creates stories for students in a classroom context
- Manages one or more classes with student rosters
- Stories belong to a class, not just to the educator personally
- Institutional/school licensing applies at this tier
- Use case: classroom teacher, reading specialist, school librarian

### Admin
- Nest & Quill staff account
- Full read/write access across all users, stories, jobs
- Can impersonate, retry pipelines, manage plans
- Not a customer-facing role

---

## Why Educator Needs Its Own Lane

| Dimension | Creator | Educator |
|---|---|---|
| Who they create for | Their own child | Other people's children (students) |
| Volume | 1–5 stories total | 20–35 per class, per term |
| Workflow | One story at a time | Bulk creation from a roster |
| Library ownership | Personal | Class-based, transferable |
| Billing | Individual | School or district PO/invoice |
| Content requirements | Parent's preference | Classroom-appropriate, curriculum-aligned |
| Account type | Personal | Institutional |
| Privacy concern | Low | Higher — student names/ages as PII |

---

## Educator-Specific Features

### Class Management
- Create and name a classroom (e.g., "Mrs. Rivera — Grade 2, Room 14")
- Set grade level and school name
- Archive or delete a class at end of term

### Student Roster
- Add students by first name and age only (no last names, no emails — minimise PII)
- Optional notes per student (interests, reading level, special details for story personalisation)
- Roster powers the pre-fill for story creation — educator selects a student, form populates

### Story Creation for Students
- Educator selects a student from their roster to create a story
- Story is linked to both the educator's account and the student record
- Story lives in the class library, not just the educator's personal feed

### Bulk Creation
- Educator selects all (or multiple) students in a class
- Sets shared story settings (theme, tone, illustration style, page count)
- System queues one pipeline job per student
- Progress dashboard shows which stories are generating, done, or failed
- Educator can retry individual failures

### Class Library
- Grid view of all stories for a class, organised by student name
- Filter by status (complete, generating, failed)
- Download all as PDFs (batch export) when PDF phase ships

### Educator Dashboard
- Overview: total classes, total students, total stories generated
- Per-class: stories complete vs pending vs failed
- Recent activity feed
- Usage vs plan limits (stories remaining this billing period)

### Licensing / Usage Model
- Educator plan licensed per seat (one teacher = one seat)
- School or district can purchase multiple seats under one org
- Usage tracked per educator account, not per story recipient
- Stories generated for students do not count against the student — only against the educator's quota

---

## Feature Gates by Plan

| Feature | free | story_pro | family | educator |
|---|---|---|---|---|
| Stories per month | 1 | 5 | 10 | 60 |
| Max pages per story | 8 | 16 | 24 | 24 |
| Illustration styles | 1 | 3 | 5 | 5 |
| Dedication page | No | Yes | Yes | Yes |
| Classroom management | No | No | No | Yes |
| Student roster | No | No | No | Yes |
| Bulk creation | No | No | No | Yes |
| Class library | No | No | No | Yes |
| Bulk PDF export | No | No | No | Yes |
| Priority processing | No | No | No | Yes |

---

## MVP vs Phase 2

### MVP — Build after auth ships

These are the minimum features that make the Educator lane functional and sellable:

- [ ] Educator account flag on user profile
- [ ] Create / manage a single classroom
- [ ] Student roster (first name + age + optional notes)
- [ ] Create a story for a student from their roster record (pre-fills the form)
- [ ] Class library: list all stories for a class with status
- [ ] Educator dashboard: basic stats (students, stories, usage)
- [ ] Plan gating: `educator` tier unlocks classroom features, higher quotas
- [ ] Schema additions (see below)

**Hard dependency:** Auth must ship first. Every educator feature requires a persistent account.

### Phase 2 — After core educator lane is validated

- [ ] Bulk story creation (queue all students at once)
- [ ] Bulk progress view (per-student status during bulk job)
- [ ] Multiple classrooms per educator
- [ ] School / org licensing (group billing, multiple educator seats)
- [ ] Batch PDF export (download all complete stories as a ZIP)
- [ ] Curriculum alignment tags on stories
- [ ] Shareable class library link (read-only, for parents to view their child's story)
- [ ] Admin view: manage educator accounts, orgs, usage

---

## Schema Additions

These tables should be added before or alongside the auth build so the data model is right from the start.

```sql
-- One classroom per educator (Phase 2 allows multiple)
CREATE TABLE classrooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  educator_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  grade_level     TEXT,
  school_name     TEXT,
  archived        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Students in a classroom — first name + age only, no email
CREATE TABLE students (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id    UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  first_name      TEXT NOT NULL,
  age             INTEGER NOT NULL CHECK (age BETWEEN 1 AND 18),
  notes           TEXT,                -- interests, reading level, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bulk job tracker — one row per bulk creation run
CREATE TABLE bulk_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  educator_id     UUID NOT NULL REFERENCES auth.users(id),
  classroom_id    UUID NOT NULL REFERENCES classrooms(id),
  status          TEXT NOT NULL DEFAULT 'queued',   -- queued | running | complete | partial
  total_count     INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

-- Link story_requests to classroom/student context
ALTER TABLE story_requests
  ADD COLUMN classroom_id UUID REFERENCES classrooms(id),
  ADD COLUMN student_id   UUID REFERENCES students(id),
  ADD COLUMN bulk_job_id  UUID REFERENCES bulk_jobs(id);
```

**RLS notes:**
- Educators can only read/write their own classrooms and students
- Students table never exposed to the client — always accessed via educator's session
- `story_requests` RLS already handles user_id ownership; `classroom_id` adds a secondary ownership path for the class library query

---

## Educator Dashboard Sections (UI)

### 1. Overview
- Cards: Total students, Stories created this month, Stories remaining on plan
- Quick action: "Create a story for a student"

### 2. My Classes
- List of active classrooms with student count and story count
- "New class" button
- Click into a class → class detail view

### 3. Class Detail
- Student roster table: name, age, stories created, last story date
- "Create story" button per student row
- Filter stories by status
- Bulk create button (Phase 2)

### 4. Story Library
- All stories across all classes
- Filter by class, student, status, date
- Download PDF per story (when PDF ships)

### 5. Settings
- Plan and usage
- School name, billing info
- (Phase 2) Org/seat management

---

## What Stays the Same

- The core story creation pipeline is identical — educator stories go through the same `process-story` Edge Function
- The `story_requests` table gains two nullable FK columns (`classroom_id`, `student_id`) but is otherwise unchanged
- Plan tier `educator` already exists in the DB enum — no migration needed for that
- The wizard form is reused; educator flow pre-populates it from the student record instead of requiring manual entry

---

## Open Questions to Decide Before Building

1. **Student privacy:** Do we ever store student last names? Recommendation: no — first name + age is sufficient for personalisation and avoids COPPA/FERPA complexity.
2. **Parent access:** Should parents be able to view their child's story via a shareable link? If yes, that's a Phase 2 read-only share feature.
3. **Story ownership on teacher departure:** If an educator account closes, what happens to the class stories? Recommend: stories are retained and downloadable for 90 days post-cancellation.
4. **Free educator trial:** Should educators get a free trial (e.g., 3 stories) before requiring a paid plan? Worth deciding before building the plan-gate logic.
5. **Org billing:** Phase 2 — does a school pay one invoice for N educator seats, or does each teacher pay individually? This affects whether we need an `organisations` table.
