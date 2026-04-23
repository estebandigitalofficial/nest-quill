/**
 * Hand-written database types for Phase 1.
 *
 * Once you have Supabase CLI installed and `supabase start` running locally,
 * replace this file by running:
 *   pnpm run types
 *
 * That command runs `supabase gen types typescript --local` which auto-generates
 * perfectly accurate types from your actual database schema.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type PlanTier = 'free' | 'single' | 'story_pack' | 'story_pro' | 'educator'

export type StoryStatus =
  | 'queued'
  | 'generating_text'
  | 'generating_images'
  | 'assembling_pdf'
  | 'complete'
  | 'failed'
  | 'refund_requested'

export type ImageStatus = 'pending' | 'generating' | 'complete' | 'failed'

export type DeliveryChannel = 'email' | 'download'
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced'
export type LogLevel = 'info' | 'warning' | 'error'
export type ExportFormat = 'pdf' | 'print_ready_pdf'

// ─── Table row types ────────────────────────────────────────────────────────

export interface Profile {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  stripe_customer_id: string | null
  plan_tier: PlanTier
  books_generated: number
  books_limit: number
  is_admin: boolean
  metadata: Json
  created_at: string
  updated_at: string
}

export interface Plan {
  id: string
  tier: PlanTier
  display_name: string
  price_monthly_cents: number
  stripe_price_id: string | null
  books_per_month: number
  max_pages_per_book: number
  can_download_pdf: boolean
  can_order_print: boolean
  can_add_dedication: boolean
  features: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StoryRequest {
  id: string
  user_id: string | null
  guest_token: string | null
  plan_tier: PlanTier
  child_name: string
  child_age: number
  child_description: string | null
  story_theme: string
  story_tone: string[]
  story_moral: string | null
  story_length: 8 | 16 | 24 | 32
  illustration_style: string
  dedication_text: string | null
  custom_notes: string | null
  supporting_characters: string | null
  author_name: string | null
  closing_message: string | null
  locale: string
  user_email: string
  status: StoryStatus
  status_message: string | null
  progress_pct: number
  worker_id: string | null
  retry_count: number
  last_error: string | null
  stripe_payment_intent_id: string | null
  stripe_checkout_session_id: string | null
  amount_paid_cents: number | null
  paid_at: string | null
  created_at: string
  updated_at: string
  processing_started_at: string | null
  completed_at: string | null
  learning_mode: boolean
  learning_subject: string | null
  learning_grade: number | null
  learning_topic: string | null
}

export interface QuizQuestion {
  question: string
  options: [string, string, string, string]
  correct_index: 0 | 1 | 2 | 3
  explanation: string
}

export interface StoryQuiz {
  id: string
  request_id: string
  subject: string | null
  grade: number | null
  topic: string | null
  questions: QuizQuestion[]
  created_at: string
}

export interface QuizResult {
  id: string
  request_id: string
  user_id: string | null
  guest_token: string | null
  score: number
  total: number
  answers: { question_index: number; selected_index: number; correct: boolean }[]
  completed_at: string
}

export interface GeneratedStory {
  id: string
  request_id: string
  title: string
  subtitle: string | null
  author_line: string
  dedication: string | null
  synopsis: string | null
  full_text_json: StoryPage[]
  raw_llm_output: string | null
  model_used: string
  prompt_tokens: number | null
  completion_tokens: number | null
  generation_time_ms: number | null
  created_at: string
}

export interface StoryScene {
  id: string
  story_id: string
  request_id: string
  page_number: number
  page_text: string
  image_prompt: string
  image_status: ImageStatus
  image_url: string | null
  storage_path: string | null
  storage_bucket: string
  image_model: string | null
  image_revised_prompt: string | null
  generation_attempts: number
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface BookExport {
  id: string
  request_id: string
  format: ExportFormat
  storage_path: string
  storage_bucket: string
  file_size_bytes: number | null
  page_count: number | null
  signed_url: string | null
  signed_url_expires_at: string | null
  render_time_ms: number | null
  is_latest: boolean
  created_at: string
}

export interface DeliveryLog {
  id: string
  request_id: string
  export_id: string | null
  channel: DeliveryChannel
  status: DeliveryStatus
  recipient_email: string | null
  resend_message_id: string | null
  opened_at: string | null
  delivered_at: string | null
  failed_at: string | null
  failure_reason: string | null
  retry_count: number
  created_at: string
  updated_at: string
}

export interface ProcessingLog {
  id: number
  request_id: string
  level: LogLevel
  stage: string
  message: string
  duration_ms: number | null
  metadata: Json
  created_at: string
}

// ─── Convenience type for a story page inside full_text_json ────────────────
export interface StoryPage {
  page: number
  text: string
  image_description: string
}

// ─── Supabase Database shape (used by createClient<Database>) ───────────────
// Must include Views, Functions, Enums, CompositeTypes for correct type inference.
// Replace this entire file by running `pnpm run types` once Supabase CLI is set up.
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile>; Relationships: [] }
      plans: { Row: Plan; Insert: Partial<Plan>; Update: Partial<Plan>; Relationships: [] }
      story_requests: { Row: StoryRequest; Insert: Partial<StoryRequest>; Update: Partial<StoryRequest>; Relationships: [] }
      generated_stories: { Row: GeneratedStory; Insert: Partial<GeneratedStory>; Update: Partial<GeneratedStory>; Relationships: [] }
      story_scenes: { Row: StoryScene; Insert: Partial<StoryScene>; Update: Partial<StoryScene>; Relationships: [] }
      book_exports: { Row: BookExport; Insert: Partial<BookExport>; Update: Partial<BookExport>; Relationships: [] }
      delivery_logs: { Row: DeliveryLog; Insert: Partial<DeliveryLog>; Update: Partial<DeliveryLog>; Relationships: [] }
      processing_logs: { Row: ProcessingLog; Insert: Partial<ProcessingLog>; Update: Partial<ProcessingLog>; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: {
      increment_books_generated: {
        Args: { user_id_input: string }
        Returns: void
      }
    }
    Enums: {
      plan_tier: PlanTier
      story_status: StoryStatus
      image_status: ImageStatus
      delivery_channel: DeliveryChannel
      delivery_status: DeliveryStatus
      log_level: LogLevel
      export_format: ExportFormat
    }
    CompositeTypes: Record<string, never>
  }
}