'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { storyFormSchema, type StoryFormValues } from '@/lib/validators/story-form'
import { cn } from '@/lib/utils/cn'
import { useLanguage } from '@/lib/i18n/context'
import { PLAN_CONFIG, WIZARD_PLANS } from '@/lib/plans/config'
import type { PlanTier } from '@/types/database'
import WizardProgress from './WizardProgress'
import { WizardConfigContext } from './WizardContext'
import PlanStep from './steps/PlanStep'
import ChildStep from './steps/ChildStep'
import StoryStep from './steps/StoryStep'
import LearningStep from './steps/LearningStep'
import StyleStep from './steps/StyleStep'
import ReviewStep from './steps/ReviewStep'
import TourRunner from '@/components/tour/TourRunner'

// Standard story steps + validation fields
const STANDARD_STEPS = [PlanStep, ChildStep, StoryStep, StyleStep, ReviewStep]
const STANDARD_FIELDS: (keyof StoryFormValues)[][] = [
  ['planTier'],
  ['childName', 'childAge'],
  ['storyTheme', 'storyTone'],
  ['illustrationStyle', 'storyLength'],
  ['userEmail'],
]

// Learning story steps (insert LearningStep before StyleStep)
const LEARNING_STEPS = [PlanStep, ChildStep, StoryStep, LearningStep, StyleStep, ReviewStep]
const LEARNING_FIELDS: (keyof StoryFormValues)[][] = [
  ['planTier'],
  ['childName', 'childAge'],
  ['storyTheme', 'storyTone'],
  ['learningSubject', 'learningGrade', 'learningTopic'],
  ['illustrationStyle', 'storyLength'],
  ['userEmail'],
]

// Resolve a ?plan=<tier> query param to a valid plan tier — only the four
// tiers in WIZARD_PLANS are accepted, anything else falls back to null and
// the wizard renders the normal plan-picker step.
function planFromQuery(raw: string | null): PlanTier | null {
  if (!raw) return null
  return (WIZARD_PLANS as readonly string[]).includes(raw) ? (raw as PlanTier) : null
}

// Resolve the signed-in user's profiles.plan_tier into an implicit
// preselect. Free tier returns null so authenticated free users still
// see the picker (they're a conversion target, not a sticky selection).
// Tiers outside WIZARD_PLANS — e.g. 'educator' — also return null so
// those users get the picker rather than an unsupported wizard branch.
function planFromAccount(raw: string | null | undefined): PlanTier | null {
  if (!raw || raw === 'free') return null
  return (WIZARD_PLANS as readonly string[]).includes(raw) ? (raw as PlanTier) : null
}

