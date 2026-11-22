import { MessageSquareText, Plus, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Field, Loading, Modal, StatCard } from '../components/ui'
import { api } from '../lib/api'
import { dateTime, num } from '../lib/format'
import { useAction, useGet } from '../lib/hooks'

interface PlatformInfo { provider: string; configured: boolean; default_sender: string; countries: string[] }
interface ShopRow { id: number; name: string; enabled: boolean; monthly_limit: number; credits: number; sender: string; used_this_month: number; failed_this_month: number; available: number }
interface Overview { platform: PlatformInfo; total_sent_this_month: number; enabled_shops: number; shops: ShopRow[] }
interface ShopSms {
  enabled: boolean; monthly_limit: number; used_this_month: number; credits: number; available: number; sender: string
  own_sender: boolean; platform: PlatformInfo
  messages: { id: number; to: string; body: string; kind_display: string; status: string; status_display: string; segments: number; error: string; user: string; created_at: string }[]
  grants: { id: number; amount: number; balance_after: number; note: string; by: string; created_at: string }[]
}

function ProviderBanner({ p }: { p?: PlatformInfo }) {
  if (!p) return null
  return p.configured ? (
    <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
      مزود الرسائل: <b>{p.provider === 'advansys' ? 'Advansys Telecom' : p.provider}</b> · اسم المرسل الافتراضي: <b dir="ltr">{p.default_sender || '—'}</b> · أرقام مصر فقط
    </div>
  ) : (
    <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
      حساب الرسائل غير مُعد على الخادم بعد (SMS_PLATFORM_API_KEY و SMS_PLATFORM_SENDER). يمكنك ضبط باقات المحلات الآن، والإرسال يبدأ فور إضافة المفتاح.
    </div>
  )
}

/** /platform/sms — every shop's SMS switch, allowance and usage this month. */
export function PlatformSmsOverview() {
  const { data } = useGet<Overview>(['platform', 'sms'], '/platform/sms/')
  if (!data) return <Loading />
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold"><MessageSquareText />رسائل SMS للمحلات</h1>
      <ProviderBanner p={data.platform} />
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="رسائل هذا الشهر (كل المحلات)" value={num(data.total_sent_this_month)} />
        <StatCard label="محلات مفعل لها SMS" value={`${num(data.enabled_shops)} / ${num(data.shops.length)}`} tone="green" />
      </div>
      <div className="card">
        {data.shops.map((s) => (
          <Link key={s.id} to={`/platform/shops/${s.id}#sms`} className="list-row hover:bg-slate-50">
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{s.name}</div>
              <div className="text-xs text-slate-500">
                {s.enabled ? <>الشهر: {num(s.used_this_month)} / {num(s.monthly_limit)} · إضافي {num(s.credits)}{s.sender && <> · <span dir="ltr">{s.sender}</span></>}</> : 'غير مفعل'}
                {s.failed_this_month > 0 && <span className="text-rose-600"> · {num(s.failed_this_month)} فشل</span>}
              </div>
            </div>
            {s.enabled ? <Badge tone={s.available > 0 ? 'green' : 'amber'}>متاح {num(s.available)}</Badge> : <Badge>متوقف</Badge>}
          </Link>
        ))}
      </div>
    </div>
  )
}

