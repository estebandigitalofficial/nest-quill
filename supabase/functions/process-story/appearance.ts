// Deterministic appearance parsing for the visual bible (Phase 1H).
//
// Pure module: turns the parent's free text (child description, supporting
// characters, family notes) into structured visual FACTS that the bible
// treats as authoritative. The parser keeps the parent's own words for
// each fact (lower-cased, articles stripped) instead of re-synthesising
// them, so "long black braid tied with a red ribbon" survives verbatim.
// Anything it does not recognise as visual (interests, personality,
// addresses, feelings) is dropped and never reaches an image prompt.

export interface GarmentFact {
  /** The parent's phrase, e.g. "bright green raincoat". */
  phrase: string
  /** Slot the garment fills; used to decide what may still be invented. */
  slot: 'outerwear' | 'top' | 'bottom' | 'full' | 'footwear' | 'headwear' | 'accessory'
}

export interface Appearance {
  /** Explicit skin tone phrase, only when the parent wrote one. */
  skin: string | null
  /** Hair facts: colour/length/style phrases and accessories (ribbon, bow …). */
  hair: string[]
  hair_accessories: string[]
  eyes: string | null
  glasses: boolean
  /** Freckles, dimples, gap teeth, cowlick, scars, birthmarks … */
  features: string[]
  garments: GarmentFact[]
  /** Explicit "favourite colour X" / "loves the colour X"; never inferred from a garment colour. */
  favourite_colour: string | null
  /** Non-human identity when the text names a species. */
  species: string | null
  /** Colour words and markings attached to an animal ("black", "one white paw", "bent tail"). */
  markings: string[]
  /** Explicit build/height/size words ("tall", "stocky", "small"). Optional: absent in bibles persisted before 1H.1. */
  build?: string | null
  /** Carried identity items that belong to THIS character ("walking stick", "fishing rod"); never story-level recurring objects. Optional. */
  props?: string[]
}

/** "a"/"an" by sound, not spelling: an orange cat, a black cat, an 8-year-old, a unicorn, an hour. */
export function indefinite(phrase: string): string {
  const w = phrase.trim().toLowerCase()
  if (!w) return 'a'
  if (/^(8|11|18|80|800)\b/.test(w)) return 'an'
  if (/^\d/.test(w)) return 'a'
  if (/^(hour|honest|heir|honou?r)/.test(w)) return 'an'
  if (/^(uni|use|usu|eu|one|once|ewe|ukulele|utensil|u-)/.test(w)) return 'a'
  return /^[aeiou]/.test(w) ? 'an' : 'a'
}

export const withArticle = (phrase: string) => `${indefinite(phrase)} ${phrase.trim()}`

export const COLOUR_WORDS = ['red', 'yellow', 'green', 'blue', 'orange', 'purple', 'teal', 'pink', 'lilac', 'violet', 'turquoise', 'navy', 'gold', 'golden', 'silver', 'grey', 'gray', 'black', 'white', 'brown', 'tan', 'cream', 'beige', 'ginger', 'auburn', 'blond', 'blonde', 'dark', 'light', 'pale', 'olive', 'copper', 'chestnut', 'tabby', 'calico', 'tortoiseshell', 'brindle']
const COLOUR_RE = new RegExp(`\\b(${COLOUR_WORDS.join('|')})\\b`, 'i')

