import { useEffect, useRef, useState } from 'react'
import { config } from '../config'
import { remainingTime } from '../game/clock'
import { readJSON, writeJSON } from '../game/storage'
import type { Action, Game } from '../game/types'
import { currentTime, useNow, useShortcuts, useWakeLock } from '../ui/hooks'
import { play, setMuted, soundForChange } from '../ui/sounds'
import { BetweenTurnsScreen, HandOverScreen } from './BetweenTurnsScreen'
import { FinalScreen } from './FinalScreen'
import { GameScreen, type Tap } from './GameScreen'

const MUTED_KEY = 'atrapalabras:muted'

interface Props {
  game: Game
  dispatch: (a: Action) => void
  // Online only: the seat (0 or 1) of the player on this device.
  seat?: 0 | 1
  onRematch: () => void
  onHome: () => void
}

// The game in progress, the same on one device or online. Online, the answering player never sees the question.
export function GameTable({ game, dispatch, seat, onRematch, onHome }: Props) {
  const [muted, setMutedState] = useState(() => readJSON(MUTED_KEY) === true)
  const previous = useRef(game)
  const online = seat !== undefined
  const answering = online && game.current === seat

  const running = game.phase === 'playing' && !game.paused
  const now = useNow(running)
  const remainingMs = remainingTime(game, game.current, now)
  const seconds = Math.ceil(remainingMs / 1000)

  useWakeLock(game.phase !== 'finished')

  useEffect(() => {
    setMuted(muted)
    writeJSON(MUTED_KEY, muted)
  }, [muted])

  useEffect(() => {
    const sound = soundForChange(previous.current, game)
    previous.current = game
    if (sound) play(sound)
  }, [game])

  // Online both devices dispatch it; the reducer ignores the duplicate.
  useEffect(() => {
    if (running && remainingMs <= 0) dispatch({ type: 'TIME_UP', now: currentTime() })
  }, [running, remainingMs, dispatch])

  useEffect(() => {
    if (running && seconds > 0 && seconds <= config.warningSeconds) play('warning')
  }, [running, seconds])

  // The time is read when tapping, never when rendering.
  const tap = (t: Tap) => {
    if (!running || answering) return
    dispatch({ type: t, now: currentTime() })
  }
  const continueGame = () => { if (game.phase === 'betweenTurns') dispatch({ type: 'CONTINUE', now: currentTime() }) }
  const pause = () => dispatch({ type: 'PAUSE', now: currentTime() })
  const resume = () => dispatch({ type: 'RESUME', now: currentTime() })
  const undo = () => dispatch({ type: 'UNDO', now: currentTime() })
  const quit = () => dispatch({ type: 'RESET' })

  const shortcuts: Record<string, () => void> = {}
  if (game.phase === 'playing' && game.paused) {
    shortcuts[' '] = resume
  } else if (game.phase === 'playing') {
    // Answers only go through the buttons; the keyboard just pauses and undoes.
    Object.assign(shortcuts, { ' ': pause, escape: pause }, !answering && { z: undo })
  } else if (game.phase === 'betweenTurns') {
    Object.assign(shortcuts, { enter: continueGame, ' ': continueGame, z: undo })
  }
  useShortcuts(shortcuts)

  if (game.phase === 'finished') return <FinalScreen game={game} onRematch={onRematch} onHome={onHome} />

  if (game.phase === 'betweenTurns') {
    return game.turns === 0
      ? <HandOverScreen game={game} online={online} onContinue={continueGame} />
      : <BetweenTurnsScreen game={game} online={online} onContinue={continueGame} onUndo={undo} />
  }

  return (
    <GameScreen
      game={game}
      remainingMs={remainingMs}
      muted={muted}
      readBy={answering ? game.players[game.current === 0 ? 1 : 0].name : undefined}
      onTap={tap}
      onPause={pause}
      onResume={resume}
      onUndo={undo}
      onQuit={quit}
      onToggleMute={() => setMutedState(!muted)}
    />
  )
}
