import { ArrowLeft, LinkSimple, SignOut } from '@phosphor-icons/react'
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { GameTable } from '../components/GameTable'
import { MAX_NAME_LENGTH } from '../components/StartScreen'
import { config } from '../config'
import { readJSON, writeJSON } from '../game/storage'
import { pickWheels, recordUsed, savedUsedIds } from '../game/questionPicker'
import type { Action, Question } from '../game/types'
import { setClockOffset } from '../ui/hooks'
import { normalizeRoomCode } from './roomCode'
import { RoomError, type Connection, type Room } from './connection'
import { deleteExpiredRooms, rememberRoom, ROOM_KEY, roomCodeFromLink, savedSeat, type SavedSeat } from './seat'

const ONLINE_NAME_KEY = 'atrapalabras:onlineName'
const NO_CONNECTION = 'No se pudo conectar. Revisá tu internet y probá de nuevo.'

// Firebase is only downloaded when entering online mode, so local play does not pay for it.
let connection: Promise<Connection> | null = null
const connect = () => (connection ??= import('./firebase').then((m) => m.firebaseConnection()))

function withTimeout<T>(promise: Promise<T>, ms = 15_000): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}

interface Props {
  bank: Record<string, Question[]>
  onExit: () => void
  // For tests: Firebase by default.
  createConnection?: () => Promise<Connection>
}

export function Online({ bank, onExit, createConnection = connect }: Props) {
  const [seat, setSeat] = useState(() => {
    const saved = savedSeat()
    const link = roomCodeFromLink()
    return saved && (!link || link === saved.roomCode) ? saved : null
  })
  const [connection, setConnection] = useState<Connection | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    createConnection().then((c) => {
      setConnection(c)
      void deleteExpiredRooms(c, savedSeat()?.roomCode)
    }, () => setError(NO_CONNECTION))
  }, [createConnection])

  const clearLink = () => history.replaceState(null, '', location.pathname)
  const enter = (s: SavedSeat) => {
    writeJSON(ROOM_KEY, s)
    rememberRoom(s.roomCode)
    clearLink()
    setSeat(s)
  }
  const exit = () => {
    writeJSON(ROOM_KEY, null)
    clearLink()
    onExit()
  }

  if (!connection) return <Connecting error={error} onBack={exit} />
  if (!seat) return <LobbyScreen connection={connection} linkCode={roomCodeFromLink() ?? ''} onEnter={enter} onBack={exit} />
  return <InRoom key={seat.roomCode} connection={connection} bank={bank} {...seat} onExit={exit} />
}

function Connecting({ error, onBack }: { error?: string; onBack: () => void }) {
  return (
    <main className="screen screen--centered online">
      {error ? <p className="error" role="alert">{error}</p> : <p role="status">Conectando…</p>}
      <button type="button" className="button button--small" onClick={onBack}>
        <ArrowLeft size={18} weight="bold" aria-hidden /> Volver
      </button>
    </main>
  )
}

interface LobbyProps {
  connection: Connection
  linkCode: string
  onEnter: (s: SavedSeat) => void
  onBack: () => void
}

// Create a room or join someone else's with the code.
function LobbyScreen({ connection, linkCode, onEnter, onBack }: LobbyProps) {
  const [name, setName] = useState(() => String(readJSON(ONLINE_NAME_KEY) ?? ''))
  const [code, setCode] = useState(linkCode)
  const [error, setError] = useState('')
  const [waiting, setWaiting] = useState(false)

  const attempt = async (action: (name: string) => Promise<SavedSeat>) => {
    const trimmed = name.trim()
    if (!trimmed) return setError('Escribí tu nombre.')
    setError('')
    setWaiting(true)
    try {
      writeJSON(ONLINE_NAME_KEY, trimmed)
      onEnter(await withTimeout(action(trimmed)))
    } catch (e) {
      setError(e instanceof RoomError ? e.message : NO_CONNECTION)
      setWaiting(false)
    }
  }

  const create = () => attempt(async (n) => ({ roomCode: await connection.createRoom(n, savedUsedIds()), seat: 0 }))

  const join = () => {
    const c = normalizeRoomCode(code)
    if (!c) return setError('El código tiene 4 letras.')
    void attempt(async (n) => {
      await connection.join(c, n, savedUsedIds())
      return { roomCode: c, seat: 1 }
    })
  }

  // Enter: joins if a code was typed; otherwise creates the room.
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (code.trim()) join()
    else void create()
  }

  const createButton = (primary: boolean) => (
    <button type="button" className={`button button--large${primary ? ' button--primary' : ''}`} onClick={() => void create()} disabled={waiting}>
      Crear sala
    </button>
  )
  const joinWithCode = (primary: boolean) => (
    <>
      <label className="field">
        <span>Código de la sala</span>
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value); setError('') }}
          maxLength={6}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="field__code"
        />
      </label>
      <button type="submit" className={`button button--large${primary ? ' button--primary' : ''}`} disabled={waiting}>
        Entrar
      </button>
    </>
  )

  return (
    <main className="screen screen--centered online">
      <header>
        <h1>Jugar online</h1>
        <p className="note">Cada uno en su celular o compu.</p>
      </header>

      <form className="card start__form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Tu nombre</span>
          <input value={name} onChange={(e) => { setName(e.target.value); setError('') }} maxLength={MAX_NAME_LENGTH} autoComplete="off" />
        </label>
        {linkCode ? (
          <>
            {joinWithCode(true)}
            <p className="divider">o creá una sala nueva</p>
            {createButton(false)}
          </>
        ) : (
          <>
            {createButton(true)}
            <p className="divider">o entrá a la sala de un amigo</p>
            {joinWithCode(false)}
          </>
        )}
        {waiting && <p role="status">Conectando…</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </form>

      <button type="button" className="button button--small" onClick={onBack}>
        <ArrowLeft size={18} weight="bold" aria-hidden /> Volver
      </button>
    </main>
  )
}

