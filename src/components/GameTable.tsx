import { useEffect } from 'react'
import { remainingTime } from '../game/clock'
import type { Action, Game } from '../game/types'
import { currentTime, useNow, useShortcuts, useWakeLock } from '../ui/hooks'
import { BetweenTurnsScreen, HandOverScreen } from './BetweenTurnsScreen'
import { FinalScreen } from './FinalScreen'
import { GameScreen, type Tap } from './GameScreen'

interface Props {
  game: Game
  dispatch: (a: Action) => void
  onRematch: () => void
  onHome: () => void
}

// The game in progress: picks the screen for the current phase and runs the clock.
export function GameTable({ game, dispatch, onRematch, onHome }: Props) {
  const running = game.phase === 'playing' && !game.paused
  const now = useNow(running)
  const remainingMs = remainingTime(game, game.current, now)

  useWakeLock(game.phase !== 'finished')

  useEffect(() => {
    if (running && remainingMs <= 0) dispatch({ type: 'TIME_UP', now: currentTime() })
  }, [running, remainingMs, dispatch])

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
      onTap={tap}
      onPause={pause}
      onResume={resume}
      onUndo={undo}
      onQuit={quit}
    />
  )
}
