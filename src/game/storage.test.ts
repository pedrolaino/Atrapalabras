// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadGame, readFlagged, saveGame, toggleFlagged } from './storage'
import { testGame } from './testUtils'

beforeEach(() => localStorage.clear())

describe('saved game', () => {
  it('is saved and loaded back unchanged', () => {
    const g = testGame()
    saveGame(g)
    expect(loadGame()).toEqual(g)
  })

  it('saving null deletes it', () => {
    saveGame(testGame())
    saveGame(null)
    expect(loadGame()).toBeNull()
  })

  it('ignores corrupt data or another version', () => {
    localStorage.setItem('atrapalabras:game', '{broken')
    expect(loadGame()).toBeNull()
    localStorage.setItem('atrapalabras:game', JSON.stringify({ ...testGame(), version: 99 }))
    expect(loadGame()).toBeNull()
    localStorage.setItem('atrapalabras:game', JSON.stringify({ version: 2, players: 'x' }))
    expect(loadGame()).toBeNull()
  })

  it('does not break if localStorage fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    expect(() => saveGame(testGame())).not.toThrow()
    spy.mockRestore()
  })
})

describe('flagged questions', () => {
  it('flags and unflags a question', () => {
    const q = testGame().players[0].wheel[0].question
    expect(toggleFlagged(q).map((f) => f.id)).toEqual([q.id])
    expect(readFlagged().map((f) => f.id)).toEqual([q.id])
    expect(toggleFlagged(q)).toEqual([])
    expect(readFlagged()).toEqual([])
  })
})
