// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { loadBank } from '../data/loadQuestions'
import { memoryConnection, type Connection } from './connection'
import { currentTime } from '../ui/hooks'
import { InRoom, Online } from './Online'

const { bank } = loadBank()
let network: Connection
const createConnection = () => Promise.resolve(network)

// Test taps are instantaneous: simulate one second between taps.
let clock = 0
beforeEach(() => { vi.spyOn(performance, 'now').mockImplementation(() => (clock += 1000)) })
afterEach(() => { vi.restoreAllMocks() })

beforeEach(() => {
  localStorage.clear()
  network = memoryConnection()
})
afterEach(cleanup)

it('creates the room, waits for the other player and starts the game', async () => {
  render(<Online bank={bank} onExit={() => {}} createConnection={createConnection} />)
  fireEvent.change(await screen.findByLabelText('Tu nombre'), { target: { value: 'Pedro' } })
  fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }))
  await screen.findByRole('button', { name: 'Jugar' })
  const code = screen.getByLabelText(/Código de la sala:/).textContent!
  expect(code).toMatch(/^[A-Z]{4}$/)
  expect(screen.getByRole('button', { name: 'Jugar' })).toHaveProperty('disabled', true)
  expect(JSON.parse(localStorage.getItem('atrapalabras:room')!)).toEqual({ roomCode: code, seat: 0 })

  await act(() => network.join(code, 'Juan', []))
  expect(screen.getByText('Juan')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Jugar' }))
  expect(screen.getByText('Turno de Pedro')).toBeTruthy()
  expect(screen.getByText('Te lee Juan.')).toBeTruthy()
})

it('joins with the code and reports a room that does not exist', async () => {
  const code = await network.createRoom('Pedro', [])
  render(<Online bank={bank} onExit={() => {}} createConnection={createConnection} />)
  fireEvent.change(await screen.findByLabelText('Tu nombre'), { target: { value: 'Juan' } })
  fireEvent.change(screen.getByLabelText('Código de la sala'), { target: { value: 'ZZZZ' === code ? 'YYYY' : 'zzzz' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/No existe/)
  fireEvent.change(screen.getByLabelText('Código de la sala'), { target: { value: code.toLowerCase() } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  expect(await screen.findByText('Esperando que Pedro toque Jugar.')).toBeTruthy()
})

it('the answering player never sees the question; either player can pause and continue', async () => {
  const code = await network.createRoom('Pedro', [])
  await network.join(code, 'Juan', [])
  const pedro = within(render(<InRoom connection={network} bank={bank} roomCode={code} seat={0} onExit={() => {}} />).container)
  const juan = within(render(<InRoom connection={network} bank={bank} roomCode={code} seat={1} onExit={() => {}} />).container)

  fireEvent.click(pedro.getByRole('button', { name: 'Jugar' }))
  fireEvent.click(juan.getByRole('button', { name: 'Continuar' }))
  // Pedro answers: he sees his wheel and who reads to him; Juan sees the question and the buttons.
  expect(pedro.getByText('Te está leyendo Juan')).toBeTruthy()
  expect(pedro.queryByText('Respuesta:')).toBeNull()
  expect(pedro.queryByRole('button', { name: /Correcto/ })).toBeNull()
  expect(juan.getByText('Respuesta:')).toBeTruthy()

  fireEvent.click(juan.getByRole('button', { name: /Correcto/ }))
  expect(pedro.getByRole('listitem', { name: 'A: acierto' })).toBeTruthy()

  fireEvent.click(pedro.getByRole('button', { name: /Pausa/ }))
  expect(juan.getByRole('dialog', { name: 'Partida en pausa' })).toBeTruthy()
  fireEvent.click(juan.getByRole('button', { name: 'Continuar' }))
  expect(pedro.queryByRole('dialog')).toBeNull()

  // Pass: the roles switch
  fireEvent.click(juan.getByRole('button', { name: /Pasa/ }))
  expect(pedro.getByText('Te lee Pedro.')).toBeTruthy()
  fireEvent.click(pedro.getByRole('button', { name: 'Continuar' }))
  expect(juan.getByText('Te está leyendo Pedro')).toBeTruthy()
  expect(pedro.getByText('Respuesta:')).toBeTruthy()
})

it('after a reload it goes back to the same room and seat', async () => {
  const code = await network.createRoom('Pedro', [])
  await network.join(code, 'Juan', [])
  localStorage.setItem('atrapalabras:room', JSON.stringify({ roomCode: code, seat: 1 }))
  render(<Online bank={bank} onExit={() => {}} createConnection={createConnection} />)
  expect(await screen.findByText('Juan (vos)')).toBeTruthy()
})

it('entering online mode deletes the expired rooms this device was in', async () => {
  network = memoryConnection({ activeMs: -1, finishedMs: -1 })
  const old = await network.createRoom('Pedro', [])
  localStorage.setItem('atrapalabras:myRooms', JSON.stringify([old]))
  render(<Online bank={bank} onExit={() => {}} createConnection={createConnection} />)
  fireEvent.change(await screen.findByLabelText('Tu nombre'), { target: { value: 'Pedro' } })
  fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }))
  await screen.findByRole('button', { name: 'Jugar' })
  const fresh = screen.getByLabelText(/Código de la sala:/).textContent!
  let room: unknown = 'not read'
  network.subscribe(old, (r) => { room = r })()
  expect(room).toBeNull()
  // The new one is remembered and the old one is not
  expect(JSON.parse(localStorage.getItem('atrapalabras:myRooms')!)).toEqual([fresh])
})

it('the server time correction is only used while in the room', async () => {
  const code = await network.createRoom('Pedro', [])
  const withOffset: Connection = { ...network, subscribeClockOffset: (onChange) => { onChange(60_000); return () => {} } }
  const { unmount } = render(<InRoom connection={withOffset} bank={bank} roomCode={code} seat={0} onExit={() => {}} />)
  expect(currentTime() - Date.now()).toBeGreaterThan(59_000)
  unmount()
  expect(Math.abs(currentTime() - Date.now())).toBeLessThan(1000)
})