interface InRoomProps extends SavedSeat {
  connection: Connection
  bank: Record<string, Question[]>
  onExit: () => void
}

export function InRoom({ connection, bank, roomCode, seat, onExit }: InRoomProps) {
  const [room, setRoom] = useState<Room | null | undefined>(undefined)
  const [error, setError] = useState('')
  const game = room?.game ?? null

  useEffect(() => connection.subscribe(roomCode, setRoom), [connection, roomCode])
  // Server time is only used inside the room: on leaving, local play goes back to the device clock.
  useEffect(() => {
    const stop = connection.subscribeClockOffset(setClockOffset)
    return () => { stop(); setClockOffset(0) }
  }, [connection])

  // When a game starts, each device records its questions so they are not repeated.
  useEffect(() => {
    if (game?.turns === 0) recordUsed(game.players.flatMap((p) => p.wheel.map((s) => s.question.id)))
  }, [game])

  const dispatch = useCallback((a: Action) => {
    setError('')
    connection.dispatch(roomCode, a).catch(() => setError('No se pudo guardar el último cambio. Revisá tu conexión.'))
  }, [connection, roomCode])

  if (room === undefined) return <Connecting onBack={onExit} />
  if (room === null) return <Connecting error="Esta sala ya no existe." onBack={onExit} />

  const [host, guest] = room.players
  const start = () => {
    if (!guest) return
    dispatch({
      type: 'START',
      names: [host, guest],
      // Whoever picks combines their history with the other player's, so neither repeats questions.
      wheels: pickWheels(bank, config.letters, { otherUsed: room.used[seat === 0 ? 1 : 0] }),
      timeMs: config.secondsPerPlayer * 1000,
    })
  }

  const warning = error && <p className="connection-warning error" role="alert">{error}</p>
  if (!game) return <RoomScreen roomCode={roomCode} room={room} seat={seat} warning={warning} onPlay={start} onExit={onExit} />
  return <>{warning}<GameTable game={game} dispatch={dispatch} seat={seat} onRematch={start} onHome={onExit} /></>
}

interface RoomScreenProps {
  roomCode: string
  room: Room
  seat: 0 | 1
  warning: ReactNode
  onPlay: () => void
  onExit: () => void
}

// Waiting room: the code to share and who is in.
function RoomScreen({ roomCode, room, seat, warning, onPlay, onExit }: RoomScreenProps) {
  const [copied, setCopied] = useState<boolean | null>(null)
  const link = new URL(`${import.meta.env.BASE_URL}?sala=${roomCode}`, location.origin).href
  const copy = () => {
    // If the browser does not allow copying, the link is shown to copy it by hand.
    if (!navigator.clipboard) return setCopied(false)
    navigator.clipboard.writeText(link).then(() => setCopied(true), () => setCopied(false))
  }
  const [host, guest] = room.players
  const you = (i: 0 | 1) => (i === seat ? ' (vos)' : '')

  return (
    <main className="screen screen--centered online">
      {warning}
      <header>
        <h1>Sala</h1>
        <p className="room-code" aria-label={`Código de la sala: ${[...roomCode].join(' ')}`}>
          {[...roomCode].map((l, i) => <span key={i} aria-hidden="true">{l}</span>)}
        </p>
      </header>

      <div className="room__share">
        <button type="button" className="button" onClick={copy}>
          <LinkSimple size={20} weight="bold" aria-hidden /> {copied ? 'Link copiado' : 'Copiar link'}
        </button>
        {copied === false && <p className="room__link">{link}</p>}
        <p className="note">Pegalo en el chat de Discord o decile el código a tu amigo.</p>
      </div>

      <ol className="card room__players" aria-label="Jugadores">
        <li>{host}{you(0)}</li>
        <li className={guest ? undefined : 'room__waiting'}>{guest ? `${guest}${you(1)}` : 'Esperando al otro jugador…'}</li>
      </ol>

      {seat === 0 ? (
        <button type="button" className="button button--primary button--large room__play" onClick={onPlay} disabled={!guest}>
          Jugar
        </button>
      ) : (
        <p role="status">Esperando que {host} toque Jugar.</p>
      )}

      <button type="button" className="button button--small" onClick={onExit}>
        <SignOut size={18} weight="bold" aria-hidden /> Salir de la sala
      </button>
    </main>
  )
}
