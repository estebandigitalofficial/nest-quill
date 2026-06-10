'use client'

import { useRef, useState } from 'react'
import type { WriterProjectFile } from '@/types/writer'

interface Props {
  projectId: string
  initialFiles: WriterProjectFile[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  uploaded: 'Uploaded',
  processing: 'Processing',
  processed: 'Processed',
  failed: 'Failed',
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, i)
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function SourceDocuments({ projectId, initialFiles }: Props) {
  const [files, setFiles] = useState<WriterProjectFile[]>(initialFiles)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return
    setError(null)
    setUploading(true)
    try {
      // Upload sequentially so each row appears as it lands.
      for (const file of Array.from(selected)) {
        const body = new FormData()
        body.append('file', file)
        const res = await fetch(`/api/writer/projects/${projectId}/files`, {
          method: 'POST',
          body,
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(json.error ?? `Could not upload ${file.name}.`)
          break
        }
        setFiles((prev) => [json.file as WriterProjectFile, ...prev])
      }
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(fileId: string) {
    setError(null)
    setDeletingId(fileId)
    try {
      const res = await fetch(`/api/writer/projects/${projectId}/files/${fileId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Could not delete file.')
        return
      }
      setFiles((prev) => prev.filter((f) => f.id !== fileId))
    } catch {
      setError('Could not delete file. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-6 py-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h2 className="font-serif text-xl text-oxford">Source Documents</h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 bg-oxford hover:bg-oxford/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors"
        >
          {uploading ? 'Uploading…' : '+ Add document'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      <p className="text-xs text-charcoal-light mb-4">
        Attach reference material (PDF, DOCX, or TXT, up to 25MB). These will power
        source-aware writing in a later release.
      </p>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      )}

      {files.length === 0 ? (
        <div className="rounded-xl border border-dashed border-parchment-dark px-6 py-10 text-center">
          <p className="text-2xl">📄</p>
          <p className="text-sm text-charcoal-light mt-2">No source documents uploaded yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-parchment-dark">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-lg bg-parchment flex items-center justify-center text-base shrink-0">
                📄
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-oxford truncate">{file.file_name}</p>
                <p className="text-xs text-charcoal-light">
                  {formatBytes(file.file_size)} · {formatDate(file.created_at)}
                </p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                {STATUS_LABELS[file.upload_status] ?? file.upload_status}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(file.id)}
                disabled={deletingId === file.id}
                className="text-xs font-medium text-charcoal-light hover:text-rose-600 disabled:opacity-40 transition-colors shrink-0"
              >
                {deletingId === file.id ? 'Removing…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
