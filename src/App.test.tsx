// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'

// Test taps are instantaneous: simulate one second between taps.
let clock = 0
beforeEach(() => { vi.spyOn(performance, 'now').mockImplementation(() => (clock += 1000)) })
afterEach(() => { vi.restoreAllMocks() })

beforeEach(() => localStorage.clear())
afterEach(cleanup)

function start() {
  render(<App />)
  fireEvent.change(screen.getByLabelText('Jugador 1'), { target: { value: 'Juan' } })
  fireEvent.change(screen.getByLabelText('Jugador 2'), { target: { value: 'Pedro' } })
  fireEvent.click(screen.getByRole('button', { name: 'Jugar' }))
}

it('asks for two different, non-empty names', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Jugar' }))
  expect(screen.getByRole('alert').textContent).toMatch(/nombre de los dos/)
  fireEvent.change(screen.getByLabelText('Jugador 1'), { target: { value: 'Ana' } })
  fireEvent.change(screen.getByLabelText('Jugador 2'), { target: { value: ' ana ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Jugar' }))
  expect(screen.getByRole('alert').textContent).toMatch(/distintos/)
})

it('plays a turn: correct, wrong and handing the device over', () => {
  start()
  expect(screen.getByText('Turno de Juan')).toBeTruthy()
  expect(screen.getByText('Pasale el dispositivo a Pedro para que te lea.')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
  expect(screen.getByText('Respuesta:')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Correcto/ }))
  expect(screen.getByRole('listitem', { name: 'A: acierto' })).toBeTruthy()
  expect(screen.getByRole('listitem', { name: 'B: pendiente, letra actual' })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: /Incorrecto/ }))
  expect(screen.getByText('Turno de Pedro')).toBeTruthy()
  // Between turns the statuses are shown, but never the questions.
  expect(screen.queryByText('Respuesta:')).toBeNull()
  expect(screen.getAllByRole('listitem', { name: 'B: error' })).toHaveLength(1)

  fireEvent.click(screen.getByRole('button', { name: /Deshacer/ }))
  expect(screen.getByRole('listitem', { name: 'B: pendiente, letra actual' })).toBeTruthy()
})

it('the keyboard pauses, continues and undoes, but never answers', () => {
  start()
  fireEvent.keyDown(window, { key: 'Enter' })
  fireEvent.keyDown(window, { key: 'c' })
  expect(screen.getByRole('listitem', { name: 'A: pendiente, letra actual' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Correcto/ }))
  expect(screen.getByRole('listitem', { name: 'A: acierto' })).toBeTruthy()
  fireEvent.keyDown(window, { key: 'z' })
  expect(screen.getByRole('listitem', { name: 'A: pendiente, letra actual' })).toBeTruthy()
  fireEvent.keyDown(window, { key: ' ' })
  expect(screen.getByRole('dialog', { name: 'Partida en pausa' })).toBeTruthy()
  fireEvent.keyDown(window, { key: ' ' })
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Pasa/ }))
  expect(screen.getByText('Turno de Pedro')).toBeTruthy()
})

it('after a reload, the game resumes where it was, paused', () => {
  start()
  fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
  fireEvent.click(screen.getByRole('button', { name: /Correcto/ }))
  cleanup()
  render(<App />)
  expect(screen.getByRole('dialog', { name: 'Partida en pausa' })).toBeTruthy()
  expect(screen.getByRole('listitem', { name: 'A: acierto' })).toBeTruthy()
})

it('a double tap on Correcto does not also score the next letter', () => {
  start()
  fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
  // The clock stands still: the second tap arrives "at the same time" B appears.
  vi.mocked(performance.now).mockReturnValue(1e12)
  fireEvent.click(screen.getByRole('button', { name: /Correcto/ }))
  fireEvent.click(screen.getByRole('button', { name: /Correcto/ }))
  expect(screen.getByRole('listitem', { name: 'B: pendiente, letra actual' })).toBeTruthy()
})

it('between turns shows the letter the next player continues with', () => {
  start()
  fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
  fireEvent.click(screen.getByRole('button', { name: /Correcto/ }))
  fireEvent.click(screen.getByRole('button', { name: /Incorrecto/ }))
  expect(screen.getByText(/Sigue con la/).textContent).toBe('Sigue con la A')
  expect(within(screen.getByRole('region', { name: 'Pedro' })).getByRole('listitem', { name: 'A: pendiente, letra actual' })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
  fireEvent.click(screen.getByRole('button', { name: /Pasa/ }))
  expect(screen.getByText(/Sigue con la/).textContent).toBe('Sigue con la C')
  // Only marked on the next player's wheel
  expect(within(screen.getByRole('region', { name: 'Pedro' })).queryByRole('listitem', { name: /letra actual/ })).toBeNull()
})
