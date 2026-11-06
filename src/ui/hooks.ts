import { useEffect, useRef, useState } from 'react'

export const currentTime = () => Date.now()

// Current time, refreshed several times per second while `active` is true.
// It may lag a few milliseconds right after starting; remainingTime tolerates it.
export function useNow(active: boolean, everyMs = 200): number {
  const [now, setNow] = useState(currentTime)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(currentTime()), everyMs)
    return () => clearInterval(id)
  }, [active, everyMs])
  return now
}

// Keeps the screen on while `active` is true (if the browser allows it).
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let ended = false
    const request = async () => {
      try {
        const next = await navigator.wakeLock.request('screen')
        if (ended) void next.release()
        else lock = next
      } catch {
        // It can fail on low battery or if the tab is not visible; not a big deal.
      }
    }
    // The browser releases the lock when the tab is hidden: request it again on return.
    const onVisible = () => { if (document.visibilityState === 'visible') void request() }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      ended = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => {})
    }
  }, [active])
}

// Keyboard shortcuts: { key: action }. Keys in lowercase; ' ' is the space bar.
export function useShortcuts(shortcuts: Record<string, () => void>): void {
  const ref = useRef(shortcuts)
  useEffect(() => { ref.current = shortcuts })
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return
      const action = ref.current[e.key.toLowerCase()]
      if (!action) return
      e.preventDefault() // so the space bar does not also "press" the focused button
      action()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

export function formatTime(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
