import { getAdminContext } from '@/lib/admin/guard'
import { getSetting } from '@/lib/settings/appSettings'
import BetaModeToggle from './BetaModeToggle'

export default async function AdminBetaPage() {
  const ctx = await getAdminContext()
  if (!ctx) return null

  const betaModeEnabled = await getSetting('beta_mode_enabled', false)

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

      <div>
        <h1 className="text-xl font-semibold text-adm-text">Beta Mode</h1>
        <p className="text-sm text-adm-muted mt-1">
          Cost-safe testing mode. Bypasses limits and skips expensive AI operations.
        </p>
      </div>

      {/* Toggle card */}
      <div className="bg-adm-surface rounded-2xl border border-adm-border px-6 py-5">
        <BetaModeToggle initialEnabled={betaModeEnabled as boolean} />
      </div>

      {/* What is real vs simulated */}
      <div className="grid sm:grid-cols-2 gap-4">

        <div className="bg-adm-surface rounded-2xl border border-adm-border px-5 py-5 space-y-3">
          <p className="text-xs font-bold text-green-400 uppercase tracking-widest">Real (always runs)</p>
          <ul className="space-y-2 text-sm text-adm-muted">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Story text generation (GPT-4o) — full AI writing
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Database writes — story, scenes, and status all saved
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Usage tracking — books_generated still increments
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Status and progress flow — queued → generating → complete
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Completion emails — sent as normal
            </li>
          </ul>
        </div>

        <div className="bg-adm-surface rounded-2xl border border-adm-border px-5 py-5 space-y-3">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Simulated (skipped)</p>
          <ul className="space-y-2 text-sm text-adm-muted">
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">~</span>
              All story limits bypassed — guest, free, and paid tiers
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">~</span>
              DALL-E image generation skipped — placeholder images used
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">~</span>
              PDF generation skipped — no export assembled
            </li>
          </ul>
        </div>

      </div>

      {/* Usage instructions */}
      <div className="bg-adm-surface rounded-2xl border border-adm-border px-5 py-5 space-y-2">
        <p className="text-xs font-bold text-adm-subtle uppercase tracking-widest mb-3">How to use</p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-adm-muted">
          <li>Enable beta mode above.</li>
          <li>Create a story as any user — limits won&apos;t block you.</li>
          <li>The story generates with real GPT-4o text but placeholder illustrations.</li>
          <li>No DALL-E or PDF costs are incurred.</li>
          <li>Disable beta mode when done — limits and generation resume immediately.</li>
        </ol>
        <p className="text-xs text-adm-subtle mt-3">
          Beta mode is global — it applies to all users and all story creation while enabled.
          Always disable it when not actively testing.
        </p>
      </div>

    </div>
  )
}
