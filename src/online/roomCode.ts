// Room codes: 4 letters, without the ones easily mistaken for digits (I, L, O).
export const ROOM_CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ'

export function newRoomCode(random = Math.random): string {
  let code = ''
  for (let i = 0; i < 4; i++) code += ROOM_CODE_LETTERS[Math.floor(random() * ROOM_CODE_LETTERS.length)]
  return code
}

// What people type ("ab cd") turned into a valid code, or null if it is not one.
export function normalizeRoomCode(text: string): string | null {
  const code = text.replace(/\s/g, '').toUpperCase()
  return code.length === 4 && [...code].every((l) => ROOM_CODE_LETTERS.includes(l)) ? code : null
}
