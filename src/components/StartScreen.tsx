import { useState, type FormEvent } from 'react'
import { config } from '../config'
import { clearFlagged, readFlagged } from '../game/storage'

interface Props {
  initialNames: [string, string]
  onPlay: (names: [string, string]) => void
}

const MAX_NAME_LENGTH = 20

export function StartScreen({ initialNames, onPlay }: Props) {
  const [names, setNames] = useState(initialNames)
  const [error, setError] = useState('')
  const [flagged, setFlagged] = useState(readFlagged)

  const change = (i: 0 | 1, value: string) => {
    const next: [string, string] = [...names]
    next[i] = value
    setNames(next)
    setError('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = names.map((n) => n.trim()) as [string, string]
    if (trimmed.some((n) => n === '')) return setError('Escribí el nombre de los dos jugadores.')
    if (trimmed[0].toLowerCase() === trimmed[1].toLowerCase()) return setError('Los nombres tienen que ser distintos.')
    onPlay(trimmed)
  }

  const copyFlagged = () => {
    void navigator.clipboard?.writeText(JSON.stringify(flagged, null, 2)).catch(() => {})
  }

  return (
    <main className="screen screen--centered start">
      <header className="start__title">
        <h1>{config.name}</h1>
        {config.showSubtitle && <p className="subtitle">{config.subtitle}</p>}
      </header>

      <form className="card start__form" onSubmit={submit} noValidate>
        {([0, 1] as const).map((i) => (
          <label key={i} className="field">
            <span>Jugador {i + 1}</span>
            <input
              value={names[i]}
              onChange={(e) => change(i, e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              aria-invalid={error !== '' && names[i].trim() === ''}
              aria-describedby={error ? 'names-error' : undefined}
            />
          </label>
        ))}
        {error && <p id="names-error" className="error" role="alert">{error}</p>}
        <button type="submit" className="button button--primary button--large">Jugar</button>
      </form>

      {flagged.length > 0 && (
        <details className="flagged">
          <summary>Preguntas marcadas como malas ({flagged.length})</summary>
          <ul>
            {flagged.map((f) => (
              <li key={f.id}><strong>{f.id}</strong> ({f.letter}): {f.clue} → {f.answer}</li>
            ))}
          </ul>
          <div className="row">
            <button type="button" className="button button--small" onClick={copyFlagged}>Copiar lista</button>
            <button type="button" className="button button--small" onClick={() => { clearFlagged(); setFlagged([]) }}>Borrar lista</button>
          </div>
        </details>
      )}
    </main>
  )
}
