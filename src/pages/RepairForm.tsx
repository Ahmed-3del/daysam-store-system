import { Camera, History, ScanBarcode, ShieldCheck, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { CustomerPicker } from '../components/pickers'
import { repairTone } from '../components/RepairReceipt'
import { Checklist, PatternLock, type CheckValue } from '../components/RepairWidgets'
import { useToast } from '../components/toast'
import { Badge, Field, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { date } from '../lib/format'
import { useAction, useDebounced, useGet } from '../lib/hooks'
import type { Customer, RepairHistoryItem, RepairTicket, User } from '../lib/types'


export interface RepairOptions {
  checklist_items: Record<string, string>
  models: { brand: string; model: string }[]
  fault_tags: string[]
  brands: string[]
  device_types: string[]
  accessories: string[]
  serial_label: string
  default_warranty_days: number
}

export default function RepairForm() {
  const nav = useNavigate()
  const toast = useToast()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [scan, setScan] = useState(false)
  const [acc, setAcc] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [checklist, setChecklist] = useState<Record<string, CheckValue>>({})
  const [pattern, setPattern] = useState('')
  const [lockType, setLockType] = useState<'none' | 'pin' | 'pattern'>('none')
  const [photos, setPhotos] = useState<File[]>([])
  const photoInput = useRef<HTMLInputElement>(null)
  const { data: team } = useGet<User[]>(['users'], '/users/')
  const { data: opts } = useGet<RepairOptions>(['repairs', 'options'], '/repairs/options/')
  const [f, setF] = useState({
    customer_name: '', customer_phone: '', device_type: '', brand: '', model: '', serial: '', passcode: '',
    issue: '', condition_notes: '', estimated_cost: '', deposit: '', expected_date: '', technician: '', notes: '',
    warranty_days: '30', battery_health: '',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  // Previous repairs for this IMEI or phone number (repeat customers, warranty claims).
  const phone = customer?.phone || f.customer_phone
  const dSerial = useDebounced(f.serial.trim(), 500)
  const dPhone = useDebounced(phone.trim(), 500)
  const { data: history } = useGet<RepairHistoryItem[]>(['repairs', 'history', dSerial, dPhone],
    dSerial.length >= 5 || dPhone.length >= 8 ? '/repairs/history/' : null, { serial: dSerial, phone: dPhone })

  const modelSuggestions = (opts?.models || []).filter((m) => !f.brand || m.brand.toLowerCase() === f.brand.toLowerCase())
  const faults = opts?.fault_tags || []
  const deviceTypes = opts?.device_types?.length ? opts.device_types : ['جهاز']
  const serialLabel = opts?.serial_label || 'السيريال'
  const isPhone = serialLabel.includes('IMEI')
  useEffect(() => {
    if (opts) setF((x) => ({ ...x, device_type: deviceTypes.includes(x.device_type) ? x.device_type : deviceTypes[0], warranty_days: String(opts.default_warranty_days ?? 0) }))
  }, [opts]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useAction(async () => {
    const { data } = await api.post<RepairTicket>('/repairs/', {
      ...f, customer: customer?.id ?? null,
      customer_name: customer?.name || f.customer_name, customer_phone: customer?.phone || f.customer_phone,
      estimated_cost: Number(f.estimated_cost) || 0, deposit: Number(f.deposit) || 0, warranty_days: Number(f.warranty_days) || 0,
      battery_health: f.battery_health === '' ? null : Number(f.battery_health),
      expected_date: f.expected_date || null, technician: f.technician || null, accessories: acc.join('، '),
      fault_tags: tags, checklist, pattern: lockType === 'pattern' ? pattern : '', passcode: lockType === 'pin' ? f.passcode : '',
    })
    if (photos.length) {
      const fd = new FormData()
      photos.forEach((p) => fd.append('file', p))
      fd.append('kind', 'intake')
      await api.post(`/repairs/${data.id}/photos/`, fd).catch(() => toast.error('تم حفظ التذكرة لكن تعذر رفع الصور.'))
    }
    return data
  }, { invalidate: ['repairs', 'cash'], success: 'تم استلام الجهاز', onSuccess: (r) => nav(`/repairs/${r.id}?print=1`, { replace: true }) })

  const closeScan = useCallback(() => setScan(false), [])
  const onScan = useCallback((code: string) => setF((x) => ({ ...x, serial: code })), [])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!tags.length && !f.issue.trim()) { toast.error('اختر العطل أو اكتب وصفه.'); return }
    save.mutate(undefined)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PageHeader back title="استلام جهاز للصيانة" />

      <section className="card space-y-3 p-4">
        <h2 className="font-extrabold">العميل</h2>
        <CustomerPicker value={customer} onChange={setCustomer} />
        {!customer && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اسم العميل"><input className="input" required value={f.customer_name} onChange={set('customer_name')} /></Field>
            <Field label="الموبايل"><input className="input" dir="ltr" inputMode="tel" value={f.customer_phone} onChange={set('customer_phone')} /></Field>
          </div>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-extrabold">الجهاز</h2>
        <div className="flex flex-wrap gap-1.5">
          {(opts?.brands || []).map((b) => (
            <button type="button" key={b} onClick={() => setF({ ...f, brand: b })}
              className={`chip px-3 py-1.5 text-sm ${f.brand === b ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{b}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الماركة"><input className="input" value={f.brand} onChange={set('brand')} /></Field>
          <Field label="الموديل">
            <input className="input" list="repair-models" placeholder="مثال: A52 / 13 Pro Max" value={f.model} onChange={set('model')} />
            <datalist id="repair-models">{modelSuggestions.map((m) => <option key={`${m.brand}-${m.model}`} value={m.model} />)}</datalist>
          </Field>
          <Field label={serialLabel} hint={isPhone ? 'اطلب *#06# لعرض الـ IMEI' : undefined}>
            <div className="flex gap-2">
              <input className="input font-mono" dir="ltr" value={f.serial} onChange={set('serial')} />
              <button type="button" className="btn-secondary px-3" onClick={() => setScan(true)} aria-label="مسح"><ScanBarcode size={18} /></button>
            </div>
          </Field>
          <Field label="النوع">
            <select className="input" value={f.device_type} onChange={set('device_type')}>{deviceTypes.map((d) => <option key={d}>{d}</option>)}</select>
          </Field>
        </div>
        {!!history?.length && <HistoryBox items={history} />}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-extrabold">العطل</h2>
        <div className="flex flex-wrap gap-1.5">
          {faults.map((t) => (
            <button type="button" key={t} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
              className={`chip px-3 py-1.5 text-sm ${tags.includes(t) ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{t}</button>
          ))}
        </div>
        <Field label="وصف العطل بالتفصيل"><textarea className="input" rows={2} placeholder="مثال: الشاشة مكسورة واللمس لا يعمل في الجزء السفلي" value={f.issue} onChange={set('issue')} /></Field>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-extrabold">فحص الجهاز عند الاستلام</h2>
        <p className="text-xs text-slate-500">يحمي المحل من أي خلاف لاحق — يُطبع على إيصال العميل.</p>
        <Checklist items={opts?.checklist_items || {}} value={checklist} onChange={setChecklist} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="صحة البطارية %"><input className="input" inputMode="numeric" value={f.battery_health} onChange={set('battery_health')} /></Field>
          <Field label="ملاحظات الحالة الخارجية"><input className="input" placeholder="خدوش، كسر بالزاوية، أثر مياه..." value={f.condition_notes} onChange={set('condition_notes')} /></Field>
        </div>
        <div>
          <span className="label">صور الجهاز</span>
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative size-20 overflow-hidden rounded-xl ring-1 ring-slate-200">
                <img src={URL.createObjectURL(p)} alt="" className="size-full object-cover" />
                <button type="button" className="absolute end-1 top-1 rounded-full bg-black/60 p-0.5 text-white" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} aria-label="حذف"><X size={14} /></button>
              </div>
            ))}
            <button type="button" className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-500" onClick={() => photoInput.current?.click()}>
              <Camera size={22} />تصوير
            </button>
            <input ref={photoInput} type="file" accept="image/*" capture="environment" multiple className="hidden"
              onChange={(e) => { setPhotos([...photos, ...Array.from(e.target.files || [])].slice(0, 10)); e.target.value = '' }} />
          </div>
        </div>
        <div>
          <span className="label">المرفقات المستلمة</span>
          <div className="flex flex-wrap gap-2">
            {(opts?.accessories || []).map((a) => (
              <button type="button" key={a} onClick={() => setAcc(acc.includes(a) ? acc.filter((x) => x !== a) : [...acc, a])}
                className={`chip px-3 py-1.5 text-sm ${acc.includes(a) ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{a}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-extrabold">قفل الجهاز</h2>
        <div className="flex gap-2">
          {([['none', 'بدون قفل'], ['pin', 'رقم / كلمة سر'], ['pattern', 'نمط']] as const).map(([v, l]) => (
            <button type="button" key={v} onClick={() => setLockType(v)}
              className={`chip px-3 py-1.5 text-sm ${lockType === v ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{l}</button>
          ))}
        </div>
        {lockType === 'pin' && <Field label="رمز القفل" hint="يظهر للفنيين فقط ولا يُطبع"><input className="input font-mono" dir="ltr" value={f.passcode} onChange={set('passcode')} /></Field>}
        {lockType === 'pattern' && <div className="flex justify-center"><PatternLock value={pattern} onChange={setPattern} /></div>}
      </section>

      <section className="card grid gap-3 p-4 sm:grid-cols-2">
        <h2 className="font-extrabold sm:col-span-2">التكلفة والموعد</h2>
        <Field label="التكلفة المتوقعة"><input className="input" inputMode="decimal" value={f.estimated_cost} onChange={set('estimated_cost')} /></Field>
        <Field label="المقدم المدفوع"><input className="input" inputMode="decimal" value={f.deposit} onChange={set('deposit')} /></Field>
        <Field label="موعد التسليم المتوقع"><input className="input" type="date" value={f.expected_date} onChange={set('expected_date')} /></Field>
        <Field label="الفني المسؤول">
          <select className="input" value={f.technician} onChange={set('technician')}>
            <option value="">—</option>
            {team?.filter((u) => u.is_active).map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
          </select>
        </Field>
        <Field label="ضمان الإصلاح (أيام)"><input className="input" inputMode="numeric" value={f.warranty_days} onChange={set('warranty_days')} /></Field>
        <Field label="ملاحظات داخلية"><input className="input" value={f.notes} onChange={set('notes')} /></Field>
      </section>

      <button className="btn-primary w-full py-3" disabled={save.isPending}>{save.isPending ? 'جاري الحفظ...' : 'حفظ وطباعة الإيصال'}</button>
      <BarcodeScanner open={scan} onClose={closeScan} onResult={onScan} />
    </form>
  )
}

export function HistoryBox({ items, title = 'صيانات سابقة لنفس الجهاز / العميل' }: { items: RepairHistoryItem[]; title?: string }) {
  return (
    <div className="rounded-xl bg-sky-50 p-3 text-sm">
      <div className="mb-1 flex items-center gap-1.5 font-bold text-sky-800"><History size={16} />{title}</div>
      {items.slice(0, 5).map((h) => {
        const inWarranty = h.warranty_until && new Date(h.warranty_until) >= new Date(new Date().toDateString())
        return (
          <Link key={h.id} to={`/repairs/${h.id}`} target="_blank" className="flex flex-wrap items-center gap-2 py-1 hover:underline">
            <span className="font-bold">#{h.number}</span>
            <span className="text-slate-600">{h.brand} {h.model} — {h.issue}</span>
            <span className="text-xs text-slate-500">{date(h.created_at)}</span>
            <Badge tone={repairTone(h.status)}>{h.status_display}</Badge>
            {inWarranty && <Badge tone="green"><ShieldCheck size={12} className="me-1" />ضمان حتى {date(h.warranty_until)}</Badge>}
          </Link>
        )
      })}
    </div>
  )
}
