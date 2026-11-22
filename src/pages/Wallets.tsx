import { ArrowLeftRight, Plus, Wallet as WalletIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, Fab, Field, Loading, Modal, Money, PageHeader } from '../components/ui'
import { WalletTxModal } from '../components/WalletTxModal'
import { api } from '../lib/api'
import { dateTime } from '../lib/format'
import { useAction, useGet, useList } from '../lib/hooks'
import type { Wallet, WalletTransaction } from '../lib/types'

export const PROVIDERS = [
  ['vodafone_cash', 'فودافون كاش'], ['etisalat_cash', 'اتصالات كاش (e&)'], ['orange_cash', 'أورنج كاش'], ['we_pay', 'WE Pay'],
  ['instapay', 'إنستا باي'], ['fawry', 'ماكينة فوري'], ['aman', 'ماكينة أمان'], ['masary', 'ماكينة مصاري'], ['other', 'أخرى'],
]
const providerColor: Record<string, string> = {
  vodafone_cash: 'from-red-500 to-red-700', etisalat_cash: 'from-lime-500 to-green-700', orange_cash: 'from-orange-400 to-orange-600',
  we_pay: 'from-purple-500 to-purple-700', instapay: 'from-fuchsia-500 to-purple-700', fawry: 'from-sky-500 to-blue-700',
  aman: 'from-emerald-500 to-teal-700', masary: 'from-amber-500 to-yellow-700', other: 'from-slate-500 to-slate-700',
}

export default function Wallets() {
  const { data: wallets, isLoading } = useGet<Wallet[]>(['wallets'], '/wallets/', { is_active: true })
  const { data: txs } = useList<WalletTransaction>('wallet-transactions', { page_size: 15 })
  const [tx, setTx] = useState(false)
  const [adding, setAdding] = useState(false)
  if (isLoading) return <Loading />

  return (
    <div className="space-y-4">
      <PageHeader title="المحافظ والماكينات" actions={<button className="btn-secondary" onClick={() => setAdding(true)}><Plus size={18} />محفظة</button>} />
      {!wallets?.length ? (
        <Empty icon={<WalletIcon size={44} />} title="لا توجد محافظ">
          أضف محافظ فودافون كاش أو ماكينات الدفع لمتابعة أرصدتها وعمولاتها
          <button className="btn-primary mt-2" onClick={() => setAdding(true)}>إضافة محفظة</button>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {wallets.map((w) => {
            const pct = Number(w.daily_limit) ? Math.min(100, (Number(w.usage.today) / Number(w.daily_limit)) * 100) : 0
            return (
              <Link key={w.id} to={`/wallets/${w.id}`} className={`rounded-2xl bg-gradient-to-br p-4 text-white shadow-sm ${providerColor[w.provider]}`}>
                <div className="flex items-center justify-between text-sm opacity-90"><span className="font-bold">{w.name}</span><span>{w.provider_display}</span></div>
                <div className="mt-3 text-2xl font-extrabold"><Money value={w.balance} /></div>
                <div className="text-xs opacity-80" dir="ltr">{w.phone_number}</div>
                {Number(w.daily_limit) > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] opacity-90"><span>المستخدم اليوم</span><span><Money value={w.usage.today} /> / <Money value={w.daily_limit} /></span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/25"><div className={`h-full ${pct > 85 ? 'bg-yellow-300' : 'bg-white'}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}

      <section className="card">
        <h2 className="border-b border-slate-100 px-4 py-3 font-extrabold">آخر العمليات</h2>
        {!txs?.results.length ? <p className="p-4 text-sm text-slate-500">لا توجد عمليات.</p> : txs.results.map((t) => <TxRow key={t.id} t={t} />)}
      </section>

      {!!wallets?.length && <Fab onClick={() => setTx(true)} icon={<ArrowLeftRight size={20} />} label="عملية جديدة" />}
      <WalletTxModal wallets={wallets || []} open={tx} onClose={() => setTx(false)} />
      <WalletFormModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

export function TxRow({ t }: { t: WalletTransaction }) {
  const inbound = ['receive', 'topup', 'agent_topup'].includes(t.kind) || (t.kind === 'adjust' && Number(t.amount) > 0)
  return (
    <div className="list-row text-sm">
      <div className="min-w-0 flex-1">
        <div className="font-bold">{t.kind_display} <span className="font-normal text-slate-500">· {t.wallet_name}</span></div>
        <div className="truncate text-xs text-slate-500">{dateTime(t.created_at)} · {t.user}{t.counterparty && ` · ${t.counterparty}`}{t.reference && ` · #${t.reference}`}</div>
      </div>
      <div className="text-end">
        <span className={`font-extrabold ${inbound ? 'text-emerald-600' : 'text-rose-600'}`} dir="ltr">{inbound ? '+' : '-'}<Money value={Math.abs(Number(t.amount))} /></span>
        {Number(t.commission) > 0 && <div className="text-xs text-emerald-700">عمولة <Money value={t.commission} /></div>}
        {t.kind === 'agent_topup' && t.cost != null && <div className="text-xs text-sky-700">آجل للمندوب <Money value={t.cost} /></div>}
      </div>
    </div>
  )
}

export function WalletFormModal({ open, onClose, wallet }: { open: boolean; onClose: () => void; wallet?: Wallet }) {
  const [f, setF] = useState({
    name: wallet?.name || '', provider: wallet?.provider || 'vodafone_cash', phone_number: wallet?.phone_number || '',
    balance: wallet ? String(wallet.balance) : '', daily_limit: wallet ? String(wallet.daily_limit) : '60000',
    monthly_limit: wallet ? String(wallet.monthly_limit) : '200000',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const body = { ...f, balance: Number(f.balance) || 0, daily_limit: Number(f.daily_limit) || 0, monthly_limit: Number(f.monthly_limit) || 0 }
  const save = useAction(() => (wallet ? api.patch(`/wallets/${wallet.id}/`, { ...body, balance: wallet.balance }) : api.post('/wallets/', body)), {
    invalidate: ['wallets'], success: 'تم الحفظ', onSuccess: onClose,
  })
  return (
    <Modal open={open} onClose={onClose} title={wallet ? 'تعديل المحفظة' : 'محفظة / ماكينة جديدة'} footer={
      <button className="btn-primary flex-1" disabled={!f.name || save.isPending} onClick={() => save.mutate(undefined)}>حفظ</button>
    }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="الاسم" className="col-span-2"><input className="input" placeholder="مثال: فودافون خط 1" value={f.name} onChange={set('name')} /></Field>
        <Field label="النوع"><select className="input" value={f.provider} onChange={set('provider')}>{PROVIDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="الرقم"><input className="input" dir="ltr" value={f.phone_number} onChange={set('phone_number')} /></Field>
        {!wallet && <Field label="الرصيد الحالي" className="col-span-2"><input className="input" inputMode="decimal" value={f.balance} onChange={set('balance')} /></Field>}
        <Field label="الحد اليومي" hint="0 = بدون حد"><input className="input" inputMode="decimal" value={f.daily_limit} onChange={set('daily_limit')} /></Field>
        <Field label="الحد الشهري"><input className="input" inputMode="decimal" value={f.monthly_limit} onChange={set('monthly_limit')} /></Field>
      </div>
    </Modal>
  )
}
