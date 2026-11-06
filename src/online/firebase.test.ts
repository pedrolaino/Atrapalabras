import { describe, expect, it } from 'vitest'
import { testGame } from '../game/testUtils'
import { toRoom } from './firebase'

// Anyone who knows the code can write to the room: whatever arrives is checked before use.
describe('reading the stored room', () => {
  const game = testGame()

  it('reads a well-formed room', () => {
    expect(toRoom({ createdAt: 1, uid0: 'u', name0: 'Pedro', used0: '["a-001"]', name1: 'Juan', used1: '[]', game: JSON.stringify(game) }))
      .toEqual({ players: ['Pedro', 'Juan'], used: [['a-001'], []], game })
  })

  it('discards a broken game instead of breaking the screen', () => {
    for (const broken of ['{', '{"version":2}', '"hola"', '{"version":2,"players":[1,2],"phase":"finished","history":[]}']) {
      expect(toRoom({ createdAt: 1, uid0: 'u', name0: 'Pedro', used0: '[]', game: broken })?.game).toBeNull()
    }
  })

  it('ignores used lists that are not lists of strings', () => {
    expect(toRoom({ createdAt: 1, uid0: 'u', name0: 'Pedro', used0: '{"a":1}', used1: '[1,"b-001"]' })?.used).toEqual([[], []])
  })

  it('a room without a valid name is treated as nonexistent', () => {
    expect(toRoom({ createdAt: 1, uid0: 'u', name0: 5, used0: '[]' } as never)).toBeNull()
    expect(toRoom({ createdAt: 1, uid0: 'u', name0: 'Pedro', used0: '[]', name1: {} } as never)?.players).toEqual(['Pedro', null])
  })
})
