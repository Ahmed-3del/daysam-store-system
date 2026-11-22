import { ArrowLeftRight, ClipboardCheck, Pencil, Truck } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ContactSearchModal } from '../components/pickers'
import { Fab, Field, InfoRow, Loading, Modal, Money, PageHeader, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { TX_KINDS, WalletTxModal } from '../components/WalletTxModal'
import { useAction, useGet, useList } from '../lib/hooks'
import type { Supplier, Wallet, WalletTransaction } from '../lib/types'
import { TxRow, WalletFormModal } from './Wallets'

export default function WalletDetail() {
  const { id } = useParams()
  const [kind, setKind] = useState('')
  const [page, setPage] = useState(1)
  const [tx, setTx] = useState(false)
  const [edit, setEdit] = useState(false)
  const [agentTopup, setAgentTopup] = useState(false)
  const [counting, setCounting] = useState(false)
  const { data: w, isLoading } = useGet<Wallet>(['wallets', id], `/wallets/${id}/`)
  const { data: txs } = useList<WalletTransaction>('wallet-transactions', { wallet: id, kind: kind || undefined, page })
  if (isLoading || !w) return <Loading />

  return (
    <div className="space-y-4">
      <PageHeader back="/wallets" title={w.name} subtitle={w.provider_display} actions={<button className="btn-secondary px-3" onClick={() => setEdit(true)} aria-label="تعديل"><Pencil size={18} /></button>} />
      <div className="card grid gap-2 p-4 sm:grid-cols-2">
        <InfoRow label="الرصيد"><Money value={w.balance} className="text-lg font-extrabold" /></InfoRow>
        <InfoRow label="الرقم"><span dir="ltr">{w.phone_number || '—'}</span></InfoRow>
        <InfoRow label="المستخدم اليوم"><Money value={w.usage.today} /> {Number(w.daily_limit) > 0 && <>/ <Money value={w.daily_limit} /></>}</InfoRow>
        <InfoRow label="المستخدم هذا الشهر"><Money value={w.usage.month} /> {Number(w.monthly_limit) > 0 && <>/ <Money value={w.monthly_limit} /></>}</InfoRow>
        {Number(w.daily_limit) > 0 && <InfoRow label="المتبقي من الحد اليومي"><Money value={Math.max(0, Number(w.daily_limit) - Number(w.usage.today))} className="text-emerald-600" /></InfoRow>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={() => setAgentTopup(true)}><Truck size={18} />شحن رصيد من مندوب</button>
        <button className="btn-secondary" onClick={() => setCounting(true)}><ClipboardCheck size={18} />جرد الرصيد الفعلي</button>
      </div>
      <Tabs value={kind} onChange={(v) => { setKind(v); setPage(1) }} options={[{ value: '', label: 'الكل' },
        ...TX_KINDS.map((k) => ({ value: k.value as string, label: k.label })),
        { value: 'agent_topup', label: 'شحن مندوب' }, { value: 'adjust', label: 'جرد' }]} />
      <div className="card">
        {!txs?.results.length ? <p className="p-4 text-sm text-slate-500">لا توجد عمليات.</p> : txs.results.map((t) => <TxRow key={t.id} t={t} />)}
      </div>
      {txs && (txs.next || txs.previous) && (
        <div className="flex justify-center gap-2">
          <button className="btn-secondary" disabled={!txs.previous} onClick={() => setPage(page - 1)}>السابق</button>
          <button className="btn-secondary" disabled={!txs.next} onClick={() => setPage(page + 1)}>التالي</button>
        </div>
      )}
      <Fab onClick={() => setTx(true)} icon={<ArrowLeftRight size={20} />} label="عملية جديدة" />
      <WalletTxModal wallets={[w]} initialWallet={w.id} open={tx} onClose={() => setTx(false)} />
      {edit && <WalletFormModal open wallet={w} onClose={() => setEdit(false)} />}
      {agentTopup && <AgentTopupModal wallet={w} onClose={() => setAgentTopup(false)} />}
      {counting && <ReconcileModal wallet={w} onClose={() => setCounting(false)} />}
    </div>
  )
}

function AgentTopupModal({ wallet, onClose }: { wallet: Wallet; onClose: () => void }) {
  const [agent, setAgent] = useState<Supplier | null>(null)
  const [pick, setPick] = useState(false)
  const [f, setF] = useState({ amount: '', cost: '', paid_now: '', note: '' })
  const amount = Number(f.amount) || 0
  const cost = f.cost === '' ? amount : Number(f.cost) || 0
  const save = useAction(() => api.post(`/wallets/${wallet.id}/agent-topup/`, {
    agent: agent?.id, amount, cost, paid_now: Number(f.paid_now) || 0, note: f.note,
  }), { invalidate: ['wallets', 'wallet-transactions', 'suppliers', 'cash'], success: 'تم شحن الرصيد وتسجيله على المندوب', onSuccess: onClose })
  return (
    <Modal open onClose={onClose} title={`شحن رصيد ${wallet.name} من مندوب`} footer={
      <button className="btn-primary flex-1" disabled={!agent || !amount || save.isPending} onClick={() => save.mutate(undefined)}>تسجيل الشحن</button>
    }>
      <div className="space-y-3">
        <button type="button" className="btn-secondary w-full justify-start" onClick={() => setPick(true)}>
          <Truck size={18} />{agent ? `${agent.name}${Number(agent.balance) > 0 ? ` — مستحق له ${Number(agent.balance).toLocaleString('ar-EG')}` : ''}` : 'اختر المندوب'}
        </button>
        {agent && agent.kind !== 'agent' && <p className="text-xs text-rose-600">هذا مورد وليس مندوباً — عدّل نوعه إلى «مندوب» من صفحته.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="الرصيد المشحون"><input className="input text-lg font-bold" inputMode="decimal" autoFocus value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="المستحق للمندوب" hint="لو الرصيد بخصم"><input className="input" inputMode="decimal" placeholder={String(amount || '')} value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></Field>
          <Field label="مدفوع الآن نقداً"><input className="input" inputMode="decimal" placeholder="0" value={f.paid_now} onChange={(e) => setF({ ...f, paid_now: e.target.value })} /></Field>
          <Field label="ملاحظة"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        </div>
        {amount > 0 && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div>رصيد {wallet.name}: <b>+<Money value={amount} /></b></div>
            <div>على حساب المندوب: <b><Money value={cost - (Number(f.paid_now) || 0)} /></b>{amount > cost && <span className="text-emerald-700"> (خصم <Money value={amount - cost} />)</span>}</div>
          </div>
        )}
      </div>
      <ContactSearchModal kind="suppliers" open={pick} onClose={() => setPick(false)} onPick={(s) => { setAgent(s as Supplier); setPick(false) }} />
    </Modal>
  )
}

function ReconcileModal({ wallet, onClose }: { wallet: Wallet; onClose: () => void }) {
  const [actual, setActual] = useState('')
  const [note, setNote] = useState('')
  const diff = actual === '' ? 0 : Number(actual) - Number(wallet.balance)
  const save = useAction(() => api.post(`/wallets/${wallet.id}/reconcile/`, { actual_balance: Number(actual) || 0, note }), {
    invalidate: ['wallets', 'wallet-transactions'], success: diff === 0 ? 'الرصيد مطابق ✅' : 'تم تسجيل فرق الجرد', onSuccess: onClose,
  })
  return (
    <Modal open onClose={onClose} title={`جرد رصيد ${wallet.name}`} footer={
      <button className="btn-primary flex-1" disabled={actual === '' || save.isPending} onClick={() => save.mutate(undefined)}>حفظ الجرد</button>
    }>
      <div className="space-y-3">
        <InfoRow label="رصيد النظام"><Money value={wallet.balance} className="font-extrabold" /></InfoRow>
        <Field label="الرصيد الفعلي على المحفظة / الماكينة"><input className="input text-lg font-bold" inputMode="decimal" autoFocus value={actual} onChange={(e) => setActual(e.target.value)} /></Field>
        {actual !== '' && (
          <p className={`rounded-xl p-3 text-sm font-bold ${diff === 0 ? 'bg-emerald-50 text-emerald-700' : diff < 0 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
            {diff === 0 ? 'مطابق — لا يوجد فرق' : <>{diff < 0 ? 'عجز' : 'زيادة'} <Money value={Math.abs(diff)} /></>}
          </p>
        )}
        <Field label="ملاحظة"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