export default function StoryWizard({
  betaMode = false,
  accountPlan = null,
}: {
  betaMode?: boolean
  /** profiles.plan_tier for the signed-in user; null/undefined for guests. */
  accountPlan?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { lang, t } = useLanguage()
  // Resolution order for the implicit preselect:
  //   1. ?plan=<tier> query param (highest — explicit user intent)
  //   2. authenticated user's plan_tier when it's a paid tier
  //   3. nothing — render the picker
  const urlPlan = planFromQuery(searchParams.get('plan'))
  const accountInitial = planFromAccount(accountPlan)
  const initialPlan = urlPlan ?? accountInitial
  // Whether the preselect came from the user's account (vs the URL).
  // Drives the pill copy and stays stable across renders since the
  // values it depends on are fixed at mount time.
  const preselectFromAccount = !urlPlan && accountInitial !== null
  const [step, setStep] = useState(initialPlan ? 1 : 0)
  const [planPreselected, setPlanPreselected] = useState(!!initialPlan)
  const [learningMode, setLearningMode] = useState(false)

  const methods = useForm<StoryFormValues>({
    resolver: zodResolver(storyFormSchema),
    defaultValues: {
      planTier: initialPlan ?? 'free',
      storyLength: Math.min((initialPlan ? PLAN_CONFIG[initialPlan].limits.maxPagesPerBook : 8), 16) as 8 | 16 | 24 | 32,
      illustrationStyle: 'watercolor',
      storyTone: [],
      learningMode: false,
    },
    mode: 'onTouched',
  })

  const { handleSubmit, trigger, setError, setValue, watch, formState: { isSubmitting, errors } } = methods
  const currentPlan = watch('planTier')

  // Auto-enable learning mode when ?mode=learning is in the URL
  useEffect(() => {
    if (searchParams.get('mode') === 'learning') {
      setLearningMode(true)
      setValue('learningMode', true)
    }
  }, [searchParams, setValue])

  const STEPS = learningMode ? LEARNING_STEPS : STANDARD_STEPS
  const STEP_FIELDS = learningMode ? LEARNING_FIELDS : STANDARD_FIELDS
  const isLastStep = step === STEPS.length - 1
  const StepComponent = STEPS[step]
  // Map the active wizard step to the tour selector convention.
  // Selector values match the seed in 20240051_guided_tours.sql; the
  // tour highlights whichever step is currently rendered, so users
  // can read the popover and follow the wizard at their own pace.
  const STEP_TOUR_IDS_STANDARD = ['plan-step', 'child-step', 'story-step', 'style-step', 'review-step']
  const STEP_TOUR_IDS_LEARNING = ['plan-step', 'child-step', 'story-step', 'learning-step', 'style-step', 'review-step']
  const stepTourId = (learningMode ? STEP_TOUR_IDS_LEARNING : STEP_TOUR_IDS_STANDARD)[step] ?? null
  const replayTour = searchParams.get('replayTour') === 'create_story_wizard'

  // The "first visible" step depends on whether the user came in with a plan
  // pre-selected via ?plan=... — when they did, the plan-picker is skipped so
  // step 1 (ChildStep) is the first thing they see. The mode toggle and the
  // "Plan selected · Change" pill both anchor to this step.
  const firstVisibleStep = planPreselected ? 1 : 0

  function toggleLearningMode(on: boolean) {
    setLearningMode(on)
    setValue('learningMode', on)
    setStep(firstVisibleStep)
  }

  function showPlanPicker() {
    // Drop the preselected flag so the wizard returns to its full default
    // shape — back button, normal first step, etc. The current planTier is
    // preserved so the user starts from where they were.
    setPlanPreselected(false)
    setStep(0)
    // Strip ?plan= from the URL so a refresh doesn't re-apply the
    // preselection the user just opted out of. Other params (e.g.
    // ?mode=learning) are preserved.
    if (searchParams.get('plan')) {
      const next = new URLSearchParams(searchParams.toString())
      next.delete('plan')
      const qs = next.toString()
      router.replace(qs ? `/create?${qs}` : '/create', { scroll: false })
    }
  }

  async function handleNext() {
    const fields = STEP_FIELDS[step]
    const valid = await trigger(fields)
    if (valid) setStep((s) => s + 1)
  }

  function handleBack() {
    setStep((s) => Math.max(firstVisibleStep, s - 1))
  }

  async function onSubmit(data: StoryFormValues) {
    try {
      const res = await fetch('/api/story/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, language: lang }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError('root', {
          type: json.requiresSignup ? 'GUEST_LIMIT_EXCEEDED' : (json.code ?? 'error'),
          message: json.message ?? 'Something went wrong. Please try again.',
        })
        return
      }

      router.push(`/story/${json.requestId}`)
    } catch {
      setError('root', {
        message: 'Could not reach the server. Check your connection and try again.',
      })
    }
  }

  return (
    <WizardConfigContext.Provider value={{ betaMode }}>
    <FormProvider {...methods}>
      {/* Plan-selected pill — only when ?plan=... preselected the tier and
          we're still on the first visible step. Lets the user jump back to
          the normal plan picker if they want a different one. */}
      {planPreselected && step === firstVisibleStep && (
        <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-xl px-4 py-2.5 mb-2">
          <p className="text-xs text-brand-700">
            <span className="font-semibold">{preselectFromAccount ? 'Current plan:' : 'Plan selected:'}</span>{' '}
            {PLAN_CONFIG[currentPlan].displayName}
          </p>
          <button
            type="button"
            onClick={showPlanPicker}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2"
          >
            Change plan
          </button>
        </div>
      )}

      {/* Mode toggle — shown on the first visible step (step 0 by default,
          step 1 when a plan was preselected via ?plan=...). */}
      {step === firstVisibleStep && (
        <div data-tour-id="mode-toggle" className="flex items-center bg-gray-100 rounded-2xl p-1 mb-2">
          {planPreselected && (
            <span className="sr-only">What would you like to create?</span>
          )}
          <button
            type="button"
            onClick={() => toggleLearningMode(false)}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
              !learningMode
                ? 'bg-white text-oxford shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            )}
          >
            {t.wizard.modeStory}
          </button>
          <button
            type="button"
            onClick={() => toggleLearningMode(true)}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
              learningMode
                ? 'bg-white text-oxford shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            )}
          >
            {t.wizard.modeLearning}
          </button>
        </div>
      )}

      <WizardProgress currentStep={step} totalSteps={STEPS.length} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <div
          data-tour-id={stepTourId ?? undefined}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6"
        >
          <StepComponent />
        </div>

        {/* Guided tour overlay — opt-in via the tour table being enabled.
            forceReplay kicks in when the user clicks "Replay tour" from
            the help menu (which sets ?replayTour=create_story_wizard). */}
        <TourRunner tourKey="create_story_wizard" forceReplay={replayTour} />

        {errors.root && (
          errors.root.type === 'GUEST_LIMIT_EXCEEDED' ? (
            <div className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 text-center space-y-2">
              <p className="text-sm font-semibold text-oxford">You&apos;ve used your free story</p>
              <p className="text-xs text-charcoal-light">Create a free account to get 2 stories.</p>
              <div className="flex justify-center gap-2 mt-1">
                <Link
                  href="/signup"
                  className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2 rounded-full transition-colors"
                >
                  Create account →
                </Link>
                <Link
                  href="/login"
                  className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-5 py-2 rounded-full transition-colors"
                >
                  Sign in
                </Link>
              </div>
            </div>
          ) : errors.root.type === 'PLAN_LIMIT_EXCEEDED' ? (
            <div className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 text-center space-y-2">
              <p className="text-sm font-semibold text-oxford">You&apos;ve reached your free limit</p>
              <p className="text-xs text-charcoal-light">Upgrade to create more personalized storybooks.</p>
              <Link
                href="/pricing"
                className="inline-block mt-1 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2 rounded-full transition-colors"
              >
                See plans →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 text-center">
              {errors.root.message}
            </p>
          )
        )}

        <div className="flex items-center gap-3">
          {step > firstVisibleStep && (
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {t.wizard.back}
            </button>
          )}

          {isLastStep ? (
            <button
              data-tour-id="submit-button"
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'flex-1 py-3.5 px-6 rounded-xl font-semibold text-white text-base transition-all',
                isSubmitting
                  ? 'bg-brand-300 cursor-not-allowed'
                  : 'bg-brand-500 hover:bg-brand-600 active:scale-[0.99]'
              )}
            >
              {isSubmitting ? t.wizard.review.submitting : t.wizard.review.submit}
            </button>
          ) : (
            <button
              data-tour-id="wizard-next"
              type="button"
              onClick={handleNext}
              className="flex-1 py-3.5 px-6 rounded-xl font-semibold text-white text-base bg-brand-500 hover:bg-brand-600 active:scale-[0.99] transition-all"
            >
              {t.wizard.next}
            </button>
          )}
        </div>

        {step === 0 && (
          <p className="text-center text-xs text-gray-400">
            Try 1 story without an account · Free accounts get 2 stories
          </p>
        )}
      </form>
    </FormProvider>
    </WizardConfigContext.Provider>
  )
}
