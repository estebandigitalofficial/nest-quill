import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { getSetting } from '@/lib/settings/appSettings'

export const metadata = { title: 'Privacy Policy — Nest & Quill' }
// Re-read beta_mode_enabled on every request so an admin toggle takes
// effect without a redeploy or page revalidation window.
export const dynamic = 'force-dynamic'

export default async function PrivacyPage() {
  // Beta-only sections appear when the admin beta toggle is on; the
  // non-beta copy below is the default and assumes a normal product
  // experience (illustrated stories, real billing).
  const betaMode = (await getSetting('beta_mode_enabled', false)) as boolean

  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford">← Back</Link>} />

      <div className="flex-1 overflow-y-auto">
      <main className="max-w-3xl mx-auto px-6 py-14 space-y-10 w-full">
        <div>
          <h1 className="font-serif text-4xl text-oxford mb-3">Privacy Policy</h1>
          <p className="text-sm text-charcoal-light">Last updated: May 2026</p>
          <p className="text-sm text-charcoal-light mt-1">Nest &amp; Quill is operated by Bright Tale Books.</p>
        </div>

        <Section title="Overview">
          <p>
            This Privacy Policy explains what information we collect, how we use it, and how we protect it.
          </p>
          <p>By using the Service, you agree to this policy.</p>
        </Section>

        {betaMode && (
          <Section title="Beta Notice">
            <p>
              Nest &amp; Quill is currently in beta. Some paid features may be free during this period and
              certain capabilities (such as illustration generation) may be paused or limited. We will give
              reasonable notice before enabling billing or removing beta accommodations.
            </p>
          </Section>
        )}

        <Section title="Information We Collect">
          <p><strong>Account Information</strong></p>
          <ul>
            <li>Name</li>
            <li>Email address</li>
            <li>Account role (parent, student, educator)</li>
            <li>
              Guest token (a per-browser cookie) when you submit a story without signing in, so we can show
              you the story in progress and, if you later create an account with the same email, link the
              story to your account.
            </li>
          </ul>
          <p><strong>User Content</strong></p>
          <ul>
            <li>Story inputs and preferences (including drafts and submitted stories)</li>
            <li>Study Helper material (text or images you provide for learning)</li>
            <li>Quiz answers, flashcard responses, and other learning-activity submissions</li>
            <li>In-app notifications addressed to your account (titles, links, read state)</li>
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
          <p>We send three categories of email:</p>
          <ul>
            <li>
              <strong>Transactional</strong> — story-ready, story-failed, password reset, and other
              account-essential messages.
            </li>
            <li>
              <strong>Educational</strong> — occasional tips and onboarding suggestions; you can
              unsubscribe at any time.
            </li>
            <li>
              <strong>Administrative</strong> — service announcements such as billing changes or policy
              updates.
            </li>
          </ul>
          <p>You will not be enrolled in marketing email lists by default.</p>
        </Section>

        <Section title="AI Processing">
          <p>
            To generate content, user inputs may be sent to third-party AI providers (such as OpenAI).
            These providers process data solely to return results to the Service.
          </p>
          <p>We do not use your content to train external AI models.</p>
        </Section>

        <Section title="Cookies and Local Storage">
          <p>We use a small number of essential cookies and browser storage entries:</p>
          <ul>
            <li>An authentication session cookie so you stay signed in.</li>
            <li>A guest token (when applicable) so a guest submission can be claimed on later sign-up.</li>
            <li>Preference flags such as theme or cookie-banner dismissal.</li>
          </ul>
          <p>We do not use third-party advertising trackers.</p>
        </Section>

        <Section title="Student and Minor Data">
          <p>
            Students participate in Nest &amp; Quill through a classroom managed by an educator or, in
            the home setting, with a parent&apos;s supervision. The educator or parent is responsible for
            obtaining any consent required by their school, district, or local law before enrolling a student.
          </p>
          <p>
            We collect only the data needed to operate the educational service the educator or parent has
            requested: the student&apos;s display name, optional avatar, classroom membership, and the
            student&apos;s responses to assigned activities. We do not sell or share student data, and we
            do not use student-submitted content to train external AI models.
          </p>
          <p>
            A student&apos;s submissions are visible to the educator who owns the classroom and to
            Nest &amp; Quill administrators for support and moderation. They are not shared with sponsors
            or with other students unless the educator explicitly enables that within a feature.
          </p>
        </Section>

        <Section title="Adult Content Data">
          <p>
            When users opt into adult story creation, we collect an additional consent acknowledgment
            confirming the user is at least 18 years old. This consent record is stored alongside the
            story request.
          </p>
          <p>
            Adult story content is generated using a separate AI configuration. The same data handling
            and retention policies apply to adult stories as to all other content on the platform.
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
          <p>
            We may also partner with brands (&ldquo;Sponsors&rdquo;) who fund classroom rewards. Sponsors
            do not receive student personal data. If you redeem a sponsor-funded reward, only the
            information needed to fulfill the reward is shared with the relevant Sponsor or fulfillment
            partner.
          </p>
        </Section>

        <Section title="Data Security">
          <p>
            We use reasonable safeguards to protect your data. However, no system is completely secure.
          </p>
        </Section>

        <Section title="Data Retention">
          <p>
            We retain account data for as long as you have an account with us. Stories you archive
            remain in our system in a hidden state and can be restored from your account.
          </p>
          <p>
            To request permanent deletion of your account or specific stories, contact support; we will
            remove the data from our active databases within 30 days, subject to backup retention
            windows.
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
