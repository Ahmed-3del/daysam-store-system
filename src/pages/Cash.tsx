import { useState } from 'react'
import { Field, Loading, Modal, Money, PageHeader, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateTime, todayISO } from '../lib/format'
import { useAction, useGet, useList } from '../lib/hooks'
import { ArrowLeftRight } from 'lucide-react'
import type { CashBalance, CashEntry } from '../lib/types'

const KINDS = [
  ['', 'الكل'], ['sale', 'مبيعات'], ['repair', 'صيانة'], ['installment', 'أقساط'], ['wallet', 'محافظ'],
  ['expense', 'مصروفات'], ['withdrawal', 'مسحوبات'], ['purchase', 'توريد'], ['sale_return', 'مرتجعات'], ['transfer', 'تحويلات'],
]

export default function Cash() {
  const { isManager } = useAuth()
  const [kind, setKind] = useState('')
  const [day, setDay] = useState(todayISO())
  const [page, setPage] = useState(1)
  const [manual, setManual] = useState(false)
  const [moving, setMoving] = useState(false)
  const [drawer, setDrawer] = useState('')
  const { data: bal } = useGet<CashBalance>(['cash', 'balance'], '/cash/balance/')
  const multi = (bal?.drawers.length ?? 0) > 1
  const shown = drawer ? bal?.drawers.find((d) => String(d.id) === drawer)?.balance : bal?.balance
  const { data, isLoading } = useList<CashEntry>('cash', {
    drawer: drawer || undefined, kind: kind || undefined, created_at__date__gte: day || undefined, created_at__date__lte: day || undefined, page, page_size: 50,
  })
  const inSum = data?.results.filter((e) => Number(e.amount) > 0).reduce((s, e) => s + Number(e.amount), 0) ?? 0
  const outSum = data?.results.filter((e) => Number(e.amount) < 0).reduce((s, e) => s + Number(e.amount), 0) ?? 0

  return (
    <div className="space-y-3">
      <PageHeader title="الخزينة (حركة النقدية)" actions={isManager && (
        <>
          {multi && <button className="btn-secondary" onClick={() => setMoving(true)}><ArrowLeftRight size={18} />تحويل</button>}
          <button className="btn-secondary" onClick={() => setManual(true)}>إيداع / تسوية</button>
        </>
      )} />
      {multi && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button onClick={() => { setDrawer(''); setPage(1) }} className={`card p-3 text-start ${!drawer ? 'ring-2 ring-brand-600' : ''}`}>
            <div className="text-xs text-slate-500">كل الأدراج</div><Money value={bal?.balance} className="font-extrabold" />
          </button>
          {bal?.drawers.map((d) => (
            <button key={d.id} onClick={() => { setDrawer(String(d.id)); setPage(1) }} className={`card p-3 text-start ${drawer === String(d.id) ? 'ring-2 ring-brand-600' : ''}`}>
              <div className="truncate text-xs text-slate-500">{d.name}{d.id === bal.my_drawer && ' (درجي)'}</div><Money value={d.balance} className="font-extrabold" />
            </button>
          ))}
        </div>
      )}
      <div className="card grid grid-cols-3 divide-x divide-x-reverse divide-slate-100 text-center">
        <div className="p-3"><div className="text-xs text-slate-500">{drawer ? 'رصيد الدرج' : multi ? 'إجمالي الأدراج' : 'رصيد الدرج الحالي'}</div><Money value={shown} className="text-lg font-extrabold" /></div>
        <div className="p-3"><div className="text-xs text-slate-500">داخل (المعروض)</div><Money value={inSum} className="text-lg font-extrabold text-emerald-600" /></div>
        <div className="p-3"><div className="text-xs text-slate-500">خارج (المعروض)</div><Money value={-outSum} className="text-lg font-extrabold text-rose-600" /></div>
      </div>
      <div className="flex items-center gap-2">
        <input className="input w-auto" type="date" value={day} onChange={(e) => { setDay(e.target.value); setPage(1) }} />
        <button className="btn-ghost" onClick={() => { setDay(''); setPage(1) }}>كل الأيام</button>
      </div>
      <Tabs value={kind} onChange={(v) => { setKind(v); setPage(1) }} options={KINDS.map(([value, label]) => ({ value, label }))} />
      {isLoading ? <Loading /> : (
        <div className="card">
          {!data?.results.length ? <p className="p-6 text-center text-sm text-slate-500">لا توجد حركات.</p> : data.results.map((e) => (
            <div key={e.id} className="list-row text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{e.description || e.kind_display}</div>
                <div className="text-xs text-slate-500">{dateTime(e.created_at)} · {e.kind_display} · {e.user}{multi && !drawer && ` · ${e.drawer_name}`}</div>
              </div>
              <span className={`font-extrabold tabular-nums ${Number(e.amount) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} dir="ltr">
                {Number(e.amount) >= 0 ? '+' : '-'}<Money value={Math.abs(Number(e.amount))} />
              </span>
            </div>
          ))}
        </div>
      )}
      {data && (data.next || data.previous) && (
        <div className="flex justify-center gap-2">
          <button className="btn-secondary" disabled={!data.previous} onClick={() => setPage(page - 1)}>السابق</button>
          <button className="btn-secondary" disabled={!data.next} onClick={() => setPage(page + 1)}>التالي</button>
        </div>
      )}
      <ManualModal open={manual} onClose={() => setManual(false)} bal={bal} defaultDrawer={drawer} />
      {moving && bal && <TransferModal bal={bal} onClose={() => setMoving(false)} />}
    </div>
  )
}

function ManualModal({ open, onClose, bal, defaultDrawer }: { open: boolean; onClose: () => void; bal?: CashBalance; defaultDrawer: string }) {
  const [mode, setMode] = useState<'deposit' | 'count'>('deposit')
  const [drawerId, setDrawerId] = useState(defaultDrawer || String(bal?.my_drawer ?? ''))
  const current = Number(bal?.drawers.find((d) => String(d.id) === drawerId)?.balance ?? bal?.balance ?? 0)
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const value = mode === 'deposit' ? Number(amount) || 0 : (Number(amount) || 0) - current
  const save = useAction(() => api.post('/cash/manual/', {
    kind: mode === 'deposit' ? 'deposit' : 'adjustment', amount: value, drawer: drawerId ? Number(drawerId) : null,
    description: desc || (mode === 'deposit' ? 'إيداع في الدرج' : 'تسوية جرد الدرج'),
  }), { invalidate: ['cash'], success: 'تم التسجيل', onSuccess: () => { setAmount(''); setDesc(''); onClose() } })
  return (
    <Modal open={open} onClose={onClose} title="حركة يدوية على الخزينة" footer={
      <button className="btn-primary flex-1" disabled={amount === '' || !value || save.isPending} onClick={() => save.mutate(undefined)}>حفظ</button>
    }>
      <div className="space-y-3">
        <Tabs value={mode} onChange={setMode} options={[{ value: 'deposit', label: 'إيداع (رأس مال / فكة)' }, { value: 'count', label: 'جرد الدرج' }]} />
        {(bal?.drawers.length ?? 0) > 1 && (
          <Field label="الدرج">
            <select className="input" value={drawerId} onChange={(e) => setDrawerId(e.target.value)}>
              {bal!.drawers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        )}
        <Field label={mode === 'deposit' ? 'المبلغ' : 'النقدية الفعلية في الدرج'} hint={mode === 'count' && amount !== '' ? <>الفرق: <Money value={value} /></> : undefined}>
          <input className="input text-lg font-bold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="البيان"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function TransferModal({ bal, onClose }: { bal: CashBalance; onClose: () => void }) {
  const [source, setSource] = useState(String(bal.drawers.find((d) => !(d.id === bal.my_drawer))?.id ?? bal.drawers[0].id))
  const [target, setTarget] = useState(String(bal.my_drawer))
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const available = Number(bal.drawers.find((d) => String(d.id) === source)?.balance ?? 0)
  const save = useAction(() => api.post('/drawers/transfer/', { source: Number(source), target: Number(target), amount: Number(amount) || 0, note }), {
    invalidate: ['cash', 'drawers', 'shifts'], success: 'تم التحويل', onSuccess: onClose,
  })
  return (
    <Modal open onClose={onClose} title="تحويل نقدية بين الأدراج" footer={
      <button className="btn-primary flex-1" disabled={!Number(amount) || source === target || save.isPending} onClick={() => save.mutate(undefined)}>تحويل</button>
    }>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="من" hint={<>المتاح <Money value={available} /></>}>
            <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>{bal.drawers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          </Field>
          <Field label="إلى">
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>{bal.drawers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          </Field>
        </div>
        <Field label="المبلغ"><input className="input text-lg font-bold" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setAmount(String(available))}>تحويل كامل الرصيد</button>
        <Field label="ملاحظة"><input className="input" placeholder="مثال: تقفيل اليوم إلى الخزنة" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