/** SMS section on a shop's page in the console. */
export function ShopSmsPanel({ shopId }: { shopId: number }) {
  const key = ['platform', 'sms', shopId]
  const { data } = useGet<ShopSms>(key, `/platform/shops/${shopId}/sms/`)
  const [f, setF] = useState({ sms_enabled: false, sms_monthly_limit: '0', sms_sender_id: '' })
  const [granting, setGranting] = useState(false)
  const [testing, setTesting] = useState(false)
  useEffect(() => {
    if (data) setF({ sms_enabled: data.enabled, sms_monthly_limit: String(data.monthly_limit), sms_sender_id: data.own_sender ? data.sender : '' })
  }, [data])
  const save = useAction(() => api.patch(`/platform/shops/${shopId}/sms/`, { ...f, sms_monthly_limit: Number(f.sms_monthly_limit) || 0 }), {
    invalidate: ['platform', 'platformshops'], success: 'تم حفظ إعدادات الرسائل',
  })
  if (!data) return <Loading />
  return (
    <section id="sms" className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-extrabold"><MessageSquareText size={18} />رسائل SMS</h2>
        <div className="flex gap-2">
          <button className="btn-secondary px-3 py-1.5" onClick={() => setGranting(true)}><Plus size={16} />رصيد إضافي</button>
          <button className="btn-secondary px-3 py-1.5" disabled={!data.enabled} onClick={() => setTesting(true)}><Send size={16} />رسالة تجربة</button>
        </div>
      </div>
      <ProviderBanner p={data.platform} />
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-emerald-50 p-3"><div className="text-xs text-slate-500">المتاح</div><div className="text-xl font-extrabold text-emerald-700">{num(data.available)}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">هذا الشهر</div><div className="text-xl font-extrabold">{num(data.used_this_month)}<span className="text-sm font-normal text-slate-400"> / {num(data.monthly_limit)}</span></div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">رصيد إضافي</div><div className="text-xl font-extrabold">{num(data.credits)}</div></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2 font-bold sm:pt-6">
          <input type="checkbox" className="size-4" checked={f.sms_enabled} onChange={(e) => setF({ ...f, sms_enabled: e.target.checked })} />تفعيل SMS لهذا المحل
        </label>
        <Field label="الباقة الشهرية (رسالة)" hint="تتجدد أول كل شهر"><input className="input" inputMode="numeric" value={f.sms_monthly_limit} onChange={(e) => setF({ ...f, sms_monthly_limit: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="اسم مرسل خاص (اختياري)" hint="بعد تسجيله لدى الشبكات عبر Advansys">
          <input className="input" dir="ltr" maxLength={11} placeholder={data.platform.default_sender} value={f.sms_sender_id} onChange={(e) => setF({ ...f, sms_sender_id: e.target.value })} />
        </Field>
      </div>
      <button className="btn-primary w-full" disabled={save.isPending} onClick={() => save.mutate(undefined)}>حفظ</button>

      {!!data.grants.length && (
        <div>
          <span className="label">سجل الرصيد الإضافي</span>
          <div className="divide-y divide-slate-100 rounded-xl text-sm ring-1 ring-slate-200">
            {data.grants.map((g) => (
              <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
                <span className={`font-extrabold ${g.amount > 0 ? 'text-emerald-700' : 'text-rose-600'}`} dir="ltr">{g.amount > 0 ? '+' : ''}{g.amount}</span>
                <span className="flex-1 text-slate-600">{g.note || '—'}</span>
                <span className="text-xs text-slate-400">الرصيد {g.balance_after} · {g.by} · {dateTime(g.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!!data.messages.length && (
        <div>
          <span className="label">آخر رسائل المحل</span>
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl text-sm ring-1 ring-slate-200">
            {data.messages.map((m) => (
              <div key={m.id} className="p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs" dir="ltr">{m.to}</span>
                  <Badge tone={m.status === 'sent' ? 'green' : m.status === 'failed' ? 'red' : 'gray'}>{m.status_display}</Badge>
                </div>
                <div className="mt-1 line-clamp-2 text-slate-600">{m.body}</div>
                <div className="text-xs text-slate-400">{m.kind_display} · {m.segments} رسالة · {dateTime(m.created_at)}{m.user && ` · ${m.user}`}{m.error && ` · ${m.error}`}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {granting && <GrantModal shopId={shopId} onClose={() => setGranting(false)} />}
      {testing && <TestModal shopId={shopId} onClose={() => setTesting(false)} />}
    </section>
  )
}

function GrantModal({ shopId, onClose }: { shopId: number; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const save = useAction(() => api.post(`/platform/shops/${shopId}/sms/credits/`, { amount: Number(amount), note }), {
    invalidate: ['platform', 'platformshops'], success: 'تم تحديث الرصيد', onSuccess: onClose,
  })
  return (
    <Modal open onClose={onClose} title="رصيد رسائل إضافي" footer={
      <button className="btn-primary flex-1" disabled={!Number(amount) || save.isPending} onClick={() => save.mutate(undefined)}>حفظ</button>
    }>
      <div className="space-y-3">
        <Field label="عدد الرسائل" hint="رقم سالب للخصم / التصحيح. الرصيد الإضافي لا ينتهي ويُستخدم بعد انتهاء الباقة الشهرية.">
          <input className="input text-lg font-bold" dir="ltr" inputMode="numeric" autoFocus value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d-]/g, ''))} />
        </Field>
        <Field label="ملاحظة"><input className="input" placeholder="مثال: دفع 100 ج.م فودافون كاش" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function TestModal({ shopId, onClose }: { shopId: number; onClose: () => void }) {
  const [to, setTo] = useState('')
  const [message, setMessage] = useState('')
  const send = useAction(() => api.post(`/platform/shops/${shopId}/sms/test/`, { to, message }), {
    invalidate: ['platform'], success: 'تم إرسال رسالة التجربة', onSuccess: onClose,
  })
  return (
    <Modal open onClose={onClose} title="رسالة تجربة" footer={
      <button className="btn-primary flex-1" disabled={!to || send.isPending} onClick={() => send.mutate(undefined)}><Send size={18} />إرسال</button>
    }>
      <div className="space-y-3">
        <Field label="رقم موبايل مصري"><input className="input" dir="ltr" inputMode="tel" autoFocus value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="النص (اختياري)"><input className="input" value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        <p className="text-xs text-slate-500">تُخصم من رصيد المحل وتُرسل باسم مرسله — تختبر المسار كاملاً.</p>
      </div>
    </Modal>
  )
}
