import { createAdminClient } from '@/lib/supabase/admin'

export interface AssembledSection {
  type: string
  label: string
  content: string
}

export interface AssembledChapter {
  number: number
  title: string
  content: string  // scenes joined
}

export interface AssembledBook {
  title: string
  subtitle: string | null
  authorName: string
  penName: string | null
  publisher: string | null
  year: string
  edition: string | null
  copyrightText: string | null
  // Manuscript order:
  preTocSections: AssembledSection[]   // dedication, epigraph (before TOC)
  postTocSections: AssembledSection[]  // foreword, preface, acknowledgments, prologue, introduction (after TOC)
  chapters: AssembledChapter[]
  backMatter: AssembledSection[]       // conclusion → notes → about_author → also_by
}

export const SECTION_LABELS: Record<string, string> = {
  dedication: 'Dedication',
  epigraph: 'Epigraph',
  foreword: 'Foreword',
  preface: 'Preface',
  acknowledgments: 'Acknowledgments',
  prologue: 'Prologue',
  introduction: 'Introduction',
  conclusion: 'Conclusion',
  notes: 'Notes',
  about_author: 'About the Author',
  also_by: 'Also By',
}

// Canonical manuscript order
const PRE_TOC_ORDER = ['dedication', 'epigraph']
const POST_TOC_ORDER = ['foreword', 'preface', 'acknowledgments', 'prologue', 'introduction']
const BACK_ORDER = ['conclusion', 'notes', 'about_author', 'also_by']

function pickSections(
  all: Record<string, unknown>[],
  types: string[]
): AssembledSection[] {
  return types
    .map(type => all.find(s => s.type === type && s.enabled && s.content))
    .filter(Boolean)
    .map(s => ({
      type: s!.type as string,
      label: SECTION_LABELS[s!.type as string] ?? (s!.type as string),
      content: s!.content as string,
    }))
}

export async function assembleBook(
  bookId: string,
  options: {
    includeFrontMatter?: boolean
    includeBackMatter?: boolean
    includeCopyright?: boolean
  } = {}
): Promise<AssembledBook> {
  const {
    includeFrontMatter = true,
    includeBackMatter = true,
    includeCopyright = true,
  } = options

  const supabase = createAdminClient()

  const [bookRes, chaptersRes, sectionsRes, copyrightRes] = await Promise.all([
    supabase.from('writer_books').select('*').eq('id', bookId).single(),
    supabase.from('writer_chapters').select('*, writer_scenes(*)').eq('book_id', bookId).order('chapter_number', { ascending: true }),
    supabase.from('writer_book_sections').select('*').eq('book_id', bookId),
    supabase.from('writer_copyright').select('*').eq('book_id', bookId).single(),
  ])

  const book = bookRes.data
  const chapters = chaptersRes.data ?? []
  const sections: Record<string, unknown>[] = sectionsRes.data ?? []
  const copyright = copyrightRes.data

  const authorName = book.pen_name || book.author_name || 'Unknown Author'
  const year = book.year_published || String(new Date().getFullYear())

  // Build copyright text
  let copyrightText: string | null = null
  if (includeCopyright && copyright) {
    if (copyright.custom_text) {
      copyrightText = copyright.custom_text
    } else {
      const name = copyright.pen_name || copyright.author_name || authorName
      const lines: string[] = [`Copyright © ${year} ${name}`]
      if (copyright.edition || book.edition) lines.push(copyright.edition || book.edition)
      if (copyright.publisher_name || book.publisher_name) {
        lines.push(`Published by ${copyright.publisher_name || book.publisher_name}`)
      }
      lines.push('')
      for (const cl of (copyright.clauses ?? []).filter((c: { enabled: boolean }) => c.enabled)) {
        lines.push(cl.label)
      }
      if (copyright.collaborators?.length) {
        lines.push('')
        for (const col of copyright.collaborators) {
          if (col.name && col.role) lines.push(`${col.role}: ${col.name}`)
        }
      }
      copyrightText = lines.join('\n')
    }
  }

  // Chapters — prefer locked content, join scenes in order
  const assembledChapters: AssembledChapter[] = chapters
    .map((ch: Record<string, unknown>) => {
      const scenes = ((ch.writer_scenes as unknown[]) ?? [])
        .sort((a: unknown, b: unknown) =>
          (a as { scene_number: number }).scene_number - (b as { scene_number: number }).scene_number
        )
        .filter((s: unknown) => (s as { content: string | null }).content)
        .map((s: unknown) => (s as { content: string }).content)
      return {
        number: ch.chapter_number as number,
        title: ch.title as string,
        content: scenes.join('\n\n'),
      }
    })
    .filter((ch: AssembledChapter) => ch.content)

  return {
    title: book.title,
    subtitle: book.subtitle ?? null,
    authorName,
    penName: book.pen_name ?? null,
    publisher: book.publisher_name ?? null,
    year,
    edition: book.edition ?? null,
    copyrightText,
    preTocSections: includeFrontMatter ? pickSections(sections, PRE_TOC_ORDER) : [],
    postTocSections: includeFrontMatter ? pickSections(sections, POST_TOC_ORDER) : [],
    chapters: assembledChapters,
    backMatter: includeBackMatter ? pickSections(sections, BACK_ORDER) : [],
  }
}
