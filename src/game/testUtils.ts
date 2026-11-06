import { reducer } from './reducer'
import type { Game, Question } from './types'

export function testQuestions(letters: string[], prefix: string): Question[] {
  return letters.map((letter) => ({
    id: `${prefix}-${letter}`,
    letter,
    type: 'startsWith',
    clue: `Definición ${prefix} ${letter}`,
    answer: `${letter}respuesta`,
    difficulty: 'easy',
  }))
}

export function testGame(letters = ['A', 'B', 'C'], timeMs = 150_000): Game {
  const g = reducer(null, {
    type: 'START',
    names: ['Juan', 'Pedro'],
    wheels: [testQuestions(letters, 'j1'), testQuestions(letters, 'j2')],
    timeMs,
  })
  if (!g) throw new Error('START did not create the game')
  return g
}
