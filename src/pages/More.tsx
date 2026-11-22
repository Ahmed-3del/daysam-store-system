import { ChevronLeft, LogOut } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNavItems } from '../components/Layout'
import { useAuth } from '../lib/auth'
import { useOffline } from '../lib/offline'

export default function More() {
  const { logout: doLogout, shop, user, pendingApprovals } = useAuth()
  const { pending } = useOffline()
  const logout = () => { if (!pending || confirm(`يوجد ${pending} عملية بيع لم تتم مزامنتها وستُحذف عند الخروج. هل تريد الخروج؟`)) doLogout() }
  const groups = useNavItems()
  return (
    <div className="space-y-5">
      <div className="card flex items-center gap-3 p-4">
        <img src="/pwa-192.png" alt="" className="size-12 rounded-xl" />
        <div>
          <div className="font-extrabold">{shop?.name}</div>
          <div className="text-sm text-slate-500">{user?.display_name}</div>
        </div>
      </div>
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="mb-2 px-1 text-sm font-bold text-slate-500">{g.title}</h2>
          <div className="card divide-y divide-slate-100">
            {g.items.filter((i) => i.to !== '/').map((i) => (
              <Link key={i.to} to={i.to} className="flex items-center gap-3 px-4 py-3.5 font-bold text-slate-700">
                <i.icon size={20} className="text-brand-700" />
                <span className="flex-1">{i.label}</span>
                {i.badge === 'approvals' && pendingApprovals > 0 && <span className="chip bg-rose-600 text-white">{pendingApprovals}</span>}
                <ChevronLeft size={18} className="text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
      ))}
      <button onClick={logout} className="btn w-full bg-rose-50 py-3 text-rose-600"><LogOut size={18} />تسجيل الخروج</button>
    </div>
  )
}
