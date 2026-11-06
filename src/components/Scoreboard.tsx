import { stats } from '../game/scoring'
import type { Player } from '../game/types'
import { formatTime } from '../ui/hooks'

interface Props {
  player: Player
  remainingMs: number
  showPending?: boolean
}

export function Scoreboard({ player, remainingMs, showPending }: Props) {
  const { correct, wrong, pending } = stats(player)
  return (
    <dl className="scoreboard">
      <div><dt>Aciertos</dt><dd>{correct}</dd></div>
      <div><dt>Errores</dt><dd>{wrong}</dd></div>
      {showPending && <div><dt>Sin responder</dt><dd>{pending}</dd></div>}
      <div><dt>Tiempo</dt><dd>{formatTime(remainingMs)}</dd></div>
    </dl>
  )
}
