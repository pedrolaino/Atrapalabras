import type { CSSProperties, ReactNode } from 'react'
import type { SlotStatus, WheelSlot } from '../game/types'

// Status never depends on color alone: each one has its own mark and border style.
const MARK: Record<SlotStatus, string> = { pending: '', correct: '✓', wrong: '✗' }
// Spoken by screen readers (the UI is in Spanish).
const STATUS_LABEL: Record<SlotStatus, string> = { pending: 'pendiente', correct: 'acierto', wrong: 'error' }

interface Props {
  slots: WheelSlot[]
  label: string
  active?: number
  children?: ReactNode
}

export function LetterWheel({ slots, label, active, children }: Props) {
  return (
    <div className="wheel">
      <ol className="wheel__tiles" aria-label={label}>
        {slots.map((s, i) => (
          <li
            key={s.letter}
            className={`tile tile--${s.status}${i === active ? ' tile--active' : ''}`}
            style={{ '--angle': `${(i / slots.length) * 360}deg` } as CSSProperties}
            aria-label={`${s.letter}: ${STATUS_LABEL[s.status]}${i === active ? ', letra actual' : ''}`}
            aria-current={i === active ? 'step' : undefined}
          >
            <span aria-hidden="true">{s.letter}</span>
            {MARK[s.status] && <span className="tile__mark" aria-hidden="true">{MARK[s.status]}</span>}
          </li>
        ))}
      </ol>
      {children && <div className="wheel__center">{children}</div>}
    </div>
  )
}
