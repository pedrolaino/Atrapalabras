import { describe, expect, it } from 'vitest'
import { pickWheels, recordUsed, USED_QUESTIONS_KEY, type KeyValueStore } from './questionPicker'
import { testQuestions } from './testUtils'
import type { Question } from './types'

const LETTERS = ['A', 'B']

// Bank with `n` questions per letter: ids p0-A, p1-A, ...
function bank(n: number): Record<string, Question[]> {
  const b: Record<string, Question[]> = {}
  for (const letter of LETTERS) b[letter] = Array.from({ length: n }, (_, i) => testQuestions([letter], `p${i}`)[0])
  return b
}

function memoryStore(initial?: string[]): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  if (initial) data.set(USED_QUESTIONS_KEY, JSON.stringify(initial))
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

const used = (s: { data: Map<string, string> }) => new Set<string>(JSON.parse(s.data.get(USED_QUESTIONS_KEY) ?? '[]'))
const ids = (r: Question[][]) => r.map((wheel) => wheel.map((q) => q.id))

describe('pickWheels', () => {
  it('gives each player one question per letter, in wheel order', () => {
    const r = pickWheels(bank(3), LETTERS, { store: memoryStore() })
    expect(r).toHaveLength(2)
    for (const wheel of r) expect(wheel.map((q) => q.letter)).toEqual(LETTERS)
  })

  it('the two players never get the same question', () => {
    for (let i = 0; i < 50; i++) {
      const [a, b] = pickWheels(bank(2), LETTERS, { store: memoryStore() })
      a.forEach((q, k) => expect(q.id).not.toBe(b[k].id))
    }
  })

  it('avoids questions already used and records the new ones', () => {
    const store = memoryStore(['p0-A', 'p1-A', 'p0-B'])
    const r = pickWheels(bank(4), LETTERS, { store })
    const picked = ids(r).flat()
    for (const id of ['p0-A', 'p1-A', 'p0-B']) expect(picked).not.toContain(id)
    const saved = used(store)
    for (const id of [...picked, 'p0-A', 'p1-A', 'p0-B']) expect(saved.has(id)).toBe(true)
  })

  it('when a letter runs out, restarts the cycle for that letter only', () => {
    const store = memoryStore(['p0-A', 'p1-A', 'p0-B'])
    const r = pickWheels(bank(2), LETTERS, { store })
    expect(new Set([r[0][0].id, r[1][0].id])).toEqual(new Set(['p0-A', 'p1-A']))
    // B had one free question (p1-B): one player gets it, the other starts the new cycle.
    expect(new Set([r[0][1].id, r[1][1].id])).toEqual(new Set(['p0-B', 'p1-B']))
    expect(used(store)).toEqual(new Set(['p0-A', 'p1-A', 'p0-B', 'p1-B']))
  })

  it('on a restart with a single free question, that one is used and recorded in the new cycle', () => {
    const store = memoryStore(['p0-A', 'p1-A'])
    const r = pickWheels(bank(3), ['A'], { store, random: () => 0 })
    expect(r[0][0].id).toBe('p2-A')
    expect(r[1][0].id).toBe('p0-A')
    expect(used(store)).toEqual(new Set(['p2-A', 'p0-A']))
  })

  it('if localStorage fails, picks at random and keeps working', () => {
    const broken: KeyValueStore = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') } }
    const [a, b] = pickWheels(bank(2), LETTERS, { store: broken })
    a.forEach((q, k) => expect(q.id).not.toBe(b[k].id))
  })

  it('ignores corrupt saved data', () => {
    const store = memoryStore()
    store.data.set(USED_QUESTIONS_KEY, '{not json')
    expect(() => pickWheels(bank(2), LETTERS, { store })).not.toThrow()
    store.data.set(USED_QUESTIONS_KEY, '{"a": 1}')
    expect(() => pickWheels(bank(2), LETTERS, { store })).not.toThrow()
  })

  it('works without a store', () => {
    expect(pickWheels(bank(2), LETTERS, { store: null })[0]).toHaveLength(2)
  })
})

describe('pickWheels online', () => {
  it('also avoids the questions the other player used, without recording them as own', () => {
    const store = memoryStore(['p0-A'])
    const r = pickWheels(bank(4), ['A'], { store, otherUsed: ['p1-A'] })
    expect(new Set(ids(r).flat())).toEqual(new Set(['p2-A', 'p3-A']))
    expect(used(store)).toEqual(new Set(['p0-A', 'p2-A', 'p3-A']))
  })

  it('if between them they used them all, restarts the cycle for that letter', () => {
    const store = memoryStore(['p0-A'])
    const r = pickWheels(bank(2), ['A'], { store, otherUsed: ['p1-A'] })
    expect(new Set(ids(r).flat())).toEqual(new Set(['p0-A', 'p1-A']))
    expect(used(store)).toEqual(new Set(['p0-A', 'p1-A']))
  })
})

describe('recordUsed', () => {
  it('adds a game\'s questions to the history, without duplicates', () => {
    const store = memoryStore(['p0-A'])
    recordUsed(['p0-A', 'p1-A'], store)
    expect(used(store)).toEqual(new Set(['p0-A', 'p1-A']))
    expect(JSON.parse(store.data.get(USED_QUESTIONS_KEY)!)).toHaveLength(2)
  })
})
