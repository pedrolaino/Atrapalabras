// Syncing an online room, with no React. There are two implementations with the same
// behavior: Firebase (firebase.ts) and this in-memory one, used by the tests.
import { reducer } from '../game/reducer'
import type { Action, Game } from '../game/types'
import { newRoomCode } from './roomCode'

export interface Room {
  // Seat 0 belongs to whoever created the room; seat 1 to whoever joined (null while empty).
  players: [string, string | null]
  // Ids of the questions each player already used, so the wheels avoid repeating them.
  used: [string[], string[]]
  game: Game | null
}

export interface Connection {
  createRoom(name: string, used: string[]): Promise<string>
  // Takes seat 1. Fails with RoomError if the room does not exist, is full or the name is taken.
  join(code: string, name: string, used: string[]): Promise<void>
  // Reports the room every time it changes (null if it does not exist). Returns the unsubscribe function.
  subscribe(code: string, onChange: (room: Room | null) => void): () => void
  // Applies the action with the reducer on the stored game, without losing simultaneous actions.
  dispatch(code: string, action: Action): Promise<void>
  // Difference in ms between the server clock and the device clock.
  subscribeClockOffset(onChange: (ms: number) => void): () => void
}

export class RoomError extends Error {}

// Checks whether someone can join the room. Shared by both implementations.
// The messages are shown in the app (in Spanish).
export function checkJoin(room: Room | null, name: string): void {
  if (!room) throw new RoomError('No existe una sala con ese código.')
  if (room.players[1] !== null) throw new RoomError('La sala ya está llena.')
  if (room.players[0].trim().toLowerCase() === name.trim().toLowerCase()) {
    throw new RoomError('Ese nombre ya está en la sala. Elegí otro.')
  }
}

// What lives on the server with Firebase. Several connections can share it, like several devices.
export function createMemoryServer() {
  return {
    rooms: new Map<string, Room>(),
    listeners: new Map<string, Set<(r: Room | null) => void>>(),
  }
}

export function memoryConnection(server = createMemoryServer()): Connection {
  const { rooms, listeners } = server
  const read = (code: string) => (rooms.has(code) ? structuredClone(rooms.get(code)!) : null)
  const notify = (code: string) => listeners.get(code)?.forEach((f) => f(read(code)))

  return {
    async createRoom(name, used) {
      let code = newRoomCode()
      while (rooms.has(code)) code = newRoomCode()
      rooms.set(code, { players: [name, null], used: [used, []], game: null })
      notify(code)
      return code
    },
    async join(code, name, used) {
      const room = rooms.get(code) ?? null
      checkJoin(room, name)
      room!.players[1] = name
      room!.used[1] = used
      notify(code)
    },
    subscribe(code, onChange) {
      if (!listeners.has(code)) listeners.set(code, new Set())
      listeners.get(code)!.add(onChange)
      onChange(read(code))
      return () => void listeners.get(code)?.delete(onChange)
    },
    async dispatch(code, action) {
      const room = rooms.get(code)
      if (!room) return
      const next = reducer(room.game, action)
      if (next === room.game) return
      room.game = structuredClone(next)
      notify(code)
    },
    subscribeClockOffset(onChange) {
      onChange(0)
      return () => {}
    },
  }
}
