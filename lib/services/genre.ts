/**
 * Rule-based genre classifier for story requests.
 */

const GENRE_RULES: { genre: string; pattern: RegExp }[] = [
  { genre: 'fantasy', pattern: /magic|wizard|fairy|dragon|unicorn|enchant|spell|witch|mermaid|elf/i },
  { genre: 'adventure', pattern: /adventure|quest|journey|explore|pirate|treasure|expedition|discover/i },
  { genre: 'sci-fi', pattern: /space|robot|alien|future|science|planet|rocket|galaxy|astronaut/i },
  { genre: 'animals', pattern: /animal|pet|dog|cat|horse|bunny|bear|zoo|farm|dinosaur|puppy|kitten/i },
  { genre: 'fairy-tale', pattern: /princess|prince|king|queen|castle|knight|kingdom|royal/i },
  { genre: 'educational', pattern: /learn|school|math|read|abc|number|letter|science|teach/i },
  { genre: 'friendship', pattern: /friend|share|kind|help|team|together|cooperat/i },
  { genre: 'family', pattern: /family|mom|dad|sister|brother|grandma|grandpa|parent|sibling/i },
  { genre: 'sports', pattern: /sport|soccer|baseball|swim|run|game|race|basketball|football/i },
  { genre: 'bedtime', pattern: /sleep|dream|bed|night|moon|star|lullaby|goodnight/i },
]

export function classifyGenre(theme: string, tones?: string[]): string {
  const combined = [theme, ...(tones ?? [])].join(' ')

  for (const { genre, pattern } of GENRE_RULES) {
    if (pattern.test(combined)) return genre
  }

  return 'general'
}
