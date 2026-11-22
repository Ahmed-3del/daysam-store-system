import { CalendarClock, MessageCircle, Plus } from 'lucide-react'
import { SmsButton } from '../components/Sms'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CustomerPicker } from '../components/pickers'
import { Badge, Empty, Fab, Field, Loading, Modal, Money, PageHeader, SearchBox, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { useAuth, useCurrency } from '../lib/auth'
import { date, money, todayISO, whatsappLink } from '../lib/format'
import { useAction, useDebounced, useGet, useList } from '../lib/hooks'
import type { Customer, InstallmentPlan } from '../lib/types'

interface Upcoming { id: number; plan: number; plan_number: number; customer_name: string; customer_phone: string; seq: number; due_date: string; remaining: number; state: string }

export default function Installments() {
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const cur = useCurrency()
  const { shop } = useAuth()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const tab = params.get('overdue') ? 'overdue' : params.get('tab') || 'upcoming'
  const { data: upcoming } = useGet<Upcoming[]>(['installments', 'upcoming'], tab === 'upcoming' ? '/installments/upcoming/' : null, { days: 7 })
  const { data, isLoading } = useList<InstallmentPlan>('installments', {
    search: useDebounced(q), overdue: tab === 'overdue' ? 1 : undefined,
    status: tab === 'active' ? 'active' : tab === 'completed' ? 'completed' : undefined,
  })

  return (
    <div className="space-y-3">
      <PageHeader title="الأقساط" />
      <Tabs value={tab} onChange={(v) => setParams(v === 'overdue' ? { overdue: '1' } : { tab: v })} options={[
        { value: 'upcoming', label: 'مستحق هذا الأسبوع' }, { value: 'overdue', label: 'متأخرات' },
        { value: 'active', label: 'جارية' }, { value: 'completed', label: 'مكتملة' }, { value: 'all', label: 'الكل' },
      ]} />
      {tab === 'upcoming' ? (
        !upcoming ? <Loading /> : !upcoming.length ? <Empty icon={<CalendarClock size={44} />} title="لا توجد أقساط مستحقة خلال 7 أيام" /> : (
          <div className="card">
            {upcoming.map((d) => (
              <div key={d.id} className="list-row">
                <Link to={`/installments/${d.plan}`} className="min-w-0 flex-1">
                  <div className="truncate font-bold">{d.customer_name}</div>
                  <div className="text-xs text-slate-500">قسط {d.seq} · خطة #{d.plan_number} · {date(d.due_date)}</div>
                </Link>
                <div className="text-end">
                  <Money value={d.remaining} className="block font-extrabold" />
                  {d.state === 'overdue' ? <Badge tone="red">متأخر</Badge> : <Badge tone="amber">قريب</Badge>}
                </div>
                {d.customer_phone && (
                  <a className="btn-ghost px-2 text-emerald-600" target="_blank" rel="noreferrer" aria-label="تذكير واتساب"
                    href={whatsappLink(d.customer_phone, `مرحباً ${d.customer_name}، نذكركم بموعد القسط رقم ${d.seq} بتاريخ ${date(d.due_date)} بقيمة ${money(d.remaining, cur)}. شكراً لكم.`)}>
                    <MessageCircle size={20} />
                  </a>
                )}
                <SmsButton to={d.customer_phone} kind="installment" className="btn-ghost px-2 text-brand-700" label=""
                  text={`${shop?.name ?? ''}: نذكركم بالقسط رقم ${d.seq} بتاريخ ${date(d.due_date)} بقيمة ${money(d.remaining, cur)}.`} />
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <SearchBox value={q} onChange={setQ} placeholder="اسم العميل أو رقم الخطة" />
          {isLoading ? <Loading /> : !data?.results.length ? <Empty icon={<CalendarClock size={44} />} title="لا توجد خطط" /> : (
            <div className="card">
              {data.results.map((p) => (
                <Link key={p.id} to={`/installments/${p.id}`} className="list-row hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{p.customer_name}</div>
                    <div className="truncate text-xs text-slate-500">#{p.number} · {p.title}</div>
                    {p.next_due && <div className="text-xs text-slate-500">القسط القادم {date(p.next_due.due_date)}</div>}
                  </div>
                  <div className="text-end">
                    <div className="text-[11px] text-slate-500">المتبقي</div>
                    <Money value={p.remaining} className="block font-extrabold" />
                    {Number(p.overdue_amount) > 0 && <Badge tone="red">متأخر <Money value={p.overdue_amount} /></Badge>}
                    {p.status === 'completed' && <Badge tone="green">مكتمل</Badge>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
      <Fab onClick={() => setAdding(true)} icon={<Plus size={20} />} label="خطة تقسيط" />
      <NewPlanModal open={adding} onClose={() => setAdding(false)} onCreated={(id) => nav(`/installments/${id}`)} />
    </div>
  )
}

function NewPlanModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [f, setF] = useState({ title: '', total_price: '', down_payment: '', months: '6', interest_rate: '0', start_date: '', guarantor_name: '', guarantor_phone: '', notes: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const financed = Math.max(0, (Number(f.total_price) || 0) - (Number(f.down_payment) || 0))
  const totalDue = financed * (1 + (Number(f.interest_rate) || 0) / 100)
  const save = useAction(() => api.post<InstallmentPlan>('/installments/', {
    ...f, customer: customer?.id, total_price: Number(f.total_price) || 0, down_payment: Number(f.down_payment) || 0,
    months: Number(f.months) || 1, interest_rate: Number(f.interest_rate) || 0, start_date: f.start_date || undefined,
  }), { invalidate: ['installments', 'cash'], success: 'تم إنشاء خطة التقسيط', onSuccess: (r) => { onClose(); onCreated(r.data.id) } })
  return (
    <Modal open={open} onClose={onClose} wide title="خطة تقسيط جديدة" footer={
      <button className="btn-primary flex-1" disabled={!customer || !f.title || !financed || save.isPending} onClick={() => save.mutate(undefined)}>إنشاء الخطة</button>
    }>
      <div className="space-y-3">
        <p className="rounded-xl bg-sky-50 p-3 text-xs text-sky-800">للبيع بالتقسيط من المخزن استخدم «نقطة البيع» واختر الدفع «تقسيط». هذا النموذج لخطط مستقلة (مثل أجهزة خارج المخزن أو مديونيات سابقة).</p>
        <CustomerPicker value={customer} onChange={setCustomer} required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="البيان" className="col-span-2"><input className="input" placeholder="مثال: iPhone 15 Pro" value={f.title} onChange={set('title')} /></Field>
          <Field label="السعر الإجمالي"><input className="input" inputMode="decimal" value={f.total_price} onChange={set('total_price')} /></Field>
          <Field label="المقدم"><input className="input" inputMode="decimal" value={f.down_payment} onChange={set('down_payment')} /></Field>
          <Field label="عدد الأشهر"><input className="input" inputMode="numeric" value={f.months} onChange={set('months')} /></Field>
          <Field label="الفائدة %"><input className="input" inputMode="decimal" value={f.interest_rate} onChange={set('interest_rate')} /></Field>
          <Field label="تاريخ أول قسط"><input className="input" type="date" min={todayISO()} value={f.start_date} onChange={set('start_date')} /></Field>
          <Field label="اسم الضامن"><input className="input" value={f.guarantor_name} onChange={set('guarantor_name')} /></Field>
          <Field label="موبايل الضامن"><input className="input" dir="ltr" value={f.guarantor_phone} onChange={set('guarantor_phone')} /></Field>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          إجمالي الأقساط <Money value={totalDue.toFixed(2)} className="font-extrabold" /> — القسط الشهري ≈ <Money value={(totalDue / Math.max(1, Number(f.months) || 1)).toFixed(2)} className="font-extrabold text-brand-700" />
        </div>
      </div>
    </Modal>
  )
}
