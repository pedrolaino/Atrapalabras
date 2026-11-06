// The whole game state is plain JSON (no functions, dates or classes),
// so it can be saved to localStorage and synced online as-is.

export type QuestionType = 'startsWith' | 'contains'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Question {
  id: string
  letter: string
  type: QuestionType
  clue: string
  answer: string
  difficulty: Difficulty
}

export type SlotStatus = 'pending' | 'correct' | 'wrong'

export interface WheelSlot {
  letter: string
  question: Question
  status: SlotStatus
}

export interface Player {
  name: string
  wheel: WheelSlot[]
  // Position of the letter being asked now (or the next time this player plays).
  index: number
  // Remaining time in milliseconds, as of the last time this player's clock stopped.
  remainingMs: number
  // Finished the wheel or ran out of time.
  done: boolean
}

export type Phase = 'betweenTurns' | 'playing' | 'finished'

export interface Game {
  version: 2
  players: [Player, Player]
  // Index (0 or 1) of the player who is answering now or is up next.
  current: 0 | 1
  phase: Phase
  paused: boolean
  // When (Date.now()) the current player's clock started; null while it is stopped.
  clockStartedAt: number | null
  // On the between-turns screen: true if the device has to change hands.
  // False when the player left alone passed and keeps playing.
  handOver: boolean
  // Number of turns started so far (0 = the first one has not started yet).
  turns: number
  // Board snapshots taken before each tap, for undo.
  history: BoardSnapshot[]
}

// What undo restores (only what a tap changes, to keep it small).
// Clocks are not restored: time that passed, passed.
export interface PlayerSnapshot {
  index: number
  done: boolean
  statuses: SlotStatus[]
}

export interface BoardSnapshot {
  current: 0 | 1
  players: [PlayerSnapshot, PlayerSnapshot]
}

// Which question and turn the tap was made on: if that is no longer the current one (a double
// tap, or a tap that arrived late from the other device), it is ignored.
export interface AnswerTap { now: number; questionId?: string; turn?: number }

export type Action =
  | { type: 'START'; names: [string, string]; wheels: [Question[], Question[]]; timeMs: number }
  | ({ type: 'CORRECT' } & AnswerTap)
  | ({ type: 'WRONG' } & AnswerTap)
  | ({ type: 'PASS' } & AnswerTap)
  // turn: the turn number on screen when tapped, so a late tap is ignored.
  | { type: 'CONTINUE'; now: number; turn?: number }
  | { type: 'UNDO'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'TIME_UP'; now: number }
  | { type: 'RESET' }
