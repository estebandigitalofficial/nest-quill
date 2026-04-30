'use client'

import { useFormContext } from 'react-hook-form'
import type { StoryFormValues } from '@/lib/validators/story-form'

const SUBJECTS = [
  { value: 'math', label: 'Math' },
  { value: 'reading', label: 'Reading & Language' },
  { value: 'science', label: 'Science' },
  { value: 'social_studies', label: 'Social Studies' },
  { value: 'spelling', label: 'Spelling & Writing' },
  { value: 'history', label: 'History' },
]

const TOPIC_HINTS: Record<string, string[]> = {
  math: ['Addition & subtraction', 'Multiplication tables', 'Fractions', 'Geometry shapes', 'Telling time', 'Money & counting'],
  reading: ['Sight words', 'Phonics & blending', 'Reading comprehension', 'Story sequencing', 'Main idea & details'],
  science: ['The water cycle', 'Animal habitats', 'Plant life cycle', 'Solar system', 'States of matter', 'Food chains'],
  social_studies: ['Community helpers', 'Maps & directions', 'Continents & oceans', 'American symbols', 'Cultures around the world'],
  spelling: ['Rhyming words', 'Long vowel sounds', 'Silent letters', 'Compound words', 'Prefixes & suffixes'],
  history: ['Pilgrims & Thanksgiving', 'American Revolution', 'Civil Rights', 'Ancient Egypt', 'World War II'],
}

export default function LearningStep() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<StoryFormValues>()
  const subject = watch('learningSubject') ?? ''
  const grade = watch('learningGrade')
  const topic = watch('learningTopic') ?? ''
  const hints = TOPIC_HINTS[subject] ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-serif text-gray-900">What are we learning?</h2>
        <p className="text-sm text-gray-500 mt-1">
          We&apos;ll weave this into the story so your child learns while they read.
        </p>
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Subject</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SUBJECTS.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                setValue('learningSubject', s.value, { shouldValidate: true })
                setValue('learningTopic', '', { shouldValidate: false })
              }}
              className={`text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                subject === s.value
                  ? 'border-brand-500 bg-brand-50 text-oxford'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grade */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Grade level</label>
        <div className="flex flex-wrap gap-2">
          {[1,2,3,4,5,6,7,8].map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setValue('learningGrade', g, { shouldValidate: true })}
              className={`w-10 h-10 rounded-xl border-2 text-sm font-semibold transition-all ${
                grade === g
                  ? 'border-brand-500 bg-brand-50 text-oxford'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400">Select your child&apos;s current grade</p>
      </div>

      {/* Topic */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Specific topic <span className="text-brand-500">*</span>
        </label>
        <input
          type="text"
          placeholder={subject ? `e.g. "${hints[0] ?? 'describe the topic'}"` : 'Choose a subject first…'}
          {...register('learningTopic')}
          className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors"
        />
        {errors.learningTopic && (
          <p className="text-xs text-red-500">{errors.learningTopic.message}</p>
        )}

        {/* Quick-pick hints */}
        {hints.length > 0 && !topic && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {hints.map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setValue('learningTopic', h, { shouldValidate: true })}
                className="text-xs bg-gray-100 hover:bg-brand-50 hover:text-brand-600 text-gray-500 px-2.5 py-1 rounded-full transition-colors"
              >
                {h}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 text-xs text-brand-700 leading-relaxed">
        After the story, there will be a short 5-question quiz to reinforce what they learned.
      </div>
    </div>
  )
}
