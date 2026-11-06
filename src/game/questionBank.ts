import type { Question } from './types'

export type QuestionBank = Record<string, Question[]>

const TYPES = ['startsWith', 'contains']
const DIFFICULTIES = ['easy', 'medium', 'hard']

// Uppercase and without accents, but Ñ stays Ñ.
function normalize(text: string): string {
  return text
    .trim()
    .toUpperCase()
    .normalize('NFC')
    .split('Ñ')
    .map((part) => part.normalize('NFD').replace(/\p{Diacritic}/gu, ''))
    .join('Ñ')
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

// Takes the text of each file (name -> content) and returns the bank by letter, or the list of
// errors. Errors are shown in the app (in Spanish), written so anyone can fix the file.
export function validateBank(files: Record<string, string>, letters: string[]): { bank: QuestionBank; errors: string[] } {
  const bank: QuestionBank = {}
  const errors: string[] = []
  const seenIds = new Set<string>()

  for (const letter of letters) {
    const file = `${letter.toLowerCase()}.json`
    const text = files[file]
    if (text === undefined) {
      errors.push(`Falta el archivo ${file} (letra ${letter}).`)
      continue
    }
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch (e) {
      errors.push(`${file}: el JSON está mal formado (${(e as Error).message}).`)
      continue
    }
    if (!Array.isArray(data)) {
      errors.push(`${file}: tiene que ser una lista de preguntas entre corchetes [ ].`)
      continue
    }
    if (data.length < 2) errors.push(`${file}: tiene que tener al menos 2 preguntas (una por jugador).`)

    bank[letter] = []
    data.forEach((q: unknown, i) => {
      const inQuestion = (id: unknown) => `${file}, pregunta ${isText(id) ? id : i + 1}`
      if (typeof q !== 'object' || q === null || Array.isArray(q)) {
        errors.push(`${inQuestion(null)}: tiene que ser un objeto entre llaves { }.`)
        return
      }
      const { id, letter: qLetter, type, clue, answer, difficulty } = q as Record<string, unknown>
      const where = inQuestion(id)
      const before = errors.length
      if (!isText(id)) errors.push(`${where}: falta el "id".`)
      else if (seenIds.has(id)) errors.push(`${where}: el id "${id}" está repetido.`)
      if (qLetter !== letter) errors.push(`${where}: el campo "letter" tiene que ser "${letter}" (dice "${String(qLetter)}").`)
      if (!TYPES.includes(type as string)) errors.push(`${where}: el campo "type" tiene que ser "startsWith" o "contains".`)
      if (!isText(clue)) errors.push(`${where}: falta el campo "clue".`)
      if (!isText(answer)) errors.push(`${where}: falta el campo "answer".`)
      else if (type === 'startsWith' && !normalize(answer).startsWith(letter)) {
        errors.push(`${where}: la respuesta "${answer}" no empieza con la ${letter}.`)
      } else if (type === 'contains' && !normalize(answer).includes(letter)) {
        errors.push(`${where}: la respuesta "${answer}" no contiene la ${letter}.`)
      }
      if (!DIFFICULTIES.includes(difficulty as string)) errors.push(`${where}: el campo "difficulty" tiene que ser "easy", "medium" o "hard".`)
      if (isText(id)) seenIds.add(id)
      if (errors.length === before) bank[letter].push(q as unknown as Question)
    })
  }
  return { bank, errors }
}
