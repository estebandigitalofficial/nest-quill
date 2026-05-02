'use client'

import { useState } from 'react'

// ─── API response types ─────────────────────────────────────────────────────

interface DuplicateSceneGroup {
  requestId: string
  pageNumber: number
  activeId: string
  activeStatus: string
  totalRows: number
  duplicates: { id: string; status: string; storagePath: string | null }[]
}

interface DuplicateLibGroup {
  sceneId: string
  activeId: string
  totalRows: number
  skipped: boolean
  duplicates: { id: string; storagePath: string | null; hasTags: boolean; createdAt: string }[]
}

interface OrphanRow {
  id: string
  sceneId: string | null
  storagePath: string | null
}

interface ScanResult {
  // story_scenes
  duplicateSceneGroups: number
  duplicateSceneRows: number
  groups: DuplicateSceneGroup[]
  // image_library duplicates
  duplicateLibGroups: number
  duplicateLibRows: number
  skippedLibGroups: number
  libGroups: DuplicateLibGroup[]
  // orphans
  orphanedLibraryRows: number
  orphanedLibrary: OrphanRow[]
}

interface ExecuteResult {
  dryRun: boolean
  wouldDeleteScenes: number
  wouldDeleteLibDupes: number
  wouldDeleteOrphans: number
  deletedScenes: number
  deletedLibDupes: number
  deletedOrphans: number
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CleanupTool() {
  const [scanning, setScanning] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null)
  const [dryRun, setDryRun] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSceneGroups, setShowSceneGroups] = useState(false)
  const [showLibGroups, setShowLibGroups] = useState(false)
  const [showOrphans, setShowOrphans] = useState(false)

  async function handleScan() {
    setScanning(true)
    setError(null)
    setExecuteResult(null)
    try {
      const res = await fetch('/api/admin/cleanup/images')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scan failed')
      setScanResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setScanning(false)
    }
  }

  async function handleExecute() {
    if (!scanResult) return
    const totalToDelete =
      scanResult.duplicateSceneRows + scanResult.duplicateLibRows + scanResult.orphanedLibraryRows

    if (!dryRun && totalToDelete > 0) {
      const confirmed = window.confirm(
        `This will permanently delete:\n` +
        `  • ${scanResult.duplicateSceneRows} duplicate scene row(s)\n` +
        `  • ${scanResult.duplicateLibRows} duplicate library row(s)\n` +
        `  • ${scanResult.orphanedLibraryRows} orphaned library row(s)\n\n` +
        `No storage files will be deleted. Continue?`
      )
      if (!confirmed) return
    }

    setExecuting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/cleanup/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Execute failed')
      setExecuteResult(data)
      if (!dryRun) setScanResult(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setExecuting(false)
    }
  }

  const totalToDelete = scanResult
    ? scanResult.duplicateSceneRows + scanResult.duplicateLibRows + scanResult.orphanedLibraryRows
    : 0
  const clean = scanResult && totalToDelete === 0

  return (
    <div className="space-y-4">
      {/* Header + scan button */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs text-adm-muted leading-relaxed max-w-lg">
          Detects duplicate <code className="font-mono text-adm-text">story_scenes</code> rows
          and duplicate/orphaned <code className="font-mono text-adm-text">image_library</code> rows.
          Never deletes storage files — only database rows.
        </p>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="shrink-0 px-4 py-2 rounded-lg bg-adm-border text-white text-xs font-medium hover:bg-adm-muted/30 disabled:opacity-50 transition-colors"
        >
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {scanResult && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Stat label="Scene dupes" value={scanResult.duplicateSceneRows} warn={scanResult.duplicateSceneRows > 0} />
            <Stat label="Library dupes" value={scanResult.duplicateLibRows} warn={scanResult.duplicateLibRows > 0} sub={scanResult.skippedLibGroups > 0 ? `${scanResult.skippedLibGroups} group(s) skipped (tagged)` : undefined} />
            <Stat label="Orphaned library" value={scanResult.orphanedLibraryRows} warn={scanResult.orphanedLibraryRows > 0} />
          </div>

          {clean && (
            <p className="text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-800 rounded-lg px-3 py-2">
              No duplicates or orphans found — database is clean.
            </p>
          )}

          {/* Duplicate scene groups */}
          {scanResult.duplicateSceneGroups > 0 && (
            <ExpandableSection
              label={`${scanResult.duplicateSceneGroups} duplicate scene group${scanResult.duplicateSceneGroups !== 1 ? 's' : ''}`}
              open={showSceneGroups}
              onToggle={() => setShowSceneGroups(v => !v)}
            >
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {scanResult.groups.map(g => (
                  <div key={g.activeId} className="border border-adm-border rounded-lg p-3 text-xs space-y-1">
                    <div className="flex items-center gap-2 text-adm-muted">
                      <span className="font-mono">{g.requestId.slice(0, 8)}…</span>
                      <span>page {g.pageNumber}</span>
                      <span className="ml-auto">{g.totalRows} rows</span>
                    </div>
                    <RowLine color="emerald" label="keep" id={g.activeId}>
                      <StatusBadge status={g.activeStatus} />
                    </RowLine>
                    {g.duplicates.map(d => (
                      <RowLine key={d.id} color="red" label="delete" id={d.id}>
                        <StatusBadge status={d.status} />
                      </RowLine>
                    ))}
                  </div>
                ))}
              </div>
            </ExpandableSection>
          )}

          {/* Duplicate library groups */}
          {scanResult.duplicateLibGroups > 0 && (
            <ExpandableSection
              label={`${scanResult.duplicateLibGroups} duplicate library group${scanResult.duplicateLibGroups !== 1 ? 's' : ''}`}
              open={showLibGroups}
              onToggle={() => setShowLibGroups(v => !v)}
            >
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {scanResult.libGroups.map(g => (
                  <div key={g.sceneId} className="border border-adm-border rounded-lg p-3 text-xs space-y-1">
                    <div className="flex items-center gap-2 text-adm-muted">
                      <span>scene</span>
                      <span className="font-mono">{g.sceneId.slice(0, 8)}…</span>
                      <span className="ml-auto">{g.totalRows} rows</span>
                      {g.skipped && (
                        <span className="text-amber-400 font-medium">skipped (tagged)</span>
                      )}
                    </div>
                    {!g.skipped && (
                      <>
                        <RowLine color="emerald" label="keep" id={g.activeId} />
                        {g.duplicates.map(d => (
                          <RowLine key={d.id} color="red" label="delete" id={d.id}>
                            {d.hasTags && <span className="text-amber-400">has tags</span>}
                          </RowLine>
                        ))}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </ExpandableSection>
          )}

          {/* Orphaned library rows */}
          {scanResult.orphanedLibraryRows > 0 && (
            <ExpandableSection
              label={`${scanResult.orphanedLibraryRows} orphaned library row${scanResult.orphanedLibraryRows !== 1 ? 's' : ''}`}
              open={showOrphans}
              onToggle={() => setShowOrphans(v => !v)}
            >
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {scanResult.orphanedLibrary.map(r => (
                  <div key={r.id} className="flex items-center gap-2 text-xs border border-adm-border rounded px-3 py-1.5">
                    <span className="font-mono text-adm-muted">{r.id.slice(0, 8)}…</span>
                    <span className="text-adm-muted">scene</span>
                    <span className="font-mono text-red-400">{r.sceneId?.slice(0, 8)}… (missing)</span>
                  </div>
                ))}
              </div>
            </ExpandableSection>
          )}

          {/* Execute controls */}
          {!clean && (
            <div className="flex items-center gap-4 pt-2 border-t border-adm-border">
              <label className="flex items-center gap-2 text-xs text-adm-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={e => setDryRun(e.target.checked)}
                  className="accent-brand-500"
                />
                Dry run (preview only)
              </label>

              <button
                onClick={handleExecute}
                disabled={executing}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                  dryRun
                    ? 'bg-adm-border text-white hover:bg-adm-muted/30'
                    : 'bg-red-700 text-white hover:bg-red-600'
                }`}
              >
                {executing
                  ? 'Running…'
                  : dryRun
                  ? `Preview (${totalToDelete} rows)`
                  : `Delete ${totalToDelete} rows`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Execute result */}
      {executeResult && (
        <div className="bg-adm-bg border border-adm-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">
            {executeResult.dryRun ? 'Dry Run Preview' : 'Cleanup Complete'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Stat
              label={executeResult.dryRun ? 'Would delete (scenes)' : 'Deleted scenes'}
              value={executeResult.dryRun ? executeResult.wouldDeleteScenes : executeResult.deletedScenes}
            />
            <Stat
              label={executeResult.dryRun ? 'Would delete (lib dupes)' : 'Deleted lib dupes'}
              value={executeResult.dryRun ? executeResult.wouldDeleteLibDupes : executeResult.deletedLibDupes}
            />
            <Stat
              label={executeResult.dryRun ? 'Would delete (orphans)' : 'Deleted orphans'}
              value={executeResult.dryRun ? executeResult.wouldDeleteOrphans : executeResult.deletedOrphans}
            />
          </div>
          {!executeResult.dryRun && (
            <p className="text-xs text-emerald-400">
              {executeResult.deletedScenes + executeResult.deletedLibDupes + executeResult.deletedOrphans} rows deleted. Run scan again to verify.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Stat({ label, value, warn, sub }: { label: string; value: number; warn?: boolean; sub?: string }) {
  return (
    <div className="bg-adm-bg border border-adm-border rounded-lg px-3 py-2.5">
      <div className={`text-xl font-semibold tabular-nums ${warn && value > 0 ? 'text-amber-400' : 'text-white'}`}>
        {value}
      </div>
      <div className="text-[11px] text-adm-muted mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-adm-subtle mt-0.5">{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'complete' ? 'text-emerald-400' :
    status === 'failed' ? 'text-red-400' :
    'text-adm-muted'
  return <span className={`text-[10px] font-mono ${color}`}>{status}</span>
}

function RowLine({
  color, label, id, children,
}: {
  color: 'emerald' | 'red'
  label: string
  id: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={color === 'emerald' ? 'text-emerald-400' : 'text-red-400'}>{label}</span>
      <span className="font-mono text-adm-muted">{id.slice(0, 8)}…</span>
      {children}
    </div>
  )
}

function ExpandableSection({
  label, open, onToggle, children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="text-xs text-adm-muted hover:text-white transition-colors"
      >
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}
