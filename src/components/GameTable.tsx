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
  onRematch: () => void
  onHome: () => void
}

// The game in progress: picks the screen for the current phase, runs the clock and plays the sounds.
export function GameTable({ game, dispatch, onRematch, onHome }: Props) {
  const [muted, setMutedState] = useState(() => readJSON(MUTED_KEY) === true)
  const previous = useRef(game)

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

  useEffect(() => {
    if (running && remainingMs <= 0) dispatch({ type: 'TIME_UP', now: currentTime() })
  }, [running, remainingMs, dispatch])

  useEffect(() => {
    if (running && seconds > 0 && seconds <= config.warningSeconds) play('warning')
  }, [running, seconds])

  // The time is read when tapping, never when rendering.
  const tap = (t: Tap) => {
    if (!running) return
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
    Object.assign(shortcuts, { ' ': pause, escape: pause, z: undo })
  } else if (game.phase === 'betweenTurns') {
    Object.assign(shortcuts, { enter: continueGame, ' ': continueGame, z: undo })
  }
  useShortcuts(shortcuts)

  if (game.phase === 'finished') return <FinalScreen game={game} onRematch={onRematch} onHome={onHome} />

  if (game.phase === 'betweenTurns') {
    return game.turns === 0
      ? <HandOverScreen game={game} onContinue={continueGame} />
      : <BetweenTurnsScreen game={game} onContinue={continueGame} onUndo={undo} />
  }

  return (
    <GameScreen
      game={game}
      remainingMs={remainingMs}
      muted={muted}
      onTap={tap}
      onPause={pause}
      onResume={resume}
      onUndo={undo}
      onQuit={quit}
      onToggleMute={() => setMutedState(!muted)}
    />
  )
}
