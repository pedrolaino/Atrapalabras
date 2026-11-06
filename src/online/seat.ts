import { readJSON } from '../game/storage'
import { normalizeRoomCode } from './roomCode'

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
