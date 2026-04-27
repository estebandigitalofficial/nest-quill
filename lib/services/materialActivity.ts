import { NEUTRALITY_RULE } from '@/lib/utils/learningGuardrails'

export type ActivityMode = 'quiz' | 'flashcards' | 'explain' | 'study-guide'

export const VALID_ACTIVITY_MODES: ActivityMode[] = ['quiz', 'flashcards', 'explain', 'study-guide']

export function buildPrompts(
  mode: ActivityMode,
  material: string,
  gradeLabel: string,
): { system: string; user: string } {
  const user = `Study material:\n\n${material.trim()}`

  if (mode === 'quiz') {
    return {
      system: `You are an educational quiz writer for ${gradeLabel} students. Create 5 multiple-choice questions based ONLY on the provided text.

Rules:
- Exactly 5 questions, vocabulary matching ${gradeLabel} level
- correct_index is 0-based
- All 4 options must be plausible
- Questions must be answerable from the provided text only
- ${NEUTRALITY_RULE}

Output valid JSON:
{
  "title": "short descriptive title for this quiz",
  "questions": [
    {
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "brief encouraging explanation"
    }
  ]
}`,
      user: `${user}\n\nGenerate 5 quiz questions based on this text.`,
    }
  }

  if (mode === 'flashcards') {
    return {
      system: `You are a flashcard creator for ${gradeLabel} students. Create 8-10 flashcards based ONLY on the provided text.

Rules:
- 8-10 cards, vocabulary matching ${gradeLabel} level
- Cards must come directly from the provided text
- Keep fronts short (1-5 words), backs informative (1-2 sentences)
- ${NEUTRALITY_RULE}

Output valid JSON:
{
  "title": "short descriptive title",
  "cards": [
    {"front": "term or question", "back": "definition or answer"}
  ]
}`,
      user: `${user}\n\nCreate flashcards from this text.`,
    }
  }

  if (mode === 'explain') {
    return {
      system: `You are a patient teacher for ${gradeLabel} students. Explain the key ideas from the provided text clearly and engagingly.

Rules:
- 3-5 sections covering the main ideas
- Language appropriate for ${gradeLabel} level
- Explain concepts from the text only
- ${NEUTRALITY_RULE}

Output valid JSON:
{
  "title": "short descriptive title",
  "sections": [
    {"heading": "section heading", "content": "2-3 sentence explanation"}
  ],
  "summary": "1-2 sentence summary of the most important takeaway"
}`,
      user: `${user}\n\nExplain the key ideas from this text.`,
    }
  }

  // study-guide
  return {
    system: `You are an expert study guide creator for ${gradeLabel} students. Create a comprehensive study guide based ONLY on the provided text.

Rules:
- 4-6 key terms, 3-4 main concepts, 3 remember tips, 3-4 practice questions
- All content must come from the provided text
- Vocabulary and complexity matching ${gradeLabel} level
- ${NEUTRALITY_RULE}

Output valid JSON:
{
  "title": "Study Guide: [topic]",
  "overview": "1-2 sentence overview",
  "key_terms": [{"term": "string", "definition": "string"}],
  "main_concepts": [{"heading": "string", "content": "string"}],
  "remember": ["tip 1", "tip 2", "tip 3"],
  "practice_questions": [{"question": "string", "answer": "string"}]
}`,
    user: `${user}\n\nCreate a study guide from this text.`,
  }
}
