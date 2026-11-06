// Online room stored in Firebase Realtime Database, at rooms/<code>:
//   createdAt and expiresAt (timestamps), uid0, name0, used0, uid1, name1, used1 and game.
// The game and the used-question lists are stored as JSON text: Firebase drops nulls and
// empty lists, and this way they come back exactly as they were sent.
import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence, connectAuthEmulator, indexedDBLocalPersistence, initializeAuth, onAuthStateChanged, signInAnonymously, signOut,
} from 'firebase/auth'
import { connectDatabaseEmulator, get, getDatabase, onValue, ref, remove, runTransaction, type Database } from 'firebase/database'
import { reducer } from '../game/reducer'
import type { Game } from '../game/types'
import { newRoomCode } from './roomCode'
import { checkJoin, EXPIRY, expiresAt, type Connection, type Expiry, type Room } from './connection'
import { firebaseConfig } from './firebaseConfig'

interface StoredRoom {
  createdAt: number
  expiresAt?: number
  // Anonymous identity of each device: the rules only let these two write.
  uid0: string
  uid1?: string
  name0: string
  used0: string
  name1?: string
  used1?: string
  game?: string
}

function parseJSON<T>(text: string | undefined, fallback: T): T {
  try {
    return text ? JSON.parse(text) : fallback
  } catch {
    return fallback
  }
}

export function toRoom(s: StoredRoom | null): Room | null {
  if (!s) return null
  return {
    players: [s.name0, s.name1 ?? null],
    used: [parseJSON<string[]>(s.used0, []), parseJSON<string[]>(s.used1, [])],
    game: parseJSON<Game | null>(s.game, null),
  }
}

// `emulator` ("localhost:9000") is for tests; `appName` lets tests simulate several devices.
export function firebaseConnection(
  emulator: string | undefined = import.meta.env.VITE_FIREBASE_EMULATOR,
  appName?: string,
  e: Expiry = EXPIRY,
): Connection {
  const app = initializeApp(firebaseConfig, appName)
  const db: Database = getDatabase(app)
  // No login screen: each device signs in with an anonymous identity, which is kept in the
  // browser and lets it return to the same seat after a reload.
  const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] })
  if (emulator) {
    const [host, port] = emulator.split(':')
    connectDatabaseEmulator(db, host, Number(port))
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  }
  // Firebase deletes anonymous identities older than 30 days: if the saved one is gone, get a new one.
  let identity: Promise<string> | null = null
  async function signIn() {
    await auth.authStateReady()
    const saved = auth.currentUser
    if (saved) {
      try {
        await saved.getIdToken()
        return saved.uid
      } catch {
        await signOut(auth)
      }
    }
    return (await signInAnonymously(auth)).user.uid
  }
  const me = () => (identity ??= signIn().catch((err) => { identity = null; throw err }))
  onAuthStateChanged(auth, (user) => { if (!user) identity = null })
  const room = (code: string) => ref(db, `rooms/${code}`)
  const offset = ref(db, '.info/serverTimeOffset')
  let offsetMs = 0
  onValue(offset, (s) => { offsetMs = Number(s.val()) || 0 })
  const now = () => Date.now() + offsetMs

  return {
    async createRoom(name, used) {
      const uid = await me()
      for (;;) {
        const code = newRoomCode()
        // The transaction only writes if the code is free.
        const r = await runTransaction(room(code), (current: StoredRoom | null) =>
          current === null ? { createdAt: now(), expiresAt: expiresAt(null, now(), e), uid0: uid, name0: name, used0: JSON.stringify(used) } : undefined,
        )
        if (r.committed) return code
      }
    },

    async join(code, name, used) {
      const uid = await me()
      let error: unknown = null
      // With a transaction, if two people join at once only one gets in.
      const r = await runTransaction(room(code), (current: StoredRoom | null) => {
        error = null
        // If it is not cached yet, Firebase first calls with null and then retries with the real value.
        if (current === null) return null
        if (current.uid1 === uid) return undefined // already in
        try {
          checkJoin(toRoom(current), name)
        } catch (err) {
          error = err
          return undefined
        }
        return { ...current, expiresAt: expiresAt(null, now(), e), uid1: uid, name1: name, used1: JSON.stringify(used) }
      })
      if (error) throw error
      // If the room did not exist, the transaction "wrote" null over null.
      if (!r.snapshot.exists()) checkJoin(null, name)
    },

    subscribe(code, onChange) {
      let stop: (() => void) | null = null
      let cancelled = false
      me().then(() => {
        if (!cancelled) stop = onValue(room(code), (s) => onChange(toRoom(s.val())), () => onChange(null))
      }, () => onChange(null))
      return () => { cancelled = true; stop?.() }
    },

    async dispatch(code, action) {
      await me()
      await runTransaction(room(code), (current: StoredRoom | null) => {
        // If it is not cached yet, Firebase first calls with null: returning null makes it retry
        // with the real value. If the room really does not exist, nothing is written.
        if (current === null) return null
        const before = toRoom(current)?.game ?? null
        const after = reducer(before, action)
        if (after === before) return undefined
        const next: StoredRoom = { ...current, expiresAt: expiresAt(after, now(), e) }
        if (after) next.game = JSON.stringify(after)
        else delete next.game
        return next
      })
    },

    async deleteIfExpired(code) {
      await me()
      const s = await get(room(code))
      const expires = (s.val() as StoredRoom | null)?.expiresAt
      // Margin in case the server clock runs slightly behind: the rules check it again.
      if (s.exists() && typeof expires === 'number' && expires > now() - 30_000) return false
      if (s.exists()) await remove(s.ref)
      return true
    },

    subscribeClockOffset(onChange) {
      return onValue(offset, (s) => onChange(Number(s.val()) || 0))
    },
  }
}
