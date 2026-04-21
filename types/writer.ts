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
  model_used: string | null
  generation_time_ms: number | null
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