const SPECIES: Array<[RegExp, string]> = [
  [/\b(kitten|kitty|cats?)\b/i, 'cat'], [/\b(pupp(?:y|ies)|dogs?|hound|spaniel|terrier|retriever|labrador|beagle|poodle|corgi|husky|dachshund|collie)\b/i, 'dog'],
  [/\b(bunn(?:y|ies)|rabbits?)\b/i, 'rabbit'], [/\b(parrots?|macaws?|budgies?|parakeets?)\b/i, 'parrot'], [/\b(owls?)\b/i, 'owl'],
  [/\b(ducks?|ducklings?)\b/i, 'duck'], [/\b(hens?|chickens?|chicks?|roosters?)\b/i, 'chicken'], [/\b(penguins?)\b/i, 'penguin'], [/\b(birds?)\b/i, 'bird'],
  [/\b(foxes|fox)\b/i, 'fox'], [/\b(bears?|bear cubs?)\b/i, 'bear'], [/\b(ponies|pony|horses?|foals?)\b/i, 'horse'], [/\b(turtles?|tortoises?)\b/i, 'turtle'],
  [/\b(goldfish|fish)\b/i, 'fish'], [/\b(hamsters?)\b/i, 'hamster'], [/\b(guinea pigs?)\b/i, 'guinea pig'], [/\b(mice|mouse)\b/i, 'mouse'],
  [/\b(frogs?|toads?)\b/i, 'frog'], [/\b(hedgehogs?)\b/i, 'hedgehog'], [/\b(squirrels?)\b/i, 'squirrel'], [/\b(deer|fawns?)\b/i, 'deer'],
  [/\b(elephants?)\b/i, 'elephant'], [/\b(lions?)\b/i, 'lion'], [/\b(tigers?)\b/i, 'tiger'], [/\b(monkeys?)\b/i, 'monkey'], [/\b(goats?)\b/i, 'goat'],
  [/\b(sheep|lambs?)\b/i, 'sheep'], [/\b(pigs?|piglets?)\b/i, 'pig'], [/\b(cows?|calves|calf)\b/i, 'cow'], [/\b(lizards?|geckos?)\b/i, 'lizard'],
  [/\b(dragons?)\b/i, 'dragon'], [/\b(robots?)\b/i, 'robot'], [/\b(unicorns?)\b/i, 'unicorn'], [/\b(dinosaurs?|t-?rex|triceratops)\b/i, 'dinosaur'],
  [/\b(monsters?)\b/i, 'monster'], [/\b(aliens?)\b/i, 'alien'], [/\b(fair(?:y|ies))\b/i, 'fairy'], [/\b(teddy bears?|teddy|plush)\b/i, 'teddy bear'],
]

export function detectSpecies(text: string): string | null {
  for (const [re, species] of SPECIES) if (re.test(text)) return species
  return null
}

const MARKING_RE = /\b((?:one|two|three|four|a|with)\s+)?(?:white|black|brown|grey|gray|ginger|orange|golden|cream|pink|spotted|striped|patched|fluffy|curly|floppy|pointy|crooked|bent|kinked|stubby|curled|ragged|torn|notched|missing|droopy|scruffy|shaggy|silky|long|short|bushy|tufted)\s+(?:paws?|socks?|patch(?:es)?|spots?|stripes?|ears?|tails?|nose|beak|belly|chest|muzzle|face|mane|feathers?|fur|coat|whiskers|wings?|collar|eye|eyes|legs?|horns?|crest|fins?|shell)\b/gi

const GARMENT_SLOTS: Array<[RegExp, GarmentFact['slot']]> = [
  [/\b(raincoat|rain coat|coat|jacket|anorak|parka|windbreaker|hoodie|cardigan|cloak|cape|poncho|blazer|overcoat|duffle)\b/i, 'outerwear'],
  [/\b(dungarees|overalls|overall|jumpsuit|dress|pinafore|romper|onesie|pyjamas|pajamas|uniform|costume|tracksuit|wetsuit|spacesuit|flight suit)\b/i, 'full'],
  [/\b(t-?shirt|tee|shirt|sweater|jumper|sweatshirt|blouse|top|tunic|vest|polo|turtleneck|fleece)\b/i, 'top'],
  [/\b(trousers|pants|jeans|shorts|skirt|leggings|joggers|tights|culottes|cords|corduroys)\b/i, 'bottom'],
  [/\b(boots|wellies|wellingtons|sneakers|trainers|shoes|sandals|slippers|flip-flops|clogs|loafers|socks)\b/i, 'footwear'],
  [/\b(hat|cap|beanie|bonnet|helmet|hood|headscarf|bandana|crown|tiara|headband)\b/i, 'headwear'],
  [/\b(scarf|backpack|rucksack|satchel|bag|belt|mittens|gloves|watch|necklace|bracelet|goggles|binoculars|umbrella|cape)\b/i, 'accessory'],
]

