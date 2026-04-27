import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export const metadata = { title: 'Privacy Policy — Nest & Quill' }

export default function PrivacyPage() {
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford">← Back</Link>} />

      <div className="flex-1 overflow-y-auto">
      <main className="max-w-3xl mx-auto px-6 py-14 space-y-10 w-full">
        <div>
          <h1 className="font-serif text-4xl text-oxford mb-3">Privacy Policy</h1>
          <p className="text-sm text-charcoal-light">Last updated: April 2026</p>
          <p className="text-sm text-charcoal-light mt-1">Nest &amp; Quill is operated by Bright Tale Books.</p>
        </div>

        <Section title="Overview">
          <p>
            This Privacy Policy explains what information we collect, how we use it, and how we protect it.
          </p>
          <p>By using the Service, you agree to this policy.</p>
        </Section>

        <Section title="Information We Collect">
          <p><strong>Account Information</strong></p>
          <ul>
            <li>Name</li>
            <li>Email address</li>
            <li>Account role (parent, student, educator)</li>
          </ul>
          <p><strong>User Content</strong></p>
          <ul>
            <li>Story inputs and preferences</li>
            <li>Study Helper material (text you provide for learning)</li>
            <li>Quiz answers and learning activity responses</li>
          </ul>
          <p><strong>Classroom Data</strong></p>
          <ul>
            <li>Class memberships</li>
            <li>Assignments and submissions</li>
            <li>Progress data (scores, XP, streaks, badges)</li>
          </ul>
          <p><strong>Usage Data</strong></p>
          <ul>
            <li>Interaction with features</li>
            <li>Basic analytics to improve performance</li>
          </ul>
        </Section>

        <Section title="How We Use Information">
          <p>We use your information to:</p>
          <ul>
            <li>Provide and operate the Service</li>
            <li>Generate AI content (stories, learning tools, etc.)</li>
            <li>Track learning progress and assignment completion</li>
            <li>Improve product functionality and user experience</li>
            <li>Communicate important updates</li>
          </ul>
        </Section>

        <Section title="AI Processing">
          <p>
            To generate content, user inputs may be sent to third-party AI providers (such as OpenAI).
            These providers process data solely to return results to the Service.
          </p>
          <p>We do not use your content to train external AI models.</p>
        </Section>

        <Section title="Student and Minor Data">
          <p>
            Students may use Nest &amp; Quill through teacher- or parent-managed environments.
          </p>
          <p>
            We do not knowingly collect personal data directly from children without supervision.
            Educators and parents are responsible for managing student participation.
          </p>
        </Section>

        <Section title="Data Sharing">
          <p>We do not sell your personal information.</p>
          <p>We may share data with:</p>
          <ul>
            <li>Service providers (e.g., hosting, payments, email delivery)</li>
            <li>AI providers for content generation</li>
            <li>Legal authorities when required</li>
          </ul>
        </Section>

        <Section title="Data Security">
          <p>
            We use reasonable safeguards to protect your data. However, no system is completely secure.
          </p>
        </Section>

        <Section title="Data Retention">
          <p>
            We retain data as long as necessary to operate the Service and improve user experience.
          </p>
        </Section>

        <Section title="Your Rights">
          <p>You may:</p>
          <ul>
            <li>Access or update your information</li>
            <li>Request account deletion</li>
            <li>Contact us with privacy concerns</li>
          </ul>
        </Section>

        <Section title="Changes to This Policy">
          <p>
            We may update this policy from time to time. Continued use of the Service indicates acceptance
            of updates.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For privacy-related questions, contact:{' '}
            <a href="mailto:contact@nestandquill.com" className="text-brand-600 hover:text-brand-700">
              contact@nestandquill.com
            </a>.
          </p>
        </Section>
      </main>
      </div>
      <SiteFooter />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-xl text-oxford">{title}</h2>
      <div className="text-sm text-charcoal leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:text-brand-600 [&_a]:hover:text-brand-700">
        {children}
      </div>
    </section>
  )
}
