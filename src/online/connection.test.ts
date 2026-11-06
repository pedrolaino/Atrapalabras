// Both implementations (in-memory and Firebase) must behave the same.
// The Firebase one only runs against the emulator: npm run test:online
import { describe, expect, it } from 'vitest'
import { testQuestions } from '../game/testUtils'
import type { Action, Game } from '../game/types'
import { memoryConnection, RoomError, createMemoryServer, type Connection, type Expiry, type Room } from './connection'

declare const process: { env: Record<string, string | undefined> }

// Three different devices: Pedro, Juan and Ana.
type Devices = (expiry?: Expiry) => Promise<[Connection, Connection, Connection]>

const implementations: [string, Devices][] = [['in memory', async (expiry) => {
  const s = createMemoryServer()
  return [memoryConnection(expiry, s), memoryConnection(expiry, s), memoryConnection(expiry, s)]
}]]
const emulator = process.env.FIREBASE_DATABASE_EMULATOR_HOST
if (emulator) {
  let n = 0
  implementations.push(['Firebase', async (expiry) => {
    const { firebaseConnection } = await import('./firebase')
    n++
    return [firebaseConnection(emulator, `pedro-${n}`, expiry), firebaseConnection(emulator, `juan-${n}`, expiry), firebaseConnection(emulator, `ana-${n}`, expiry)]
  }])
}

// Waits until the room meets the condition (or fails after 5 seconds).
function waitFor(c: Connection, code: string, condition: (r: Room | null) => boolean): Promise<Room | null> {
  return new Promise((resolve, reject) => {
    let stop = () => {}
    const timeout = setTimeout(() => { stop(); reject(new Error('the room never reached the expected state')) }, 5000)
    let done = false
    stop = c.subscribe(code, (r) => {
      if (done || !condition(r)) return
      done = true
      clearTimeout(timeout)
      queueMicrotask(() => stop())
      resolve(r)
    })
    if (done) stop()
  })
}

const LETTERS = ['A', 'B', 'C']
const START: Action = { type: 'START', names: ['Pedro', 'Juan'], wheels: [testQuestions(LETTERS, 'j1'), testQuestions(LETTERS, 'j2')], timeMs: 150_000 }
const correct = (g: Game | null | undefined, i: 0 | 1) => g?.players[i].wheel.filter((s) => s.status === 'correct').length

