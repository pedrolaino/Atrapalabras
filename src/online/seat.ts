import { readJSON, writeJSON } from '../game/storage'
import { normalizeRoomCode } from './roomCode'
import type { Connection } from './connection'

// Which room this device is in and in which seat. Saved so a reload goes straight back.
export interface SavedSeat { roomCode: string; seat: 0 | 1 }

export const ROOM_KEY = 'atrapalabras:room'

export function savedSeat(): SavedSeat | null {
  const d = readJSON(ROOM_KEY) as SavedSeat | null
  return d && normalizeRoomCode(String(d.roomCode)) && (d.seat === 0 || d.seat === 1) ? d : null
}

// The share link is ?sala=<code> (the player sees it, so it stays in Spanish).
export const roomCodeFromLink = () => normalizeRoomCode(new URLSearchParams(location.search).get('sala') ?? '')

// Go straight to online mode if there is a saved room or the page was opened from a room link.
export const shouldStartOnline = () => savedSeat() !== null || roomCodeFromLink() !== null

// Rooms this device has been in, to delete them once they expire.
const MY_ROOMS_KEY = 'atrapalabras:myRooms'

const myRooms = (): string[] => {
  const d = readJSON(MY_ROOMS_KEY)
  return Array.isArray(d) ? d.filter((c): c is string => typeof c === 'string' && normalizeRoomCode(c) === c) : []
}

export const rememberRoom = (code: string) => writeJSON(MY_ROOMS_KEY, [...new Set([...myRooms(), code])].slice(-20))

export async function deleteExpiredRooms(connection: Connection, except?: string) {
  const deleted = new Set<string>()
  for (const c of myRooms()) {
    if (c !== except && await connection.deleteIfExpired(c).catch(() => false)) deleted.add(c)
  }
  writeJSON(MY_ROOMS_KEY, myRooms().filter((c) => !deleted.has(c)))
}
