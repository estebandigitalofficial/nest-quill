// Backwards-compatible re-export. The dictionaries now live in ./dict and the
// helpers in ./index; nothing new should import from here.
export { dictionaries as translations } from './index'
export type { Lang, Dictionary } from './index'