describe.each(implementations)('connection %s', (_, devices) => {
  it('creates a room, the other player joins and both see the same', async () => {
    const [pedro, juan] = await devices()
    const code = await pedro.createRoom('Pedro', ['a-001'])
    expect(code).toMatch(/^[A-Z]{4}$/)
    await juan.join(code, 'Juan', ['b-001', 'b-002'])
    const room = await waitFor(pedro, code, (r) => r?.players[1] === 'Juan')
    expect(room).toEqual({ players: ['Pedro', 'Juan'], used: [['a-001'], ['b-001', 'b-002']], game: null })
  })

  it('does not let anyone join a room that does not exist, is full or has the same name', async () => {
    const [pedro, juan, ana] = await devices()
    const code = await pedro.createRoom('Pedro', [])
    await expect(juan.join(code, ' pedro ', [])).rejects.toThrow(RoomError)
    await juan.join(code, 'Juan', [])
    await expect(ana.join(code, 'Ana', [])).rejects.toThrow(/llena/)
    const other = code === 'ZZZZ' ? 'YYYY' : 'ZZZZ'
    await expect(juan.join(other, 'Ana', [])).rejects.toThrow(/No existe/)
    expect(await waitFor(juan, other, () => true)).toBeNull()
  })

  it('both players\' actions go through the reducer without overwriting each other', async () => {
    const [pedro, juan] = await devices()
    const code = await pedro.createRoom('Pedro', [])
    await juan.join(code, 'Juan', [])
    await pedro.dispatch(code, START)
    await juan.dispatch(code, { type: 'CONTINUE', now: 1000 })
    // Both tap at the same time: both taps are applied, one after the other.
    await Promise.all([pedro.dispatch(code, { type: 'CORRECT', now: 2000 }), juan.dispatch(code, { type: 'CORRECT', now: 2001 })])
    const room = await waitFor(juan, code, (r) => correct(r?.game, 0) === 2)
    expect(room?.game?.players[0].index).toBe(2)
    expect(room?.game?.clockStartedAt).toBe(1000)
    // A repeated or early TIME_UP changes nothing
    await Promise.all([pedro.dispatch(code, { type: 'TIME_UP', now: 3000 }), juan.dispatch(code, { type: 'TIME_UP', now: 3000 })])
    expect((await waitFor(pedro, code, () => true))?.game).toEqual(room?.game)
    // RESET goes back to the room without a game
    await pedro.dispatch(code, { type: 'RESET' })
    expect((await waitFor(juan, code, (r) => r?.game === null))?.players).toEqual(['Pedro', 'Juan'])
  })

  it('reports the offset from the server clock', async () => {
    const [pedro] = await devices()
    let stop = () => {}
    const offset = await new Promise<number>((resolve) => { stop = pedro.subscribeClockOffset(resolve) })
    stop()
    expect(typeof offset).toBe('number')
  })

  it('deletes a room only once it expired', async () => {
    const [pedro, juan] = await devices({ activeMs: -120_000, finishedMs: -120_000 })
    const expired = await pedro.createRoom('Pedro', [])
    expect(await juan.deleteIfExpired(expired)).toBe(true)
    expect(await waitFor(pedro, expired, () => true)).toBeNull()
    expect(await juan.deleteIfExpired(expired)).toBe(true) // already gone

    const [, , ana] = await devices()
    const active = await ana.createRoom('Ana', [])
    expect(await ana.deleteIfExpired(active)).toBe(false)
    expect((await waitFor(ana, active, () => true))?.players[0]).toBe('Ana')
  })

  it('a finished room expires sooner than one in play', async () => {
    const [pedro, juan] = await devices({ activeMs: 3_600_000, finishedMs: -120_000 })
    const finished = await pedro.createRoom('Pedro', [])
    await juan.join(finished, 'Juan', [])
    const one = ['A']
    await pedro.dispatch(finished, { type: 'START', names: ['Pedro', 'Juan'], wheels: [testQuestions(one, 'j1'), testQuestions(one, 'j2')], timeMs: 150_000 })
    expect(await pedro.deleteIfExpired(finished)).toBe(false)
    for (const now of [1000, 2000, 3000, 4000]) await pedro.dispatch(finished, { type: now % 2000 ? 'CONTINUE' : 'CORRECT', now })
    expect((await waitFor(pedro, finished, (r) => r?.game?.phase === 'finished'))?.game?.phase).toBe('finished')
    expect(await juan.deleteIfExpired(finished)).toBe(true)
    expect(await waitFor(pedro, finished, () => true)).toBeNull()
  })

  it('joining again (for example, after a dropped connection) returns to the same seat', async () => {
    const [pedro, juan, ana] = await devices()
    const code = await pedro.createRoom('Pedro', [])
    await juan.join(code, 'Juan', [])
    await juan.join(code, 'Juan', [])
    await expect(ana.join(code, 'Juan', [])).rejects.toThrow(/llena/)
    expect((await waitFor(pedro, code, () => true))?.players).toEqual(['Pedro', 'Juan'])
  })
})

// The Firebase rules: only the two players can modify the room.
describe.skipIf(!emulator)('Firebase rules', () => {
  it('an outsider cannot change the game or delete the room', async () => {
    const [pedro, juan, ana] = await implementations[1][1]()
    const code = await pedro.createRoom('Pedro', [])
    await juan.join(code, 'Juan', [])
    await pedro.dispatch(code, START)
    await expect(ana.dispatch(code, { type: 'RESET' })).rejects.toThrow(/permission/i)
    expect(await ana.deleteIfExpired(code)).toBe(false)
    expect((await waitFor(pedro, code, () => true))?.game?.turns).toBe(0)
  })
})
