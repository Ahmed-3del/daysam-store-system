import { Clock, LockOpen, Lock } from 'lucide-react'
import { useState } from 'react'
import { Badge, Empty, Field, InfoRow, Loading, Modal, Money, PageHeader, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateTime } from '../lib/format'
import { useAction, useGet, useList } from '../lib/hooks'
import type { CashBalance, CashDrawer, Shift } from '../lib/types'

export function ShiftReport({ shift }: { shift: Shift }) {
  const r = shift.report
  if (!r) return null
  return (
    <div className="space-y-1 text-sm">
      <InfoRow label="نقدية البداية (عد فعلي)"><Money value={shift.opening_cash} /></InfoRow>
      {r.by_kind.map((k) => (
        <InfoRow key={k.kind} label={k.label}>
          <Money value={k.total} className={Number(k.total) >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
        </InfoRow>
      ))}
      <div className="border-t border-dashed border-slate-200 pt-1">
        <InfoRow label="داخل الدرج"><Money value={r.cash_in} /></InfoRow>
        <InfoRow label="خارج الدرج"><Money value={r.cash_out} /></InfoRow>
        <InfoRow label="المتوقع في الدرج"><Money value={shift.expected_cash ?? r.expected_cash} className="text-base font-extrabold" /></InfoRow>
        {shift.counted_cash !== null && <InfoRow label="المعدود فعلياً"><Money value={shift.counted_cash} /></InfoRow>}
        {shift.difference !== null && Number(shift.difference) !== 0 && (
          <InfoRow label={Number(shift.difference) < 0 ? 'عجز' : 'زيادة'}>
            <Money value={shift.difference} className={`font-extrabold ${Number(shift.difference) < 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
          </InfoRow>
        )}
      </div>
    </div>
  )
}

export default function Shifts() {
  const { can } = useAuth()
  const { data: drawers } = useGet<CashDrawer[]>(['drawers'], '/drawers/')
  const { data: bal } = useGet<CashBalance>(['cash', 'balance'], '/cash/balance/')
  const [drawerId, setDrawerId] = useState('')
  const activeDrawer = drawerId || String(bal?.my_drawer ?? '')
  const { data: current, isLoading } = useGet<Shift | null>(['shifts', 'current', activeDrawer], '/shifts/current/',
    activeDrawer ? { drawer: activeDrawer } : undefined)
  const { data: history } = useList<Shift>('shifts')
  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState(false)
  const [view, setView] = useState<number | null>(null)
  if (isLoading) return <Loading />

  return (
    <div className="space-y-4">
      <PageHeader title="الورديات (استلام وتسليم الخزينة)" />
      {(drawers?.length ?? 0) > 1 && (
        <Tabs value={activeDrawer} onChange={setDrawerId} options={drawers!.map((d) => ({
          value: String(d.id), label: `${d.name}${d.open_shift ? ' 🟢' : ''}${d.id === bal?.my_drawer ? ' (درجي)' : ''}`,
        }))} />
      )}
      {current ? (
        <section className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 font-extrabold"><LockOpen size={18} className="text-emerald-600" />وردية #{current.number} مفتوحة{current.drawer_name && ` — ${current.drawer_name}`}</div>
              <div className="text-xs text-slate-500">منذ {dateTime(current.opened_at)} · {current.opened_by}</div>
            </div>
            <button className="btn-danger" onClick={() => setClosing(true)}><Lock size={18} />إغلاق وتسليم</button>
          </div>
          <ShiftReport shift={current} />
        </section>
      ) : (
        <Empty icon={<Clock size={44} />} title="لا توجد وردية مفتوحة">
          ابدأ الوردية بعد عد النقدية الموجودة في الدرج
          <button className="btn-primary mt-2" onClick={() => setOpening(true)}><LockOpen size={18} />فتح وردية</button>
        </Empty>
      )}

      {can('cash') && !!history?.results.length && (
        <section className="card">
          <h2 className="border-b border-slate-100 px-4 py-3 font-extrabold">سجل الورديات</h2>
          {history.results.map((s) => (
            <button key={s.id} className="list-row w-full text-start hover:bg-slate-50" onClick={() => setView(s.id)}>
              <div className="flex-1">
                <div className="font-bold">وردية #{s.number} <span className="font-normal text-slate-500">· {s.opened_by}{s.drawer_name && ` · ${s.drawer_name}`}</span></div>
                <div className="text-xs text-slate-500">{dateTime(s.opened_at)}{s.closed_at && ` ← ${dateTime(s.closed_at)}`}</div>
              </div>
              {s.status === 'open' ? <Badge tone="green">مفتوحة</Badge> :
                Number(s.difference) === 0 ? <Badge tone="gray">مطابقة</Badge> :
                  <Badge tone={Number(s.difference) < 0 ? 'red' : 'amber'}><Money value={s.difference} /></Badge>}
            </button>
          ))}
        </section>
      )}

      <OpenModal open={opening} onClose={() => setOpening(false)} drawerId={activeDrawer} bal={bal} />
      {current && <CloseModal shift={current} open={closing} onClose={() => setClosing(false)} />}
      {view && <ShiftView id={view} onClose={() => setView(null)} />}
    </div>
  )
}

function OpenModal({ open, onClose, drawerId, bal: all }: { open: boolean; onClose: () => void; drawerId: string; bal?: CashBalance }) {
  const [amount, setAmount] = useState('')
  const d = all?.drawers.find((x) => String(x.id) === drawerId)
  const bal = d ? { balance: d.balance } : all
  const save = useAction(() => api.post('/shifts/start/', { opening_cash: Number(amount) || 0, drawer: drawerId ? Number(drawerId) : null }), {
    invalidate: ['shifts', 'cash'], success: 'تم فتح الوردية', onSuccess: () => { setAmount(''); onClose() },
  })
  const diff = amount !== '' && bal ? Number(amount) - Number(bal.balance) : 0
  return (
    <Modal open={open} onClose={onClose} title={`فتح وردية جديدة${d ? ` — ${d.name}` : ''}`} footer={
      <button className="btn-primary flex-1" disabled={amount === '' || save.isPending} onClick={() => save.mutate(undefined)}>فتح الوردية</button>
    }>
      <Field label="النقدية الموجودة في الدرج الآن (بعد العد)" hint={bal && <>رصيد النظام: <Money value={bal.balance} />{diff !== 0 && <> — سيتم تسجيل فرق <Money value={diff} /></>}</>}>
        <input className="input text-lg font-bold" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
    </Modal>
  )
}

function CloseModal({ shift, open, onClose }: { shift: Shift; open: boolean; onClose: () => void }) {
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')
  const expected = Number(shift.report?.expected_cash ?? 0)
  const diff = counted === '' ? 0 : Number(counted) - expected
  const save = useAction(() => api.post(`/shifts/${shift.id}/close/`, { counted_cash: Number(counted) || 0, notes }), {
    invalidate: ['shifts', 'cash'], success: 'تم إغلاق الوردية', onSuccess: () => { setCounted(''); setNotes(''); onClose() },
  })
  return (
    <Modal open={open} onClose={onClose} title={`إغلاق وردية #${shift.number}`} footer={
      <button className="btn-danger flex-1" disabled={counted === '' || save.isPending} onClick={() => save.mutate(undefined)}>إغلاق الوردية</button>
    }>
      <div className="space-y-3">
        <InfoRow label="المتوقع في الدرج"><Money value={expected} className="text-lg font-extrabold" /></InfoRow>
        <Field label="النقدية المعدودة فعلياً">
          <input className="input text-lg font-bold" inputMode="decimal" autoFocus value={counted} onChange={(e) => setCounted(e.target.value)} />
        </Field>
        {counted !== '' && diff !== 0 && (
          <p className={`rounded-xl p-3 text-sm font-bold ${diff < 0 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
            {diff < 0 ? 'عجز' : 'زيادة'} <Money value={Math.abs(diff)} /> — سيتم تسجيله في الخزينة وسجل الوردية.
          </p>
        )}
        <Field label="ملاحظات التسليم"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function ShiftView({ id, onClose }: { id: number; onClose: () => void }) {
  const { data } = useGet<Shift>(['shifts', id], `/shifts/${id}/`)
  return (
    <Modal open onClose={onClose} title={`تقرير وردية #${data?.number ?? ''}`}>
      {!data ? <Loading /> : (
        <div className="space-y-3">
          <div className="text-xs text-slate-500">
            فتح: {dateTime(data.opened_at)} ({data.opened_by}){data.closed_at && <> · إغلاق: {dateTime(data.closed_at)} ({data.closed_by_name})</>}
          </div>
          <ShiftReport shift={data} />
          {data.notes && <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm">{data.notes}</p>}
        </div>
      )}
    </Modal>
  )
}
