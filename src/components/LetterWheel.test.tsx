// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { config } from '../config'
import { testGame } from '../game/testUtils'
import { LetterWheel } from './LetterWheel'

it('shows each letter\'s status as text and with a mark, not only with color', () => {
  const g = testGame(config.letters)
  const slots = g.players[0].wheel.map((s, i) => ({ ...s, status: i === 0 ? 'correct' as const : i === 1 ? 'wrong' as const : s.status }))
  render(<LetterWheel slots={slots} label="Rosco de Juan" active={2} />)
  const letters = screen.getAllByRole('listitem')
  expect(letters).toHaveLength(25)
  expect(letters[0].getAttribute('aria-label')).toBe('A: acierto')
  expect(letters[0].textContent).toBe('A✓')
  expect(letters[1].textContent).toBe('B✗')
  expect(letters[2].getAttribute('aria-label')).toBe('C: pendiente, letra actual')
  expect(letters[2].getAttribute('aria-current')).toBe('step')
})
