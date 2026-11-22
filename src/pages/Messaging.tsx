import { Check, MessageCircle, MessageSquareText, Send, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { smsSegments, useSmsStatus } from '../components/Sms'
import { Empty, Field, Loading, PageHeader, SearchBox, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { num, whatsappLink } from '../lib/format'
import { useAction, useDebounced, useGet } from '../lib/hooks'

interface Row { id: number; name: string; phone: string; balance: number | string }
type Segment = 'all' | 'debtors' | 'overdue' | 'recent' | 'ids'

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'all', label: 'كل العملاء' }, { value: 'debtors', label: 'عليهم مديونية' }, { value: 'overdue', label: 'أقساط متأخرة' },
  { value: 'recent', label: 'اشتروا مؤخراً' }, { value: 'ids', label: 'اختيار يدوي' },
]
const VARS = [['{الاسم}', 'الاسم الأول'], ['{الاسم_كامل}', 'الاسم كامل'], ['{المستحق}', 'المديونية'], ['{المحل}', 'اسم المحل']] as const
const TEMPLATES = [
  { label: 'عرض / خصم', text: 'أهلاً {الاسم} 👋\nعروض جديدة في {المحل}! خصومات على الموبايلات والإكسسوارات لفترة محدودة. في انتظارك.' },
  { label: 'تذكير مديونية', text: 'مرحباً {الاسم}، نود تذكيركم بأن المستحق عليكم {المستحق}. شكراً لتعاملكم مع {المحل}.' },
  { label: 'تذكير قسط', text: 'مرحباً {الاسم}، نذكركم بموعد سداد القسط المتأخر. برجاء المرور على {المحل} أو التواصل معنا.' },
  { label: 'وصل جديد', text: 'أهلاً {الاسم}، وصل حديثاً في {المحل} أحدث الموبايلات. تعالى شوف بنفسك!' },
]

function personalize(t: string, r: Row, shopName: string, currency: string) {
  return t.replaceAll('{الاسم_كامل}', r.name)
    .replaceAll('{الاسم}', r.name.split(/\s+/)[0] || '')
    .replaceAll('{المستحق}', `${Math.round(Number(r.balance))} ${currency}`)
    .replaceAll('{المحل}', shopName).trim()
}

const SENT_KEY = 'daysam.wa.sent'

