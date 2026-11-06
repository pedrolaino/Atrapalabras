// localStorage reads and writes that never break the game if the browser blocks storage,
// it is full or it holds old data.
import type { Game, Player, Question } from './types'

const GAME_KEY = 'atrapalabras:game'
const FLAGGED_KEY = 'atrapalabras:flaggedQuestions'

export function readJSON(key: string): unknown {
  try {
    const text = localStorage.getItem(key)
    return text === null ? null : JSON.parse(text)
  } catch {
    return null
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Without storage the game goes on; it just cannot be resumed after a reload.
  }
}

// Checks the shape of a game that comes from outside (localStorage or the online room) before using it.
export function isGame(d: unknown): d is Game {
  const g = d as Game
  return (
    typeof g === 'object' && g !== null && g.version === 2 &&
    Array.isArray(g.players) && g.players.length === 2 && g.players.every(isPlayer) &&
    (g.current === 0 || g.current === 1) &&
    ['betweenTurns', 'playing', 'finished'].includes(g.phase) && Array.isArray(g.history)
  )
}

const STATUSES = ['pending', 'correct', 'wrong']
const isString = (x: unknown) => typeof x === 'string'

function isPlayer(p: Player): boolean {
  return (
    typeof p === 'object' && p !== null && isString(p.name) &&
    Number.isFinite(p.index) && Number.isFinite(p.remainingMs) &&
    Array.isArray(p.wheel) && p.wheel.length > 0 &&
    p.wheel.every((s) => isString(s?.letter) && STATUSES.includes(s.status) &&
      isString(s.question?.id) && isString(s.question.clue) && isString(s.question.answer) && isString(s.question.type))
  )
}

export function loadGame(): Game | null {
  const d = readJSON(GAME_KEY)
  return isGame(d) ? d : null
}

export const saveGame = (g: Game | null) => writeJSON(GAME_KEY, g)

export type FlaggedQuestion = Pick<Question, 'id' | 'letter' | 'clue' | 'answer'>

export function readFlagged(): FlaggedQuestion[] {
  const d = readJSON(FLAGGED_KEY)
  return Array.isArray(d) ? d.filter((f) => typeof f?.id === 'string') : []
}

// Flags the question, or unflags it if it was already flagged. Returns the new list.
export function toggleFlagged(q: Question): FlaggedQuestion[] {
  const flagged = readFlagged()
  const next = flagged.some((f) => f.id === q.id)
    ? flagged.filter((f) => f.id !== q.id)
    : [...flagged, { id: q.id, letter: q.letter, clue: q.clue, answer: q.answer }]
  writeJSON(FLAGGED_KEY, next)
  return next
}

export const clearFlagged = () => writeJSON(FLAGGED_KEY, null)
