import { Check, Minus, RotateCcw, X } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'

/* ---------- Android pattern lock (3×3) ---------- */

const DOTS = Array.from({ length: 9 }, (_, i) => ({ n: i + 1, x: 40 + (i % 3) * 80, y: 40 + Math.floor(i / 3) * 80 }))

/** Draw or display an unlock pattern; value is "1-2-3-6-9" (dots numbered row by row). */
export function PatternLock({ value, onChange, readOnly, size = 200 }: {
  value: string; onChange?: (v: string) => void; readOnly?: boolean; size?: number
}) {
  const svg = useRef<SVGSVGElement>(null)
  const [drawing, setDrawing] = useState<number[] | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const seq = drawing ?? (value ? value.split('-').map(Number) : [])

  const local = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 240, y: ((e.clientY - r.top) / r.height) * 240 }
  }
  const hit = (p: { x: number; y: number }) => DOTS.find((d) => Math.hypot(d.x - p.x, d.y - p.y) < 28)?.n
  const start = (e: PointerEvent) => {
    if (readOnly) return
    svg.current?.setPointerCapture(e.pointerId)
    const p = local(e); const n = hit(p)
    setDrawing(n ? [n] : []); setPointer(p)
  }
  const move = (e: PointerEvent) => {
    if (!drawing) return
    const p = local(e); setPointer(p)
    const n = hit(p)
    if (n && !drawing.includes(n)) setDrawing([...drawing, n])
  }
  const end = () => {
    if (!drawing) return
    if (drawing.length >= 4) onChange?.(drawing.join('-'))
    setDrawing(null); setPointer(null)
  }
  const pts = seq.map((n) => DOTS[n - 1])

  return (
    <div className="inline-flex flex-col items-center gap-2" dir="ltr">
      <svg ref={svg} viewBox="0 0 240 240" width={size} height={size}
        className={`touch-none select-none rounded-2xl bg-slate-900 ${readOnly ? '' : 'cursor-crosshair'}`}
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        {pts.length > 1 && <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#818cf8" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />}
        {drawing && pointer && pts.length > 0 && <line x1={pts[pts.length - 1].x} y1={pts[pts.length - 1].y} x2={pointer.x} y2={pointer.y} stroke="#818cf8" strokeWidth="6" strokeLinecap="round" opacity=".6" />}
        {DOTS.map((d) => {
          const idx = seq.indexOf(d.n)
          return (
            <g key={d.n}>
              <circle cx={d.x} cy={d.y} r={idx >= 0 ? 16 : 10} fill={idx >= 0 ? '#6366f1' : '#64748b'} />
              {idx >= 0 && <text x={d.x} y={d.y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">{idx === 0 ? '●' : idx + 1}</text>}
            </g>
          )
        })}
      </svg>
      {!readOnly && (
        <div className="flex items-center gap-2 text-xs text-slate-500" dir="rtl">
          {value ? <span dir="ltr" className="font-mono">{value}</span> : 'ارسم النمط (4 نقاط على الأقل)'}
          {value && <button type="button" className="btn-ghost px-2 py-1" onClick={() => onChange?.('')}><RotateCcw size={14} />مسح</button>}
        </div>
      )}
    </div>
  )
}

/* ---------- Intake inspection checklist ---------- */

export type CheckValue = 'ok' | 'bad' | 'na'
const NEXT: Record<string, CheckValue | undefined> = { undefined: 'ok', ok: 'bad', bad: 'na', na: undefined }
const STYLE: Record<CheckValue, { cls: string; icon: typeof Check; label: string }> = {
  ok: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: Check, label: 'سليم' },
  bad: { cls: 'bg-rose-50 text-rose-700 ring-rose-200', icon: X, label: 'عطل' },
  na: { cls: 'bg-slate-100 text-slate-500 ring-slate-200', icon: Minus, label: 'لم يُفحص' },
}

/** Tap an item to cycle: سليم → عطل → لم يُفحص → (empty). */
export function Checklist({ items, value, onChange, readOnly }: {
  items: Record<string, string>; value: Record<string, CheckValue>; onChange?: (v: Record<string, CheckValue>) => void
  readOnly?: boolean
}) {
  const entries = readOnly ? Object.entries(items).filter(([k]) => value[k]) : Object.entries(items)
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {entries.map(([k, label]) => {
          const v = value[k]
          const st = v ? STYLE[v] : null
          const Icon = st?.icon
          return (
            <button key={k} type="button" disabled={readOnly}
              onClick={() => {
                const next = NEXT[String(v)]
                const copy = { ...value }
                if (next) copy[k] = next; else delete copy[k]
                onChange?.(copy)
              }}
              className={`flex items-center justify-between gap-1 rounded-xl px-3 py-2 text-start text-sm font-bold ring-1 transition ${st ? st.cls : 'bg-white text-slate-600 ring-slate-200'}`}>
              <span className="truncate">{label}</span>
              {Icon ? <Icon size={16} className="shrink-0" /> : <span className="text-[10px] font-normal text-slate-400">اضغط</span>}
            </button>
          )
        })}
      </div>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>اضغط على البند: سليم ← عطل ← لم يُفحص</span>
          <button type="button" className="btn-ghost px-2 py-1" onClick={() => onChange?.(Object.fromEntries(Object.keys(items).map((k) => [k, value[k] ?? 'ok'])) as Record<string, CheckValue>)}>
            الباقي سليم
          </button>
        </div>
      )}
    </div>
  )
}

export const PHONE_BRANDS = ['Samsung', 'iPhone', 'Oppo', 'Xiaomi', 'Realme', 'Vivo', 'Infinix', 'Tecno', 'Huawei', 'Honor', 'Nokia', 'OnePlus']
export const COMMON_FAULTS = [
  'شاشة', 'بطارية', 'سوكت شحن', 'باغة / بوردة', 'سوفت وير', 'فك حماية / FRP', 'مياه', 'كاميرا', 'سماعة', 'ميكروفون',
  'شبكة', 'زجاج خلفي', 'أزرار', 'بصمة / Face ID', 'لا يعمل',
]