/** Message a group of the shop's customers: WhatsApp one chat at a time, or SMS to everyone at once. */
export default function Messaging() {
  const { shop } = useAuth()
  const { data: sms } = useSmsStatus()
  const smsOn = !!sms?.enabled && !!sms.platform_configured
  const [segment, setSegment] = useState<Segment>('all')
  const [days, setDays] = useState('30')
  const [picked, setPicked] = useState<number[]>([])
  const [q, setQ] = useState('')
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp')
  const [message, setMessage] = useState(TEMPLATES[0].text)
  const [sent, setSent] = useState<number[]>([])
  const dDays = useDebounced(days)

  const listSegment = segment === 'ids' ? 'all' : segment
  const params = { segment: listSegment, days: segment === 'recent' ? dDays || 30 : undefined }
  const { data, isLoading } = useGet<{ count: number; results: Row[] }>(['messaging', 'audience', params], '/messaging/audience/', params)
  const all = useMemo(() => data?.results ?? [], [data])
  const recipients = segment === 'ids' ? all.filter((r) => picked.includes(r.id)) : all
  const shopName = shop?.name ?? ''
  const cur = shop?.currency ?? 'ج.م'

  // Remember who already got the WhatsApp message for this text, so a refresh doesn't lose the place.
  const sentKey = `${SENT_KEY}:${message.length}:${message.slice(0, 40)}`
  useEffect(() => {
    try { setSent(JSON.parse(sessionStorage.getItem(sentKey) || '[]')) } catch { setSent([]) }
  }, [sentKey])
  const markSent = (id: number) => setSent((s) => {
    const n = s.includes(id) ? s : [...s, id]
    try { sessionStorage.setItem(sentKey, JSON.stringify(n)) } catch { /* private mode */ }
    return n
  })

  const openWa = (r: Row) => { window.open(whatsappLink(r.phone, personalize(message, r, shopName, cur)), '_blank', 'noopener'); markSent(r.id) }
  const nextUnsent = recipients.find((r) => !sent.includes(r.id))

  // SMS cost: Arabic = 70 chars per message; computed per customer since names differ.
  const smsCost = useMemo(() => recipients.reduce((s, r) => s + smsSegments(personalize(message, r, shopName, cur)), 0), [recipients, message, shopName, cur])
  const bulk = useAction(() => api.post('/sms/bulk/', {
    segment, days: Number(days) || 30, ids: segment === 'ids' ? picked : undefined, message,
  }).then((r) => r.data), { invalidate: ['sms'], success: 'جاري الإرسال — تابع النتيجة في سجل الرسائل بالإعدادات' })

  const dq = useDebounced(q).trim()
  const shown = segment === 'ids' && dq ? all.filter((r) => r.name.includes(dq) || r.phone.includes(dq)) : all
  const insert = (v: string) => setMessage((m) => `${m}${m.endsWith(' ') || !m ? '' : ' '}${v}`)
  const sample = recipients[0] ? personalize(message, recipients[0], shopName, cur) : ''

  return (
    <div className="space-y-4">
      <PageHeader title="مراسلة العملاء" subtitle="أرسل عرضاً أو تذكيراً لعملائك على واتساب أو SMS" />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card min-w-0 space-y-4 p-4 lg:col-span-2">
          <div>
            <span className="label">إلى من؟</span>
            <Tabs value={segment} onChange={(v) => { setSegment(v); setSent([]) }} options={SEGMENTS} />
          </div>
          {segment === 'recent' && (
            <Field label="اشتروا خلال آخر (يوم)">
              <input className="input w-28" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} />
            </Field>
          )}
          {segment === 'ids' && (
            <div className="space-y-2">
              <SearchBox value={q} onChange={setQ} placeholder="ابحث بالاسم أو الرقم" />
              <div className="flex justify-between text-xs">
                <button className="font-bold text-brand-700" onClick={() => setPicked(shown.map((r) => r.id))}>تحديد الكل</button>
                <button className="text-slate-500" onClick={() => setPicked([])}>إلغاء التحديد ({num(picked.length)})</button>
              </div>
              <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl ring-1 ring-slate-200">
                {shown.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 p-2.5 text-sm">
                    <input type="checkbox" className="size-4" checked={picked.includes(r.id)}
                      onChange={(e) => setPicked((p) => (e.target.checked ? [...p, r.id] : p.filter((x) => x !== r.id)))} />
                    <span className="flex-1 truncate font-bold">{r.name}</span><span dir="ltr" className="text-xs text-slate-500">{r.phone}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm">
            <Users size={18} className="text-brand-700" />
            {isLoading ? 'جاري التحميل...' : <span><b>{num(recipients.length)}</b> عميل لديه رقم موبايل</span>}
          </div>

          <div>
            <span className="label">نص الرسالة</span>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => <button key={t.label} type="button" className="chip bg-slate-100 px-2.5 py-1 text-xs" onClick={() => setMessage(t.text)}>{t.label}</button>)}
            </div>
            <textarea className="input" rows={6} maxLength={600} value={message} onChange={(e) => setMessage(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {VARS.map(([v, l]) => <button key={v} type="button" className="chip bg-brand-50 px-2.5 py-1 text-xs text-brand-700" onClick={() => insert(v)}>+ {l}</button>)}
            </div>
          </div>
          {sample && (
            <div>
              <span className="label">معاينة ({recipients[0].name})</span>
              <div className="whitespace-pre-wrap rounded-xl bg-emerald-50 p-3 text-sm">{sample}</div>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3 lg:col-span-3">
          <Tabs value={channel} onChange={setChannel} options={[
            { value: 'whatsapp', label: <span className="flex items-center gap-1.5"><MessageCircle size={16} />واتساب</span> },
            { value: 'sms', label: <span className="flex items-center gap-1.5"><MessageSquareText size={16} />رسائل SMS</span> },
          ]} />

          {channel === 'sms' ? (
            !smsOn ? (
              <div className="card p-4 text-sm text-slate-600">
                خدمة SMS غير مفعلة لمحلك. تواصل مع إدارة النظام لتفعيلها وتحديد باقة الرسائل — أو أرسل على واتساب مجاناً.
              </div>
            ) : (
              <div className="card space-y-3 p-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">العملاء</div><div className="text-xl font-extrabold">{num(recipients.length)}</div></div>
                  <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">تكلفة الإرسال</div><div className="text-xl font-extrabold">{num(smsCost)}</div></div>
                  <div className={`rounded-xl p-3 ${smsCost > (sms?.available ?? 0) ? 'bg-rose-50' : 'bg-emerald-50'}`}><div className="text-xs text-slate-500">المتاح</div><div className="text-xl font-extrabold">{num(sms?.available ?? 0)}</div></div>
                </div>
                {smsCost > (sms?.available ?? 0) && <p className="text-sm text-rose-600">الرصيد لا يكفي — قلّل العملاء أو اختصر النص (العربي 70 حرفاً للرسالة).</p>}
                <button className="btn-primary w-full" disabled={!recipients.length || !message.trim() || smsCost > (sms?.available ?? 0) || bulk.isPending}
                  onClick={() => confirm(`إرسال SMS إلى ${recipients.length} عميل؟ سيُخصم ${smsCost} رسالة من رصيدك.`) && bulk.mutate(undefined)}>
                  <Send size={18} />{bulk.isPending ? 'جاري الإرسال...' : `إرسال SMS إلى ${num(recipients.length)} عميل`}
                </button>
                <p className="text-xs text-slate-500">ترسل لكل العملاء مرة واحدة باسم «{sms?.sender}». للأرقام المصرية فقط. النتيجة في <Link to="/settings" className="font-bold text-brand-700">الإعدادات ← رسائل SMS</Link>.</p>
              </div>
            )
          ) : isLoading ? <Loading /> : !recipients.length ? (
            <Empty icon={<Users size={44} />} title="لا يوجد عملاء في هذه المجموعة" />
          ) : (
            <div className="card">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
                <div className="flex-1 text-sm">تم <b>{num(recipients.filter((r) => sent.includes(r.id)).length)}</b> من <b>{num(recipients.length)}</b></div>
                {nextUnsent ? (
                  <button className="btn-success" disabled={!message.trim()} onClick={() => openWa(nextUnsent)}><MessageCircle size={18} />التالي: {nextUnsent.name}</button>
                ) : <span className="chip bg-emerald-100 text-emerald-700"><Check size={14} />تم الإرسال للجميع</span>}
              </div>
              <p className="px-3 pt-2 text-xs text-slate-500">كل ضغطة تفتح محادثة العميل في واتساب والرسالة جاهزة — اضغط إرسال ثم ارجع للعميل التالي.</p>
              <div className="max-h-[60vh] overflow-y-auto">
                {recipients.map((r) => {
                  const done = sent.includes(r.id)
                  return (
                    <div key={r.id} className="list-row">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold">{r.name}</div>
                        <div className="text-xs text-slate-500" dir="ltr">{r.phone}</div>
                      </div>
                      <button className={done ? 'btn-ghost px-3 py-1.5 text-emerald-700' : 'btn-success px-3 py-1.5'} disabled={!message.trim()} onClick={() => openWa(r)}>
                        {done ? <><Check size={16} />أُرسلت</> : <><MessageCircle size={16} />إرسال</>}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
