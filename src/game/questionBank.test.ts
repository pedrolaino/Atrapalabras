import { describe, expect, it } from 'vitest'
import { validateBank } from './questionBank'

const question = (id: string, letter: string, answer: string, extra: object = {}) => ({
  id, letter, type: 'startsWith', clue: 'Una definición', answer, difficulty: 'easy', ...extra,
})

const file = (...questions: unknown[]) => JSON.stringify(questions)

const validBank = () => ({
  'a.json': file(question('a1', 'A', 'Árbol'), question('a2', 'A', 'Casa', { type: 'contains' })),
  'ñ.json': file(question('n1', 'Ñ', 'Ñandú'), question('n2', 'Ñ', 'Año', { type: 'contains', difficulty: 'hard' })),
})

describe('validateBank', () => {
  it('builds the bank by letter when everything is valid', () => {
    const r = validateBank(validBank(), ['A', 'Ñ'])
    expect(r.errors).toEqual([])
    expect(r.bank.A.map((q) => q.id)).toEqual(['a1', 'a2'])
    expect(r.bank['Ñ'].map((q) => q.id)).toEqual(['n1', 'n2'])
  })

  it('reports a missing letter file', () => {
    expect(validateBank(validBank(), ['A', 'Ñ', 'B']).errors).toEqual(['Falta el archivo b.json (letra B).'])
  })

  it('reports malformed JSON, naming the file', () => {
    const r = validateBank({ ...validBank(), 'a.json': '[{"id": "a1",' }, ['A', 'Ñ'])
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toMatch(/^a\.json: el JSON está mal formado/)
  })

  it('reports a file that is not a list', () => {
    expect(validateBank({ ...validBank(), 'a.json': '{}' }, ['A', 'Ñ']).errors)
      .toEqual(['a.json: tiene que ser una lista de preguntas entre corchetes [ ].'])
  })

  it('validates every field of every question', () => {
    const bad = { id: '', letter: 'B', type: 'other', clue: ' ', answer: 3, difficulty: 'impossible' }
    const r = validateBank({ ...validBank(), 'a.json': file(question('a1', 'A', 'Asa'), question('a2', 'A', 'Ala'), bad) }, ['A', 'Ñ'])
    expect(r.errors).toEqual([
      'a.json, pregunta 3: falta el "id".',
      'a.json, pregunta 3: el campo "letter" tiene que ser "A" (dice "B").',
      'a.json, pregunta 3: el campo "type" tiene que ser "startsWith" o "contains".',
      'a.json, pregunta 3: falta el campo "clue".',
      'a.json, pregunta 3: falta el campo "answer".',
      'a.json, pregunta 3: el campo "difficulty" tiene que ser "easy", "medium" o "hard".',
    ])
  })

  it('reports a question that is not an object', () => {
    const r = validateBank({ ...validBank(), 'a.json': file(question('a1', 'A', 'Asa'), question('a2', 'A', 'Ala'), 'hola') }, ['A', 'Ñ'])
    expect(r.errors).toEqual(['a.json, pregunta 3: tiene que ser un objeto entre llaves { }.'])
  })

  it('checks that the answer starts with or contains the letter, ignoring accents', () => {
    const r = validateBank({
      ...validBank(),
      'a.json': file(question('a1', 'A', 'Barco'), question('a2', 'A', 'Perro', { type: 'contains' }), question('a3', 'A', 'águila')),
    }, ['A', 'Ñ'])
    expect(r.errors).toEqual([
      'a.json, pregunta a1: la respuesta "Barco" no empieza con la A.',
      'a.json, pregunta a2: la respuesta "Perro" no contiene la A.',
    ])
  })

  it('does not mistake Ñ for N', () => {
    const r = validateBank({ ...validBank(), 'ñ.json': file(question('n1', 'Ñ', 'Nido'), question('n2', 'Ñ', 'Niño', { type: 'contains' })) }, ['A', 'Ñ'])
    expect(r.errors).toEqual(['ñ.json, pregunta n1: la respuesta "Nido" no empieza con la Ñ.'])
  })

  it('ids cannot repeat across files', () => {
    const r = validateBank({ ...validBank(), 'ñ.json': file(question('a1', 'Ñ', 'Ñu'), question('n2', 'Ñ', 'Ñoqui')) }, ['A', 'Ñ'])
    expect(r.errors).toEqual(['ñ.json, pregunta a1: el id "a1" está repetido.'])
  })

  it('each letter needs at least 2 questions so players never share one', () => {
    const r = validateBank({ ...validBank(), 'a.json': file(question('a1', 'A', 'Asa')) }, ['A', 'Ñ'])
    expect(r.errors).toEqual(['a.json: tiene que tener al menos 2 preguntas (una por jugador).'])
  })
})
