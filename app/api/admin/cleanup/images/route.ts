import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

interface SceneRow {
  id: string
  request_id: string
  page_number: number
  image_prompt: string | null
  image_status: string
  storage_path: string | null
  updated_at: string
}

interface LibRow {
  id: string
  scene_id: string | null
  storage_path: string | null
}

interface DuplicateGroup {
  requestId: string
  pageNumber: number
  activeId: string
  activeStatus: string
  totalRows: number
  duplicates: { id: string; status: string; storagePath: string | null }[]
}

// Complete before non-complete; newest first within same status
function sortRows(a: SceneRow, b: SceneRow) {
  const aComplete = a.image_status === 'complete' ? 0 : 1
  const bComplete = b.image_status === 'complete' ? 0 : 1
  if (aComplete !== bComplete) return aComplete - bComplete
  return b.updated_at.localeCompare(a.updated_at) // newest first
}

async function scan(db: ReturnType<typeof createAdminClient>) {
  const { data: rawScenes, error: scenesErr } = await db
    .from('story_scenes')
    .select('id, request_id, page_number, image_prompt, image_status, storage_path, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50000)

  if (scenesErr) throw new Error(`story_scenes scan: ${scenesErr.message}`)
  const scenes = (rawScenes ?? []) as SceneRow[]

  // Group by (request_id, page_number, image_prompt)
  const groups = new Map<string, SceneRow[]>()
  for (const s of scenes) {
    const key = `${s.request_id}|${s.page_number}|${s.image_prompt ?? ''}`
    const list = groups.get(key) ?? []
    list.push(s)
    groups.set(key, list)
  }

  const duplicateGroups: DuplicateGroup[] = []
  const toDeleteSceneIds: string[] = []

  for (const [, group] of groups) {
    if (group.length <= 1) continue

    // Keep whichever row is complete (or latest if none complete)
    const sorted = [...group].sort(sortRows)
    const [active, ...dupes] = sorted

    duplicateGroups.push({
      requestId: active.request_id,
      pageNumber: active.page_number,
      activeId: active.id,
      activeStatus: active.image_status,
      totalRows: group.length,
      duplicates: dupes.map(d => ({ id: d.id, status: d.image_status, storagePath: d.storage_path })),
    })
    toDeleteSceneIds.push(...dupes.map(d => d.id))
  }

  // Orphaned image_library rows: scene_id present but no matching story_scenes row
  const allSceneIds = new Set(scenes.map(s => s.id))

  const { data: rawLib, error: libErr } = await db
    .from('image_library')
    .select('id, scene_id, storage_path')
    .not('scene_id', 'is', null)
    .limit(50000)

  if (libErr) throw new Error(`image_library scan: ${libErr.message}`)
  const orphanedLib = ((rawLib ?? []) as LibRow[]).filter(
    r => r.scene_id && !allSceneIds.has(r.scene_id)
  )

  return { duplicateGroups, toDeleteSceneIds, orphanedLib }
}

export async function GET() {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const db = createAdminClient()
    const { duplicateGroups, toDeleteSceneIds, orphanedLib } = await scan(db)

    return NextResponse.json({
      duplicateGroups: duplicateGroups.length,
      duplicateRows: toDeleteSceneIds.length,
      orphanedLibraryRows: orphanedLib.length,
      groups: duplicateGroups,
      orphanedLibrary: orphanedLib.map(r => ({
        id: r.id,
        sceneId: r.scene_id,
        storagePath: r.storage_path,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const dryRun = body.dryRun !== false // default true for safety

  try {
    const db = createAdminClient()
    const { toDeleteSceneIds, orphanedLib } = await scan(db)

    let deletedScenes = 0
    let deletedLibrary = 0

    if (!dryRun) {
      if (toDeleteSceneIds.length > 0) {
        const { error } = await db
          .from('story_scenes')
          .delete()
          .in('id', toDeleteSceneIds)
        if (error) throw new Error(`Delete story_scenes: ${error.message}`)
        deletedScenes = toDeleteSceneIds.length
      }

      const orphanIds = orphanedLib.map(r => r.id)
      if (orphanIds.length > 0) {
        const { error } = await db
          .from('image_library')
          .delete()
          .in('id', orphanIds)
        if (error) throw new Error(`Delete image_library: ${error.message}`)
        deletedLibrary = orphanIds.length
      }
    }

    return NextResponse.json({
      dryRun,
      wouldDeleteScenes: toDeleteSceneIds.length,
      wouldDeleteLibrary: orphanedLib.length,
      deletedScenes,
      deletedLibrary,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
