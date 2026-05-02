'use client'

import { useState } from 'react'

interface DuplicateGroup {
  requestId: string
  pageNumber: number
  activeId: string
  activeStatus: string
  totalRows: number
  duplicates: { id: string; status: string; storagePath: string | null }[]
}

interface OrphanRow {
  id: string
  sceneId: string | null
  storagePath: string | null
}

interface ScanResult {
  duplicateGroups: number
  duplicateRows: number
  orphanedLibraryRows: number
  groups: DuplicateGroup[]
  orphanedLibrary: OrphanRow[]
}

interface ExecuteResult {
  dryRun: boolean
  wouldDeleteScenes: number
  wouldDeleteLibrary: number
  deletedScenes: number
  deletedLibrary: number
}

export default function CleanupTool() {
  const [scanning, setScanning] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null)
  const [dryRun, setDryRun] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showGroups, setShowGroups] = useState(false)
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
    const totalToDelete = scanResult.duplicateRows + scanResult.orphanedLibraryRows
    if (!dryRun && totalToDelete > 0) {
      const confirmed = window.confirm(
        `This will permanently delete ${scanResult.duplicateRows} duplicate scene row(s) and ${scanResult.orphanedLibraryRows} orphaned library row(s). Continue?`
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
    ? scanResult.duplicateRows + scanResult.orphanedLibraryRows
    : 0
  const clean = scanResult && totalToDelete === 0

  return (
    <div className="space-y-6">
      {/* Scan */}
      <div className="bg-adm-card border border-adm-border rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Duplicate Scene Rows</h2>
          <p className="text-xs text-adm-muted mt-0.5">
            Groups story_scenes by (request_id, page_number, image_prompt). Keeps the complete row (or
            latest) and flags the rest. Also finds orphaned image_library rows where the linked scene no
            longer exists.
          </p>
        </div>

        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-4 py-2 rounded-lg bg-adm-border text-white text-xs font-medium hover:bg-adm-muted/30 disabled:opacity-50 transition-colors"
        >
          {scanning ? 'Scanning…' : 'Scan for duplicates'}
        </button>

        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {scanResult && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Duplicate groups" value={scanResult.duplicateGroups} />
              <Stat label="Rows to delete" value={scanResult.duplicateRows} warn={scanResult.duplicateRows > 0} />
              <Stat label="Orphaned library" value={scanResult.orphanedLibraryRows} warn={scanResult.orphanedLibraryRows > 0} />
            </div>

            {clean && (
              <p className="text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-800 rounded-lg px-3 py-2">
                No duplicates or orphans found — database looks clean.
              </p>
            )}

            {/* Duplicate groups detail */}
            {scanResult.duplicateGroups > 0 && (
              <div>
                <button
                  onClick={() => setShowGroups(v => !v)}
                  className="text-xs text-adm-muted hover:text-white transition-colors"
                >
                  {showGroups ? '▾' : '▸'} {scanResult.duplicateGroups} duplicate group{scanResult.duplicateGroups !== 1 ? 's' : ''}
                </button>
                {showGroups && (
                  <div className="mt-2 space-y-2 max-h-80 overflow-y-auto pr-1">
                    {scanResult.groups.map(g => (
                      <div key={g.activeId} className="border border-adm-border rounded-lg p-3 text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-adm-muted">request</span>
                          <span className="text-white font-mono">{g.requestId.slice(0, 8)}…</span>
                          <span className="text-adm-muted">page</span>
                          <span className="text-white">{g.pageNumber}</span>
                          <span className="ml-auto text-adm-muted">{g.totalRows} rows</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400">keep</span>
                          <span className="font-mono text-adm-muted">{g.activeId.slice(0, 8)}…</span>
                          <StatusBadge status={g.activeStatus} />
                        </div>
                        {g.duplicates.map(d => (
                          <div key={d.id} className="flex items-center gap-2">
                            <span className="text-red-400">delete</span>
                            <span className="font-mono text-adm-muted">{d.id.slice(0, 8)}…</span>
                            <StatusBadge status={d.status} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Orphans detail */}
            {scanResult.orphanedLibraryRows > 0 && (
              <div>
                <button
                  onClick={() => setShowOrphans(v => !v)}
                  className="text-xs text-adm-muted hover:text-white transition-colors"
                >
                  {showOrphans ? '▾' : '▸'} {scanResult.orphanedLibraryRows} orphaned library row{scanResult.orphanedLibraryRows !== 1 ? 's' : ''}
                </button>
                {showOrphans && (
                  <div className="mt-2 space-y-1 max-h-48 overflow-y-auto pr-1">
                    {scanResult.orphanedLibrary.map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-xs border border-adm-border rounded px-3 py-1.5">
                        <span className="font-mono text-adm-muted">{r.id.slice(0, 8)}…</span>
                        <span className="text-adm-muted">scene</span>
                        <span className="font-mono text-red-400">{r.sceneId?.slice(0, 8)}… (missing)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Execute */}
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
                    ? `Preview deletion (${totalToDelete} rows)`
                    : `Delete ${totalToDelete} rows`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Execute result */}
      {executeResult && (
        <div className="bg-adm-card border border-adm-border rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-white">
            {executeResult.dryRun ? 'Dry Run Result' : 'Cleanup Complete'}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label={executeResult.dryRun ? 'Would delete (scenes)' : 'Deleted scenes'}
              value={executeResult.dryRun ? executeResult.wouldDeleteScenes : executeResult.deletedScenes}
            />
            <Stat
              label={executeResult.dryRun ? 'Would delete (library)' : 'Deleted library rows'}
              value={executeResult.dryRun ? executeResult.wouldDeleteLibrary : executeResult.deletedLibrary}
            />
          </div>
          {!executeResult.dryRun && (
            <p className="text-xs text-emerald-400">
              Deleted {executeResult.deletedScenes + executeResult.deletedLibrary} rows total.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="bg-adm-bg border border-adm-border rounded-lg px-4 py-3">
      <div className={`text-2xl font-semibold tabular-nums ${warn && value > 0 ? 'text-amber-400' : 'text-white'}`}>
        {value}
      </div>
      <div className="text-xs text-adm-muted mt-0.5">{label}</div>
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
