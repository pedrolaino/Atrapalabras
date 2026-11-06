// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

afterEach(cleanup)

function Broken(): never {
  throw new Error('broken data')
}

it('if rendering breaks, offers to start over and deletes the saved game', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const replace = vi.fn()
  vi.stubGlobal('location', { ...location, replace })
  localStorage.setItem('atrapalabras:game', '{"version":2}')
  localStorage.setItem('atrapalabras:room', '{"roomCode":"ABCD","seat":0}')
  localStorage.setItem('atrapalabras:usedQuestions', '["a-001"]')

  render(<ErrorBoundary><Broken /></ErrorBoundary>)
  fireEvent.click(screen.getByRole('button', { name: 'Empezar de nuevo' }))

  expect(localStorage.getItem('atrapalabras:game')).toBeNull()
  expect(localStorage.getItem('atrapalabras:room')).toBeNull()
  expect(localStorage.getItem('atrapalabras:usedQuestions')).toBe('["a-001"]')
  expect(replace).toHaveBeenCalled()
  vi.unstubAllGlobals()
})
