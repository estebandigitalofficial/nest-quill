'use client'

import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { storyFormSchema, type StoryFormValues } from '@/lib/validators/story-form'
import { ILLUSTRATION_STYLES } from '@/types/story'
import { cn } from '@/lib/utils/cn'

interface SubmitResult {
  requestId: string
  status: string
}

export default function StoryForm() {
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<StoryFormValues>({
    resolver: zodResolver(storyFormSchema),
    defaultValues: {
      storyLength: 16,
      illustrationStyle: 'watercolor',
    },
  })

  async function onSubmit(data: StoryFormValues) {
    try {
      const res = await fetch('/api/story/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const json = await res.json()

      if (!res.ok) {
        // Must use setError, not throw — React Hook Form silently
        // swallows throws inside onSubmit and shows nothing to the user.
        setError('root', {
          message: json.message ?? 'Something went wrong. Please try again.',
        })
        return
      }

      setSubmitResult({ requestId: json.requestId, status: json.status })
    } catch {
      setError('root', {
        message: 'Could not reach the server. Check your connection and try again.',
      })
    }
  }

  if (submitResult) {
    return (
      <SuccessScreen
        requestId={submitResult.requestId}
        childName={getValues('childName')}
        email={getValues('userEmail')}
        onReset={() => setSubmitResult(null)}
      />
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-8"
    >
      <Section title="About the child">
        <Field label="Child's name" error={errors.childName?.message} required>
          <input
            id="childName"
            type="text"
            placeholder="e.g. Sofia"
            autoComplete="off"
            {...register('childName')}
            className={inputClass(!!errors.childName)}
          />
        </Field>

        <Field label="Age" error={errors.childAge?.message} required>
          <input
            id="childAge"
            type="number"
            min={1}
            max={12}
            placeholder="e.g. 5"
            {...register('childAge', { valueAsNumber: true })}
            className={cn(inputClass(!!errors.childAge), 'w-28')}
          />
        </Field>
      </Section>

      <Section title="Story details">
        <Field
          label="Story theme"
          error={errors.storyTheme?.message}
          hint="What should the story be about? Be as specific or simple as you like."
          required
        >
          <input
            id="storyTheme"
            type="text"
            placeholder="e.g. A brave rabbit who learns to share"
            autoComplete="off"
            {...register('storyTheme')}
            className={inputClass(!!errors.storyTheme)}
          />
        </Field>

        <Field label="Story length" error={errors.storyLength?.message} required>
          <select
            id="storyLength"
            {...register('storyLength', { valueAsNumber: true })}
            className={inputClass(!!errors.storyLength)}
          >
            <option value={8}>Short — 8 pages</option>
            <option value={16}>Standard — 16 pages</option>
            <option value={24}>Long — 24 pages</option>
            <option value={32}>Epic — 32 pages</option>
          </select>
        </Field>

        <Field
          label="Illustration style"
          error={errors.illustrationStyle?.message}
          required
        >
          <select
            id="illustrationStyle"
            {...register('illustrationStyle')}
            className={inputClass(!!errors.illustrationStyle)}
          >
            {Object.entries(ILLUSTRATION_STYLES).map(([value, { label, description }]) => (
              <option key={value} value={value}>
                {label} — {description}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Where to send it">
        <Field
          label="Your email address"
          error={errors.userEmail?.message}
          hint="We'll send the finished book here."
          required
        >
          <input
            id="userEmail"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            {...register('userEmail')}
            className={inputClass(!!errors.userEmail)}
          />
        </Field>
      </Section>

      {errors.root && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {errors.root.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          'w-full py-3.5 px-6 rounded-xl font-semibold text-white text-base transition-all',
          isSubmitting
            ? 'bg-brand-300 cursor-not-allowed'
            : 'bg-brand-500 hover:bg-brand-600 active:scale-[0.99]'
        )}
      >
        {isSubmitting ? 'Creating your story…' : 'Create My Story →'}
      </button>

      <p className="text-center text-xs text-gray-400">
        Free plan · No account required
      </p>
    </form>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-brand-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function SuccessScreen({
  requestId,
  childName,
  email,
  onReset,
}: {
  requestId: string
  childName: string
  email: string
  onReset: () => void
}) {
  const shortId = requestId.slice(0, 8).toUpperCase()

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10 text-center space-y-5">
      <p className="text-xl font-bold text-brand-500">Story Queued</p>

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

function inputClass(hasError: boolean) {
  return cn(
    'w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 bg-white',
    'placeholder:text-gray-300',
    'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent',
    'transition-colors',
    hasError
      ? 'border-red-300 bg-red-50'
      : 'border-gray-200 hover:border-gray-300'
  )
}
