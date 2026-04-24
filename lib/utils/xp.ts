// XP thresholds per level (index = level - 1)
const XP_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2000, 2800, 4000, 6000]

export const LEVEL_TITLES = [
  'Explorer', 'Adventurer', 'Trailblazer', 'Champion',
  'Scholar', 'Pathfinder', 'Mastermind', 'Legend', 'Legend+',
]

export function xpToLevel(xp: number): number {
  let level = 1
  for (let i = 1; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) level = i + 1
    else break
  }
  return level
}

export function levelProgress(xp: number): { level: number; title: string; current: number; needed: number; pct: number } {
  const level = xpToLevel(xp)
  const idx = level - 1
  const current = xp - XP_THRESHOLDS[idx]
  const needed = (XP_THRESHOLDS[idx + 1] ?? XP_THRESHOLDS[idx] + 2000) - XP_THRESHOLDS[idx]
  return {
    level,
    title: LEVEL_TITLES[idx] ?? 'Legend',
    current,
    needed,
    pct: Math.min(100, Math.round((current / needed) * 100)),
  }
}

export function calcXP(opts: { tool: string; score?: number | null; total?: number | null; streakDays?: number }): { base: number; bonus: number; reasons: string[] } {
  const base = 50
  const reasons: string[] = ['assignment_complete']
  let bonus = 0

  if (opts.score != null && opts.total) {
    const pct = opts.score / opts.total
    if (pct === 1) { bonus += 75; reasons.push('perfect_score') }
    else if (pct >= 0.8) { bonus += 50; reasons.push('high_score') }
    else if (pct >= 0.6) { bonus += 25; reasons.push('good_score') }
  }

  const streak = opts.streakDays ?? 0
  if (streak >= 7) { bonus += Math.round((base + bonus) * 1.0); reasons.push('streak_7') }
  else if (streak >= 3) { bonus += Math.round((base + bonus) * 0.5); reasons.push('streak_3') }

  return { base, bonus, reasons }
}
