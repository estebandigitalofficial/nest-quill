export async function extractTextFromImage(
  imageBase64: string,
  mimeType: string,
  mode: 'general' | 'spelling' = 'general'
): Promise<string> {
  const prompt = mode === 'spelling'
    ? 'Look at this image and extract any spelling words, vocabulary words, or word lists. Return ONLY the words, one per line. No numbers, bullets, punctuation, or extra text — just the words.'
    : 'Describe the educational content in this image clearly and specifically. Extract all topics, questions, problems, formulas, terms, and text that a student would need to study. Be thorough.'

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'auto' } },
          { type: 'text', text: prompt },
        ],
      }],
      max_tokens: 800,
      temperature: 0.2,
    }),
  })

  if (!res.ok) throw new Error(`OpenAI vision error: ${res.status}`)
  const json = await res.json()
  return json.choices[0].message.content?.trim() ?? ''
}
