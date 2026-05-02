import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

// ─── Types ─────────────────────────────────────────────────────────────────

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
  tags: string[]
  created_at: string
}

export interface DuplicateSceneGroup {
  requestId: string
  pageNumber: number
  activeId: string
  activeStatus: string
  totalRows: number
  duplicates: { id: string; status: string; storagePath: string | null }[]
}

export interface DuplicateLibGroup {
  sceneId: string
  activeId: string
  totalRows: number
  skipped: boolean // multiple rows have tags — too risky to auto-delete
  duplicates: { id: string; storagePath: string | null; hasTags: boolean; createdAt: string }[]
}

export interface OrphanedLibRow {
  id: string
  sceneId: string | null
  storagePath: string | null
}

// ─── Sort helpers ───────────────────────────────────────────────────────────

// Complete before non-complete; newest first within same status
function sortSceneRows(a: SceneRow, b: SceneRow) {
  const aComplete = a.image_status === 'complete' ? 0 : 1
  const bComplete = b.image_status === 'complete' ? 0 : 1
  if (aComplete !== bComplete) return aComplete - bComplete
  return b.updated_at.localeCompare(a.updated_at)
}

// ─── Main scan ──────────────────────────────────────────────────────────────

async function scan(db: ReturnType<typeof createAdminClient>) {
  // ── story_scenes: duplicates by (request_id, page_number, image_prompt) ──
  const { data: rawScenes, error: scenesErr } = await db
    .from('story_scenes')
    .select('id, request_id, page_number, image_prompt, image_status, storage_path, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50000)

  if (scenesErr) throw new Error(`story_scenes scan: ${scenesErr.message}`)
  const scenes = (rawScenes ?? []) as SceneRow[]

  const sceneGroups = new Map<string, SceneRow[]>()
  for (const s of scenes) {
    const key = `${s.request_id}|${s.page_number}|${s.image_prompt ?? ''}`
    const list = sceneGroups.get(key) ?? []
    list.push(s)
    sceneGroups.set(key, list)
  }

  const duplicateSceneGroups: DuplicateSceneGroup[] = []
  const toDeleteSceneIds: string[] = []

  for (const [, group] of sceneGroups) {
    if (group.length <= 1) continue
    const sorted = [...group].sort(sortSceneRows)
    const [active, ...dupes] = sorted
    duplicateSceneGroups.push({
      requestId: active.request_id,
      pageNumber: active.page_number,
      activeId: active.id,
      activeStatus: active.image_status,
      totalRows: group.length,
      duplicates: dupes.map(d => ({ id: d.id, status: d.image_status, storagePath: d.storage_path })),
    })
    toDeleteSceneIds.push(...dupes.map(d => d.id))
  }

  // ── image_library: load all rows ─────────────────────────────────────────
  const { data: rawLib, error: libErr } = await db
    .from('image_library')
    .select('id, scene_id, storage_path, tags, created_at')
    .order('created_at', { ascending: false })
    .limit(50000)

  if (libErr) throw new Error(`image_library scan: ${libErr.message}`)
  const allLibRows = (rawLib ?? []) as LibRow[]

  const allSceneIds = new Set(scenes.map(s => s.id))

  // ── image_library: duplicates by scene_id ─────────────────────────────────
  // Root cause: trigger fn_image_library_auto_populate fires each time a scene
  // transitions to 'complete' (including retries), and ON CONFLICT DO NOTHING
  // is inert — image_library has no unique constraint on scene_id.
  const libByScene = new Map<string, LibRow[]>()
  for (const r of allLibRows) {
    if (!r.scene_id) continue
    const list = libByScene.get(r.scene_id) ?? []
    list.push(r)
    libByScene.set(r.scene_id, list)
  }

  const duplicateLibGroups: DuplicateLibGroup[] = []
  const toDeleteLibDupeIds: string[] = []

  for (const [sceneId, group] of libByScene) {
    if (group.length <= 1) continue

    const taggedRows = group.filter(r => r.tags?.length > 0)

    // Multiple rows have tags — curated data, don't auto-delete any
    if (taggedRows.length > 1) {
      duplicateLibGroups.push({
        sceneId,
        activeId: group[0].id,
        totalRows: group.length,
        skipped: true,
        duplicates: [],
      })
      continue
    }

    // Pick active: tagged row if one exists, otherwise newest (already sorted desc)
    const active = taggedRows[0] ?? group[0]
    const dupes = group.filter(r => r.id !== active.id)

    duplicateLibGroups.push({
      sceneId,
      activeId: active.id,
      totalRows: group.length,
      skipped: false,
      duplicates: dupes.map(d => ({
        id: d.id,
        storagePath: d.storage_path,
        hasTags: (d.tags?.length ?? 0) > 0,
        createdAt: d.created_at,
      })),
    })
    toDeleteLibDupeIds.push(...dupes.map(d => d.id))
  }

  // ── image_library: orphaned rows (scene no longer in story_scenes) ─────────
  const orphanedLib: OrphanedLibRow[] = allLibRows
    .filter(r => r.scene_id && !allSceneIds.has(r.scene_id))
    .map(r => ({ id: r.id, sceneId: r.scene_id, storagePath: r.storage_path }))

  return {
    duplicateSceneGroups,
    toDeleteSceneIds,
    duplicateLibGroups,
    toDeleteLibDupeIds,
    orphanedLib,
  }
}

// ─── GET — scan only, no mutations ─────────────────────────────────────────

export async function GET() {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const db = createAdminClient()
    const result = await scan(db)

    return NextResponse.json({
      // story_scenes
      duplicateSceneGroups: result.duplicateSceneGroups.length,
      duplicateSceneRows: result.toDeleteSceneIds.length,
      groups: result.duplicateSceneGroups,
      // image_library duplicates
      duplicateLibGroups: result.duplicateLibGroups.length,
      duplicateLibRows: result.toDeleteLibDupeIds.length,
      skippedLibGroups: result.duplicateLibGroups.filter(g => g.skipped).length,
      libGroups: result.duplicateLibGroups,
      // orphans
      orphanedLibraryRows: result.orphanedLib.length,
      orphanedLibrary: result.orphanedLib,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── POST — execute cleanup (default dryRun=true) ──────────────────────────

export async function POST(request: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const dryRun = body.dryRun !== false // default true for safety

  try {
    const db = createAdminClient()
    const { toDeleteSceneIds, toDeleteLibDupeIds, orphanedLib } = await scan(db)

    const orphanIds = orphanedLib.map(r => r.id)
    let deletedScenes = 0
    let deletedLibDupes = 0
    let deletedOrphans = 0

    if (!dryRun) {
      if (toDeleteSceneIds.length > 0) {
        const { error } = await db
          .from('story_scenes')
          .delete()
          .in('id', toDeleteSceneIds)
        if (error) throw new Error(`Delete story_scenes: ${error.message}`)
        deletedScenes = toDeleteSceneIds.length
      }

      if (toDeleteLibDupeIds.length > 0) {
        const { error } = await db
          .from('image_library')
          .delete()
          .in('id', toDeleteLibDupeIds)
        if (error) throw new Error(`Delete image_library dupes: ${error.message}`)
        deletedLibDupes = toDeleteLibDupeIds.length
      }

      if (orphanIds.length > 0) {
        const { error } = await db
          .from('image_library')
          .delete()
          .in('id', orphanIds)
        if (error) throw new Error(`Delete image_library orphans: ${error.message}`)
        deletedOrphans = orphanIds.length
      }
    }

    return NextResponse.json({
      dryRun,
      wouldDeleteScenes: toDeleteSceneIds.length,
      wouldDeleteLibDupes: toDeleteLibDupeIds.length,
      wouldDeleteOrphans: orphanIds.length,
      deletedScenes,
      deletedLibDupes,
      deletedOrphans,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
