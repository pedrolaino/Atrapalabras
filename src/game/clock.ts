import type { Game } from './types'

// The clock is computed from timestamps: the saved time minus what passed since it started.
export function remainingTime(g: Game, player: 0 | 1, now: number): number {
  const saved = g.players[player].remainingMs
  if (player !== g.current || g.clockStartedAt === null) return saved
  return Math.max(0, saved - Math.max(0, now - g.clockStartedAt))
}