const HAIR_RE = /\b(hair|braids?|plaits?|pigtails?|ponytail|bun|curls|curly|afro|bob|bangs|fringe|mohawk|buzz ?cut|dreadlocks|locs|twists|cornrows|topknot|cowlick)\b/i
const HAIR_ACCESSORY_RE = /\b(ribbons?|bows?|beads?|hair ?beads|headbands?|hair ?clips?|hairclips?|scrunchies?|barrettes?|hair ?ties?|bobbles?|hair ?bands?|bandana|flower in (?:her|his|their) hair)\b/i
const FEATURE_RE = /\b(freckles?|dimples?|gap-?toothed|(?:chipped|missing|crooked|wobbly|loose) (?:front |baby )?(?:tooth|teeth)|gappy smile|buck teeth|scar|birthmark|mole|big ears|sticking-out ears|round face|rosy cheeks|chubby cheeks|button nose|snub nose|bushy eyebrows|moustache|mustache|beard|goatee|stubble|wrinkles|laugh lines|braces|eye ?patch|hearing aids?|bandage|plaster cast|cast on (?:her|his|their) arm|wheelchair)\b/i
const BUILD_RE = /\b(very tall|tall|short|small|tiny|little|big|large|stocky|lanky|round|plump|skinny|thin|slim|broad-shouldered|broad|muscular|wiry|hunched|stooped|chubby|tubby|sturdy|petite)\b/i
const PROP_RE = /\b(walking stick|walking cane|cane|crutch(?:es)?|umbrella|pipe|fishing rod|fishing net|net|basket|lantern|torch|flashlight|map|notebook|sketchbook|book|teddy(?: bear)?|blanket|wand|sword|shield|bow and arrows?|guitar|ukulele|violin|drum|flute|whistle|camera|binoculars|telescope|magnifying glass|compass|trowel|spade|shovel|broom|watering can|toolbox|hammer|skateboard|scooter|kite|ball|football|balloon|bucket|jar|lunchbox|suitcase|trolley|wagon|cart)\b/i
const EYES_RE = /\b(brown|blue|green|hazel|grey|gray|dark|amber|black)\s+eyes\b/i
const SKIN_RE = /\b((?:dark|light|deep|warm|medium|pale|fair|olive|tan|tanned|brown|black|golden|copper|rich|bronze|ebony|caramel)[- ]?(?:brown|black|golden)?\s+skin(?:\s+tone)?|skin tone[^,.;]*)\b/i
const GLASSES_RE = /\b(glasses|spectacles|specs)\b/i
const FAVOURITE_RE = /\b(?:favou?rite colou?r (?:is )?|loves? the colou?r |obsessed with the colou?r |colou?r )(\w+)/i

const OBJECT_CUE_RE = /\b(favou?rite (?:thing|object|toy|possession)|lucky (?:object|charm|thing)|never goes anywhere without|always carries|always has|carries|treasured?|special|beloved|magic(?:al)?|named|called)\b/i
const ARTICLE_RE = /^(?:(?:a|an|the|her|his|their|its|my|our|some|with|wearing|wears|always wears|always in|in|and|who has|has|have)\s+)+/i

export function clausesOf(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/\s*(?:[,;.]|\band\b|\bwith\b|\bwho\b|\bplus\b|\balso\b)\s*/i)
    .map(c => c.trim())
    .filter(Boolean)
}

/** Lower-case, strip leading articles/verbs and trailing punctuation; keep the parent's words. */
export function normalizePhrase(clause: string): string {
  return clause.toLowerCase().replace(ARTICLE_RE, '').replace(/[\s.;:!]+$/g, '').replace(/^\s+/, '').trim()
}

const GENERIC_CLAUSE_RE = /\b(loves?|likes?|enjoys?|favou?rite|obsessed|hates?|scared|afraid|shy|brave|kind|curious|funny|silly|lives?|email|phone|address|road|street|school|grade|birthday|allerg|refuses|never takes|always carrying)\b/i

export interface ParseOptions {
  /** 'protagonist': species only when the text says the character IS one ("is a fox", "a little robot who…"); 'supporting': any species mention counts. */
  subject?: 'protagonist' | 'supporting'
}

const IS_SPECIES_RE = /\b(?:is|as|being)\s+an?\s+(?:[\w-]+\s+){0,2}(\w+)|^an?\s+(?:[\w-]+\s+){0,2}(\w+)\b/i

