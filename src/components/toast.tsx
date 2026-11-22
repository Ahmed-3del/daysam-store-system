import { CheckCircle2, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { errorMessage } from '../lib/api'

type Toast = { id: number; text: string; kind: 'ok' | 'error' }
interface ToastApi { ok: (t: string) => void; error: (e: unknown) => void }

const Ctx = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string, kind: Toast['kind']) => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, text, kind }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 5000 : 2500)
  }, [])
  const api: ToastApi = {
    ok: useCallback((t: string) => push(t, 'ok'), [push]),
    error: useCallback((e: unknown) => push(typeof e === 'string' ? e : errorMessage(e), 'error'), [push]),
  }
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} role="status"
            className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-lg ${t.kind === 'ok' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            {t.kind === 'ok' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useToast outside provider')
  return c
}
