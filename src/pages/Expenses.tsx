import { HandCoins, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Badge, Empty, Fab, Field, Loading, Modal, Money, PageHeader, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { useAuth, useShopConfig } from '../lib/auth'
import { date, todayISO } from '../lib/format'
import { useAction, useGet, useList } from '../lib/hooks'
import type { Expense } from '../lib/types'


export default function Expenses() {
  const { isManager } = useAuth()
  const [kind, setKind] = useState('')
  const [adding, setAdding] = useState(false)
  const { data, isLoading } = useList<Expense>('expenses', { kind: kind || undefined })
  const del = useAction((id: number) => api.delete(`/expenses/${id}/`), { invalidate: ['expenses', 'cash'], success: 'تم الحذف' })
  const total = data?.results.reduce((s, e) => s + Number(e.amount), 0) ?? 0

  return (
    <div className="space-y-3">
      <PageHeader title="المصروفات والمسحوبات" />
      <Tabs value={kind} onChange={setKind} options={[{ value: '', label: 'الكل' }, { value: 'expense', label: 'مصروفات' }, { value: 'withdrawal', label: 'مسحوبات شخصية' }]} />
      {isLoading ? <Loading /> : !data?.results.length ? <Empty icon={<HandCoins size={44} />} title="لا توجد مصروفات" /> : (
        <div className="card">
          {data.results.map((e) => (
            <div key={e.id} className="list-row">
              <div className="min-w-0 flex-1">
                <div className="font-bold">{e.category} {e.kind === 'withdrawal' && <Badge tone="violet">مسحوبات</Badge>}</div>
                <div className="truncate text-xs text-slate-500">{date(e.date)} · {e.user}{e.note && ` · ${e.note}`}</div>
              </div>
              <Money value={e.amount} className="font-extrabold text-rose-600" />
              {isManager && <button className="btn-ghost px-1.5 text-slate-400" onClick={() => confirm('حذف المصروف وإرجاع المبلغ للخزينة؟') && del.mutate(e.id)} aria-label="حذف"><Trash2 size={16} /></button>}
            </div>
          ))}
          <div className="flex justify-between bg-slate-50 px-4 py-3 font-extrabold"><span>إجمالي الصفحة</span><Money value={total} /></div>
        </div>
      )}
      <Fab onClick={() => setAdding(true)} icon={<Plus size={20} />} label="مصروف جديد" />
      <ExpenseModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function ExpenseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: cats } = useGet<string[]>(['expenses', 'categories'], open ? '/expenses/categories/' : null)
  const [f, setF] = useState({ kind: 'expense', category: '', amount: '', date: todayISO(), note: '' })
  const save = useAction(() => api.post('/expenses/', f), {
    invalidate: ['expenses', 'cash'], success: 'تم تسجيل المصروف', onSuccess: () => { setF({ ...f, category: '', amount: '', note: '' }); onClose() },
  })
  const cfg = useShopConfig()
  const suggestions = [...new Set([...cfg.expense_categories, ...(cats || [])])]
  return (
    <Modal open={open} onClose={onClose} title="تسجيل مصروف" footer={
      <button className="btn-primary flex-1" disabled={!f.category || !Number(f.amount) || save.isPending} onClick={() => save.mutate(undefined)}>حفظ</button>
    }>
      <div className="space-y-3">
        <Tabs value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={[{ value: 'expense', label: 'مصروف تشغيل' }, { value: 'withdrawal', label: 'مسحوبات شخصية' }]} />
        <Field label="البند">
          <input className="input" list="exp-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          <datalist id="exp-cats">{suggestions.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 8).map((c) => <button key={c} type="button" className="chip bg-slate-100 px-2.5 py-1 text-slate-600" onClick={() => setF({ ...f, category: c })}>{c}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="المبلغ"><input className="input text-lg font-bold" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="التاريخ"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <Field label="ملاحظة"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
