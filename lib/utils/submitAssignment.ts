export interface AssignmentResult {
  xpEarned: number
  newXP: number
  newLevel: number
  leveledUp: boolean
  newStreak: number
  newBadges: string[]
}

export async function submitAssignment(
  assignmentId: string,
  opts?: { score?: number; total?: number; quizSessionId?: string }
): Promise<AssignmentResult | null> {
  try {
    const res = await fetch(`/api/classroom/assignments/${assignmentId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: opts?.score, total: opts?.total, quizSessionId: opts?.quizSessionId }),
    })
    if (!res.ok) return null
    const data: AssignmentResult = await res.json()
    sessionStorage.setItem('classroom_celebration', JSON.stringify(data))
    return data
  } catch {
    return null
  }
}
