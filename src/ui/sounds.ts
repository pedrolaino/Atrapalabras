// Short sounds generated on the fly with Web Audio (no audio files) plus vibration.
// If the browser lacks support for something, it fails silently: the game goes on.
import type { Game, SlotStatus } from '../game/types'

export type Sound = 'correct' | 'wrong' | 'pass' | 'turn' | 'warning' | 'end'

// Each sound is a sequence of notes: [frequency in Hz, duration in seconds].
const NOTES: Record<Sound, { wave: OscillatorType; notes: [number, number][] }> = {
  correct: { wave: 'sine', notes: [[660, 0.08], [990, 0.14]] },
  wrong: { wave: 'square', notes: [[200, 0.12], [150, 0.22]] },
  pass: { wave: 'triangle', notes: [[587, 0.08], [440, 0.14]] },
  turn: { wave: 'sine', notes: [[440, 0.08], [554, 0.08], [659, 0.14]] },
  warning: { wave: 'square', notes: [[1046, 0.05]] },
  end: { wave: 'triangle', notes: [[523, 0.14], [659, 0.14], [784, 0.14], [1046, 0.35]] },
}

const VIBRATIONS: Partial<Record<Sound, number | number[]>> = {
  correct: 40,
  wrong: [120, 60, 120],
  pass: 60,
  end: [100, 50, 100, 50, 200],
}

let muted = false
let context: AudioContext | null = null

export const setMuted = (value: boolean) => { muted = value }

function getContext(): AudioContext | null {
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    context = new Ctor()
  }
  // Browsers start audio "suspended" until the user interacts with the page.
  if (context.state === 'suspended') void context.resume()
  return context
}

// On iPhone audio can only be unlocked inside a tap. Since in online mode sounds are also
// triggered by changes from the other device, it is unlocked on any tap or key press.
if (typeof window !== 'undefined') {
  for (const event of ['pointerdown', 'keydown']) window.addEventListener(event, () => { if (!muted) getContext() })
}

// Which sound goes with a change from one game state to the next (null if none). It is derived
// from the state change, not from the button tapped, so both online devices play the same sound.
export function soundForChange(before: Game | null, after: Game | null): Sound | null {
  if (!before || !after) return null
  if (after.phase === 'finished') return before.phase === 'finished' ? null : 'end'
  if (after.turns > before.turns) return 'turn'
  const last = (g: Game) => JSON.stringify(g.history.at(-1))
  // Every tap saves an undo snapshot: no new snapshot means nothing was tapped.
  if (after.history.length < before.history.length || last(after) === last(before)) return null
  const count = (g: Game, status: SlotStatus) => g.players[before.current].wheel.filter((s) => s.status === status).length
  if (count(after, 'correct') > count(before, 'correct')) return 'correct'
  if (count(after, 'wrong') > count(before, 'wrong')) return 'wrong'
  return 'pass'
}

export function play(sound: Sound): void {
  if (muted) return
  try {
    vibrate(sound)
    const ctx = getContext()
    if (!ctx) return
    const { wave, notes } = NOTES[sound]
    let t = ctx.currentTime
    for (const [frequency, duration] of notes) {
      const osc = ctx.createOscillator()
      const volume = ctx.createGain()
      osc.type = wave
      osc.frequency.value = frequency
      // Quick fade in and out so it does not "click".
      volume.gain.setValueAtTime(0.0001, t)
      volume.gain.exponentialRampToValueAtTime(0.25, t + 0.01)
      volume.gain.exponentialRampToValueAtTime(0.0001, t + duration)
      osc.connect(volume).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + duration + 0.02)
      t += duration
    }
  } catch {
    // No audio, no problem.
  }
}

function vibrate(sound: Sound): void {
  const pattern = VIBRATIONS[sound]
  try {
    if (pattern !== undefined) navigator.vibrate?.(pattern)
  } catch {
    // iPhone and most computers do not vibrate.
  }
}
