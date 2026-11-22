import { Camera, CheckCircle2, FileText, MessageCircle, PackagePlus, Printer, RotateCcw, ShieldCheck, Trash2, X, XCircle } from 'lucide-react'
import { SmsButton } from '../components/Sms'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ProductSearchModal } from '../components/pickers'
import { REPAIR_STATUSES, RepairReceipt, repairTone } from '../components/RepairReceipt'
import { Badge, Field, InfoRow, Loading, Modal, Money, PageHeader } from '../components/ui'
import { useApproval } from '../components/approval'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { date, dateTime, money, whatsappLink } from '../lib/format'
import { useAction, useGet } from '../lib/hooks'
import { Checklist, PatternLock } from '../components/RepairWidgets'
import type { RepairHistoryItem, RepairStatus, RepairTicket, Shop } from '../lib/types'
import { HistoryBox, type RepairOptions } from './RepairForm'

export default function RepairDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { shop, isManager } = useAuth()
  const { data: t, isLoading } = useGet<RepairTicket>(['repairs', id], `/repairs/${id}/`)
  const [pickPart, setPickPart] = useState(false)
  const [manualPart, setManualPart] = useState(false)
  const [delivering, setDelivering] = useState(false)
  const [labor, setLabor] = useState('')
  const [notify, setNotify] = useState<RepairStatus | null>(null)
  const [quoting, setQuoting] = useState(false)
  const nav = useNavigate()
  const { data: opts } = useGet<RepairOptions>(['repairs', 'options'], '/repairs/options/')
  const { data: history } = useGet<RepairHistoryItem[]>(['repairs', 'history', id], t ? '/repairs/history/' : null,
    { serial: t?.serial || '', phone: t?.customer_phone || '' })
  const inv = ['repairs', 'products', 'cash', 'customers']

  useEffect(() => { if (t) setLabor(String(t.labor_cost)) }, [t])
  useEffect(() => {
    if (params.get('print') && t) { const h = setTimeout(() => window.print(), 400); return () => clearTimeout(h) }
  }, [params, t])

  const setStatus = useAction((status: RepairStatus) => api.post(`/repairs/${id}/status/`, { status }).then(() => status),
    { invalidate: inv, success: 'تم تحديث الحالة', onSuccess: (s) => setNotify(s) })
  const quoteResponse = useAction((approve: boolean) => api.post(`/repairs/${id}/quote-response/`, { approve }),
    { invalidate: inv, success: 'تم تسجيل رد العميل' })
  const warrantyReturn = useAction((issue: string) => api.post<RepairTicket>(`/repairs/${id}/warranty-return/`, { issue }),
    { invalidate: inv, success: 'تم فتح تذكرة رجوع ضمان', onSuccess: (r) => nav(`/repairs/${r.data.id}?print=1`) })
  const addPart = useAction((body: object) => api.post(`/repairs/${id}/parts/`, body), { invalidate: inv, success: 'تمت إضافة القطعة' })
  const removePart = useAction((pid: number) => api.delete(`/repairs/${id}/parts/${pid}/`), { invalidate: inv })
  const saveLabor = useAction(() => api.patch(`/repairs/${id}/`, { labor_cost: Number(labor) || 0 }), { invalidate: inv, success: 'تم حفظ أجرة اليد' })
  const approval = useApproval()
  const cancel = useAction(() => approval.run((extra) => api.post(`/repairs/${id}/cancel/`, { refund_deposit: true, ...extra })),
    { invalidate: inv, success: 'تم إلغاء التذكرة' })

  if (isLoading || !t || !shop) return <Loading />
  const closed = t.status === 'delivered' || t.status === 'cancelled'
  const trackUrl = `${window.location.origin}/t/${t.tracking_code}`
  const waText = statusMessage(t, shop, trackUrl, t.status)
  const otherHistory = (history || []).filter((h) => h.id !== t.id)

  return (
    <div className="space-y-4">
      <PageHeader back="/repairs" title={`صيانة #${t.number}`} subtitle={<Badge tone={repairTone(t.status)}>{t.status_display}</Badge>} />
      <div className="no-print flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={() => window.print()}><Printer size={18} />طباعة الإيصال</button>
        {t.customer_phone && <a className="btn-success" target="_blank" rel="noreferrer" href={whatsappLink(t.customer_phone, waText)}><MessageCircle size={18} />واتساب للعميل</a>}
        <SmsButton to={t.customer_phone} kind="repair_status" text={statusMessage(t, shop, trackUrl, t.status)} />
        {!closed && <button className="btn-primary" onClick={() => setDelivering(true)}><CheckCircle2 size={18} />تسليم الجهاز</button>}
        {!closed && <button className="btn-ghost text-rose-600" onClick={() => confirm('إلغاء التذكرة وإرجاع القطع للمخزن ورد المقدم؟') && cancel.mutate(undefined)}><XCircle size={18} />إلغاء</button>}
      </div>

      {notify && t.customer_phone && (
        <div className="no-print flex flex-wrap items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
          تم تغيير الحالة — أبلغ العميل؟
          <a className="btn-success ms-auto px-3 py-1.5" target="_blank" rel="noreferrer" onClick={() => setNotify(null)}
            href={whatsappLink(t.customer_phone, statusMessage(t, shop, trackUrl, notify))}><MessageCircle size={16} />إرسال واتساب</a>
          <SmsButton to={t.customer_phone} kind={notify === 'ready' ? 'repair_ready' : 'repair_status'} text={statusMessage(t, shop, trackUrl, notify)} className="btn-secondary px-3 py-1.5" />
          <button className="btn-ghost px-2" onClick={() => setNotify(null)} aria-label="إغلاق"><X size={16} /></button>
        </div>
      )}
      {t.is_warranty && (
        <div className="no-print flex items-center gap-2 rounded-2xl bg-violet-50 p-3 text-sm font-bold text-violet-800">
          <ShieldCheck size={18} />رجوع ضمان على صيانة <Link className="underline" to={`/repairs/${t.parent}`}>#{t.parent_number}</Link>
        </div>
      )}

      <div className="print-only"><RepairReceipt t={t} shop={shop} trackUrl={trackUrl} /></div>

      <div className="no-print grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {!closed && (
            <section className="card p-4">
              <h2 className="mb-3 font-extrabold">تغيير الحالة</h2>
              <div className="flex flex-wrap gap-2">
                {REPAIR_STATUSES.filter((s) => !['delivered', 'cancelled', 'awaiting_approval'].includes(s.value)).map((s) => (
                  <button key={s.value} disabled={setStatus.isPending} onClick={() => setStatus.mutate(s.value)}
                    className={`chip px-3 py-2 text-sm ${t.status === s.value ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{s.label}</button>
                ))}
              </div>
            </section>
          )}

          <QuoteCard t={t} shop={shop} trackUrl={trackUrl} closed={closed} onQuote={() => setQuoting(true)}
            onRespond={(a) => quoteResponse.mutate(a)} busy={quoteResponse.isPending} />

          <section className="card space-y-3 p-4">
            <h2 className="font-extrabold">فحص الاستلام</h2>
            {t.fault_tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">{t.fault_tags.map((x) => <Badge key={x} tone="red">{x}</Badge>)}</div>
            )}
            {Object.keys(t.checklist || {}).length
              ? <Checklist items={opts?.checklist_items || {}} value={t.checklist} readOnly />
              : <p className="text-sm text-slate-500">لم يتم تسجيل فحص عند الاستلام.</p>}
            {t.battery_health != null && <InfoRow label="صحة البطارية">{t.battery_health}%</InfoRow>}
            {(t.pattern || t.passcode) && (
              <details className="rounded-xl bg-slate-50 p-3 text-sm">
                <summary className="cursor-pointer font-bold">قفل الشاشة (للفني)</summary>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  {t.passcode && <span className="font-mono text-lg" dir="ltr">{t.passcode}</span>}
                  {t.pattern && <PatternLock value={t.pattern} readOnly size={150} />}
                </div>
              </details>
            )}
            <Photos ticketId={t.id} photos={t.photos || []} />
          </section>

          <section className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-extrabold">قطع الغيار</h2>
              {!closed && (
                <div className="flex gap-2">
                  <button className="btn-secondary px-3 py-2" onClick={() => setPickPart(true)}><PackagePlus size={16} />من المخزن</button>
                  <button className="btn-ghost px-3 py-2" onClick={() => setManualPart(true)}>قطعة خارجية</button>
                </div>
              )}
            </div>
            {!t.parts?.length ? <p className="py-3 text-sm text-slate-500">لم تُضف قطع غيار.</p> : t.parts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b border-slate-100 py-2 text-sm last:border-0">
                <span className="flex-1 font-bold">{p.name} × {p.quantity}</span>
                <Money value={p.unit_price * p.quantity} />
                {!closed && <button className="btn-ghost px-1.5 text-rose-500" onClick={() => removePart.mutate(p.id)} aria-label="حذف"><Trash2 size={16} /></button>}
              </div>
            ))}
            <div className="mt-3 grid grid-cols-2 items-end gap-3">
              <Field label="أجرة اليد">
                <input className="input" inputMode="decimal" disabled={closed} value={labor} onChange={(e) => setLabor(e.target.value)} />
              </Field>
              {!closed && <button className="btn-secondary" disabled={Number(labor) === Number(t.labor_cost)} onClick={() => saveLabor.mutate(undefined)}>حفظ الأجرة</button>}
            </div>
            <div className="mt-4 space-y-1 border-t border-dashed border-slate-200 pt-3 text-sm">
              <InfoRow label="قطع الغيار"><Money value={t.parts_total} /></InfoRow>
              <InfoRow label="أجرة اليد"><Money value={t.labor_cost} /></InfoRow>
              <InfoRow label="الإجمالي"><Money value={t.total} className="text-base font-extrabold" /></InfoRow>
              <InfoRow label="المقدم"><Money value={-Number(t.deposit)} /></InfoRow>
              {Number(t.paid) > 0 && <InfoRow label="المدفوع عند التسليم"><Money value={-Number(t.paid)} /></InfoRow>}
              <InfoRow label="المتبقي"><Money value={t.remaining} className="text-base font-extrabold text-brand-700" /></InfoRow>
              {isManager && t.profit !== undefined && <InfoRow label="ربح الصيانة"><Money value={t.profit} className="text-emerald-600" /></InfoRow>}
            </div>
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-extrabold">سجل الحالة</h2>
            <ol className="relative space-y-3 border-s-2 border-slate-200 ps-4">
              {t.logs?.map((l) => (
                <li key={l.id}>
                  <span className="absolute -start-[7px] mt-1.5 size-3 rounded-full bg-brand-500" />
                  <div className="text-sm font-bold">{l.status_display}</div>
                  <div className="text-xs text-slate-500">{dateTime(l.created_at)} · {l.user}{l.note && ` · ${l.note}`}</div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className="card h-fit p-4">
          <h2 className="mb-2 font-extrabold">البيانات</h2>
          <InfoRow label="العميل">{t.customer ? <Link to={`/customers/${t.customer}`} className="text-brand-700">{t.customer_name}</Link> : t.customer_name}</InfoRow>
          <InfoRow label="الموبايل"><span dir="ltr">{t.customer_phone || '—'}</span></InfoRow>
          <InfoRow label="الجهاز">{t.device_type} {t.brand} {t.model}</InfoRow>
          {t.serial && <InfoRow label="IMEI"><span className="font-mono" dir="ltr">{t.serial}</span></InfoRow>}
          {t.passcode && <InfoRow label="رمز القفل"><span dir="ltr">{t.passcode}</span></InfoRow>}
          <InfoRow label="العطل">{t.issue}</InfoRow>
          {t.condition_notes && <InfoRow label="حالة الجهاز">{t.condition_notes}</InfoRow>}
          {t.accessories && <InfoRow label="المرفقات">{t.accessories}</InfoRow>}
          {t.technician_name && <InfoRow label="الفني">{t.technician_name}</InfoRow>}
          {t.expected_date && <InfoRow label="الموعد المتوقع">{date(t.expected_date)}</InfoRow>}
          <InfoRow label="كود المتابعة"><span className="font-mono" dir="ltr">{t.tracking_code}</span></InfoRow>
          {t.notes && <InfoRow label="ملاحظات">{t.notes}</InfoRow>}
          <InfoRow label="الضمان">{t.warranty_days ? `${t.warranty_days} يوم` : 'بدون'}</InfoRow>
          {t.warranty_until && (
            <InfoRow label="ساري حتى"><Badge tone={t.in_warranty ? 'green' : 'gray'}>{date(t.warranty_until)}{!t.in_warranty && ' (منتهي)'}</Badge></InfoRow>
          )}
          {t.status === 'delivered' && (t.in_warranty || isManager) && (
            <button className="btn-secondary mt-3 w-full" disabled={warrantyReturn.isPending}
              onClick={() => { const issue = prompt('وصف المشكلة في رجوع الضمان'); if (issue !== null) warrantyReturn.mutate(issue) }}>
              <RotateCcw size={16} />فتح رجوع ضمان {!t.in_warranty && '(استثنائي)'}
            </button>
          )}
          {otherHistory.length > 0 && <div className="mt-3"><HistoryBox items={otherHistory} title="صيانات أخرى لنفس الجهاز / العميل" /></div>}
        </section>
      </div>

      <ProductSearchModal open={pickPart} title="اختيار قطعة غيار" onClose={() => setPickPart(false)}
        onPick={(p) => { addPart.mutate({ product: p.id, quantity: 1 }); setPickPart(false) }} />
      <ManualPartModal open={manualPart} onClose={() => setManualPart(false)} onSave={(b) => { addPart.mutate(b); setManualPart(false) }} />
      <DeliverModal t={t} open={delivering} onClose={() => setDelivering(false)} />
      <QuoteModal t={t} shop={shop} trackUrl={trackUrl} open={quoting} onClose={() => setQuoting(false)} />
    </div>
  )
}

function ManualPartModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (b: object) => void }) {
  const [f, setF] = useState({ name: '', unit_price: '', unit_cost: '', quantity: '1' })
  return (
    <Modal open={open} onClose={onClose} title="قطعة غيار من خارج المخزن" footer={
      <button className="btn-primary flex-1" disabled={!f.name} onClick={() => { onSave({ ...f, product: null, quantity: Number(f.quantity) || 1, unit_price: Number(f.unit_price) || 0, unit_cost: Number(f.unit_cost) || 0 }); setF({ name: '', unit_price: '', unit_cost: '', quantity: '1' }) }}>إضافة</button>
    }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="اسم القطعة" className="col-span-2"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="سعر البيع للعميل"><input className="input" inputMode="decimal" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} /></Field>
        <Field label="التكلفة علينا"><input className="input" inputMode="decimal" value={f.unit_cost} onChange={(e) => setF({ ...f, unit_cost: e.target.value })} /></Field>
        <Field label="الكمية"><input className="input" inputMode="numeric" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

function DeliverModal({ t, open, onClose }: { t: RepairTicket; open: boolean; onClose: () => void }) {
  const due = Math.max(0, Number(t.total) - Number(t.deposit))
  const [paid, setPaid] = useState('')
  const deliver = useAction(() => api.post(`/repairs/${t.id}/deliver/`, { paid: paid === '' ? due : Number(paid) }), {
    invalidate: ['repairs', 'cash', 'customers'], success: 'تم تسليم الجهاز', onSuccess: onClose,
  })
  return (
    <Modal open={open} onClose={onClose} title="تسليم الجهاز للعميل" footer={
      <button className="btn-primary flex-1" disabled={deliver.isPending} onClick={() => deliver.mutate(undefined)}>تأكيد التسليم</button>
    }>
      <div className="space-y-3">
        <InfoRow label="الإجمالي"><Money value={t.total} /></InfoRow>
        <InfoRow label="المقدم"><Money value={t.deposit} /></InfoRow>
        <InfoRow label="المستحق الآن"><Money value={due} className="text-lg font-extrabold" /></InfoRow>
        {Number(t.deposit) > Number(t.total) && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">المقدم أكبر من التكلفة — سيتم رد الفرق من الخزينة.</p>}
        <Field label="المبلغ المستلم" hint={t.customer ? 'أي مبلغ متبقٍ يُسجل آجل على العميل' : 'يجب تحصيل كامل المبلغ (العميل غير مسجل)'}>
          <input className="input text-lg font-bold" inputMode="decimal" placeholder={String(due)} value={paid} onChange={(e) => setPaid(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

/** WhatsApp text the shop sends the customer for each repair status. */
function statusMessage(t: RepairTicket, shop: Shop, trackUrl: string, status: RepairStatus) {
  const device = `${t.brand} ${t.model}`.trim() || t.device_type
  const hi = `مرحباً ${t.customer_name}،`
  const tail = `\nمتابعة الحالة: ${trackUrl}\n${shop.name}`
  switch (status) {
    case 'received': return `${hi} تم استلام جهازك ${device} برقم صيانة #${t.number}.${tail}`
    case 'diagnosing': return `${hi} جهازك ${device} قيد الفحص الآن، وسنبلغك بالتكلفة قريباً.${tail}`
    case 'awaiting_approval': return `${hi} تكلفة إصلاح ${device}: ${money(t.quote_amount, shop.currency)}${t.quote_note ? ` (${t.quote_note})` : ''}.\nللموافقة أو الرفض افتح الرابط:\n${trackUrl}`
    case 'waiting_parts': return `${hi} جهازك ${device} بانتظار وصول قطعة الغيار، وسنبلغك فور وصولها.${tail}`
    case 'in_progress': return `${hi} جاري إصلاح جهازك ${device} الآن.${tail}`
    case 'ready': return `${hi} جهازك ${device} جاهز للاستلام ✅\nالمطلوب: ${money(t.remaining, shop.currency)}${tail}`
    case 'delivered': return `${hi} شكراً لثقتك. تم تسليم ${device}${t.warranty_until ? ` — الضمان ساري حتى ${date(t.warranty_until)}` : ''}.${tail}`
    default: return `${hi} بخصوص جهازك ${device} (#${t.number}).${tail}`
  }
}

function QuoteCard({ t, shop, trackUrl, closed, onQuote, onRespond, busy }: {
  t: RepairTicket; shop: Shop; trackUrl: string; closed: boolean; onQuote: () => void; onRespond: (approve: boolean) => void; busy: boolean
}) {
  if (closed && !t.quote_status) return null
  const tone = { pending: 'amber', approved: 'green', rejected: 'red', '': 'gray' } as const
  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-extrabold"><FileText size={18} />عرض السعر</h2>
        {t.quote_status && <Badge tone={tone[t.quote_status]}>{t.quote_status_display}</Badge>}
      </div>
      {t.quote_amount != null && (
        <div className="flex items-baseline justify-between rounded-xl bg-slate-50 p-3">
          <span className="text-sm text-slate-600">{t.quote_note || 'تكلفة الإصلاح'}</span>
          <Money value={t.quote_amount} className="text-lg font-extrabold" />
        </div>
      )}
      {t.quote_status === 'pending' && (
        <div className="flex flex-wrap gap-2">
          {t.customer_phone && (
            <a className="btn-success px-3 py-2" target="_blank" rel="noreferrer"
              href={whatsappLink(t.customer_phone, statusMessage(t, shop, trackUrl, 'awaiting_approval'))}><MessageCircle size={16} />إرسال للعميل</a>
          )}
          <SmsButton to={t.customer_phone} kind="repair_quote" text={statusMessage(t, shop, trackUrl, 'awaiting_approval')} className="btn-secondary px-3 py-2" />
          <button className="btn-secondary px-3 py-2 text-emerald-700" disabled={busy} onClick={() => onRespond(true)}>العميل وافق (تليفونياً)</button>
          <button className="btn-secondary px-3 py-2 text-rose-600" disabled={busy} onClick={() => onRespond(false)}>العميل رفض</button>
        </div>
      )}
      {!closed && t.quote_status !== 'pending' && (
        <button className="btn-secondary w-full" onClick={onQuote}>{t.quote_amount != null ? 'عرض سعر جديد' : 'إرسال عرض سعر للعميل'}</button>
      )}
      {t.quote_status === 'pending' && <p className="text-xs text-slate-500">يستطيع العميل الموافقة أو الرفض من رابط المتابعة مباشرة.</p>}
    </section>
  )
}

function QuoteModal({ t, shop, trackUrl, open, onClose }: { t: RepairTicket; shop: Shop; trackUrl: string; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const send = useAction(() => api.post<RepairTicket>(`/repairs/${t.id}/quote/`, { amount: Number(amount) || 0, note }), {
    invalidate: ['repairs'], success: 'تم تسجيل عرض السعر',
    onSuccess: (r) => {
      onClose(); setAmount(''); setNote('')
      if (r.data.customer_phone) window.open(whatsappLink(r.data.customer_phone, statusMessage(r.data, shop, trackUrl, 'awaiting_approval')), '_blank')
    },
  })
  return (
    <Modal open={open} onClose={onClose} title="عرض سعر للعميل" footer={
      <button className="btn-primary flex-1" disabled={!Number(amount) || send.isPending} onClick={() => send.mutate(undefined)}><MessageCircle size={18} />حفظ وإرسال واتساب</button>
    }>
      <div className="space-y-3">
        <Field label="تكلفة الإصلاح الإجمالية"><input className="input text-lg font-bold" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="التفاصيل" hint="مثال: شاشة أصلية + ضمان 3 شهور"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <p className="text-xs text-slate-500">تتحول التذكرة إلى «بانتظار موافقة العميل» ويصله رابط للموافقة أو الرفض.</p>
      </div>
    </Modal>
  )
}

function Photos({ ticketId, photos }: { ticketId: number; photos: NonNullable<RepairTicket['photos']> }) {
  const { isManager } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState('repair')
  const [urls, setUrls] = useState<Record<number, string>>({})
  const [view, setView] = useState<string | null>(null)
  const base = `/repairs/${ticketId}/photos/`
  useEffect(() => {
    let alive = true
    const made: string[] = []
    Promise.all(photos.map(async (p) => {
      const r = await api.get(`${base}${p.id}/`, { responseType: 'blob' })
      const u = URL.createObjectURL(r.data); made.push(u)
      return [p.id, u] as const
    })).then((pairs) => { if (alive) setUrls(Object.fromEntries(pairs)) }).catch(() => undefined)
    return () => { alive = false; made.forEach((u) => URL.revokeObjectURL(u)) }
  }, [photos, base])
  const upload = useAction((files: File[]) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('file', f)); fd.append('kind', kind)
    return api.post(base, fd)
  }, { invalidate: ['repairs'], success: 'تم رفع الصور' })
  const del = useAction((pid: number) => api.delete(`${base}${pid}/`), { invalidate: ['repairs'] })
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">صور الجهاز ({photos.length})</span>
        <div className="flex gap-2">
          <select className="input w-auto py-1.5 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="intake">عند الاستلام</option><option value="repair">أثناء الإصلاح</option><option value="delivery">عند التسليم</option>
          </select>
          <button className="btn-secondary px-3 py-1.5" disabled={upload.isPending} onClick={() => input.current?.click()}><Camera size={16} />إضافة</button>
          <input ref={input} type="file" accept="image/*" capture="environment" multiple className="hidden"
            onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) upload.mutate(fs); e.target.value = '' }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <div key={p.id} className="relative">
            <button className="size-20 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200" onClick={() => urls[p.id] && setView(urls[p.id])}>
              {urls[p.id] && <img src={urls[p.id]} alt={p.kind_display} className="size-full object-cover" />}
            </button>
            <span className="absolute inset-x-0 bottom-0 rounded-b-xl bg-black/50 text-center text-[10px] text-white">{p.kind_display}</span>
            {isManager && <button className="absolute end-1 top-1 rounded-full bg-black/60 p-0.5 text-white" onClick={() => confirm('حذف الصورة؟') && del.mutate(p.id)} aria-label="حذف"><Trash2 size={12} /></button>}
          </div>
        ))}
      </div>
      <Modal open={!!view} onClose={() => setView(null)} title="صورة الجهاز" wide>
        {view && <img src={view} alt="" className="mx-auto max-h-[75vh] rounded-xl" />}
      </Modal>
    </div>
  )
}
