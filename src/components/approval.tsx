import { ShieldCheck } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { AxiosError, AxiosResponse } from 'axios'
import { errorMessage } from '../lib/api'
import { useToast } from './toast'
import { Field, Modal } from './ui'

/** Returned by `run` when the action was queued for a manager instead of executed. */
export const QUEUED = Symbol('approval-queued')
export type Extra = { manager_pin?: string; request_approval?: boolean }
type Call<T> = (extra: Extra) => Promise<AxiosResponse<T>>

interface Pending { reason: string; resolve: (v: Extra | null) => void }
const Ctx = createContext<{ run: <T>(call: Call<T>) => Promise<T | typeof QUEUED> } | null>(null)

/**
 * Wraps API calls that may need a manager (server answers 403 code=approval_required).
 * The cashier can type a manager PIN for instant approval, or send the request to the approvals queue.
 */
export function ApprovalProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [pending, setPending] = useState<Pending | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')

  const ask = (reason: string, error = '') =>
    new Promise<Extra | null>((resolve) => { setPin(''); setPinError(error); setPending({ reason, resolve }) })

  const run = useCallback(async <T,>(call: Call<T>): Promise<T | typeof QUEUED> => {
    let extra: Extra = {}
    let reason = ''
    for (;;) {
      try {
        const res = await call(extra)
        const data = res.data as unknown as { approval_pending?: boolean }
        setPending(null)
        if (res.status === 202 && data?.approval_pending) {
          toast.ok('تم إرسال الطلب للمدير — سيتم التنفيذ بعد الموافقة')
          return QUEUED
        }
        return res.data
      } catch (e) {
        const err = e as AxiosError<{ code?: string; detail?: string; manager_pin?: string[] }>
        const body = err.response?.data
        if (err.response?.status === 403 && body?.code === 'approval_required') {
          reason = body.detail || 'هذه العملية تحتاج موافقة المدير'
          const choice = await ask(reason)
          if (!choice) throw new Error('cancelled')
          extra = choice
          continue
        }
        if (extra.manager_pin && body?.manager_pin) {
          // Wrong PIN: keep the dialog open and let the user retry.
          const choice = await ask(reason, errorMessage(e))
          if (!choice) throw new Error('cancelled')
          extra = choice
          continue
        }
        setPending(null)
        throw e
      }
    }
  }, [toast])

  const close = () => { pending?.resolve(null); setPending(null) }

  return (
    <Ctx.Provider value={{ run }}>
      {children}
      <Modal open={!!pending} onClose={close} title={<span className="flex items-center gap-2"><ShieldCheck className="text-amber-500" />موافقة المدير مطلوبة</span>}>
        <div className="space-y-4">
          <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">{pending?.reason}</p>
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (pin) pending?.resolve({ manager_pin: pin }) }}>
            <Field label="الرقم السري للمدير (موافقة فورية)" hint={pinError && <span className="text-rose-600">{pinError}</span>}>
              <input className="input text-center text-2xl tracking-[0.5em]" type="password" inputMode="numeric" autoComplete="off"
                autoFocus maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <button className="btn-primary w-full" disabled={pin.length < 4}>موافقة بالرقم السري</button>
          </form>
          <div className="flex items-center gap-3 text-xs text-slate-400"><div className="h-px flex-1 bg-slate-200" />أو<div className="h-px flex-1 bg-slate-200" /></div>
          <button className="btn-secondary w-full" onClick={() => pending?.resolve({ request_approval: true })}>إرسال طلب للمدير والانتظار</button>
        </div>
      </Modal>
    </Ctx.Provider>
  )
}

export function useApproval() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApproval outside provider')
  return c
}
