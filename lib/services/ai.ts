import OpenAI from 'openai'
import type { StoryRequest } from '@/types/database'
import type { GeneratedStoryJSON } from '@/types/story'

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

export async function generateStoryText(
  request: Pick<
    StoryRequest,
    | 'child_name'
    | 'child_age'
    | 'child_description'
    | 'story_theme'
    | 'story_tone'
    | 'story_moral'
    | 'story_length'
    | 'illustration_style'
    | 'dedication_text'
    | 'supporting_characters'
    | 'author_name'
    | 'custom_notes'
  >
): Promise<GeneratedStoryJSON> {
  const openai = getOpenAI()
  const pageCount = request.story_length || 16
  const toneList = Array.isArray(request.story_tone)
    ? request.story_tone.join(', ')
    : String(request.story_tone)

  const systemPrompt = `You are a professional children's book author. You write warm, age-appropriate stories for young children.

Your output must be valid JSON matching this exact structure:
{
  "title": "string — a short, memorable book title",
  "subtitle": "string — an optional subtitle (can be empty string)",
  "synopsis": "string — 2-3 sentence description of the story",
  "dedication": "string — a short dedication if one was provided, otherwise empty string",
  "pages": [
    {
      "page": 1,
      "text": "string — the story text for this page (2-4 sentences, age-appropriate)",
      "image_description": "string — a detailed visual description for an illustrator (what to draw on this page)"
    }
  ]
}

Rules:
- Write exactly ${pageCount} story pages
- Keep language simple and age-appropriate for a ${request.child_age}-year-old
- Each page should have 2-4 sentences maximum
- Image descriptions must be vivid, specific, and describe a single scene
- The illustration style is ${request.illustration_style} — reflect this in image description language
- Tone: ${toneList}
- Do not include page numbers or chapter headings in the text
- End the story with a satisfying, uplifting conclusion`

  const userPrompt = [
    `Write a children's storybook with these details:`,
    ``,
    `- Main character: ${request.child_name}, age ${request.child_age}`,
    request.child_description ? `- About ${request.child_name}: ${request.child_description}` : null,
    request.supporting_characters ? `- Supporting characters to include: ${request.supporting_characters}` : null,
    `- Story theme: ${request.story_theme}`,
    `- Tone: ${toneList}`,
    request.story_moral ? `- Moral or lesson to include: ${request.story_moral}` : null,
    request.dedication_text ? `- Dedication: ${request.dedication_text}` : null,
    request.custom_notes ? `- Additional notes: ${request.custom_notes}` : null,
    `- Length: exactly ${pageCount} pages`,
    ``,
    `Write the full story now.`,
  ]
    .filter(Boolean)
    .join('\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.8,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('OpenAI returned empty response')

  const story = JSON.parse(content) as GeneratedStoryJSON
  if (!story.pages || !Array.isArray(story.pages) || story.pages.length === 0) {
    throw new Error('OpenAI returned invalid story structure — no pages found')
  }

  return story
}
