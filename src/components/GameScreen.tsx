import { ArrowCounterClockwise, CaretDoubleRight, Check, Pause, Timer, X } from '@phosphor-icons/react'
import { useState, type CSSProperties } from 'react'
import { config } from '../config'
import { stats } from '../game/scoring'
import type { Game } from '../game/types'
import { formatTime } from '../ui/hooks'
import { LetterWheel } from './LetterWheel'

export type Tap = 'CORRECT' | 'WRONG' | 'PASS'

interface Props {
  game: Game
  remainingMs: number
  onTap: (t: Tap) => void
  onPause: () => void
  onResume: () => void
  onUndo: () => void
  onQuit: () => void
}

export function GameScreen({ game, remainingMs, onTap, onPause, onResume, onUndo, onQuit }: Props) {
  const player = game.players[game.current]
  const slot = player.wheel[player.index]
  const { question } = slot
  const warning = remainingMs <= config.warningSeconds * 1000

  return (
    // --time-left: fraction of time left (1 to 0), so the design can draw it
    <main className="screen game" style={{ '--time-left': remainingMs / (config.secondsPerPlayer * 1000) } as CSSProperties}>
      <header className="game__bar" inert={game.paused}>
        <p className="game__player">
          <span className="game__name">{player.name}</span>
          <span>Aciertos: <strong>{stats(player).correct}</strong></span>
        </p>
        <div className="game__controls">
          <button type="button" className="button button--small" onClick={onUndo} disabled={game.history.length === 0} aria-keyshortcuts="Z">
            <ArrowCounterClockwise size={18} weight="bold" aria-hidden /> Deshacer
          </button>
          <button type="button" className="button button--small" onClick={onPause} aria-keyshortcuts="Space">
            <Pause size={18} weight="bold" aria-hidden /> Pausa
          </button>
        </div>
      </header>

      <div className="game__body" inert={game.paused}>
        <LetterWheel slots={player.wheel} active={player.index} label={`Rosco de ${player.name}`}>
          <p className={`clock${warning ? ' clock--warning' : ''}`} aria-label={`Tiempo restante ${formatTime(remainingMs)}`}>
            {warning && <Timer className="clock__icon" weight="bold" aria-hidden />}{formatTime(remainingMs)}
          </p>
        </LetterWheel>

        <div className="game__panel">
          <section className="question card" aria-live="polite" aria-label="Pregunta">
            {game.paused ? (
              <p className="question__clue">Pregunta oculta durante la pausa.</p>
            ) : (
              <>
                <p className="question__prompt">
                  {question.type === 'startsWith' ? 'Empieza con la' : 'Contiene la'} <strong className="question__letter">{slot.letter}</strong>
                </p>
                <p className="question__clue">{question.clue}</p>
                <p className="question__answer">Respuesta: <strong>{question.answer}</strong></p>
              </>
            )}
          </section>

          <div className="answer-buttons">
            <button type="button" className="button button--large button--correct" onClick={() => onTap('CORRECT')}>
              <Check size={30} weight="bold" aria-hidden /> Correcto
            </button>
            <button type="button" className="button button--large button--wrong" onClick={() => onTap('WRONG')}>
              <X size={30} weight="bold" aria-hidden /> Incorrecto
            </button>
            <button type="button" className="button button--large button--pass" onClick={() => onTap('PASS')}>
              <CaretDoubleRight size={30} weight="bold" aria-hidden /> Pasa
            </button>
          </div>
        </div>
      </div>

      {game.paused && <PauseDialog onResume={onResume} onQuit={onQuit} />}
    </main>
  )
}

function PauseDialog({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="pause" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className="card pause__box">
        <h2 id="pause-title">Partida en pausa</h2>
        <button type="button" className="button button--primary button--large" onClick={onResume} autoFocus aria-keyshortcuts="Space">
          Continuar
        </button>
        {confirming ? (
          <div className="pause__confirm">
            <p>¿Seguro? Se pierde la partida.</p>
            <div className="row">
              <button type="button" className="button button--small button--danger" onClick={onQuit}>Sí, abandonar</button>
              <button type="button" className="button button--small" onClick={() => setConfirming(false)}>No</button>
            </div>
          </div>
        ) : (
          <button type="button" className="button button--small" onClick={() => setConfirming(true)}>Abandonar partida</button>
        )}
      </div>
    </div>
  )
}
