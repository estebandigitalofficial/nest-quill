'use client'

const STANDARD_LABELS = ['Plan', 'Child', 'Story', 'Style', 'Review']
const LEARNING_LABELS = ['Plan', 'Child', 'Story', 'Learning', 'Style', 'Review']

export default function WizardProgress({
  currentStep,
  totalSteps = 5,
}: {
  currentStep: number
  totalSteps?: number
}) {
  const labels = totalSteps === 6 ? LEARNING_LABELS : STANDARD_LABELS

  return (
    <nav aria-label="Form steps" className="mb-8">
      <ol className="flex items-center justify-between relative">
        <li className="absolute inset-x-0 top-4 h-0.5 bg-gray-200 -z-10" aria-hidden="true">
          <div
            className="h-full bg-brand-400 transition-all duration-300"
            style={{ width: `${(currentStep / (labels.length - 1)) * 100}%` }}
          />
        </li>

        {labels.map((label, i) => {
          const done = i < currentStep
          const active = i === currentStep

          return (
            <li key={label} className="flex flex-col items-center gap-1.5">
              <span
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all',
                  done
                    ? 'bg-brand-500 text-white'
                    : active
                    ? 'bg-white border-2 border-brand-500 text-brand-600'
                    : 'bg-white border-2 border-gray-200 text-gray-400',
                ].join(' ')}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={[
                  'text-xs font-medium hidden sm:block',
                  active ? 'text-brand-600' : done ? 'text-gray-500' : 'text-gray-400',
                ].join(' ')}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
