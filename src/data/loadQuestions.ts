import { config } from '../config'
import { validateBank } from '../game/questionBank'

// Vite bundles the text of every question file at build time. They are read as text
// (not as JSON) so a malformed file shows a clear error instead of breaking the build.
const files = import.meta.glob('./questions/*.json', { eager: true, query: '?raw', import: 'default' })

export function loadBank() {
  const byName: Record<string, string> = {}
  for (const [path, text] of Object.entries(files)) {
    // normalize: on macOS the name "ñ.json" may come in a different Unicode form
    byName[path.split('/').pop()!.normalize('NFC')] = text as string
  }
  return validateBank(byName, config.letters)
}
