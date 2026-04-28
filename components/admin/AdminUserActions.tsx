'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ActionState = 'idle' | 'loading' | 'done' | 'error'

interface Props {
  userId: string
  isSelf: boolean
  userEmail: string
  isBanned: boolean
}

export default function AdminUserActions({ userId, isSelf, userEmail, isBanned: initialBanned }: Props) {
  const [banned, setBanned] = useState(initialBanned)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [recoveryState, setRecoveryState] = useState<ActionState>('idle')
  const [magicState, setMagicState] = useState<ActionState>('idle')
  const [banState, setBanState] = useState<ActionState>('idle')
  const [mfaState, setMfaState] = useState<ActionState>('idle')
  const [deleteState, setDeleteState] = useState<ActionState>('idle')
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function doAction(
    url: string,
    method: string,
    body: Record<string, unknown> | undefined,
    setState: (s: ActionState) => void,
    onSuccess?: () => void
  ) {
    setState('loading')
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? `Request failed (${res.status})`)
      }
      setState('done')
      onSuccess?.()
      setTimeout(() => setState('idle'), 2500)
    } catch (err) {
      console.error(err)
      setState('error')
      setTimeout(() => setState('idle'), 3500)
    }
  }

  function label(state: ActionState, idle: string, done: string) {
    if (state === 'loading') return 'Working…'
    if (state === 'done') return done
    if (state === 'error') return 'Error ✕'
    return idle
  }

  function btnClass(state: ActionState, base: string) {
    if (state === 'done') return `${base} opacity-60`
    if (state === 'error') return 'text-xs px-2.5 py-1 rounded-lg font-medium transition-colors text-red-400 bg-red-950 border border-red-800'
    if (state === 'loading') return `${base} opacity-50 cursor-not-allowed`
    return base
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
      >
        {open ? 'Hide actions ▲' : 'More actions ▼'}
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {/* Send password recovery */}
          <button
            disabled={recoveryState !== 'idle'}
            onClick={() =>
              doAction(
                `/api/admin/users/${userId}/send-recovery`,
                'POST',
                undefined,
                setRecoveryState
              )
            }
            className={btnClass(
              recoveryState,
              'text-xs px-2.5 py-1 rounded-lg font-medium transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            )}
          >
            {label(recoveryState, 'Send recovery email', 'Sent ✓')}
          </button>

          {/* Send magic link */}
          <button
            disabled={magicState !== 'idle'}
            onClick={() =>
              doAction(
                `/api/admin/users/${userId}/send-magic-link`,
                'POST',
                undefined,
                setMagicState
              )
            }
            className={btnClass(
              magicState,
              'text-xs px-2.5 py-1 rounded-lg font-medium transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            )}
          >
            {label(magicState, 'Send magic link', 'Sent ✓')}
          </button>

          {/* Remove MFA */}
          <button
            disabled={mfaState !== 'idle'}
            onClick={() =>
              doAction(
                `/api/admin/users/${userId}/remove-mfa`,
                'POST',
                undefined,
                setMfaState
              )
            }
            className={btnClass(
              mfaState,
              'text-xs px-2.5 py-1 rounded-lg font-medium transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            )}
          >
            {label(mfaState, 'Remove MFA', 'Removed ✓')}
          </button>

          {/* Ban / Unban user */}
          {!isSelf && (
            <button
              disabled={banState !== 'idle'}
              onClick={() =>
                doAction(
                  `/api/admin/users/${userId}/ban`,
                  'POST',
                  banned ? { unban: true } : undefined,
                  setBanState,
                  () => setBanned(b => !b)
                )
              }
              className={btnClass(
                banState,
                banned
                  ? 'text-xs px-2.5 py-1 rounded-lg font-medium transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                  : 'text-xs px-2.5 py-1 rounded-lg font-medium transition-colors bg-orange-950 text-orange-400 hover:bg-orange-900 border border-orange-800'
              )}
            >
              {label(banState, banned ? 'Unban user' : 'Ban user', banned ? 'Unbanned ✓' : 'Banned ✓')}
            </button>
          )}

          {/* Delete user */}
          {!isSelf && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors bg-red-950 text-red-400 hover:bg-red-900 border border-red-800"
            >
              Delete user
            </button>
          )}
          {!isSelf && confirmDelete && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-red-400">Delete {userEmail}?</span>
              <button
                disabled={deleteState !== 'idle'}
                onClick={() =>
                  doAction(
                    `/api/admin/users/${userId}/delete`,
                    'DELETE',
                    undefined,
                    setDeleteState,
                    () => { setTimeout(() => router.refresh(), 1500) }
                  )
                }
                className={btnClass(
                  deleteState,
                  'text-xs px-2.5 py-1 rounded-lg font-medium transition-colors bg-red-600 text-white hover:bg-red-500'
                )}
              >
                {label(deleteState, 'Confirm delete', 'Deleted ✓')}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors bg-gray-800 text-gray-400 hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