/** Parse one description into structured visual facts. */
export function parseAppearance(text: string | null | undefined, opts: ParseOptions = {}): Appearance {
  const out: Appearance = { skin: null, hair: [], hair_accessories: [], eyes: null, glasses: false, features: [], garments: [], favourite_colour: null, species: null, markings: [] }
  if (!text) return out
  const whole = text.replace(/\s+/g, ' ')
  const fav = whole.match(FAVOURITE_RE)
  if (fav && COLOUR_WORDS.includes(fav[1].toLowerCase())) out.favourite_colour = fav[1].toLowerCase()
  if (opts.subject === 'protagonist') {
    const m = whole.match(IS_SPECIES_RE)
    const candidate = m ? (m[1] ?? m[2] ?? '') : ''
    out.species = candidate ? detectSpecies(candidate) : null
  } else {
    out.species = detectSpecies(whole)
  }
  out.build = null
  out.props = []
  // an animal's size word inside its species clause ("small orange cat") is its build
  if (out.species) {
    const sized = whole.match(/\b(tiny|small|little|big|large|huge|plump|skinny|scruffy|fluffy|sturdy|stocky|lanky|chubby)\b(?=\s+(?:[\w-]+\s+){0,3}(?:cat|kitten|dog|puppy|rabbit|bunny|parrot|bird|owl|duck|fox|bear|horse|pony|turtle|fish|hamster|mouse|frog|dragon|robot|unicorn|dinosaur|monster)\b)/i)
    if (sized) out.build = sized[1].toLowerCase()
  }
  const skin = whole.match(SKIN_RE)
  if (skin) out.skin = normalizePhrase(skin[1])
  const eyes = whole.match(EYES_RE)
  if (eyes) out.eyes = eyes[0].toLowerCase()
  if (GLASSES_RE.test(whole)) out.glasses = true
  if (out.species) for (const m of whole.matchAll(MARKING_RE)) out.markings.push(normalizePhrase(m[0]))

  for (const raw of clausesOf(whole)) {
    const phrase = normalizePhrase(raw)
    if (!phrase) continue
    if (SKIN_RE.test(raw) || EYES_RE.test(raw)) continue
    if (/^(?:favou?rite|loves?|obsessed)/i.test(raw) && FAVOURITE_RE.test(raw)) continue
    if (GLASSES_RE.test(raw) && !HAIR_RE.test(raw) && !GARMENT_SLOTS.some(([re]) => re.test(raw))) {
      // "round green glasses" is a feature phrase worth keeping verbatim
      if (phrase !== 'glasses') out.features.push(phrase)
      continue
    }
    if (HAIR_ACCESSORY_RE.test(raw) && !GARMENT_SLOTS.some(([re]) => re.test(raw))) { out.hair_accessories.push(phrase); continue }
    if (HAIR_RE.test(raw)) { out.hair.push(phrase.replace(/\s+(?:tied|held|pulled|tucked|pinned|fastened|worn|done)$/i, '')); continue }
    if (FEATURE_RE.test(raw)) { out.features.push(phrase); continue }
    const slot = GARMENT_SLOTS.find(([re]) => re.test(raw))
    if (slot) {
      // "always wears a yellow scarf" → "yellow scarf"; keep the colour words the parent used
      out.garments.push({ phrase, slot: slot[1] })
      continue
    }
    // a carried identity item ("walking stick", "fishing rod") belongs to this character
    if (PROP_RE.test(raw) && !OBJECT_CUE_RE.test(raw)) { out.props!.push(phrase.replace(/^(?:carries|carrying|holds|holding|leans on|uses|with)\s+/i, '')); continue }
    // a bare build/size word ("tall", "stocky") — only as its own clause so "tall ship" never counts
    if (!out.build && BUILD_RE.test(raw) && raw.trim().split(/\s+/).length <= 3 && !COLOUR_RE.test(raw)) { out.build = phrase; continue }
    // animal body colour clause: "small black cat" → marking "black"
    if (out.species && COLOUR_RE.test(raw) && !GENERIC_CLAUSE_RE.test(raw)) {
      const c = raw.match(COLOUR_RE)![1].toLowerCase()
      if (!out.markings.some(m => m.includes(c))) out.markings.unshift(c)
    }
  }
  // de-duplicate while preserving order
  const uniq = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) === i)
  out.hair = uniq(out.hair); out.hair_accessories = uniq(out.hair_accessories); out.features = uniq(out.features); out.markings = uniq(out.markings); out.props = uniq(out.props ?? [])
  return out
}

/** Human-readable, order-stable summary of the explicit facts (no invention). Props are rendered separately ("carrying …"). */
export function appearanceSummary(a: Appearance): string[] {
  const parts: string[] = []
  if (a.build && !a.species) parts.push(a.build)
  if (a.skin) parts.push(a.skin)
  if (a.hair.length) parts.push(a.hair.join(', '))
  if (a.hair_accessories.length) parts.push(a.hair_accessories.join(', '))
  if (a.eyes) parts.push(a.eyes)
  if (a.glasses && !a.features.some(f => GLASSES_RE.test(f))) parts.push('glasses')
  if (a.features.length) parts.push(a.features.join(', '))
  return parts
}

