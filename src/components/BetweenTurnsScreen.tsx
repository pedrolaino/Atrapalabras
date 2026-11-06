import { ArrowCounterClockwise } from '@phosphor-icons/react'
import type { Game } from '../game/types'
import { LetterWheel } from './LetterWheel'
import { Scoreboard } from './Scoreboard'

interface Props {
  game: Game
  // Online each player has their own device: nothing to hand over.
  online?: boolean
  onContinue: () => void
  onUndo: () => void
}

// Message for the player who is up: the device is held by whoever read to the other player.
function TurnNotice({ game, online }: { game: Game; online?: boolean }) {
  const answerer = game.players[game.current]
  const reader = game.players[game.current === 0 ? 1 : 0]
  return (
    <div className="turn-notice" role="status">
      <h2>Turno de {answerer.name}</h2>
      {online ? <p>Te lee {reader.name}.</p> : game.handOver !== false && <p>Pasale el dispositivo a {reader.name} para que te lea.</p>}
      {reader.done && <p className="note">{reader.name} ya terminó: {answerer.name} sigue solo hasta terminar.</p>}
    </div>
  )
}

function ContinueButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="button button--primary button--large" onClick={onClick} autoFocus>
      Continuar
    </button>
  )
}

// Before the first turn: just the notice, no wheels.
export function HandOverScreen({ game, online, onContinue }: Omit<Props, 'onUndo'>) {
  return (
    <main className="screen screen--centered">
      <TurnNotice game={game} online={online} />
      <ContinueButton onClick={onContinue} />
    </main>
  )
}

// Between turns: both wheels with only each letter's status (never questions or answers).
export function BetweenTurnsScreen({ game, online, onContinue, onUndo }: Props) {
  return (
    <main className="screen between-turns">
      <TurnNotice game={game} online={online} />
      <div className="between-turns__wheels">
        {game.players.map((p, i) => {
          // The player who is up sees the letter they continue with, so they can get ready.
          const isNext = i === game.current
          return (
            <section key={i} className={`player-summary${isNext ? ' player-summary--next' : ''}`} aria-label={p.name}>
              <h3>{p.name}{p.done && <span className="badge">Terminó</span>}</h3>
              <LetterWheel slots={p.wheel} label={`Rosco de ${p.name}`} active={isNext ? p.index : undefined}>
                {isNext && (
                  <p className="next-letter">
                    Sigue con la <span className="next-letter__tile">{p.wheel[p.index].letter}</span>
                  </p>
                )}
              </LetterWheel>
              <Scoreboard player={p} remainingMs={p.remainingMs} />
            </section>
          )
        })}
      </div>
      <div className="between-turns__actions">
        <ContinueButton onClick={onContinue} />
        {game.history.length > 0 && (
          <button type="button" className="button button--small" onClick={onUndo}>
            <ArrowCounterClockwise size={18} weight="bold" aria-hidden /> Deshacer último toque
          </button>
        )}
      </div>
    </main>
  )
}
