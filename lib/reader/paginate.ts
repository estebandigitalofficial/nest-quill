// Viewport-based pagination for ebook readers.
// Measures actual rendered heights and packs content into exact viewport pages.

export type Block =
  | { kind: 'title-page' }
  | { kind: 'special'; display: 'epigraph' | 'dedication'; content: string }
  | { kind: 'chapter-header'; chapterId: string; number: number; title: string }
  | { kind: 'section-header'; label: string; zone: 'front' | 'back'; secType: string }
  | { kind: 'scene-break' }
  | { kind: 'para'; text: string; indent: boolean }

export const READER_LABELS: Record<string, string> = {
  dedication: 'Dedication', epigraph: 'Epigraph', foreword: 'Foreword',
  preface: 'Preface', acknowledgments: 'Acknowledgments', prologue: 'Prologue',
  introduction: 'Introduction', conclusion: 'Conclusion',
  notes: 'Notes', about_author: 'About the Author', also_by: 'Also By',
}

// Returns array of blocks from all book content in manuscript order.
export function buildBlocks(
  sections: { zone: string; type: string; enabled: boolean; content: string | null; position: number }[],
  chapters: {
    id: string; chapter_number: number; title: string
    scenes: { scene_number: number; content: string | null }[]
  }[]
): Block[] {
  const front = sections
    .filter(s => s.zone === 'front' && s.enabled && s.content)
    .sort((a, b) => a.position - b.position)

  const back = sections
    .filter(s => s.zone === 'back' && s.enabled && s.content)
    .sort((a, b) => a.position - b.position)

  const writtenChapters = chapters.filter(ch =>
    ch.scenes.some(s => s.content)
  )

  const blocks: Block[] = [{ kind: 'title-page' }]

  for (const s of front) {
    if (s.type === 'epigraph' || s.type === 'dedication') {
      blocks.push({ kind: 'special', display: s.type as 'epigraph' | 'dedication', content: s.content! })
    } else {
      blocks.push({ kind: 'section-header', label: READER_LABELS[s.type] ?? s.type, zone: 'front', secType: s.type })
      for (const para of (s.content ?? '').split(/\n\n+/).filter(p => p.trim())) {
        blocks.push({ kind: 'para', text: para.trim(), indent: false })
      }
    }
  }

  for (const ch of writtenChapters) {
    const scenes = ch.scenes
      .filter(s => s.content)
      .sort((a, b) => a.scene_number - b.scene_number)

    for (let si = 0; si < scenes.length; si++) {
      blocks.push(
        si === 0
          ? { kind: 'chapter-header', chapterId: ch.id, number: ch.chapter_number, title: ch.title }
          : { kind: 'scene-break' }
      )
      const paras = (scenes[si].content ?? '').split(/\n\n+/).filter(p => p.trim())
      for (let pi = 0; pi < paras.length; pi++) {
        blocks.push({ kind: 'para', text: paras[pi].trim(), indent: pi > 0 })
      }
    }
  }

  for (const s of back) {
    if (s.type === 'epigraph' || s.type === 'dedication') {
      blocks.push({ kind: 'special', display: s.type as 'epigraph' | 'dedication', content: s.content! })
    } else {
      blocks.push({ kind: 'section-header', label: READER_LABELS[s.type] ?? s.type, zone: 'back', secType: s.type })
      for (const para of (s.content ?? '').split(/\n\n+/).filter(p => p.trim())) {
        blocks.push({ kind: 'para', text: para.trim(), indent: false })
      }
    }
  }

  return blocks
}

// Measures every block and returns heights in pixels.
// Uses a temporary off-screen div so measurements match actual rendering.
export function measureBlocks(blocks: Block[], textWidth: number, dark: boolean): number[] {
  const fontSize = Math.max(16, Math.min(17.6, window.innerWidth * 0.022))
  const titleFontSize = Math.max(20.8, Math.min(28, window.innerWidth * 0.03))
  const lineHeight = 1.9
  const paraMargin = fontSize * 0.85

  const div = document.createElement('div')
  div.style.cssText = [
    'position:fixed',
    'top:-9999px',
    'left:0',
    `width:${textWidth}px`,
    `font-family:Georgia,"Times New Roman",serif`,
    `font-size:${fontSize}px`,
    `line-height:${lineHeight}`,
    'visibility:hidden',
    'pointer-events:none',
    'word-break:break-word',
  ].join(';')
  document.body.appendChild(div)

  const heights = blocks.map(block => {
    // Title page and special pages always occupy a full viewport
    if (block.kind === 'title-page' || block.kind === 'special') return 1e6

    if (block.kind === 'scene-break') return 44

    if (block.kind === 'chapter-header') {
      div.innerHTML = ''
      const numEl = document.createElement('p')
      numEl.style.cssText = `font-size:11px;text-transform:uppercase;letter-spacing:0.2em;margin:0 0 12px`
      numEl.textContent = `Chapter ${block.number}`
      const titleEl = document.createElement('p')
      titleEl.style.cssText = `font-size:${titleFontSize}px;font-weight:700;margin:0 0 8px;line-height:1.2`
      titleEl.textContent = block.title
      const hr = document.createElement('div')
      hr.style.cssText = `height:1px;width:32px;margin:20px auto 0`
      div.appendChild(numEl)
      div.appendChild(titleEl)
      div.appendChild(hr)
      return div.offsetHeight + 40 // 40px top margin before chapter
    }

    if (block.kind === 'section-header') {
      div.innerHTML = ''
      const el = document.createElement('p')
      el.style.cssText = `font-size:${titleFontSize}px;font-weight:700;margin:0 0 40px;line-height:1.2`
      el.textContent = block.label
      div.appendChild(el)
      return div.offsetHeight
    }

    if (block.kind === 'para') {
      div.innerHTML = ''
      const el = document.createElement('p')
      el.style.cssText = `margin:0;text-indent:${block.indent ? '1.6em' : '0'}`
      el.textContent = block.text
      div.appendChild(el)
      return div.offsetHeight + paraMargin
    }

    return 0
  })

  document.body.removeChild(div)
  return heights
}

// Packs blocks into viewport pages. Returns arrays of block indices.
export function packPages(blocks: Block[], heights: number[], availH: number): number[][] {
  const pages: number[][] = []
  let page: number[] = []
  let usedH = 0

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const h = heights[i]

    // Title page and special pages always stand alone
    if (block.kind === 'title-page' || block.kind === 'special') {
      if (page.length > 0) pages.push([...page])
      pages.push([i])
      page = []
      usedH = 0
      continue
    }

    const wouldFit = usedH + h <= availH

    if (wouldFit || page.length === 0) {
      page.push(i)
      usedH += h
    } else {
      // Orphan prevention: if last item on current page is a heading, move it forward
      if (page.length > 1) {
        const lastIdx = page[page.length - 1]
        const lastKind = blocks[lastIdx].kind
        if (lastKind === 'chapter-header' || lastKind === 'section-header') {
          page.pop()
          pages.push([...page])
          page = [lastIdx, i]
          usedH = heights[lastIdx] + h
          continue
        }
      }
      pages.push([...page])
      page = [i]
      usedH = h
    }
  }

  if (page.length > 0) pages.push([...page])
  return pages
}

// Find which page index contains a given block index (for position restore after resize).
export function findPageForBlock(pages: number[][], blockIdx: number): number {
  for (let pi = 0; pi < pages.length; pi++) {
    if (pages[pi][0] >= blockIdx) return pi
  }
  return Math.max(0, pages.length - 1)
}
