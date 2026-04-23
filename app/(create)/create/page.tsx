import type { Metadata } from 'next'
import { Suspense } from 'react'
import StoryWizard from '@/components/story/wizard/StoryWizard'

export const metadata: Metadata = {
  title: 'Create Your Story',
  description: 'Personalize a storybook for your child in minutes — choose a theme, add their name, and we\'ll write and illustrate it with AI.',
  openGraph: {
    title: 'Create a Personalized Storybook — Nest & Quill',
    description: 'Personalize a storybook for your child in minutes — choose a theme, add their name, and we\'ll write and illustrate it with AI.',
  },
}

export default function CreatePage() {
  return (
    <div className="py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-serif text-oxford mb-2">
            Create Your Story
          </h1>
          <p className="text-charcoal-light text-sm">
            A personalized illustrated storybook in minutes.
          </p>
        </div>
        <Suspense>
          <StoryWizard />
        </Suspense>
      </div>
    </div>
  )
}
