import { Component, type ReactNode } from 'react'
import { saveGame } from '../game/storage'
import { ROOM_KEY } from '../online/seat'

// If something breaks rendering (for example, saved data that makes no sense), offer to start
// over instead of showing a blank page. Question history and flagged questions are kept.
export class ErrorBoundary extends Component<{ children: ReactNode }, { broken: boolean }> {
  state = { broken: false }

  static getDerivedStateFromError() {
    return { broken: true }
  }

  startOver = () => {
    saveGame(null)
    try { localStorage.removeItem(ROOM_KEY) } catch { /* no storage */ }
    location.replace(import.meta.env.BASE_URL)
  }

  render() {
    if (!this.state.broken) return this.props.children
    return (
      <main className="screen screen--centered">
        <div className="card error-panel" role="alert">
          <h1>Algo salió mal</h1>
          <p>La partida guardada no se pudo abrir.</p>
          <button type="button" className="button button--primary button--large" onClick={this.startOver}>
            Empezar de nuevo
          </button>
        </div>
      </main>
    )
  }
}
