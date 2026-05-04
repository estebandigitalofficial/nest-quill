#!/usr/bin/env node
/**
 * Bulk content generator — fills every empty content_library entry.
 * Run: node scripts/generate-all-content.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load env from .env.local
const envPath = resolve(process.cwd(), '.env.local')
const envText = readFileSync(envPath, 'utf8')
const env = {}
for (const line of envText.split('\n')) {
  const eq = line.indexOf('=')
  if (eq > 0 && !line.startsWith('#')) {
    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim()
    if (key && val) env[key] = val
  }
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY = env.OPENAI_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_KEY) {
  console.error('Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Content generation (same prompts as the API route) ─────────────────────

async function generateContent(toolType, topic, grade, subject) {
  const gradeLabel = grade ? `grade ${grade}` : 'elementary school'
  const subjectLabel = subject ? ` for ${subject}` : ''

  let systemPrompt, userPrompt

  switch (toolType) {
    case 'quiz':
      systemPrompt = `You are an expert educational content writer creating accreditation-quality quiz material for ${gradeLabel} students. Create 5 multiple-choice questions aligned with Common Core / state standards.
Rules:
- Questions must be factually accurate and grade-appropriate
- All 4 options must be plausible distractors
- Include clear, encouraging explanations
- Cover different difficulty levels (2 easy, 2 medium, 1 harder)
Output valid JSON:
{"questions":[{"question":"string","options":["A","B","C","D"],"correct_index":0,"explanation":"string"}]}`
      userPrompt = `Generate 5 standards-aligned quiz questions${subjectLabel} on: ${topic} for a ${gradeLabel} student.`
      break
    case 'flashcards':
      systemPrompt = `You are an expert educational content writer creating study flashcards for ${gradeLabel} students. Generate exactly 10 cards aligned with Common Core / state standards.
Output valid JSON:
{"cards":[{"front":"term or question","back":"definition or answer"}]}`
      userPrompt = `Create 10 standards-aligned flashcards on: ${topic}${subjectLabel} (${gradeLabel}).`
      break
    case 'study-guide':
      systemPrompt = `You are an expert educational content writer creating comprehensive study guides for ${gradeLabel} students. Align with Common Core / state standards.
Output valid JSON:
{"title":"string","overview":"string","key_terms":[{"term":"string","definition":"string"}],"main_concepts":[{"heading":"string","content":"string"}],"remember":["tip1","tip2"],"practice_questions":[{"question":"string","answer":"string"}]}`
      userPrompt = `Create a comprehensive study guide on: ${topic}${subjectLabel} (${gradeLabel}).`
      break
    case 'explain':
      systemPrompt = `You are an expert educational content writer for ${gradeLabel} students.
Output valid JSON:
{"summary":"string","analogy":"string","key_points":["p1","p2","p3","p4"],"fun_fact":"string","try_this":"string"}`
      userPrompt = `Explain "${topic}" to a ${gradeLabel} student${subjectLabel}.`
      break
    default:
      return null
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`)
  }

  const json = await res.json()
  return JSON.parse(json.choices[0].message.content)
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Count empty items
  const { count: emptyCount } = await supabase
    .from('content_library')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('content', '{}')

  const { count: totalCount } = await supabase
    .from('content_library')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  console.log(`\n📚 Content Library: ${totalCount} total, ${emptyCount} empty\n`)

  if (emptyCount === 0) {
    console.log('✅ All content is already generated!')
    return
  }

  let generated = 0
  let errors = 0
  const startTime = Date.now()

  // Process grade by grade
  for (let grade = 1; grade <= 12; grade++) {
    // Get empty items for this grade
    const { data: items } = await supabase
      .from('content_library')
      .select('id, tool_type, grade, subject, topic, title')
      .eq('is_active', true)
      .eq('content', '{}')
      .eq('grade', grade)
      .order('subject')
      .order('topic')

    if (!items || items.length === 0) {
      console.log(`Grade ${grade}: ✅ all filled`)
      continue
    }

    console.log(`\nGrade ${grade}: ${items.length} items to generate`)
    let gradeGenerated = 0

    for (const item of items) {
      const label = `  [${item.tool_type}] ${item.subject} — ${item.topic}`
      try {
        const content = await generateContent(item.tool_type, item.topic, item.grade, item.subject)
        if (content) {
          await supabase
            .from('content_library')
            .update({ content, quality: 'auto', updated_at: new Date().toISOString() })
            .eq('id', item.id)
          generated++
          gradeGenerated++
          process.stdout.write(`${label} ✅ (${generated}/${emptyCount})\n`)
        } else {
          process.stdout.write(`${label} ⏭️ skipped\n`)
        }
      } catch (err) {
        errors++
        process.stdout.write(`${label} ❌ ${err.message.slice(0, 80)}\n`)
        // If rate limited, pause
        if (err.message.includes('429')) {
          console.log('  ⏳ Rate limited, waiting 30s...')
          await new Promise(r => setTimeout(r, 30000))
        }
      }

      // Small pause between requests to avoid rate limits
      await new Promise(r => setTimeout(r, 200))
    }

    console.log(`Grade ${grade}: generated ${gradeGenerated}/${items.length}`)
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  console.log(`\n✨ Done! Generated ${generated} items in ${elapsed}s (${errors} errors)\n`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
