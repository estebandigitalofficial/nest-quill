'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { storyFormSchema, type StoryFormValues } from '@/lib/validators/story-form'
import { cn } from '@/lib/utils/cn'
import WizardProgress from './WizardProgress'
import PlanStep from './steps/PlanStep'
import ChildStep from './steps/ChildStep'
import StoryStep from './steps/StoryStep'
import StyleStep from './steps/StyleStep'
import ReviewStep from './steps/ReviewStep'

// Fields validated when clicking "Next" on each step index
const STEP_FIELDS: (keyof StoryFormValues)[][] = [
  ['planTier'],
  ['childName', 'childAge'],
  ['storyTheme', 'storyTone'],
  ['illustrationStyle', 'storyLength'],
  ['userEmail'],
]

const STEPS = [PlanStep, ChildStep, StoryStep, StyleStep, ReviewStep]

export default function StoryWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)

  const methods = useForm<StoryFormValues>({
    resolver: zodResolver(storyFormSchema),
    defaultValues: {
      planTier: 'free',
      storyLength: 8,
      illustrationStyle: 'watercolor',
      storyTone: [],
    },
    mode: 'onTouched',
  })

  const { handleSubmit, trigger, setError, formState: { isSubmitting } } = methods

  const isLastStep = step === STEPS.length - 1
  const StepComponent = STEPS[step]

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
      <WizardProgress currentStep={step} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6">
          <StepComponent />
        </div>

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
              {isSubmitting ? 'Creating your story…' : 'Create My Story →'}
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
            No account required · Free during beta
          </p>
        )}
      </form>
    </FormProvider>
  )
}

