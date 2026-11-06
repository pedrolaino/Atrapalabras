import { useEffect, useReducer, useRef, useState } from 'react'
import { GameTable } from './components/GameTable'
import { QuestionBankError } from './components/QuestionBankError'
import { StartScreen } from './components/StartScreen'
import { config } from './config'
import { loadBank } from './data/loadQuestions'
import { loadGame, readJSON, saveGame, writeJSON } from './game/storage'
import { pickWheels } from './game/questionPicker'
import { reducer } from './game/reducer'
import type { Game } from './game/types'
import { shouldStartOnline } from './online/seat'
import { Online } from './online/Online'
import { currentTime } from './ui/hooks'

const { bank, errors } = loadBank()

const NAMES_KEY = 'atrapalabras:names'

// If the page was closed or reloaded with the clock running, the game resumes paused.
function initialGame(): Game | null {
  const g = loadGame()
  return g?.phase === 'playing' && !g.paused ? reducer(g, { type: 'PAUSE', now: currentTime() }) : g
}

function savedNames(): [string, string] {
  const d = readJSON(NAMES_KEY)
  return Array.isArray(d) && d.length === 2 && d.every((n) => typeof n === 'string') ? (d as [string, string]) : ['', '']
}

export default function App() {
  const [online, setOnline] = useState(shouldStartOnline)
  if (errors.length > 0) return <QuestionBankError errors={errors} />
  return online ? <Online bank={bank} onExit={() => setOnline(false)} /> : <LocalGame onOnline={() => setOnline(true)} />
}

// One device: the game lives in this browser.
function LocalGame({ onOnline }: { onOnline: () => void }) {
  const [game, dispatch] = useReducer(reducer, null, initialGame)
  const latest = useRef(game)

  useEffect(() => {
    latest.current = game
    saveGame(game)
  }, [game])

  // Switching tabs, locking the phone or closing the page pauses the game.
  useEffect(() => {
    const pause = () => {
      const g = latest.current
      if (g?.phase !== 'playing' || g.paused) return
      const action = { type: 'PAUSE', now: currentTime() } as const
      saveGame(reducer(g, action)) // right away, in case the page closes before re-rendering
      dispatch(action)
    }
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') pause() }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', pause)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', pause)
    }
  }, [])

  const start = (names: [string, string]) => {
    writeJSON(NAMES_KEY, names)
    dispatch({
      type: 'START',
      names,
      wheels: pickWheels(bank, config.letters),
      timeMs: config.secondsPerPlayer * 1000,
    })
  }

  if (!game) return <StartScreen initialNames={savedNames()} onPlay={start} onOnline={onOnline} />

  return (
    <GameTable
      game={game}
      dispatch={dispatch}
      onRematch={() => start([game.players[0].name, game.players[1].name])}
      onHome={() => dispatch({ type: 'RESET' })}
    />
  )
}
