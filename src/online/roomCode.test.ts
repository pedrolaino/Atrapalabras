import { describe, expect, it } from 'vitest'
import { ROOM_CODE_LETTERS, newRoomCode, normalizeRoomCode } from './roomCode'

describe('room codes', () => {
  it('have 4 letters and none can be mistaken for a digit', () => {
    for (let i = 0; i < 200; i++) expect(newRoomCode()).toMatch(/^[A-Z]{4}$/)
    for (const confusing of ['O', 'I', 'L']) expect(ROOM_CODE_LETTERS).not.toContain(confusing)
    expect(newRoomCode(() => 0)).toBe('AAAA')
    expect(newRoomCode(() => 0.9999)).toBe('ZZZZ')
  })

  it('accept what people type (lowercase, spaces) and reject invalid codes', () => {
    expect(normalizeRoomCode(' abcd ')).toBe('ABCD')
    expect(normalizeRoomCode('ab cd')).toBe('ABCD')
    expect(normalizeRoomCode('ABC')).toBeNull()
    expect(normalizeRoomCode('ABCDE')).toBeNull()
    expect(normalizeRoomCode('AB1D')).toBeNull()
    expect(normalizeRoomCode('ABOD')).toBeNull()
    expect(normalizeRoomCode('')).toBeNull()
  })
})
