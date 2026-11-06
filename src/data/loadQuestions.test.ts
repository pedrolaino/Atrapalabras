import { expect, it } from 'vitest'
import { config } from '../config'
import { loadBank } from './loadQuestions'

it('the game\'s question bank has no errors', () => {
  const { bank, errors } = loadBank()
  expect(errors).toEqual([])
  expect(Object.keys(bank)).toEqual(config.letters)
})
