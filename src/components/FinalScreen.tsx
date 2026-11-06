import { Flag } from '@phosphor-icons/react'
import { useState } from 'react'
import { readFlagged, toggleFlagged } from '../game/storage'
import { result } from '../game/scoring'
import type { Game, Question, SlotStatus } from '../game/types'
import { LetterWheel } from './LetterWheel'
import { Scoreboard } from './Scoreboard'

const STATUS_LABEL: Record<SlotStatus, string> = { correct: '✓ Acierto', wrong: '✗ Error', pending: '– Sin responder' }

interface Props {
  game: Game
  onRematch: () => void
  onHome: () => void
}

export function FinalScreen({ game, onRematch, onHome }: Props) {
  const { winner, reason } = result(game)
  const [flagged, setFlagged] = useState(() => new Set(readFlagged().map((f) => f.id)))
  const toggle = (q: Question) => setFlagged(new Set(toggleFlagged(q).map((f) => f.id)))

  return (
    <main className="screen final">
      <header className="final__result" role="status">
        <h1>{winner === null ? '¡Empate!' : `¡Ganó ${game.players[winner].name}!`}</h1>
        {reason === 'lessTime' && <p>Mismos aciertos y errores: gana por usar menos tiempo.</p>}
        {reason === 'tie' && <p>Mismos aciertos, errores y tiempo.</p>}
      </header>

      <div className="final__players">
        {game.players.map((p, i) => (
          <section key={i} className={`player-summary${i === winner ? ' player-summary--winner' : ''}`} aria-label={p.name}>
            <h2>{p.name}{i === winner && <span className="badge">Ganador</span>}</h2>
            <LetterWheel slots={p.wheel} label={`Rosco de ${p.name}`} />
            <Scoreboard player={p} remainingMs={p.remainingMs} showPending />
          </section>
        ))}
      </div>

      <div className="row row--centered">
        <button type="button" className="button button--primary button--large" onClick={onRematch}>Revancha</button>
        <button type="button" className="button button--large" onClick={onHome}>Volver al inicio</button>
      </div>

      <div className="final__questions">
        {game.players.map((p, i) => (
          <details key={i} className="final__details" open>
            <summary>Preguntas de {p.name}</summary>
            <ol className="question-list">
              {p.wheel.map((s) => (
                <li key={s.letter} className={`question-list__item question-list__item--${s.status}`}>
                  <p>
                    <strong>{s.letter}</strong> · {s.question.type === 'startsWith' ? 'Empieza con' : 'Contiene'} · <span className="status">{STATUS_LABEL[s.status]}</span>
                  </p>
                  <p>{s.question.clue}</p>
                  <p>Respuesta: <strong>{s.question.answer}</strong></p>
                  <button
                    type="button"
                    className="text-button"
                    aria-pressed={flagged.has(s.question.id)}
                    onClick={() => toggle(s.question)}
                  >
                    <Flag size={16} weight={flagged.has(s.question.id) ? 'fill' : 'bold'} aria-hidden />
                    {flagged.has(s.question.id) ? 'Marcada como mala (tocá para desmarcar)' : 'Marcar como mala'}
                  </button>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </main>
  )
}
