// Picks the questions for each wheel, avoiding the ones from previous games.
// Everything about "no repeats" lives here: to drop it, replace pickWheels with a random pick.
//
// Online mode: each player keeps their history on their own device. Whoever picks receives the
// other player's history in `otherUsed`, so neither gets a question they already played.
import type { Question } from './types'

export const USED_QUESTIONS_KEY = 'atrapalabras:usedQuestions'

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface Options {
  store?: KeyValueStore | null
  random?: () => number
  otherUsed?: string[]
}

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null // some browsers throw when storage is blocked
  }
}

function readUsed(store: KeyValueStore | null): Set<string> {
  try {
    const data: unknown = JSON.parse(store?.getItem(USED_QUESTIONS_KEY) ?? '[]')
    return new Set(Array.isArray(data) ? data.filter((x) => typeof x === 'string') : [])
  } catch {
    return new Set() // no history: pick at random
  }
}

// Returns one wheel per player, one question per letter, never sharing a question.
// The bank must have at least 2 questions per letter (validateBank checks it).
export function pickWheels(
  bank: Record<string, Question[]>,
  letters: string[],
  { store = defaultStore(), random = Math.random, otherUsed = [] }: Options = {},
): [Question[], Question[]] {
  const used = readUsed(store) // this device's own history: the one that gets saved
  const avoid = new Set([...used, ...otherUsed])
  const wheels: [Question[], Question[]] = [[], []]

  for (const letter of letters) {
    const all = bank[letter] ?? []
    const picked = new Set<string>()
    for (const wheel of wheels) {
      let free = all.filter((q) => !avoid.has(q.id) && !picked.has(q.id))
      if (free.length === 0) {
        // This letter ran out: start a new cycle, counting the ones picked in this game.
        for (const q of all) { used.delete(q.id); avoid.delete(q.id) }
        for (const id of picked) { used.add(id); avoid.add(id) }
        free = all.filter((q) => !picked.has(q.id))
      }
      if (free.length === 0) throw new Error(`No hay suficientes preguntas para la letra ${letter}.`)
      const q = free[Math.floor(random() * free.length)]
      picked.add(q.id)
      used.add(q.id)
      avoid.add(q.id)
      wheel.push(q)
    }
  }

  saveUsed(store, used)
  return wheels
}

// Reads the history saved on this device (to send it to the other player).
export const savedUsedIds = (store = defaultStore()) => [...readUsed(store)]

// Adds to the history the questions of a game picked by another device.
export function recordUsed(ids: string[], store = defaultStore()): void {
  saveUsed(store, new Set([...readUsed(store), ...ids]))
}

function saveUsed(store: KeyValueStore | null, used: Set<string>): void {
  try {
    store?.setItem(USED_QUESTIONS_KEY, JSON.stringify([...used]))
  } catch {
    // If it cannot be saved, the next game may repeat questions. Not a big deal.
  }
}
