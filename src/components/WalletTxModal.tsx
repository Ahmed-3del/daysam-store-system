import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useApproval } from './approval'
import { useAuth } from '../lib/auth'
import { useAction } from '../lib/hooks'
import type { Wallet } from '../lib/types'
import { Field, Modal, Money, Tabs } from './ui'

export const TX_KINDS = [
  { value: 'send', label: 'إرسال', hint: 'العميل يدفع كاش ونحوّل له من المحفظة', walletSign: -1 },
  { value: 'receive', label: 'استقبال', hint: 'العميل يحوّل للمحفظة ونسلمه كاش', walletSign: 1 },
  { value: 'bill', label: 'دفع فاتورة', hint: 'كهرباء، إنترنت، شحن رصيد عبر المحفظة/الماكينة', walletSign: -1 },
  { value: 'topup', label: 'تغذية', hint: 'شحن رصيد المحفظة من درج الكاشير', walletSign: 1 },
  { value: 'withdraw', label: 'سحب للدرج', hint: 'سحب من المحفظة إلى الدرج', walletSign: -1 },
] as const
type Kind = (typeof TX_KINDS)[number]['value']

export function WalletTxModal({ wallets, initialWallet, open, onClose }: {
  wallets: Wallet[]; initialWallet?: number; open: boolean; onClose: () => void
}) {
  const { isManager } = useAuth()
  const [walletId, setWalletId] = useState<number | undefined>(initialWallet)
  const [kind, setKind] = useState<Kind>('send')
  const [f, setF] = useState({ amount: '', commission: '', counterparty: '', reference: '', note: '' })
  const [override, setOverride] = useState(false)
  useEffect(() => { if (open) setWalletId(initialWallet ?? wallets[0]?.id) }, [open, initialWallet, wallets])
  const wallet = wallets.find((w) => w.id === walletId)
  const amount = Number(f.amount) || 0
  const commission = ['topup', 'withdraw'].includes(kind) ? 0 : Number(f.commission) || 0
  const k = TX_KINDS.find((x) => x.value === kind)!
  const drawer = kind === 'receive' ? -(amount - commission) : kind === 'topup' ? -amount : amount + commission
  const limitWarn = wallet && ['send', 'receive'].includes(kind) && Number(wallet.daily_limit) > 0 && Number(wallet.usage.today) + amount > Number(wallet.daily_limit)

  const approval = useApproval()
  const save = useAction(() => approval.run((extra) => api.post('/wallet-transactions/', {
    wallet: walletId, kind, ...f, amount, commission, override_limit: override, ...extra,
  })), { invalidate: ['wallets', 'wallet-transactions', 'cash'], success: 'تم تسجيل العملية', onSuccess: () => { setF({ amount: '', commission: '', counterparty: '', reference: '', note: '' }); setOverride(false); onClose() } })

  return (
    <Modal open={open} onClose={onClose} title="عملية محفظة" footer={
      <button className="btn-primary flex-1" disabled={!walletId || !amount || save.isPending} onClick={() => save.mutate(undefined)}>تسجيل العملية</button>
    }>
      <div className="space-y-3">
        <Field label="المحفظة / الماكينة">
          <select className="input" value={walletId ?? ''} onChange={(e) => setWalletId(Number(e.target.value))}>
            {wallets.filter((w) => w.is_active).map((w) => <option key={w.id} value={w.id}>{w.name} — رصيد {Number(w.balance).toLocaleString('ar-EG')}</option>)}
          </select>
        </Field>
        <Tabs value={kind} onChange={setKind} options={TX_KINDS.map((x) => ({ value: x.value, label: x.label }))} />
        <p className="text-xs text-slate-500">{k.hint}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="المبلغ"><input className="input text-lg font-bold" inputMode="decimal" autoFocus value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          {!['topup', 'withdraw'].includes(kind) && <Field label="العمولة"><input className="input" inputMode="decimal" value={f.commission} onChange={(e) => setF({ ...f, commission: e.target.value })} /></Field>}
          <Field label="رقم العميل / الحساب"><input className="input" dir="ltr" inputMode="tel" value={f.counterparty} onChange={(e) => setF({ ...f, counterparty: e.target.value })} /></Field>
          <Field label="رقم العملية"><input className="input" dir="ltr" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
        </div>
        <Field label="ملاحظة"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        {amount > 0 && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div>المحفظة: <b dir="ltr">{k.walletSign > 0 ? '+' : '-'}<Money value={amount} /></b></div>
            <div>الدرج: <b dir="ltr">{drawer >= 0 ? '+' : '-'}<Money value={Math.abs(drawer)} /></b></div>
          </div>
        )}
        {limitWarn && (
          <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            هذه العملية تتجاوز الحد اليومي للمحفظة ({Number(wallet!.daily_limit).toLocaleString('ar-EG')}).
            {!isManager && <div className="mt-1 text-xs">سيُطلب الرقم السري للمدير أو موافقته عند التسجيل.</div>}
            {isManager && <label className="mt-2 flex items-center gap-2 font-bold"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />تجاوز الحد (مدير)</label>}
          </div>
        )}
      </div>
    </Modal>
  )
}
