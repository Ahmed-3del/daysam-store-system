import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((l) => l()) })
}

/** Android/desktop Chrome "Add to Home Screen" prompt. iOS users install via Share → Add to Home Screen. */
export function useInstallPrompt() {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((x) => x + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  return {
    canInstall: !!deferred,
    prompt: async () => {
      if (!deferred) return false
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      deferred = null
      listeners.forEach((l) => l())
      return outcome === 'accepted'
    },
  }
}
