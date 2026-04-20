import type { Metadata } from 'next'
import StoryWizard from '@/components/story/wizard/StoryWizard'

export const metadata: Metadata = {
  title: 'Create Your Story',
}

export default function CreatePage() {
  return (
    <div className="py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-serif text-gray-900 mb-2">
            Create Your Story
          </h1>
          <p className="text-gray-500 text-sm">
            A personalized illustrated storybook in minutes.
          </p>
        </div>
        <StoryWizard />
      </div>
    </div>
  )
}
