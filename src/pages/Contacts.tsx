import { Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Empty, Fab, Field, Loading, Modal, Money, PageHeader, SearchBox, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { useAction, useDebounced, useList } from '../lib/hooks'
import type { Customer, Supplier } from '../lib/types'

function ContactList({ kind, agents }: { kind: 'customers' | 'suppliers'; agents?: boolean }) {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const debt = params.get('debt') === '1'
  const { data, isLoading } = useList<Customer | Supplier>(kind, {
    search: useDebounced(q), balance__gt: debt ? 0 : undefined, ordering: debt ? '-balance' : 'name',
    kind: kind === 'suppliers' ? (agents ? 'agent' : 'supplier') : undefined,
  })
  const isCust = kind === 'customers'
  return (
    <div className="space-y-3">
      <PageHeader title={isCust ? 'العملاء' : agents ? 'المناديب (شحن وماكينات)' : 'الموردين'}
        subtitle={agents ? 'مناديب الشحن والتحصيل لماكينات الدفع والمحافظ: الرصيد المشحون آجل وتسديده' : undefined} />
      <SearchBox value={q} onChange={setQ} placeholder="الاسم أو رقم الموبايل" />
      <Tabs value={debt ? '1' : ''} onChange={(v) => setParams(v ? { debt: v } : {})} options={[
        { value: '', label: 'الكل' }, { value: '1', label: isCust ? 'عليهم مستحقات' : 'لهم مستحقات' },
      ]} />
      {isLoading ? <Loading /> : !data?.results.length ? <Empty icon={<Users size={44} />} title="لا توجد نتائج" /> : (
        <div className="card">
          {data.results.map((c) => (
            <Link key={c.id} to={`/${kind}/${c.id}`} className="list-row hover:bg-slate-50">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 font-extrabold text-brand-700">{c.name.slice(0, 1)}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{c.name}</div>
                <div className="text-xs text-slate-500" dir="ltr">{c.phone}</div>
              </div>
              {(c as Supplier).kind === 'agent' && !agents && <span className="chip bg-sky-100 text-sky-700">مندوب</span>}
              {Number(c.balance) !== 0 && (
                <div className="text-end">
                  <div className="text-[11px] text-slate-500">{Number(c.balance) > 0 ? (isCust ? 'عليه' : 'له') : (isCust ? 'له' : 'عليه')}</div>
                  <Money value={Math.abs(Number(c.balance))} className={`font-extrabold ${Number(c.balance) > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
      <Fab onClick={() => setAdding(true)} icon={<Plus size={20} />} label={isCust ? 'عميل جديد' : agents ? 'مندوب جديد' : 'مورد جديد'} />
      <ContactFormModal kind={kind} open={adding} onClose={() => setAdding(false)} agent={agents} />
    </div>
  )
}

export function ContactFormModal({ kind, open, onClose, initial, agent }: {
  kind: 'customers' | 'suppliers'; open: boolean; onClose: () => void; initial?: Customer | Supplier; agent?: boolean
}) {
  const [f, setF] = useState<Record<string, string>>(() => ({
    name: initial?.name || '', phone: initial?.phone || '', address: initial?.address || '', notes: initial?.notes || '',
    national_id: (initial as Customer)?.national_id || '', company: (initial as Supplier)?.company || '',
    ...(kind === 'suppliers' ? { kind: (initial as Supplier)?.kind || (agent ? 'agent' : 'supplier') } : {}),
  }))
  const save = useAction(
    () => (initial ? api.patch(`/${kind}/${initial.id}/`, f) : api.post(`/${kind}/`, f)),
    { invalidate: [kind], success: 'تم الحفظ', onSuccess: () => { if (!initial) setF({}); onClose() } },
  )
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'تعديل البيانات' : kind === 'customers' ? 'عميل جديد' : 'مورد جديد'}
      footer={<button className="btn-primary flex-1" disabled={!f.name || save.isPending} onClick={() => save.mutate(undefined)}>حفظ</button>}>
      <div className="space-y-3">
        <Field label="الاسم"><input className="input" autoFocus value={f.name || ''} onChange={set('name')} /></Field>
        <Field label="الموبايل"><input className="input" dir="ltr" inputMode="tel" value={f.phone || ''} onChange={set('phone')} /></Field>
        {kind === 'customers'
          ? <Field label="الرقم القومي"><input className="input" dir="ltr" inputMode="numeric" value={f.national_id || ''} onChange={set('national_id')} /></Field>
          : <>
            <Field label={f.kind === 'agent' ? 'الشركة (فوري، أمان، فودافون...)' : 'الشركة'}><input className="input" value={f.company || ''} onChange={set('company')} /></Field>
            <Field label="النوع">
              <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                <option value="supplier">مورد بضاعة</option>
                <option value="agent">مندوب شحن / ماكينات</option>
              </select>
            </Field>
          </>}
        <Field label="العنوان"><input className="input" value={f.address || ''} onChange={set('address')} /></Field>
        <Field label="ملاحظات"><input className="input" value={f.notes || ''} onChange={set('notes')} /></Field>
      </div>
    </Modal>
  )
}

export const Customers = () => <ContactList kind="customers" />
export const Suppliers = () => <ContactList kind="suppliers" />
export const Agents = () => <ContactList kind="suppliers" agents />
