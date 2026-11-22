import { ArrowRight, Loader2, Search, X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrency } from '../lib/auth'
import { money } from '../lib/format'

export function PageHeader({ title, back, actions, subtitle }: {
  title: ReactNode; back?: boolean | string; actions?: ReactNode; subtitle?: ReactNode
}) {
  const nav = useNavigate()
  return (
    <div className="no-print mb-4 flex items-center gap-2">
      {back && (
        <button className="btn-ghost -ms-2 px-2" aria-label="رجوع"
          onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}>
          <ArrowRight size={22} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-extrabold text-slate-900">{title}</h1>
        {subtitle && <div className="text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Field({ label, children, hint, className = '' }: {
  label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button className="btn-ghost px-2" onClick={onClose} aria-label="إغلاق"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="pb-safe flex gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

const tones = {
  gray: 'bg-slate-100 text-slate-700', blue: 'bg-sky-100 text-sky-700', green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800', red: 'bg-rose-100 text-rose-700', violet: 'bg-violet-100 text-violet-700',
  brand: 'bg-brand-100 text-brand-700',
} as const
export type Tone = keyof typeof tones

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip ${tones[tone]}`}>{children}</span>
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-brand-600 ${className}`} size={22} />
}

export function Loading() {
  return <div className="flex justify-center py-16"><Spinner /></div>
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-slate-500">
      {icon && <div className="mb-1 text-slate-300">{icon}</div>}
      <div className="font-bold text-slate-700">{title}</div>
      {children}
    </div>
  )
}

export function Money({ value, className = '' }: { value: number | string | null | undefined; className?: string }) {
  const cur = useCurrency()
  return <span className={`tabular-nums ${className}`}>{money(value, cur)}</span>
}

export function StatCard({ label, value, icon, tone = 'brand', hint, onClick }: {
  label: ReactNode; value: ReactNode; icon?: ReactNode; tone?: Tone; hint?: ReactNode; onClick?: () => void
}) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className="card flex w-full items-start gap-3 p-4 text-start transition enabled:hover:ring-brand-300 disabled:cursor-default">
      {icon && <div className={`rounded-xl p-2.5 ${tones[tone]}`}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <div className="mt-0.5 truncate text-lg font-extrabold text-slate-900">{value}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
    </button>
  )
}

export function SearchBox({ value, onChange, placeholder = 'بحث...', autoFocus, trailing }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; trailing?: ReactNode
}) {
  return (
    <div className="relative flex items-center">
      <Search className="pointer-events-none absolute start-3 text-slate-400" size={18} />
      <input className={`input ps-10 ${trailing ? 'pe-14' : ''}`} value={value} placeholder={placeholder} autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)} type="search" />
      {trailing && <div className="absolute end-1.5">{trailing}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]
}) {
  return (
    <div className="no-print -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`chip shrink-0 px-3.5 py-1.5 text-sm transition ${value === o.value
            ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function InfoRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-end font-semibold text-slate-800">{children}</span>
    </div>
  )
}

export function Fab({ onClick, icon, label }: { onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button onClick={onClick} aria-label={label}
      className="no-print btn-primary fixed bottom-20 start-4 z-30 h-14 rounded-2xl px-5 shadow-lg shadow-brand-700/30 lg:bottom-6">
      {icon}<span>{label}</span>
    </button>
  )
}
