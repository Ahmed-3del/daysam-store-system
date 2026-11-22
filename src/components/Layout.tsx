import {
  ArrowLeftRight, BarChart3, Boxes, CalendarClock, ClipboardList, Clock, Cpu, Globe, HandCoins, Home, LogOut, Menu,
  CloudOff, PackageX, Receipt, RefreshCw, UserCog, Settings, ShieldCheck, ShoppingCart, Truck, Users, Vault, Wallet, Wrench, type LucideIcon,
} from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useOffline } from '../lib/offline'
import { useAuth } from '../lib/auth'

type Item = { to: string; label: string; icon: LucideIcon; manager?: boolean; section?: string; badge?: 'approvals' }

export const navGroups: { title: string; items: Item[] }[] = [
  { title: 'البيع والتشغيل', items: [
    { to: '/', label: 'الرئيسية', icon: Home },
    { to: '/pos', label: 'نقطة البيع', icon: ShoppingCart, section: 'pos' },
    { to: '/invoices', label: 'الفواتير والمرتجعات', icon: Receipt, section: 'pos' },
    { to: '/repairs', label: 'الصيانة', icon: Wrench, section: 'repairs' },
    { to: '/installments', label: 'الأقساط', icon: CalendarClock, section: 'installments' },
    { to: '/shifts', label: 'الورديات', icon: Clock },
    { to: '/offline-sales', label: 'مبيعات بدون إنترنت', icon: CloudOff, section: 'pos' },
    { to: '/approvals', label: 'طلبات الموافقة', icon: ShieldCheck, badge: 'approvals' },
  ] },
  { title: 'المحافظ والمخزون', items: [
    { to: '/wallets', label: 'المحافظ والماكينات', icon: Wallet, section: 'wallets' },
    { to: '/agents', label: 'المناديب', icon: UserCog, section: 'wallets' },
    { to: '/products', label: 'المنتجات والمخزون', icon: Boxes, section: 'inventory' },
    { to: '/purchases', label: 'التوريد', icon: Truck, section: 'inventory' },
    { to: '/supplier-returns', label: 'مرتجعات الموردين', icon: PackageX, section: 'inventory' },
    { to: '/used-devices', label: 'المستعمل والتبديل', icon: ArrowLeftRight, section: 'inventory' },
    { to: '/bundles', label: 'التجميعات والباقات', icon: Cpu, section: 'inventory' },
    { to: '/catalog-orders', label: 'المتجر الإلكتروني', icon: Globe, section: 'catalog' },
  ] },
  { title: 'الحسابات والإدارة', items: [
    { to: '/customers', label: 'العملاء', icon: Users, section: 'contacts' },
    { to: '/suppliers', label: 'الموردين', icon: Truck, section: 'contacts' },
    { to: '/expenses', label: 'المصروفات والمسحوبات', icon: HandCoins, section: 'expenses' },
    { to: '/cash', label: 'الخزينة', icon: Vault, section: 'cash' },
    { to: '/reports', label: 'التقارير', icon: BarChart3, manager: true },
    { to: '/audit', label: 'سجل الرقابة', icon: ClipboardList, manager: true },
    { to: '/settings', label: 'الإعدادات والفريق', icon: Settings },
  ] },
]

export function useNavItems() {
  const { can, isManager } = useAuth()
  return navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => (!i.manager || isManager) && can(i.section)) }))
    .filter((g) => g.items.length)
}

const bottom: Item[] = [
  { to: '/', label: 'الرئيسية', icon: Home },
  { to: '/pos', label: 'البيع', icon: ShoppingCart, section: 'pos' },
  { to: '/repairs', label: 'الصيانة', icon: Wrench, section: 'repairs' },
  { to: '/wallets', label: 'المحافظ', icon: Wallet, section: 'wallets' },
  { to: '/more', label: 'المزيد', icon: Menu },
]

export default function Layout() {
  const { shop, user, logout: doLogout, can, pendingApprovals, impersonatedBy, stopImpersonating, isManager } = useAuth()
  const daysLeft = shop?.days_left ?? null
  const { online, pending, syncing } = useOffline()
  const logout = () => {
    if (pending && !confirm(`يوجد ${pending} عملية بيع لم تتم مزامنتها وستُحذف من هذا الجهاز عند الخروج. هل تريد الخروج؟`)) return
    doLogout()
  }
  const groups = useNavItems()
  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <img src="/pwa-192.png" alt="" className="size-10 rounded-xl" />
          <div className="min-w-0">
            <div className="truncate font-extrabold">{shop?.name}</div>
            <div className="truncate text-xs text-slate-500">{user?.display_name}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="px-3 pb-1 text-xs font-bold text-slate-400">{g.title}</div>
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.to === '/'}
                  className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <i.icon size={19} /><span className="flex-1">{i.label}</span>
                  {i.badge === 'approvals' && pendingApprovals > 0 && <span className="chip bg-rose-600 text-white">{pendingApprovals}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <button onClick={logout} className="m-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50">
          <LogOut size={19} />تسجيل الخروج
        </button>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-4 sm:px-6 lg:pb-10 lg:pt-6">
        {impersonatedBy && (
          <div className="no-print mx-auto mb-3 flex max-w-6xl items-center gap-2 rounded-2xl bg-violet-700 px-3 py-2 text-sm font-bold text-white">
            <span className="flex-1">أنت داخل محل «{shop?.name}» كمدير للمنصة ({impersonatedBy}) — للدعم الفني</span>
            <button className="btn bg-white/15 px-3 py-1 text-white hover:bg-white/25" onClick={stopImpersonating}>رجوع للوحة المنصة</button>
          </div>
        )}
        {isManager && daysLeft !== null && daysLeft <= 7 && (
          <div className="no-print mx-auto mb-3 flex max-w-6xl items-center gap-2 rounded-2xl bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900">
            {daysLeft <= 0 ? 'اشتراكك ينتهي اليوم' : `اشتراكك ${shop?.plan === 'trial' ? '(التجربة المجانية) ' : ''}ينتهي خلال ${daysLeft} يوم`} — تواصل معنا للتجديد حتى لا يتوقف النظام.
          </div>
        )}
        {(!online || pending > 0) && (
          <Link to="/offline-sales" className={`no-print mx-auto mb-3 flex max-w-6xl items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold ${online ? 'bg-sky-50 text-sky-800' : 'bg-slate-800 text-white'}`}>
            {online ? <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> : <CloudOff size={16} />}
            <span className="flex-1">{online ? (syncing ? 'جاري مزامنة المبيعات...' : `${pending} عملية بيع بانتظار المزامنة`) : 'لا يوجد اتصال بالإنترنت — البيع مستمر وسيتم المزامنة تلقائياً'}</span>
            {pending > 0 && <span className="chip bg-amber-400 text-slate-900">{pending}</span>}
          </Link>
        )}
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>

      <nav className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="grid auto-cols-fr grid-flow-col">
          {bottom.filter((i) => can(i.section)).map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === '/'}
              className={({ isActive }) => `relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${isActive ? 'text-brand-700' : 'text-slate-500'}`}>
              <i.icon size={22} />{i.label}
              {i.to === '/more' && pendingApprovals > 0 && <span className="absolute end-[28%] top-1 size-2.5 rounded-full bg-rose-600" />}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
