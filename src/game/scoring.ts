import type { Game, Player, SlotStatus } from './types'

export function stats(p: Player) {
  const count = (status: SlotStatus) => p.wheel.filter((s) => s.status === status).length
  return { correct: count('correct'), wrong: count('wrong'), pending: count('pending') }
}

export type Result =
  | { winner: 0 | 1; reason: 'moreCorrect' | 'fewerWrong' | 'lessTime' }
  | { winner: null; reason: 'tie' }

// Most correct answers wins; on a tie, fewest wrong answers; then least time used
// (everyone starts with the same time, so the one with more time left wins).
// Time is compared in whole seconds, as shown on screen.
export function result(g: Game): Result {
  const [a, b] = g.players.map(stats)
  if (a.correct !== b.correct) return { winner: a.correct > b.correct ? 0 : 1, reason: 'moreCorrect' }
  if (a.wrong !== b.wrong) return { winner: a.wrong < b.wrong ? 0 : 1, reason: 'fewerWrong' }
  const [ta, tb] = g.players.map((p) => Math.ceil(p.remainingMs / 1000))
  if (ta !== tb) return { winner: ta > tb ? 0 : 1, reason: 'lessTime' }
  return { winner: null, reason: 'tie' }
}
