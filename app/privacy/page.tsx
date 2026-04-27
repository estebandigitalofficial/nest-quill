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
          <p className="text-sm text-charcoal-light">Last updated: April 2025</p>
          <p className="text-sm text-charcoal-light mt-1">Nest &amp; Quill is operated by Bright Tale Books.</p>
        </div>

        <Section title="Overview">
          <p>
            Nest &amp; Quill (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is committed to protecting your privacy.
            This policy explains what information we collect when you use our website and services,
            how we use it, and your rights regarding that information.
          </p>
        </Section>

        <Section title="Information we collect">
          <ul>
            <li><strong>Account information</strong> — your email address and password when you create an account.</li>
            <li><strong>Story information</strong> — the details you provide when creating a story: child&apos;s name, age, interests, story preferences, and any custom notes.</li>
            <li><strong>Payment information</strong> — processed securely by Stripe. We never store your full card number.</li>
            <li><strong>Usage data</strong> — pages visited, features used, and other standard analytics to help us improve the service.</li>
            <li><strong>Cookies</strong> — a guest token cookie to associate stories with your browser session before you create an account, and session cookies for authentication.</li>
          </ul>
        </Section>

        <Section title="How we use your information">
          <ul>
            <li>To generate and deliver your personalized storybooks.</li>
            <li>To send you your completed story and transactional emails (story ready, order confirmation).</li>
            <li>To process payments and manage your subscription.</li>
            <li>To improve our AI models and the quality of generated stories (using anonymized data only).</li>
            <li>To respond to support requests and communicate important service updates.</li>
          </ul>
        </Section>

        <Section title="Third-party services">
          <p>We share data with the following trusted third parties only as necessary to provide the service:</p>
          <ul>
            <li><strong>Supabase</strong> — database and authentication hosting.</li>
            <li><strong>OpenAI</strong> — AI text and image generation. Story prompts are sent to OpenAI&apos;s API. See <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer">OpenAI&apos;s Privacy Policy</a>.</li>
            <li><strong>Stripe</strong> — payment processing.</li>
            <li><strong>Resend</strong> — transactional email delivery.</li>
          </ul>
          <p>We do not sell your personal data to any third party.</p>
        </Section>

        <Section title="Children's privacy">
          <p>
            Our service creates stories featuring children&apos;s names and ages provided by parents or guardians.
            We do not knowingly collect personal information directly from children under 13.
            The information you provide about a child (name, age, interests) is used solely to generate their story
            and is not shared, sold, or used for any other purpose.
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            We retain your account information and generated stories for as long as your account is active.
            You may request deletion of your account and associated data at any time by contacting us.
            Guest stories without an account are retained for 90 days.
          </p>
        </Section>

        <Section title="Your rights">
          <p>You have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your account and data.</li>
            <li>Opt out of non-transactional emails at any time.</li>
          </ul>
          <p>To exercise any of these rights, contact us at <a href="mailto:contact@nestandquill.com">contact@nestandquill.com</a>.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy from time to time. We&apos;ll notify you of significant changes by email
            or by posting a notice on the site. Continued use of the service after changes constitutes acceptance.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy? Email us at{' '}
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
