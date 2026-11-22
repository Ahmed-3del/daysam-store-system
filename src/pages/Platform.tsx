import {
  AlertTriangle, ArrowRight, Ban, MessageSquareText, CalendarPlus, CheckCircle2, KeyRound, LogIn, LogOut, Pencil, Plus, Store, Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useToast } from '../components/toast'
import { Badge, Empty, Field, InfoRow, Loading, Modal, Money, SearchBox, StatCard, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { date, dateTime, num, todayISO } from '../lib/format'
import { useAction, useDebounced, useGet, useList } from '../lib/hooks'
import { usePresets } from './Setup'
import { ShopSmsPanel } from './PlatformSms'

interface PUser { id: number; username: string; display_name: string; phone: string; role: string; role_display: string; is_active: boolean; last_login: string | null }
interface PShop {
  id: number; name: string; phone: string; address: string; status: 'active' | 'suspended'; status_display: string
  plan: string; plan_display: string; subscription_ends_at: string | null; days_left: number | null
  access_state: 'ok' | 'suspended' | 'expired'; suspended_reason: string; suspended_at: string | null
  platform_notes: string; owner: PUser | null; users_count: number; sales_30d: number; invoices_30d: number
  last_activity: string | null; created_at: string
  users?: PUser[]; history?: { description: string; created_at: string; user__username: string }[]
}
interface Stats {
  shops_total: number; active: number; suspended: number; expired: number; expiring_7d: number; trials: number
  users_total: number; new_shops_30d: number
}

export const PLANS = [
  { value: 'trial', label: 'تجربة مجانية' }, { value: 'monthly', label: 'شهري' }, { value: 'quarterly', label: '3 شهور' },
  { value: 'yearly', label: 'سنوي' }, { value: 'lifetime', label: 'مدى الحياة' },
]

function stateBadge(s: PShop) {
  if (s.access_state === 'suspended') return <Badge tone="red">موقوف</Badge>
  if (s.access_state === 'expired') return <Badge tone="gray">منتهي الاشتراك</Badge>
  if (s.days_left !== null && s.days_left <= 7) return <Badge tone="amber">ينتهي خلال {s.days_left} يوم</Badge>
  return <Badge tone="green">نشط</Badge>
}

export function PlatformLayout() {
  const { user, logout } = useAuth()
  return (
    <div className="min-h-screen">
      <header className="pt-safe sticky top-0 z-30 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <img src="/pwa-192.png" alt="" className="size-9 rounded-xl" />
          <Link to="/platform" className="flex-1">
            <div className="font-extrabold">لوحة إدارة المنصة</div>
            <div className="text-xs text-white/60">{user?.display_name} · مدير النظام</div>
          </Link>
          <Link to="/platform/sms" className="btn-ghost px-3 py-1.5 text-white/90 hover:bg-white/10"><MessageSquareText size={18} /><span className="hidden sm:inline">SMS</span></Link>
          <a href="/admin/" className="btn-ghost hidden px-3 py-1.5 text-white/80 hover:bg-white/10 sm:inline-flex">Django Admin</a>
          <button onClick={logout} className="btn-ghost px-3 py-1.5 text-rose-300 hover:bg-white/10"><LogOut size={18} /><span className="hidden sm:inline">خروج</span></button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-5"><Outlet /></main>
    </div>
  )
}

export function PlatformHome() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [state, setState] = useState('')
  const [adding, setAdding] = useState(false)
  const { data: stats } = useGet<Stats>(['platform', 'stats'], '/platform/stats/')
  const { data, isLoading } = useList<PShop>('platform/shops', { search: useDebounced(q), state: state || undefined })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">المحلات المشتركة</h1>
        <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={18} />محل جديد</button>
      </div>
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="إجمالي المحلات" value={num(stats.shops_total)} hint={`${num(stats.new_shops_30d)} جديد هذا الشهر`} icon={<Store size={20} />} onClick={() => setState('')} />
          <StatCard label="نشط" value={num(stats.active)} hint={`${num(stats.trials)} تجربة مجانية`} tone="green" icon={<CheckCircle2 size={20} />} onClick={() => setState('active')} />
          <StatCard label="ينتهي خلال 7 أيام" value={num(stats.expiring_7d)} hint={`${num(stats.expired)} منتهي`} tone="amber" icon={<AlertTriangle size={20} />} onClick={() => setState('expiring')} />
          <StatCard label="موقوف" value={num(stats.suspended)} hint={`${num(stats.users_total)} مستخدم على المنصة`} tone="red" icon={<Ban size={20} />} onClick={() => setState('suspended')} />
        </div>
      )}
      <SearchBox value={q} onChange={setQ} placeholder="اسم المحل، التليفون أو اسم مستخدم المالك" />
      <Tabs value={state} onChange={setState} options={[
        { value: '', label: 'الكل' }, { value: 'active', label: 'نشط' }, { value: 'expiring', label: 'ينتهي قريباً' },
        { value: 'expired', label: 'منتهي' }, { value: 'suspended', label: 'موقوف' },
      ]} />
      {isLoading ? <Loading /> : !data?.results.length ? <Empty icon={<Store size={44} />} title="لا توجد محلات" /> : (
        <div className="card">
          {data.results.map((s) => (
            <button key={s.id} className="list-row w-full text-start hover:bg-slate-50" onClick={() => nav(`/platform/shops/${s.id}`)}>
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-extrabold text-brand-700">{s.name.slice(0, 1)}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{s.name}</div>
                <div className="truncate text-xs text-slate-500">
                  {s.owner ? `${s.owner.display_name} (${s.owner.username})` : 'بدون مالك'} · {s.plan_display}
                  {s.subscription_ends_at && ` حتى ${date(s.subscription_ends_at)}`}
                </div>
                <div className="text-xs text-slate-400">{num(s.users_count)} مستخدم · {num(s.invoices_30d)} فاتورة/30 يوم{s.last_activity && ` · آخر نشاط ${dateTime(s.last_activity)}`}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {stateBadge(s)}
                <Money value={s.sales_30d} className="text-sm font-bold" />
              </div>
            </button>
          ))}
        </div>
      )}
      {adding && <NewShopModal onClose={() => setAdding(false)} onCreated={(id) => nav(`/platform/shops/${id}`)} />}
    </div>
  )
}

function NewShopModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [f, setF] = useState({ shop_name: '', shop_phone: '', address: '', owner_name: '', owner_phone: '', username: '', password: '', plan: 'monthly', subscription_ends_at: '', platform_notes: '', business_type: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const { data: presets } = usePresets()
  const save = useAction(() => api.post<PShop>('/platform/shops/', { ...f, subscription_ends_at: f.subscription_ends_at || null, business_type: f.business_type || null }), {
    invalidate: ['platformshops', 'platform'], success: 'تم إنشاء المحل وحساب المالك', onSuccess: (r) => { onClose(); onCreated(r.data.id) },
  })
  return (
    <Modal open onClose={onClose} wide title="إضافة محل جديد" footer={
      <button className="btn-primary flex-1" disabled={!f.shop_name || !f.owner_name || !f.username || f.password.length < 6 || save.isPending} onClick={() => save.mutate(undefined)}>إنشاء المحل</button>
    }>
      <div className="grid gap-3 sm:grid-cols-2">
        <h3 className="font-extrabold sm:col-span-2">بيانات المحل</h3>
        <Field label="اسم المحل"><input className="input" autoFocus value={f.shop_name} onChange={set('shop_name')} /></Field>
        <Field label="تليفون المحل"><input className="input" dir="ltr" value={f.shop_phone} onChange={set('shop_phone')} /></Field>
        <Field label="العنوان"><input className="input" value={f.address} onChange={set('address')} /></Field>
        <Field label="نوع النشاط" hint="اتركه لكي يختاره المالك عند أول دخول">
          <select className="input" value={f.business_type} onChange={set('business_type')}>
            <option value="">يختاره المالك</option>
            {presets?.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </Field>
        <h3 className="pt-2 font-extrabold sm:col-span-2">حساب المالك</h3>
        <Field label="اسم المالك"><input className="input" value={f.owner_name} onChange={set('owner_name')} /></Field>
        <Field label="موبايل المالك"><input className="input" dir="ltr" value={f.owner_phone} onChange={set('owner_phone')} /></Field>
        <Field label="اسم المستخدم (للدخول)"><input className="input" dir="ltr" autoComplete="off" value={f.username} onChange={set('username')} /></Field>
        <Field label="كلمة المرور" hint="6 أحرف على الأقل — أرسلها للمالك"><input className="input" dir="ltr" autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
        <h3 className="pt-2 font-extrabold sm:col-span-2">الاشتراك</h3>
        <Field label="الباقة"><select className="input" value={f.plan} onChange={set('plan')}>{PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></Field>
        <Field label="ينتهي في" hint="اتركه فارغاً للحساب تلقائياً حسب الباقة"><input className="input" type="date" min={todayISO()} value={f.subscription_ends_at} onChange={set('subscription_ends_at')} /></Field>
        <Field label="ملاحظات داخلية (لا يراها المحل)" className="sm:col-span-2"><textarea className="input" rows={2} value={f.platform_notes} onChange={set('platform_notes')} /></Field>
      </div>
    </Modal>
  )
}

export function PlatformShopDetail() {
  const { id } = useParams()
  const toast = useToast()
  const { impersonate } = useAuth()
  const nav = useNavigate()
  const { data: s, isLoading } = useGet<PShop>(['platformshops', id], `/platform/shops/${id}/`)
  const [modal, setModal] = useState<'renew' | 'edit' | 'password' | null>(null)
  const inv = ['platformshops', 'platform']
  const suspend = useAction((reason: string) => api.post(`/platform/shops/${id}/suspend/`, { reason }), { invalidate: inv, success: 'تم إيقاف المحل' })
  const activate = useAction(() => api.post(`/platform/shops/${id}/activate/`), { invalidate: inv, success: 'تم تفعيل المحل' })
  const enter = async () => {
    try {
      const { data } = await api.post(`/platform/shops/${id}/impersonate/`)
      await impersonate(data)
      nav('/', { replace: true })
    } catch (e) { toast.error(e) }
  }
  if (isLoading || !s) return <Loading />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/platform" className="btn-ghost -ms-2 px-2" aria-label="رجوع"><ArrowRight size={22} /></Link>
        <h1 className="flex-1 truncate text-xl font-extrabold">{s.name}</h1>
        {stateBadge(s)}
      </div>
      {s.access_state === 'suspended' && (
        <div className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">
          موقوف منذ {dateTime(s.suspended_at)}{s.suspended_reason && ` — السبب: ${s.suspended_reason}`}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => setModal('renew')}><CalendarPlus size={18} />تجديد / تغيير الباقة</button>
        {s.status === 'active'
          ? <button className="btn-danger" onClick={() => { const r = prompt('سبب الإيقاف (يظهر لصاحب المحل)', 'عدم السداد'); if (r !== null) suspend.mutate(r) }}><Ban size={18} />إيقاف المحل</button>
          : <button className="btn-success" onClick={() => activate.mutate(undefined)}><CheckCircle2 size={18} />إعادة التفعيل</button>}
        <button className="btn-secondary" onClick={enter} disabled={!s.owner}><LogIn size={18} />دخول كمالك (دعم فني)</button>
        <button className="btn-secondary" onClick={() => setModal('password')}><KeyRound size={18} />تغيير كلمة مرور</button>
        <button className="btn-ghost" onClick={() => setModal('edit')}><Pencil size={18} />تعديل</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4">
          <h2 className="mb-2 font-extrabold">الاشتراك</h2>
          <InfoRow label="الباقة">{s.plan_display}</InfoRow>
          <InfoRow label="ينتهي في">{s.subscription_ends_at ? date(s.subscription_ends_at) : 'بدون انتهاء'}</InfoRow>
          {s.days_left !== null && <InfoRow label="المتبقي">{s.days_left >= 0 ? `${num(s.days_left)} يوم` : `منتهي منذ ${num(-s.days_left)} يوم`}</InfoRow>}
          <InfoRow label="تاريخ التسجيل">{date(s.created_at)}</InfoRow>
          <h2 className="mb-2 mt-4 font-extrabold">النشاط</h2>
          <InfoRow label="مبيعات آخر 30 يوم"><Money value={s.sales_30d} /></InfoRow>
          <InfoRow label="فواتير آخر 30 يوم">{num(s.invoices_30d)}</InfoRow>
          <InfoRow label="آخر نشاط">{s.last_activity ? dateTime(s.last_activity) : '—'}</InfoRow>
          <InfoRow label="التليفون"><span dir="ltr">{s.phone || '—'}</span></InfoRow>
          {s.address && <InfoRow label="العنوان">{s.address}</InfoRow>}
          {s.platform_notes && <p className="mt-3 whitespace-pre-line rounded-xl bg-amber-50 p-3 text-sm">{s.platform_notes}</p>}
        </section>
        <section className="card lg:col-span-2">
          <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 font-extrabold"><Users size={18} />المستخدمون ({num(s.users?.length ?? 0)})</h2>
          {s.users?.map((u) => (
            <div key={u.id} className="list-row text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-bold">{u.display_name} <span className="font-normal text-slate-500" dir="ltr">({u.username})</span></div>
                <div className="text-xs text-slate-500">آخر دخول: {u.last_login ? dateTime(u.last_login) : 'لم يدخل بعد'}{u.phone && ` · ${u.phone}`}</div>
              </div>
              {!u.is_active && <Badge tone="red">موقوف</Badge>}
              <Badge tone={u.role === 'owner' ? 'brand' : 'gray'}>{u.role_display}</Badge>
            </div>
          ))}
          <h2 className="border-y border-slate-100 px-4 py-3 font-extrabold">سجل إجراءات المنصة</h2>
          {!s.history?.length ? <p className="p-4 text-sm text-slate-500">لا توجد إجراءات.</p> : s.history.map((h, i) => (
            <div key={i} className="list-row text-sm">
              <span className="flex-1">{h.description.replace('[المنصة] ', '')}</span>
              <span className="text-xs text-slate-500">{h.user__username} · {dateTime(h.created_at)}</span>
            </div>
          ))}
        </section>
      </div>
      <ShopSmsPanel shopId={s.id} />
      {modal === 'renew' && <RenewModal shop={s} onClose={() => setModal(null)} />}
      {modal === 'edit' && <EditShopModal shop={s} onClose={() => setModal(null)} />}
      {modal === 'password' && <PasswordModal shop={s} onClose={() => setModal(null)} />}
    </div>
  )
}

function RenewModal({ shop, onClose }: { shop: PShop; onClose: () => void }) {
  const [plan, setPlan] = useState(shop.plan === 'trial' ? 'monthly' : shop.plan)
  const [until, setUntil] = useState('')
  const save = useAction(() => api.post(`/platform/shops/${shop.id}/renew/`, { plan, until: until || null }), {
    invalidate: ['platformshops', 'platform'], success: 'تم تجديد الاشتراك', onSuccess: onClose,
  })
  return (
    <Modal open onClose={onClose} title="تجديد الاشتراك" footer={<button className="btn-primary flex-1" disabled={save.isPending} onClick={() => save.mutate(undefined)}>تجديد</button>}>
      <div className="space-y-3">
        <Field label="الباقة"><select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>{PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></Field>
        <Field label="تاريخ انتهاء مخصص (اختياري)" hint="بدونه: تُضاف مدة الباقة من تاريخ الانتهاء الحالي أو من اليوم أيهما أبعد">
          <input className="input" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </Field>
        {shop.status === 'suspended' && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">المحل موقوف — التجديد لا يلغي الإيقاف. اضغط «إعادة التفعيل» بعد التجديد.</p>}
      </div>
    </Modal>
  )
}

function EditShopModal({ shop, onClose }: { shop: PShop; onClose: () => void }) {
  const [f, setF] = useState({ name: shop.name, phone: shop.phone, address: shop.address, platform_notes: shop.platform_notes })
  const save = useAction(() => api.patch(`/platform/shops/${shop.id}/`, f), { invalidate: ['platformshops'], success: 'تم الحفظ', onSuccess: onClose })
  return (
    <Modal open onClose={onClose} title="تعديل بيانات المحل" footer={<button className="btn-primary flex-1" disabled={save.isPending} onClick={() => save.mutate(undefined)}>حفظ</button>}>
      <div className="space-y-3">
        <Field label="اسم المحل"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="التليفون"><input className="input" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="العنوان"><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <Field label="ملاحظات داخلية"><textarea className="input" rows={3} value={f.platform_notes} onChange={(e) => setF({ ...f, platform_notes: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

function PasswordModal({ shop, onClose }: { shop: PShop; onClose: () => void }) {
  const [user, setUser] = useState(String(shop.owner?.id ?? ''))
  const [password, setPassword] = useState('')
  const save = useAction(() => api.post(`/platform/shops/${shop.id}/reset-password/`, { user: Number(user) || null, password }), {
    success: 'تم تغيير كلمة المرور', onSuccess: onClose,
  })
  return (
    <Modal open onClose={onClose} title="تغيير كلمة مرور مستخدم" footer={<button className="btn-primary flex-1" disabled={password.length < 6 || save.isPending} onClick={() => save.mutate(undefined)}>حفظ</button>}>
      <div className="space-y-3">
        <Field label="المستخدم">
          <select className="input" value={user} onChange={(e) => setUser(e.target.value)}>
            {shop.users?.map((u) => <option key={u.id} value={u.id}>{u.display_name} ({u.username}) — {u.role_display}</option>)}
          </select>
        </Field>
        <Field label="كلمة المرور الجديدة"><input className="input" dir="ltr" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

/** Shown to a shop's users when the platform suspended the shop or its subscription expired. */
export function BlockedScreen() {
  const { blocked, shop, logout, impersonatedBy, stopImpersonating } = useAuth()
  const expired = blocked?.code === 'subscription_expired'
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="card max-w-md space-y-4 p-6 text-center">
        <div className={`mx-auto flex size-16 items-center justify-center rounded-full ${expired ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
          {expired ? <CalendarPlus size={32} /> : <Ban size={32} />}
        </div>
        <h1 className="text-xl font-extrabold">{expired ? 'انتهى الاشتراك' : 'تم إيقاف الحساب'}</h1>
        <div className="font-bold text-slate-700">{shop?.name}</div>
        <p className="text-slate-600">{blocked?.detail}</p>
        <p className="text-sm text-slate-500">بياناتك محفوظة بالكامل وتعود فور {expired ? 'تجديد الاشتراك' : 'إعادة التفعيل'}.</p>
        {impersonatedBy
          ? <button className="btn-primary w-full" onClick={stopImpersonating}>رجوع للوحة المنصة</button>
          : <button className="btn-secondary w-full" onClick={logout}><LogOut size={18} />تسجيل الخروج</button>}
      </div>
    </div>
  )
}
