export type WriterBookStatus = 'draft' | 'in_progress' | 'complete' | 'archived'
export type WriterChapterStatus = 'pending' | 'in_progress' | 'complete'
export type WriterSceneStatus = 'pending' | 'generating' | 'draft' | 'final'

export interface WriterBook {
  id: string
  title: string
  subtitle: string | null
  genre: string
  tone: string
  premise: string
  target_chapters: number
  target_words_per_chapter: number
  status: WriterBookStatus
  owner_id: string | null
  source_text: string | null
  source_pdf_name: string | null
  instructions: string | null
  audience: string | null
  purpose: string | null
  voice_notes: string | null
  structural_notes: string | null
  author_name: string | null
  pen_name: string | null
  publisher_name: string | null
  edition: string | null
  year_published: string | null
  author_bio: string | null
  also_by: string | null
  isbn_epub: string | null
  isbn_kindle: string | null
  isbn_paperback: string | null
  isbn_hardcover: string | null
  isbn_pdf: string | null
  created_at: string
  updated_at: string
}

export interface WriterChapter {
  id: string
  book_id: string
  chapter_number: number
  title: string
  brief: string
  summary: string | null
  notes: string | null
  status: WriterChapterStatus
  created_at: string
  updated_at: string
}

export interface WriterScene {
  id: string
  chapter_id: string
  book_id: string
  scene_number: number
  brief: string
  content: string | null
  word_count: number | null
  status: WriterSceneStatus
  locked: boolean
  model_used: string | null
  generation_time_ms: number | null
  created_at: string
  updated_at: string
}

export type BookSectionType =
  | 'dedication'
  | 'epigraph'
  | 'foreword'
  | 'preface'
  | 'acknowledgments'
  | 'prologue'
  | 'introduction'
  | 'conclusion'
  | 'notes'
  | 'about_author'
  | 'also_by'

export interface WriterBookSection {
  id: string
  book_id: string
  type: BookSectionType
  zone: 'front' | 'back'
  enabled: boolean
  position: number
  content: string | null
  created_at: string
  updated_at: string
}

export interface WriterCopyright {
  id: string
  book_id: string
  author_name: string | null
  pen_name: string | null
  edition: string | null
  year: string | null
  publisher_name: string | null
  clauses: { key: string; label: string; enabled: boolean }[]
  collaborators: { name: string; role: string }[]
  custom_text: string | null
  created_at: string
  updated_at: string
}

export interface WriterSceneVersion {
  id: string
  scene_id: string
  version: number
  content: string
  word_count: number | null
  created_at: string
}

// API response types
export interface WriterBookWithChapters extends WriterBook {
  chapters: WriterChapterWithScenes[]
}

export interface WriterChapterWithScenes extends WriterChapter {
  scenes: WriterScene[]
}
