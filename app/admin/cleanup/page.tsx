import CleanupTool from './CleanupTool'

export default function AdminCleanupPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Cleanup</h1>
        <p className="text-sm text-adm-muted mt-1">
          Safe removal of duplicate and orphaned database rows. Never deletes storage files.
        </p>
      </div>

      <CleanupTool />
    </div>
  )
}