// ── Supporting-character parsing ─────────────────────────────────────────────

export interface SupportingEntry {
  name: string
  /** Relation/role words the parent wrote ("her uncle", "grandmother"); may be empty. */
  role: string
  /** Everything the parent wrote about this character besides the name. */
  descriptor: string
  appearance: Appearance
}

const RELATION_RE = /\b((?:(?:little|younger|older|big|baby|best|twin|new|old|kind|wise)\s+)?(?:mum|mom|mother|dad|father|grandma|grandmother|nana|granny|grandpa|grandfather|abuela|abuelo|aunt|auntie|uncle|tio|tia|cousin|brother|sister|twin|friend|best friend|classmate|neighbou?r|teacher|coach|babysitter|nanny|captain|keeper|librarian|doctor|nurse|baby|toddler|pet|puppy|kitten))\b/i
const NAME_TITLE = /^(?:Tio|Tia|Abuela|Abuelo|Grandma|Grandpa|Nana|Granny|Uncle|Aunt|Auntie|Mr|Mrs|Ms|Miss|Dr|Captain|Coach|Baby|Little)$/i

/**
 * Split the parent's supporting-character text into entries WITHOUT
 * breaking a character's own description apart. Commas inside brackets or
 * dashes belong to the preceding name; a new entry starts only at ";", a
 * newline, " and " outside brackets, or a comma followed by a capitalised
 * name that is not a continuation of the current descriptor.
 */
