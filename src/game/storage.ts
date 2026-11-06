// localStorage reads and writes that never break the game if the browser blocks storage,
// it is full or it holds old data.
import type { Game, Question } from './types'

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

export function loadGame(): Game | null {
  const d = readJSON(GAME_KEY) as Game | null
  // A game saved by an older version is dropped.
  return d?.version === 2 ? d : null
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
