'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { storyFormSchema, type StoryFormValues } from '@/lib/validators/story-form'
import { cn } from '@/lib/utils/cn'
import WizardProgress from './WizardProgress'
import PlanStep from './steps/PlanStep'
import ChildStep from './steps/ChildStep'
import StoryStep from './steps/StoryStep'
import LearningStep from './steps/LearningStep'
import StyleStep from './steps/StyleStep'
import ReviewStep from './steps/ReviewStep'

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

export default function StoryWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(0)
  const [learningMode, setLearningMode] = useState(false)

  const methods = useForm<StoryFormValues>({
    resolver: zodResolver(storyFormSchema),
    defaultValues: {
      planTier: 'free',
      storyLength: 8,
      illustrationStyle: 'watercolor',
      storyTone: [],
      learningMode: false,
    },
    mode: 'onTouched',
  })

  const { handleSubmit, trigger, setError, setValue, formState: { isSubmitting, errors } } = methods

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

  function toggleLearningMode(on: boolean) {
    setLearningMode(on)
    setValue('learningMode', on)
    setStep(0)
  }

  async function handleNext() {
    const fields = STEP_FIELDS[step]
    const valid = await trigger(fields)
    if (valid) setStep((s) => s + 1)
  }

  function handleBack() {
    setStep((s) => Math.max(0, s - 1))
  }

  async function onSubmit(data: StoryFormValues) {
    try {
      const res = await fetch('/api/story/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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
    <FormProvider {...methods}>
      {/* Mode toggle — shown only on step 0 */}
      {step === 0 && (
        <div className="flex items-center bg-gray-100 rounded-2xl p-1 mb-2">
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
            Story
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
            Learning Story
          </button>
        </div>
      )}

      <WizardProgress currentStep={step} totalSteps={STEPS.length} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6">
          <StepComponent />
        </div>

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
          {step > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
          )}

          {isLastStep ? (
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'flex-1 py-3.5 px-6 rounded-xl font-semibold text-white text-base transition-all',
                isSubmitting
                  ? 'bg-brand-300 cursor-not-allowed'
                  : 'bg-brand-500 hover:bg-brand-600 active:scale-[0.99]'
              )}
            >
              {isSubmitting ? 'Creating your story…' : learningMode ? 'Create Learning Story →' : 'Create My Story →'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 py-3.5 px-6 rounded-xl font-semibold text-white text-base bg-brand-500 hover:bg-brand-600 active:scale-[0.99] transition-all"
            >
              Next →
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
  )
}