export function splitSupportingEntries(text: string): string[] {
  const protect = text.replace(/\([^)]*\)/g, g => g.replace(/,/g, '\u0001').replace(/\band\b/gi, '\u0002'))
  const coarse = protect.split(/\s*(?:;|\n|\band\b)\s*/i).map(s => s.trim()).filter(Boolean)
  const entries: string[] = []
  for (const chunk of coarse) {
    const pieces = chunk.split(/\s*,\s*/)
    let current = ''
    for (const piece of pieces) {
      const startsNewEntry = /^(?:[A-Z][\w'-]+)(?:\s+[A-Z][\w'-]+)?\s*(?:\(|-|:|$|,)/.test(piece) && !/^(?:[A-Z][a-z]+)$/.test(piece) ? true
        : /^[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)*\s*\(/.test(piece)
      const looksLikeName = /^(?:(?:her|his|their|my|our)\s+)?(?:[a-z]+\s+)*[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?\s*(?:\(|-|:|$)/.test(piece)
      if (current && (startsNewEntry || looksLikeName) && !/^(?:tall|short|small|big|little|old|young|grey|gray|white|black|brown|blue|red|green|yellow|with|wearing|who|a |an |the )/i.test(piece)) {
        entries.push(current); current = piece
      } else {
        current = current ? `${current}, ${piece}` : piece
      }
    }
    if (current) entries.push(current)
  }
  return entries.map(e => e.replace(/\u0001/g, ',').replace(/\u0002/g, 'and').trim()).filter(Boolean)
}

/** Name = leading capitalised token(s) (allowing a title such as "Tio"/"Grandma"), else the first capitalised word anywhere. */
function extractName(entry: string): { name: string; rest: string } {
  const lead = entry.match(/^(?:(?:her|his|their|my|our)\s+(?:[a-z]+\s+){0,3})?([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)\s*(.*)$/)
  if (lead) {
    const name = lead[1].trim()
    const prefix = entry.slice(0, entry.indexOf(name)).trim()
    return { name, rest: `${prefix} ${lead[2]}`.trim() }
  }
  const any = entry.match(/\b([A-Z][\w'-]{1,30})\b/)
  if (any) return { name: any[1], rest: entry.replace(any[1], ' ').replace(/\s+/g, ' ').trim() }
  return { name: '', rest: entry }
}

export function parseSupportingEntries(text: string | null | undefined): SupportingEntry[] {
  if (!text) return []
  const out: SupportingEntry[] = []
  for (const entry of splitSupportingEntries(text)) {
    const { name, rest } = extractName(entry)
    if (!name) continue
    const descriptor = rest.replace(/^[\s(:-]+|[\s)]+$/g, '').replace(/\s+/g, ' ').trim()
    const roleMatch = descriptor.match(RELATION_RE) ?? (NAME_TITLE.test(name.split(' ')[0]) ? [name.split(' ')[0].toLowerCase()] : null)
    const role = roleMatch ? roleMatch[0].toLowerCase() : ''
    out.push({ name, role, descriptor, appearance: parseAppearance(descriptor) })
  }
  return out
}

/** Two character records refer to the same person when they share a name token (e.g. "Grandma" and "Grandma Joyce"). */
export function sameCharacter(a: string, b: string): boolean {
  const ta = a.toLowerCase().split(/\s+/).filter(t => t.length >= 2)
  const tb = b.toLowerCase().split(/\s+/).filter(t => t.length >= 2)
  return ta.some(t => tb.includes(t))
}

// ── Explicit recurring objects ───────────────────────────────────────────────

const OBJECT_NOUNS = ['compass', 'whistle', 'bucket', 'spade', 'kite', 'scooter', 'bike', 'bicycle', 'teddy', 'teddy bear', 'bear', 'bunny', 'blanket', 'blankie', 'doll', 'robot', 'truck', 'car', 'train', 'ball', 'book', 'map', 'torch', 'flashlight', 'lantern', 'lamp', 'key', 'locket', 'necklace', 'bracelet', 'ring', 'hat', 'cap', 'scarf', 'backpack', 'satchel', 'bag', 'umbrella', 'wand', 'sword', 'shield', 'crown', 'telescope', 'binoculars', 'camera', 'notebook', 'pencil', 'crayon', 'paintbrush', 'guitar', 'drum', 'flute', 'violin', 'frog', 'dinosaur', 'rocket', 'boat', 'ship', 'canoe', 'sled', 'skateboard', 'surfboard', 'jar', 'box', 'suitcase', 'basket', 'bottle', 'cup', 'mug', 'spoon', 'wooden spoon', 'shell', 'stone', 'pebble', 'feather', 'leaf', 'flower', 'seed', 'coin', 'medal', 'badge', 'glasses', 'watch', 'clock', 'bell', 'balloon', 'puzzle', 'cards', 'marble', 'marbles', 'yo-yo', 'slingshot', 'net', 'rope', 'stick', 'walking stick', 'cane', 'broom', 'pillow', 'quilt', 'mask', 'goggles', 'helmet', 'toy', 'plush']
const OBJECT_RE = new RegExp(`\\b(${OBJECT_NOUNS.map(n => n.replace(/[-\\s]/g, '[-\\\\s]')).sort((a, b) => b.length - a.length).join('|')})\\b`, 'i')

/**
 * Explicit physical objects the parent named as important (family notes,
 * description). Returns the parent's phrase for each, e.g.
 * "old brass compass" or "yellow bucket named Sunny". Never names.
 */
export function extractExplicitObjects(text: string | null | undefined, knownNames: string[] = []): string[] {
  if (!text) return []
  const out: string[] = []
  const lowerNames = knownNames.map(n => n.toLowerCase())
  for (const sentence of text.replace(/\s+/g, ' ').split(/(?<=[.!?;])\s+/)) {
    if (!OBJECT_RE.test(sentence)) continue
    const cued = OBJECT_CUE_RE.test(sentence)
    const m = sentence.match(new RegExp(`((?:\\b[\\w'-]+\\s+){0,3})(\\b(?:${OBJECT_RE.source.slice(3, -3)})\\b)(\\s+(?:named|called)\\s+[A-Z][\\w'-]+)?`, 'i'))
    if (!m) continue
    let phrase = `${m[1] ?? ''}${m[2]}${m[3] ?? ''}`.trim()
    // drop leading verbs / articles / stop words but keep the adjectives the parent used ("old brass compass")
    for (let i = 0; i < 4; i++) phrase = phrase.replace(/^(?:is|are|her|his|their|its|a|an|the|one|thing|object|toy|without|carries|has|loves|with|named|called|goes|anywhere)\s+/i, '').trim()
    if (!phrase || lowerNames.includes(phrase.toLowerCase())) continue
    if (!cued && !/\b(named|called)\b/i.test(sentence)) continue
    const key = phrase.toLowerCase()
    // containment de-duplication: "red tin bucket named Rumble" absorbs "red tin bucket"
    const idx = out.findIndex(o => o.toLowerCase().includes(key) || key.includes(o.toLowerCase()))
    if (idx === -1) out.push(phrase)
    else if (key.length > out[idx].length) out[idx] = phrase
  }
  return out.slice(0, 3)
}
