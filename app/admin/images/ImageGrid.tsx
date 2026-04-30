'use client'

import { useState } from 'react'
import type { ImageLibraryItem } from '@/types/database'

export default function ImageGrid({
  images,
  signedUrls,
}: {
  images: ImageLibraryItem[]
  signedUrls: Record<string, string>
}) {
  const [selected, setSelected] = useState<ImageLibraryItem | null>(null)
  const [editingTags, setEditingTags] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')

  function openModal(img: ImageLibraryItem) {
    setSelected(img)
    setTags(img.tags ?? [])
    setEditingTags(false)
  }

  async function saveTags() {
    if (!selected) return
    await fetch(`/api/admin/images/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    })
    setEditingTags(false)
  }

  function addTag() {
    const t = newTag.trim().toLowerCase()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
    }
    setNewTag('')
  }

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {images.map((img) => {
          const url = signedUrls[img.storage_path ?? '']
          return (
            <button
              key={img.id}
              onClick={() => openModal(img)}
              className="aspect-square rounded-xl overflow-hidden border border-gray-800 hover:border-brand-500 transition-colors bg-gray-900"
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs">No image</div>
              )}
            </button>
          )
        })}
      </div>

      {images.length === 0 && (
        <p className="text-center text-gray-600 text-sm py-12">No images found.</p>
      )}

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              {signedUrls[selected.storage_path ?? ''] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signedUrls[selected.storage_path ?? '']}
                  alt=""
                  className="w-full rounded-xl"
                />
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-600 uppercase tracking-widest mb-0.5">Style</p>
                  <p className="text-gray-300">{selected.illustration_style ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-600 uppercase tracking-widest mb-0.5">Theme</p>
                  <p className="text-gray-300">{selected.theme ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-600 uppercase tracking-widest mb-0.5">Age Range</p>
                  <p className="text-gray-300">{selected.child_age_range ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-600 uppercase tracking-widest mb-0.5">Created</p>
                  <p className="text-gray-300">{new Date(selected.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {selected.prompt_used && (
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">Prompt</p>
                  <p className="text-xs text-gray-400 bg-gray-800 rounded-lg px-3 py-2">{selected.prompt_used}</p>
                </div>
              )}

              {/* Tags */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-600 uppercase tracking-widest">Tags</p>
                  <button
                    onClick={() => setEditingTags(!editingTags)}
                    className="text-xs text-brand-400 hover:text-brand-300"
                  >
                    {editingTags ? 'Cancel' : 'Edit tags'}
                  </button>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {tags.map((tag) => (
                    <span key={tag} className="text-[10px] font-semibold bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                      {tag}
                      {editingTags && (
                        <button
                          onClick={() => setTags(tags.filter((t) => t !== tag))}
                          className="ml-1 text-red-400 hover:text-red-300"
                        >
                          x
                        </button>
                      )}
                    </span>
                  ))}
                  {tags.length === 0 && <span className="text-xs text-gray-600">No tags</span>}
                </div>
                {editingTags && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Add tag..."
                      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:ring-2 focus:ring-brand-500 focus:outline-none flex-1"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addTag() }}
                    />
                    <button onClick={saveTags} className="text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 px-3 py-1.5 rounded-lg transition-colors">
                      Save
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelected(null)}
                className="w-full text-sm text-gray-400 hover:text-white py-2 border border-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
