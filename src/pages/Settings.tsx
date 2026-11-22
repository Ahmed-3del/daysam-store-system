import { Download, ImagePlus, KeyRound, Plus, Printer, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { InvoiceReceipt } from '../components/InvoiceReceipt'
import { CustomizationCard } from './Setup'
import { SmsSettingsCard } from '../components/Sms'
import { Badge, Field, Modal, Money, PageHeader } from '../components/ui'
import { useToast } from '../components/toast'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useAction, useGet } from '../lib/hooks'
import { useInstallPrompt } from '../lib/pwa'
import type { CashDrawer, Invoice, Role, Shop, User } from '../lib/types'

const ROLES: { value: Role; label: string }[] = [
  { value: 'owner', label: 'مالك' }, { value: 'manager', label: 'مدير' },
  { value: 'cashier', label: 'كاشير' }, { value: 'technician', label: 'فني صيانة' },
]

export default function Settings() {
  const { shop, isManager, refresh } = useAuth()
  const toast = useToast()
  const install = useInstallPrompt()
  const [f, setF] = useState<Partial<Shop>>({})
  useEffect(() => { if (shop) setF(shop) }, [shop])
  const save = useAction(() => api.patch('/shop/', f), { success: 'تم حفظ الإعدادات', onSuccess: () => refresh() })
  const set = (k: keyof Shop) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  return (
    <div className="space-y-4">
      <PageHeader title="الإعدادات" />
      {install.canInstall && (
        <button className="btn-success w-full py-3" onClick={async () => { if (await install.prompt()) toast.ok('تم تثبيت التطبيق') }}>
          <Download size={18} />تثبيت التطبيق على الجهاز
        </button>
      )}
      <section className="card grid gap-3 p-4 sm:grid-cols-2">
        <h2 className="font-extrabold sm:col-span-2">بيانات المحل والفواتير</h2>
        <Field label="اسم المحل"><input className="input" disabled={!isManager} value={f.name || ''} onChange={set('name')} /></Field>
        <Field label="التليفون"><input className="input" dir="ltr" disabled={!isManager} value={f.phone || ''} onChange={set('phone')} /></Field>
        <Field label="العنوان"><input className="input" disabled={!isManager} value={f.address || ''} onChange={set('address')} /></Field>
        <Field label="العملة"><input className="input" disabled={!isManager} value={f.currency || ''} onChange={set('currency')} /></Field>
        <Field label="تذييل الفاتورة" className="sm:col-span-2"><textarea className="input" rows={2} disabled={!isManager} value={f.invoice_footer || ''} onChange={set('invoice_footer')} /></Field>
        <Field label="شروط إيصال الصيانة" className="sm:col-span-2"><textarea className="input" rows={2} disabled={!isManager} value={f.repair_terms || ''} onChange={set('repair_terms')} /></Field>
        {isManager && <button className="btn-primary sm:col-span-2" disabled={save.isPending} onClick={() => save.mutate(undefined)}>حفظ</button>}
      </section>
      {isManager && (
        <section className="card grid gap-3 p-4 sm:grid-cols-2">
          <h2 className="font-extrabold sm:col-span-2">الرقابة والصلاحيات</h2>
          <Field label="أقصى خصم يمنحه الكاشير بدون موافقة (%)">
            <input className="input" inputMode="decimal" value={f.max_discount_percent ?? ''} onChange={(e) => setF({ ...f, max_discount_percent: e.target.value as unknown as number })} />
          </Field>
          <div className="space-y-2 pt-6">
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="size-4" checked={!!f.approve_returns} onChange={(e) => setF({ ...f, approve_returns: e.target.checked })} />مرتجعات المبيعات تحتاج موافقة المدير</label>
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="size-4" checked={!!f.require_shift} onChange={(e) => setF({ ...f, require_shift: e.target.checked })} />البيع يتطلب وردية مفتوحة</label>
          </div>
          <button className="btn-primary sm:col-span-2" disabled={save.isPending} onClick={() => save.mutate(undefined)}>حفظ</button>
        </section>
      )}
      {isManager && (
        <section className="card grid gap-3 p-4 sm:grid-cols-2">
          <h2 className="font-extrabold sm:col-span-2">المتجر الإلكتروني (كتالوج رقمي)</h2>
          <label className="flex items-center gap-2 font-bold sm:col-span-2"><input type="checkbox" className="size-4" checked={!!f.catalog_enabled} onChange={(e) => setF({ ...f, catalog_enabled: e.target.checked })} />تفعيل المتجر الإلكتروني</label>
          <Field label="رابط المتجر" hint={f.catalog_slug && <span dir="ltr">{window.location.origin}/s/{f.catalog_slug}</span>}>
            <input className="input" dir="ltr" placeholder="my-shop" value={f.catalog_slug || ''} onChange={(e) => setF({ ...f, catalog_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
          </Field>
          <Field label="رقم واتساب الطلبات"><input className="input" dir="ltr" value={f.catalog_whatsapp || ''} onChange={set('catalog_whatsapp')} /></Field>
          <Field label="نبذة عن المحل" className="sm:col-span-2"><textarea className="input" rows={2} value={f.catalog_about || ''} onChange={set('catalog_about')} /></Field>
          <button className="btn-primary sm:col-span-2" disabled={save.isPending} onClick={() => save.mutate(undefined)}>حفظ</button>
        </section>
      )}
      {isManager && <SmsSettingsCard />}
      {isManager && <CustomizationCard />}
      {isManager && <ReceiptSettings f={f} setF={setF} onSave={() => save.mutate(undefined)} saving={save.isPending} />}
      {isManager && <DrawersCard />}
      {isManager && <PinCard />}
      {isManager && <Team />}
    </div>
  )
}

function PinCard() {
  const { user, refresh } = useAuth()
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const save = useAction(() => api.post('/auth/pin/', { password, pin }), {
    success: pin ? 'تم حفظ الرقم السري' : 'تم إلغاء الرقم السري', onSuccess: () => { setPassword(''); setPin(''); refresh() },
  })
  return (
    <section className="card space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-extrabold"><KeyRound size={18} />رقمي السري للموافقات {user?.has_pin && <Badge tone="green">مفعل</Badge>}</h2>
      <p className="text-sm text-slate-500">يكتبه المدير على جهاز الكاشير للموافقة الفورية على الخصومات الكبيرة والمرتجعات والإلغاء.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الرقم السري الجديد (4-8 أرقام، اتركه فارغاً للإلغاء)"><input className="input text-center tracking-widest" type="password" inputMode="numeric" maxLength={8} autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label="كلمة مرور حسابك للتأكيد"><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      </div>
      <button className="btn-primary" disabled={!password || (pin !== '' && pin.length < 4) || save.isPending} onClick={() => save.mutate(undefined)}>حفظ</button>
    </section>
  )
}

function Team() {
  const { user: me } = useAuth()
  const { data: users } = useGet<User[]>(['users'], '/users/')
  const [edit, setEdit] = useState<User | 'new' | null>(null)
  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="font-extrabold">فريق العمل والصلاحيات</h2>
        <button className="btn-secondary px-3 py-2" onClick={() => setEdit('new')}><Plus size={16} />موظف</button>
      </div>
      {users?.map((u) => (
        <button key={u.id} className="list-row w-full text-start hover:bg-slate-50" onClick={() => setEdit(u)}>
          <UserRound size={20} className="text-slate-400" />
          <div className="flex-1">
            <div className="font-bold">{u.display_name} {u.id === me?.id && <span className="text-xs text-slate-400">(أنت)</span>}</div>
            <div className="text-xs text-slate-500" dir="ltr">{u.username}</div>
          </div>
          {!u.is_active && <Badge tone="red">موقوف</Badge>}
          {u.allowed_sections?.length > 0 && u.role !== 'owner' && u.role !== 'manager' && <Badge tone="amber">{u.allowed_sections.length} أقسام</Badge>}
          <Badge tone="brand">{ROLES.find((r) => r.value === u.role)?.label}</Badge>
        </button>
      ))}
      <p className="px-4 pb-3 pt-1 text-xs text-slate-500">الكاشير والفني لا يرون الأرباح وأسعار الشراء، ولا يستطيعون البيع بأقل من الحد الأدنى أو حذف المصروفات أو تعديل الإعدادات.</p>
      {edit && <UserModal user={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </section>
  )
}

function UserModal({ user, onClose }: { user?: User; onClose: () => void }) {
  const [f, setF] = useState({
    first_name: user?.first_name || '', last_name: user?.last_name || '', username: user?.username || '',
    phone: user?.phone || '', role: user?.role || 'cashier', password: '', is_active: user?.is_active ?? true,
    allowed_sections: user?.allowed_sections || [] as string[],
    repair_commission_percent: String(user?.repair_commission_percent ?? 0),
    cash_drawer: user?.cash_drawer ? String(user.cash_drawer) : '',
  })
  const { sections } = useAuth()
  const limited = f.role === 'cashier' || f.role === 'technician'
  const { data: drawers } = useGet<CashDrawer[]>(['drawers'], '/drawers/')
  const save = useAction(() => {
    const body: Record<string, unknown> = { ...f, cash_drawer: f.cash_drawer ? Number(f.cash_drawer) : null }
    if (!f.password) delete body.password
    return user ? api.patch(`/users/${user.id}/`, body) : api.post('/users/', body)
  }, { invalidate: ['users'], success: 'تم الحفظ', onSuccess: onClose })
  return (
    <Modal open onClose={onClose} title={user ? 'تعديل موظف' : 'موظف جديد'} footer={
      <button className="btn-primary flex-1" disabled={!f.username || (!user && !f.password) || save.isPending} onClick={() => save.mutate(undefined)}>حفظ</button>
    }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="الاسم الأول"><input className="input" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></Field>
        <Field label="اسم العائلة"><input className="input" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></Field>
        <Field label="اسم المستخدم"><input className="input" dir="ltr" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
        <Field label="الموبايل"><input className="input" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="الصلاحية">
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
        </Field>
        <Field label={user ? 'كلمة مرور جديدة' : 'كلمة المرور'}><input className="input" dir="ltr" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        {user && <label className="col-span-2 flex items-center gap-2 font-bold"><input type="checkbox" className="size-4" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />الحساب مفعل</label>}
        {(drawers?.length ?? 0) > 1 && (
          <Field label="درج النقدية" hint="مبيعات ومدفوعات هذا الموظف تُسجل في هذا الدرج" className="col-span-2">
            <select className="input" value={f.cash_drawer} onChange={(e) => setF({ ...f, cash_drawer: e.target.value })}>
              <option value="">الدرج الافتراضي</option>
              {drawers!.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        )}
        {(f.role === 'technician' || Number(f.repair_commission_percent) > 0) && (
          <Field label="عمولة الفني من أجرة اليد %" className="col-span-2">
            <input className="input" inputMode="decimal" value={f.repair_commission_percent} onChange={(e) => setF({ ...f, repair_commission_percent: e.target.value })} />
          </Field>
        )}
        {limited && (
          <div className="col-span-2">
            <span className="label">الأقسام المسموح بها {!f.allowed_sections.length && <span className="font-normal text-slate-400">(لم يُحدد = كل الأقسام)</span>}</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(sections).map(([k, label]) => {
                const on = f.allowed_sections.includes(k)
                return (
                  <button key={k} type="button" onClick={() => setF({ ...f, allowed_sections: on ? f.allowed_sections.filter((x) => x !== k) : [...f.allowed_sections, k] })}
                    className={`chip px-3 py-1.5 text-sm ${on ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

const SAMPLE: Invoice = {
  id: 0, number: 1024, public_token: '00000000-0000-0000-0000-000000000000', customer: null, customer_name: 'أحمد محمد',
  customer_phone: '01012345678', subtotal: 15350, discount: 100, bundle_discount: 0, trade_in_value: 0, total: 15250, paid: 15250,
  remaining: 0, returned_total: 0, payment_method: 'cash', payment_method_display: 'نقدي', status: 'completed',
  status_display: 'مكتملة', notes: '', cashier: 'كريم', created_at: new Date().toISOString(),
  items: [
    { id: 1, product: 1, name: 'Samsung Galaxy A55', serial: 1, serial_number: '356789012345678', quantity: 1, returned_quantity: 0, unit_price: 15000, line_total: 15000, warranty_days: 365, bundle_name: '' },
    { id: 2, product: 2, name: 'جراب + اسكرينة', serial: null, serial_number: null, quantity: 1, returned_quantity: 0, unit_price: 350, line_total: 350, warranty_days: 0, bundle_name: '' },
  ],
}

function ReceiptSettings({ f, setF, onSave, saving }: { f: Partial<Shop>; setF: (s: Partial<Shop>) => void; onSave: () => void; saving: boolean }) {
  const { shop, refresh } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const upload = useAction((file: File) => { const fd = new FormData(); fd.append('logo', file); return api.post('/shop/logo/', fd) },
    { success: 'تم رفع الشعار', onSuccess: () => refresh() })
  const removeLogo = useAction(() => api.delete('/shop/logo/'), { onSuccess: () => refresh() })
  const preview = { ...(shop as Shop), ...f, logo: shop?.logo ?? null } as Shop
  return (
    <section className="card grid gap-4 p-4 lg:grid-cols-2">
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 font-extrabold"><Printer size={18} />تخصيص الفواتير والإيصالات</h2>
        <div className="flex items-center gap-3">
          <button type="button" className="flex size-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200" onClick={() => input.current?.click()} aria-label="الشعار">
            {shop?.logo ? <img src={shop.logo} alt="" className="max-h-full max-w-full object-contain" /> : <ImagePlus className="text-slate-400" />}
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary px-3 py-1.5" disabled={upload.isPending} onClick={() => input.current?.click()}>{shop?.logo ? 'تغيير الشعار' : 'رفع شعار المحل'}</button>
            {shop?.logo && <button type="button" className="btn-ghost px-2 py-1.5 text-rose-600" onClick={() => removeLogo.mutate(undefined)}>حذف</button>}
          </div>
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; if (x) upload.mutate(x); e.target.value = '' }} />
        </div>
        <Field label="مقاس ورق الطباعة">
          <select className="input" value={f.receipt_width || '80'} onChange={(e) => setF({ ...f, receipt_width: e.target.value as Shop['receipt_width'] })}>
            <option value="80">طابعة حرارية 80 مم (الأكثر استخداماً)</option>
            <option value="58">طابعة حرارية 58 مم (صغيرة / محمولة)</option>
            <option value="a4">ورق A4</option>
          </select>
        </Field>
        <Field label="سطر إضافي أعلى الفاتورة" hint="مثال: سجل تجاري 12345 — بطاقة ضريبية 678">
          <input className="input" value={f.receipt_header || ''} onChange={(e) => setF({ ...f, receipt_header: e.target.value })} />
        </Field>
        <div className="space-y-2">
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="size-4" checked={f.receipt_show_qr ?? true} onChange={(e) => setF({ ...f, receipt_show_qr: e.target.checked })} />QR لرابط الفاتورة الإلكترونية</label>
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="size-4" checked={f.receipt_show_cashier ?? true} onChange={(e) => setF({ ...f, receipt_show_cashier: e.target.checked })} />اسم الكاشير</label>
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="size-4" checked={f.receipt_show_warranty ?? true} onChange={(e) => setF({ ...f, receipt_show_warranty: e.target.checked })} />السيريال / IMEI ومدة الضمان</label>
        </div>
        <Field label="تذييل الفاتورة"><textarea className="input" rows={2} value={f.invoice_footer || ''} onChange={(e) => setF({ ...f, invoice_footer: e.target.value })} /></Field>
        <button className="btn-primary w-full" disabled={saving} onClick={onSave}>حفظ</button>
      </div>
      <div>
        <div className="mb-2 text-sm font-bold text-slate-500">معاينة</div>
        <div className="rounded-2xl bg-slate-100 p-4"><InvoiceReceipt invoice={SAMPLE} shop={preview} /></div>
      </div>
    </section>
  )
}

function DrawersCard() {
  const { data: drawers } = useGet<CashDrawer[]>(['drawers'], '/drawers/')
  const [name, setName] = useState('')
  const inv = ['drawers', 'cash', 'users']
  const add = useAction(() => api.post('/drawers/', { name }), { invalidate: inv, success: 'تمت إضافة الدرج', onSuccess: () => setName('') })
  const update = useAction(({ id, body }: { id: number; body: object }) => api.patch(`/drawers/${id}/`, body), { invalidate: inv, success: 'تم الحفظ' })
  const remove = useAction((id: number) => api.delete(`/drawers/${id}/`), { invalidate: inv, success: 'تم إيقاف الدرج' })
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-extrabold">أدراج النقدية (الخزائن)</h2>
      <p className="text-sm text-slate-500">لكل كاشير درج خاص برصيده وورديته. تُسجل حركات كل موظف في درجه (من «فريق العمل»)، ويمكن التحويل بين الأدراج من «الخزينة».</p>
      <div className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
        {drawers?.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-bold">{d.name} {d.is_default && <Badge tone="brand">افتراضي</Badge>} {d.open_shift && <Badge tone="green">وردية مفتوحة</Badge>}</div>
              <div className="text-xs text-slate-500">{d.users.length ? d.users.join('، ') : 'لا يوجد موظفون مخصصون'}</div>
            </div>
            <Money value={d.balance} className="font-extrabold" />
            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { const n = prompt('اسم الدرج', d.name); if (n) update.mutate({ id: d.id, body: { name: n } }) }}>تعديل</button>
            {!d.is_default && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => update.mutate({ id: d.id, body: { is_default: true } })}>اجعله افتراضي</button>}
            {(drawers?.length ?? 0) > 1 && <button className="btn-ghost px-2 py-1 text-xs text-rose-600" onClick={() => confirm(`إيقاف «${d.name}»؟`) && remove.mutate(d.id)}>إيقاف</button>}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input" placeholder="اسم درج جديد (مثال: كاشير 2، الصيانة، الخزنة)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-secondary shrink-0" disabled={!name.trim() || add.isPending} onClick={() => add.mutate(undefined)}><Plus size={16} />إضافة</button>
      </div>
    </section>
  )
}
