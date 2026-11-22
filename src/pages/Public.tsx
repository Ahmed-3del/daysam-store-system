import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, Printer, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { InvoiceReceipt } from '../components/InvoiceReceipt'
import { REPAIR_STATUSES } from '../components/RepairReceipt'
import { Loading } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { date, dateTime, money } from '../lib/format'
import type { Invoice, RepairTicket, Shop } from '../lib/types'

function NotFound() {
  return <div className="flex min-h-screen items-center justify-center p-6 text-center text-slate-500">الرابط غير صحيح أو انتهت صلاحيته.</div>
}

export function PublicInvoice() {
  const { token } = useParams()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-invoice', token],
    queryFn: async () => (await api.get<Invoice & { shop: Shop }>(`/public/invoices/${token}/`)).data,
  })
  if (isLoading) return <Loading />
  if (isError || !data) return <NotFound />
  return (
    <div className="min-h-screen px-4 py-6">
      <InvoiceReceipt invoice={data} shop={data.shop} />
      <div className="no-print mt-4 flex justify-center">
        <button className="btn-secondary" onClick={() => window.print()}><Printer size={18} />طباعة / حفظ PDF</button>
      </div>
    </div>
  )
}

export function PublicRepair() {
  const { code } = useParams()
  const { data: t, isLoading, isError } = useQuery({
    queryKey: ['public-repair', code],
    queryFn: async () => (await api.get<RepairTicket & { shop: Shop }>(`/public/repairs/${code}/`)).data,
    refetchInterval: 60_000,
  })
  if (isLoading) return <Loading />
  if (isError || !t || !t.shop) return <NotFound />
  const flow = REPAIR_STATUSES.filter((s) => !['cancelled', 'waiting_parts', 'awaiting_approval'].includes(s.value))
  const reached = new Set(t.logs?.map((l) => l.status))
  const currentIdx = flow.findIndex((s) => s.value === t.status)

  return (
    <div className="mx-auto min-h-screen max-w-md space-y-4 px-4 py-6">
      <div className="text-center">
        <div className="text-xl font-extrabold">{t.shop.name}</div>
        {t.shop.phone && <a href={`tel:${t.shop.phone}`} className="text-sm text-brand-700" dir="ltr">{t.shop.phone}</a>}
      </div>
      <div className="card p-5">
        <div className="text-sm text-slate-500">متابعة صيانة #{t.number}</div>
        <div className="text-lg font-extrabold">{t.device_type} {t.brand} {t.model}</div>
        <div className="mt-1 text-sm">{t.issue}</div>
        <div className={`mt-4 rounded-2xl p-4 text-center text-lg font-extrabold ${t.status === 'ready' ? 'bg-emerald-50 text-emerald-700' : t.status === 'cancelled' ? 'bg-rose-50 text-rose-700' : 'bg-brand-50 text-brand-700'}`}>
          {t.status_display}
        </div>
        {t.quote_status === 'pending' && <QuoteDecision code={code!} t={t} />}
        {t.quote_status === 'approved' && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">وافقت على عرض السعر ({money(t.quote_amount, t.shop.currency)}) — جاري الإصلاح.</p>}
        {t.quote_status === 'rejected' && <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm font-bold text-slate-600">تم رفض عرض السعر — الجهاز جاهز للاستلام بدون إصلاح.</p>}
        {t.status !== 'cancelled' && (
          <ol className="mt-5 space-y-3">
            {flow.map((s, i) => {
              const done = i <= currentIdx || reached.has(s.value)
              return (
                <li key={s.value} className={`flex items-center gap-3 ${done ? 'font-bold text-slate-800' : 'text-slate-400'}`}>
                  {done ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Circle size={20} />}{s.label}
                  {t.status === 'waiting_parts' && s.value === 'in_progress' && <span className="text-xs text-amber-600">(بانتظار قطع غيار)</span>}
                </li>
              )
            })}
          </ol>
        )}
        <div className="mt-5 space-y-1 border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">تاريخ الاستلام</span><span>{dateTime(t.created_at)}</span></div>
          {t.expected_date && <div className="flex justify-between"><span className="text-slate-500">الموعد المتوقع</span><span>{date(t.expected_date)}</span></div>}
          {Number(t.total) > 0 && <div className="flex justify-between"><span className="text-slate-500">التكلفة</span><span>{money(t.total, t.shop.currency)}</span></div>}
          {Number(t.remaining) > 0 && <div className="flex justify-between font-bold"><span>المطلوب عند الاستلام</span><span>{money(t.remaining, t.shop.currency)}</span></div>}
          {t.warranty_until && (
            <div className="flex items-center justify-between text-emerald-700"><span className="flex items-center gap-1"><ShieldCheck size={16} />ضمان الإصلاح</span><span>حتى {date(t.warranty_until)}</span></div>
          )}
        </div>
      </div>
    </div>
  )
}

function QuoteDecision({ code, t }: { code: string; t: RepairTicket & { shop: Shop } }) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const respond = async (approve: boolean) => {
    if (!approve && !confirm('رفض عرض السعر؟ سيتم تجهيز الجهاز للاستلام بدون إصلاح.')) return
    setBusy(true); setError('')
    try {
      await api.post(`/public/repairs/${code}/quote/`, { approve })
      qc.invalidateQueries({ queryKey: ['public-repair', code] })
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return (
    <div className="mt-4 space-y-3 rounded-2xl bg-amber-50 p-4">
      <div className="font-extrabold text-amber-900">مطلوب موافقتك على تكلفة الإصلاح</div>
      <div className="text-3xl font-extrabold">{money(t.quote_amount, t.shop.currency)}</div>
      {t.quote_note && <p className="text-sm text-slate-700">{t.quote_note}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-success py-3" disabled={busy} onClick={() => respond(true)}>موافق، ابدأ الإصلاح</button>
        <button className="btn-secondary py-3 text-rose-600" disabled={busy} onClick={() => respond(false)}>رفض</button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  )
}
