import { HandCoins, MessageCircle, Phone } from 'lucide-react'
import { SmsButton } from '../components/Sms'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Field, InfoRow, Loading, Modal, Money, PageHeader, type Tone } from '../components/ui'
import { api } from '../lib/api'
import { useCurrency } from '../lib/auth'
import { date, dateTime, money, whatsappLink } from '../lib/format'
import { useAction, useGet } from '../lib/hooks'
import type { InstallmentPlan } from '../lib/types'

const stateUi: Record<string, { label: string; tone: Tone }> = {
  paid: { label: 'مدفوع', tone: 'green' }, overdue: { label: 'متأخر', tone: 'red' },
  partial: { label: 'جزئي', tone: 'amber' }, pending: { label: 'قادم', tone: 'gray' },
}

export default function InstallmentDetail() {
  const { id } = useParams()
  const cur = useCurrency()
  const { data: p, isLoading } = useGet<InstallmentPlan>(['installments', id], `/installments/${id}/`)
  const [paying, setPaying] = useState(false)
  if (isLoading || !p) return <Loading />
  const progress = Math.min(100, (Number(p.paid_amount) / Number(p.total_due)) * 100)

  return (
    <div className="space-y-4">
      <PageHeader back="/installments" title={`تقسيط #${p.number}`} subtitle={p.title} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card space-y-3 p-4">
          <div className="text-center">
            <div className="text-sm text-slate-500">المتبقي</div>
            <Money value={p.remaining} className="text-3xl font-extrabold" />
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
            <div className="mt-1 text-xs text-slate-500">تم سداد <Money value={p.paid_amount} /> من <Money value={p.total_due} /></div>
          </div>
          {p.status === 'active' && <button className="btn-primary w-full" onClick={() => setPaying(true)}><HandCoins size={18} />تسجيل دفعة</button>}
          <div className="flex gap-2">
            {p.customer_phone && <a href={`tel:${p.customer_phone}`} className="btn-secondary flex-1"><Phone size={18} />اتصال</a>}
            {p.customer_phone && p.next_due && (
              <a className="btn-success flex-1" target="_blank" rel="noreferrer"
                href={whatsappLink(p.customer_phone, `مرحباً ${p.customer_name}، نذكركم بالقسط رقم ${p.next_due.seq} المستحق ${date(p.next_due.due_date)} بقيمة ${money(p.next_due.remaining, cur)}.${Number(p.overdue_amount) > 0 ? ` إجمالي المتأخرات: ${money(p.overdue_amount, cur)}.` : ''}`)}>
                <MessageCircle size={18} />تذكير
              </a>
            )}
            {p.next_due && <SmsButton to={p.customer_phone} kind="installment" className="btn-secondary flex-1"
              text={`نذكركم بالقسط رقم ${p.next_due.seq} المستحق ${date(p.next_due.due_date)} بقيمة ${money(p.next_due.remaining, cur)}.`} />}
          </div>
          <div>
            <InfoRow label="العميل"><Link className="text-brand-700" to={`/customers/${p.customer}`}>{p.customer_name}</Link></InfoRow>
            {p.invoice && <InfoRow label="الفاتورة"><Link className="text-brand-700" to={`/invoices/${p.invoice}`}>#{p.invoice_number}</Link></InfoRow>}
            <InfoRow label="السعر"><Money value={p.total_price} /></InfoRow>
            <InfoRow label="المقدم"><Money value={p.down_payment} /></InfoRow>
            <InfoRow label="المبلغ الممول"><Money value={p.financed_amount} /></InfoRow>
            <InfoRow label="الفائدة">{p.interest_rate}%</InfoRow>
            <InfoRow label="المدة">{p.months} شهر</InfoRow>
            {p.guarantor_name && <InfoRow label="الضامن">{p.guarantor_name} <span dir="ltr">{p.guarantor_phone}</span></InfoRow>}
            <InfoRow label="الحالة">{p.status_display}</InfoRow>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="card">
            <h2 className="border-b border-slate-100 px-4 py-3 font-extrabold">جدول الأقساط</h2>
            {p.dues?.map((d) => (
              <div key={d.id} className="list-row text-sm">
                <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 font-bold">{d.seq}</span>
                <span className="flex-1">{date(d.due_date)}</span>
                <Money value={d.amount} className="font-bold" />
                {d.state === 'partial' && <span className="text-xs text-slate-500">دُفع <Money value={d.paid_amount} /></span>}
                <Badge tone={stateUi[d.state].tone}>{stateUi[d.state].label}</Badge>
              </div>
            ))}
          </div>
          <div className="card">
            <h2 className="border-b border-slate-100 px-4 py-3 font-extrabold">الدفعات</h2>
            {!p.payments?.length ? <p className="p-4 text-sm text-slate-500">لا توجد دفعات بعد.</p> : p.payments.map((x) => (
              <div key={x.id} className="list-row text-sm">
                <span className="flex-1">{dateTime(x.created_at)} · {x.user}{x.note && ` · ${x.note}`}</span>
                <Money value={x.amount} className="font-bold text-emerald-600" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <PayModal plan={p} open={paying} onClose={() => setPaying(false)} />
    </div>
  )
}

function PayModal({ plan, open, onClose }: { plan: InstallmentPlan; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const suggested = Number(plan.overdue_amount) || Number(plan.next_due?.remaining) || 0
  const pay = useAction(() => api.post(`/installments/${plan.id}/pay/`, { amount: amount || suggested, note }), {
    invalidate: ['installments', 'cash'], success: 'تم تسجيل الدفعة', onSuccess: () => { setAmount(''); setNote(''); onClose() },
  })
  return (
    <Modal open={open} onClose={onClose} title="تسجيل دفعة قسط" footer={
      <button className="btn-primary flex-1" disabled={pay.isPending} onClick={() => pay.mutate(undefined)}>تأكيد</button>
    }>
      <div className="space-y-3">
        <Field label="المبلغ" hint="يُوزع تلقائياً على أقدم الأقساط غير المسددة">
          <input className="input text-lg font-bold" inputMode="decimal" autoFocus placeholder={String(suggested)} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="ملاحظة"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
