'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  classroomId: string
  classroomName: string
  educatorEmail: string
  initialIsActive: boolean
}

export default function ClassroomAdminActions({
  classroomId,
  classroomName,
  educatorEmail,
  initialIsActive,
}: Props) {
  const router = useRouter()
  const [isActive, setIsActive] = useState(initialIsActive)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    setError(null)
    setLoading(true)
    const res = await fetch(`/api/admin/classrooms/${classroomId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.message ?? 'Something went wrong.')
      setLoading(false)
      return
    }
    setIsActive(!isActive)
    setShowModal(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <>
      {isActive ? (
        <button
          onClick={() => { setError(null); setShowModal(true) }}
          className="text-xs font-semibold px-4 py-2 rounded-xl border border-red-800 bg-red-950/30 text-red-400 hover:bg-red-950/50 transition-colors"
        >
          Archive Classroom
        </button>
      ) : (
        <button
          onClick={() => { setError(null); setShowModal(true) }}
          className="text-xs font-semibold px-4 py-2 rounded-xl border border-green-800 bg-green-950/30 text-green-400 hover:bg-green-950/50 transition-colors"
        >
          Restore Classroom
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-adm-surface border border-adm-border rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div>
              <p className="font-semibold text-white text-base">
                {isActive ? 'Archive classroom?' : 'Restore classroom?'}
              </p>
              <p className="text-sm text-adm-muted mt-1.5 font-medium">{classroomName}</p>
              <p className="text-xs text-adm-subtle mt-0.5">{educatorEmail}</p>
            </div>
            <p className="text-sm text-adm-muted leading-relaxed">
              {isActive
                ? 'This will remove the classroom from active use. Students and educators will no longer see it.'
                : 'This will make the classroom active again. Students and educators will regain access.'}
            </p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleToggle}
                disabled={loading}
                className={`text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 ${
                  isActive
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {loading ? 'Saving…' : isActive ? 'Archive' : 'Restore'}
              </button>
              <button
                onClick={() => { setShowModal(false); setError(null) }}
                disabled={loading}
                className="text-sm font-semibold text-adm-muted hover:text-white px-4 py-2.5 rounded-xl border border-adm-border hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
