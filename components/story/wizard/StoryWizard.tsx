'use client'

import { useState } from 'react'
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

interface SubmitResult {
  requestId: string
  status: string
  childName: string
  email: string
}

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
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<SubmitResult | null>(null)

  const methods = useForm<StoryFormValues>({
    resolver: zodResolver(storyFormSchema),
    defaultValues: {
      planTier: 'free',
      storyLength: 16,
      illustrationStyle: 'watercolor',
      storyTone: [],
    },
    mode: 'onTouched',
  })

  const { handleSubmit, trigger, setError, getValues, formState: { isSubmitting } } = methods

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

      setResult({
        requestId: json.requestId,
        status: json.status,
        childName: data.childName,
        email: data.userEmail,
      })
    } catch {
      setError('root', {
        message: 'Could not reach the server. Check your connection and try again.',
      })
    }
  }

  if (result) {
    return <SuccessScreen {...result} onReset={() => { setResult(null); setStep(0) }} />
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

function SuccessScreen({
  requestId,
  childName,
  email,
  onReset,
}: SubmitResult & { onReset: () => void }) {
  const shortId = requestId.slice(0, 8).toUpperCase()

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10 text-center space-y-5">
      <div className="text-5xl">📖</div>

      <div>
        <h2 className="text-2xl font-serif text-gray-900 mb-2">
          {childName}&apos;s story is in the queue!
        </h2>
        <p className="text-gray-500 text-sm">
          We&apos;ll send the finished book to{' '}
          <span className="font-medium text-gray-700">{email}</span>.
        </p>
      </div>

      <div className="bg-brand-50 border border-brand-100 rounded-xl px-5 py-4">
        <p className="text-xs text-gray-400 mb-1">Reference number</p>
        <p className="font-mono text-sm font-semibold text-gray-700">{shortId}</p>
      </div>

      <p className="text-xs text-gray-400">
        Story generation is coming soon. You&apos;ll receive an email when it&apos;s ready.
      </p>

      <button
        onClick={onReset}
        className="text-sm text-brand-600 hover:text-brand-700 font-medium underline underline-offset-2"
      >
        Create another story
      </button>
    </div>
  )
}
