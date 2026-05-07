// Shared tour types — kept dependency-free so they can be imported from
// both server and client code.

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center'

export type TourAdvanceOn = 'next_button' | 'click'

export interface TourStep {
  id: string
  step_order: number
  /** CSS selector for the highlighted element. null → centred modal step. */
  target_selector: string | null
  title: string
  body: string
  placement: TourPlacement
  action_label: string | null
  requires_interaction: boolean
  /** How the tour advances away from this step. */
  advance_on: TourAdvanceOn
  /** When advance_on='click', the selector that triggers progression. */
  advance_selector: string | null
  /** Hint shown while waiting for the user's action. */
  wait_message: string | null
  /** Optional per-step metadata. Recognised keys:
   *   skip_if_target_missing — auto-advance when target_selector
   *     resolves to nothing (used for branch-only steps like the
   *     adult-consent modal that don't apply to other audiences). */
  config: Record<string, unknown> | null
}

export interface Tour {
  id: string
  key: string
  title: string
  description: string | null
  page: string | null
  steps: TourStep[]
}

export interface TourProgress {
  tour_key: string
  completed: boolean
  skipped: boolean
  last_step: number
}
