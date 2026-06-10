// ──────────────────────────────────────────────────────────────────────────
// Writer Studio — project type catalog
//
// Customer-facing companion to the internal Admin Writer. This is the single
// source of truth for the document/project types the public Writer Studio
// supports. It is intentionally decoupled from the Admin Writer tables
// (writer_books / writer_chapters / writer_scenes) so the two can evolve
// independently.
//
// FOUNDATION ONLY: these describe each type and its structural building
// blocks so the choose-a-type flow can render. Actual generation, persistence,
// and source-document upload are deliberately not wired up yet — see the
// `available` flag, which currently gates the "coming soon" creation state.
// ──────────────────────────────────────────────────────────────────────────

import type { WriterProjectDocumentType } from '@/types/writer'

// Catalog ids are the canonical document types persisted to
// public.writer_projects.document_type — kept in lockstep via this alias.
export type ProjectTypeId = WriterProjectDocumentType

export interface ProjectTypeConfig {
  /** Stable id used in URLs (?type=) and, later, persisted rows. */
  id: ProjectTypeId
  /** Display name. */
  name: string
  /** One-line description shown on the card. */
  tagline: string
  /** Longer description shown on the create/detail step. */
  description: string
  /**
   * Structural building blocks for this type. These prepare the ground for
   * the future generation pipeline (outline → sections → content) and are
   * surfaced to the user as "what's inside" hints.
   */
  structure: string[]
  /** Short glyph for the card icon tile. */
  icon: string
  /**
   * Whether project creation is wired up. All types are foundation-only for
   * now, so this is `false` everywhere and the UI shows a "coming soon" state.
   * Flip per-type as the generation flow lands.
   */
  available: boolean
  /**
   * Literal Tailwind class strings for the card accent. Kept as full strings
   * (not interpolated) so Tailwind's content scanner picks them up.
   */
  accent: {
    border: string
    hoverBorder: string
    iconBg: string
    chipBg: string
    chipText: string
  }
}

export const PROJECT_TYPES: ProjectTypeConfig[] = [
  {
    id: 'book',
    name: 'Book',
    tagline: 'Chapters, outline, creative structure',
    description:
      'A long-form book with chapters and an outline. Best for narrative, creative, or thematic works where structure and flow matter.',
    structure: ['Outline', 'Chapters', 'Scenes / sections', 'Front & back matter'],
    icon: 'B',
    available: false,
    accent: {
      border: 'border-indigo-200',
      hoverBorder: 'hover:border-indigo-400',
      iconBg: 'bg-indigo-500',
      chipBg: 'bg-indigo-100',
      chipText: 'text-indigo-700',
    },
  },
  {
    id: 'manual',
    name: 'Manual',
    tagline: 'Sections, procedures, policies',
    description:
      'A reference manual organized into sections that document procedures and policies. Best for product, operations, or technical documentation.',
    structure: ['Sections', 'Procedures', 'Policies', 'Reference appendix'],
    icon: 'M',
    available: false,
    accent: {
      border: 'border-blue-200',
      hoverBorder: 'hover:border-blue-400',
      iconBg: 'bg-blue-500',
      chipBg: 'bg-blue-100',
      chipText: 'text-blue-700',
    },
  },
  {
    id: 'handbook',
    name: 'Handbook',
    tagline: 'Policies, guidelines, reference sections',
    description:
      'A handbook of policies, guidelines, and quick-reference sections. Best for employee, member, or program handbooks people return to often.',
    structure: ['Policies', 'Guidelines', 'Reference sections', 'FAQ'],
    icon: 'H',
    available: false,
    accent: {
      border: 'border-teal-200',
      hoverBorder: 'hover:border-teal-400',
      iconBg: 'bg-teal-500',
      chipBg: 'bg-teal-100',
      chipText: 'text-teal-700',
    },
  },
  {
    id: 'sop',
    name: 'SOP',
    tagline: 'Step-by-step procedures',
    description:
      'A standard operating procedure: clear, ordered, step-by-step instructions for a repeatable process. Best for compliance, training, and consistency.',
    structure: ['Purpose & scope', 'Step-by-step procedure', 'Roles & responsibilities', 'Checklist'],
    icon: 'S',
    available: false,
    accent: {
      border: 'border-emerald-200',
      hoverBorder: 'hover:border-emerald-400',
      iconBg: 'bg-emerald-500',
      chipBg: 'bg-emerald-100',
      chipText: 'text-emerald-700',
    },
  },
  {
    id: 'training_guide',
    name: 'Training Guide',
    tagline: 'Lessons, objectives, checkpoints',
    description:
      'A structured training guide built from lessons with learning objectives and checkpoints. Best for onboarding and skills development.',
    structure: ['Lessons', 'Learning objectives', 'Checkpoints', 'Assessments'],
    icon: 'T',
    available: false,
    accent: {
      border: 'border-amber-200',
      hoverBorder: 'hover:border-amber-400',
      iconBg: 'bg-amber-500',
      chipBg: 'bg-amber-100',
      chipText: 'text-amber-700',
    },
  },
  {
    id: 'curriculum',
    name: 'Curriculum',
    tagline: 'Units, lessons, activities, quizzes',
    description:
      'A full curriculum organized into units and lessons with activities and quizzes. Best for educators and homeschool families planning a course.',
    structure: ['Units', 'Lessons', 'Activities', 'Quizzes'],
    icon: 'C',
    available: false,
    accent: {
      border: 'border-violet-200',
      hoverBorder: 'hover:border-violet-400',
      iconBg: 'bg-violet-500',
      chipBg: 'bg-violet-100',
      chipText: 'text-violet-700',
    },
  },
  {
    id: 'workbook',
    name: 'Workbook',
    tagline: 'Exercises, prompts, questions',
    description:
      'A hands-on workbook of exercises, prompts, and questions for the reader to complete. Best for practice, reflection, and applied learning.',
    structure: ['Exercises', 'Prompts', 'Questions', 'Answer key'],
    icon: 'W',
    available: false,
    accent: {
      border: 'border-rose-200',
      hoverBorder: 'hover:border-rose-400',
      iconBg: 'bg-rose-500',
      chipBg: 'bg-rose-100',
      chipText: 'text-rose-700',
    },
  },
]

/** Lookup a single project type by its id. */
export function getProjectType(id: string | undefined): ProjectTypeConfig | undefined {
  if (!id) return undefined
  return PROJECT_TYPES.find((t) => t.id === id)
}
