import {
  AlertTriangle, Clock, ShieldCheck, CalendarClock, HandCoins, PackageMinus, Receipt, ShoppingCart, TrendingUp, Vault, Wallet, Wrench,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Loading, Money, StatCard } from '../components/ui'
import { useAuth } from '../lib/auth'
import { num } from '../lib/format'
import { useGet } from '../lib/hooks'
import type { PeriodSummary, Shift } from '../lib/types'

interface DashboardData {
  today: PeriodSummary; cash_balance: number; wallets_balance: number; open_repairs: number; ready_repairs: number
  overdue_installments: number; overdue_amount: number; customers_debt: number; suppliers_debt: number; agents_debt: number
  low_stock_count: number; low_stock: { id: number; name: string; quantity: number }[]
  sales_chart: { date: string; total: number }[]
}

const quick = [
  { to: '/pos', label: 'بيع جديد', icon: ShoppingCart, cls: 'bg-brand-700 text-white' },
  { to: '/repairs/new', label: 'استلام صيانة', icon: Wrench, cls: 'bg-amber-500 text-white' },
  { to: '/wallets', label: 'عملية محفظة', icon: Wallet, cls: 'bg-emerald-600 text-white' },
  { to: '/expenses', label: 'مصروف', icon: HandCoins, cls: 'bg-rose-500 text-white' },
]

export default function Dashboard() {
  const { shop, user, isManager, pendingApprovals } = useAuth()
  const nav = useNavigate()
  const { data, isLoading } = useGet<DashboardData>(['dashboard'], '/dashboard/')
  const { data: shift } = useGet<Shift | null>(['shifts', 'current'], '/shifts/current/')
  if (isLoading || !data) return <Loading />
  const t = data.today
  const max = Math.max(1, ...data.sales_chart.map((d) => Number(d.total)))

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm text-slate-500">أهلاً {user?.first_name || user?.username} 👋</div>
        <h1 className="text-2xl font-extrabold">{shop?.name}</h1>
      </div>

      {isManager && pendingApprovals > 0 && (
        <Link to="/approvals" className="flex items-center gap-2 rounded-2xl bg-amber-100 p-3 text-sm font-bold text-amber-900">
          <ShieldCheck size={20} />{pendingApprovals} طلب بانتظار موافقتك<span className="ms-auto">عرض</span>
        </Link>
      )}
      <Link to="/shifts" className={`flex items-center gap-2 rounded-2xl p-3 text-sm font-bold ${shift ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
        <Clock size={18} />{shift ? `وردية #${shift.number} مفتوحة — ${shift.opened_by}` : 'لا توجد وردية مفتوحة'}
        <span className="ms-auto">{shift ? 'التقرير / الإغلاق' : 'فتح وردية'}</span>
      </Link>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {quick.map((q) => (
          <Link key={q.to} to={q.to} className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center text-xs font-bold shadow-sm sm:text-sm ${q.cls}`}>
            <q.icon size={24} />{q.label}
          </Link>
        ))}
      </div>

      <section>
        <h2 className="mb-2 font-extrabold text-slate-700">اليوم</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="المبيعات" value={<Money value={t.net_sales} />} hint={`${num(t.sales_count)} فاتورة`} icon={<Receipt size={20} />} onClick={() => nav('/invoices')} />
          {isManager && <StatCard label="صافي الربح" value={<Money value={t.net_profit} />} hint="مبيعات + صيانة + عمولات − مصروفات" tone="green" icon={<TrendingUp size={20} />} onClick={() => nav('/reports')} />}
          <StatCard label="الخزينة (نقدي)" value={<Money value={data.cash_balance} />} tone="violet" icon={<Vault size={20} />} onClick={() => nav('/cash')} />
          <StatCard label="أرصدة المحافظ" value={<Money value={data.wallets_balance} />} hint={<>عمولات اليوم <Money value={t.wallet_commissions} /></>} tone="green" icon={<Wallet size={20} />} onClick={() => nav('/wallets')} />
          <StatCard label="صيانة مفتوحة" value={num(data.open_repairs)} hint={`${num(data.ready_repairs)} جاهز للتسليم`} tone="amber" icon={<Wrench size={20} />} onClick={() => nav('/repairs')} />
          <StatCard label="أقساط متأخرة" value={num(data.overdue_installments)} hint={<Money value={data.overdue_amount} />} tone="red" icon={<CalendarClock size={20} />} onClick={() => nav('/installments?overdue=1')} />
          <StatCard label="مستحق على العملاء" value={<Money value={data.customers_debt} />} tone="blue" icon={<AlertTriangle size={20} />} onClick={() => nav('/customers?debt=1')} />
          <StatCard label="مستحق للموردين" value={<Money value={data.suppliers_debt} />} tone="gray" icon={<HandCoins size={20} />} onClick={() => nav('/suppliers')} />
          <StatCard label="مستحق للمناديب" value={<Money value={data.agents_debt} />} tone="blue" icon={<Wallet size={20} />} onClick={() => nav('/agents')} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <h2 className="mb-4 font-extrabold">مبيعات آخر 7 أيام</h2>
          <div className="flex h-44 items-end gap-2">
            {data.sales_chart.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="text-[10px] font-bold text-slate-500 tabular-nums">{Number(d.total) ? num(d.total) : ''}</div>
                <div className="w-full rounded-t-lg bg-brand-500/85" style={{ height: `${(Number(d.total) / max) * 100}%`, minHeight: 3 }} />
                <div className="text-[11px] text-slate-500">{new Date(d.date).toLocaleDateString('ar-EG', { weekday: 'short' })}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-extrabold">نواقص المخزون</h2>
            <Link to="/products?low_stock=1" className="text-sm font-bold text-brand-700">الكل ({num(data.low_stock_count)})</Link>
          </div>
          {data.low_stock.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">لا توجد نواقص 👌</p>
          ) : data.low_stock.map((p) => (
            <Link key={p.id} to={`/products/${p.id}`} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
              <span className="flex items-center gap-2"><PackageMinus size={16} className="text-rose-500" />{p.name}</span>
              <span className="font-bold text-rose-600">{num(p.quantity)}</span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  )
}
