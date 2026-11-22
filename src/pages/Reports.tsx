import { useState } from 'react'
import { InfoRow, Loading, Money, PageHeader, Tabs } from '../components/ui'
import { num, todayISO } from '../lib/format'
import { useGet } from '../lib/hooks'
import type { PeriodSummary } from '../lib/types'

interface Report extends PeriodSummary {
  top_products: { product_id: number; name: string; qty: number; total: number }[]
  expenses_by_category: { category: string; total: number }[]
  payment_methods: { payment_method: string; total: number; count: number }[]
}

const PM: Record<string, string> = { cash: 'نقدي', card: 'فيزا', wallet: 'محفظة', credit: 'آجل', installment: 'تقسيط' }

function shift(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
function monthStart() { const t = todayISO(); return `${t.slice(0, 8)}01` }

export default function Reports() {
  const [preset, setPreset] = useState('today')
  const [range, setRange] = useState({ from: todayISO(), to: todayISO() })
  const choose = (p: string) => {
    setPreset(p)
    const to = todayISO()
    if (p === 'today') setRange({ from: to, to })
    if (p === 'yesterday') setRange({ from: shift(1), to: shift(1) })
    if (p === 'week') setRange({ from: shift(6), to })
    if (p === 'month') setRange({ from: monthStart(), to })
  }
  const { data: r, isLoading } = useGet<Report>(['reports', range], '/reports/', range)

  return (
    <div className="space-y-4">
      <PageHeader title="التقارير" />
      <Tabs value={preset} onChange={choose} options={[
        { value: 'today', label: 'اليوم' }, { value: 'yesterday', label: 'أمس' }, { value: 'week', label: '7 أيام' },
        { value: 'month', label: 'هذا الشهر' }, { value: 'custom', label: 'مخصص' },
      ]} />
      {preset === 'custom' && (
        <div className="flex gap-2">
          <input className="input" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <input className="input" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </div>
      )}
      {isLoading || !r ? <Loading /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card p-4">
            <h2 className="mb-2 font-extrabold">الأرباح والخسائر</h2>
            <InfoRow label={`المبيعات (${num(r.sales_count)} فاتورة)`}><Money value={r.sales_total} /></InfoRow>
            <InfoRow label="المرتجعات"><Money value={-Number(r.returns_total)} /></InfoRow>
            <InfoRow label="صافي المبيعات"><Money value={r.net_sales} /></InfoRow>
            <InfoRow label="ربح المبيعات"><Money value={r.sales_profit} className="text-emerald-600" /></InfoRow>
            <InfoRow label={`ربح الصيانة (${num(r.repairs_count)} جهاز)`}><Money value={r.repair_profit} className="text-emerald-600" /></InfoRow>
            <InfoRow label="عمولات المحافظ"><Money value={r.wallet_commissions} className="text-emerald-600" /></InfoRow>
            <InfoRow label="إجمالي الربح"><Money value={r.gross_profit} /></InfoRow>
            <InfoRow label="المصروفات"><Money value={-Number(r.expenses)} className="text-rose-600" /></InfoRow>
            <div className="mt-2 flex justify-between rounded-xl bg-emerald-50 px-3 py-3 text-lg font-extrabold">
              <span>صافي الربح</span><Money value={r.net_profit} className={Number(r.net_profit) < 0 ? 'text-rose-600' : 'text-emerald-700'} />
            </div>
            <div className="mt-3 border-t border-slate-100 pt-2">
              <InfoRow label="أقساط محصلة"><Money value={r.installments_collected} /></InfoRow>
              <InfoRow label="مسحوبات شخصية"><Money value={r.withdrawals} /></InfoRow>
            </div>
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-extrabold">الأكثر مبيعاً</h2>
            {!r.top_products.length ? <p className="text-sm text-slate-500">لا توجد مبيعات.</p> : r.top_products.map((p, i) => (
              <div key={p.product_id} className="flex items-center gap-3 border-b border-slate-100 py-2 text-sm last:border-0">
                <span className="flex size-6 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-xs text-slate-500">{num(p.qty)} قطعة</span>
                <Money value={p.total} className="font-bold" />
              </div>
            ))}
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-extrabold">طرق الدفع</h2>
            {r.payment_methods.map((m) => <InfoRow key={m.payment_method} label={`${PM[m.payment_method] || m.payment_method} (${num(m.count)})`}><Money value={m.total} /></InfoRow>)}
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-extrabold">المصروفات حسب البند</h2>
            {!r.expenses_by_category.length ? <p className="text-sm text-slate-500">لا توجد مصروفات.</p> :
              r.expenses_by_category.map((e) => <InfoRow key={e.category} label={e.category}><Money value={e.total} /></InfoRow>)}
          </section>
        </div>
      )}
    </div>
  )
}
