import { MessageSquareText } from 'lucide-react'
import { useState } from 'react'
import { api } from '../lib/api'
import { useAction, useGet } from '../lib/hooks'
import { Field, Modal } from './ui'

export interface SmsStatus {
  enabled: boolean; platform_configured: boolean; monthly_limit: number; used_this_month: number; credits: number
  available: number; sender: string; own_sender: boolean; auto: Record<string, boolean>; auto_kinds: Record<string, string>
}

export function useSmsStatus() {
  return useGet<SmsStatus>(['sms', 'status'], '/sms/')
}

const GSM7 = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/

/** Billed SMS parts — mirrors the backend: 160/153 Latin, 70/67 Arabic. */
export function smsSegments(text: string) {
  const n = text.length
  if (!n) return 0
  return GSM7.test(text) ? (n <= 160 ? 1 : Math.ceil(n / 153)) : (n <= 70 ? 1 : Math.ceil(n / 67))
}

/** "SMS" button next to WhatsApp; only shows when the platform enabled SMS for this shop. */
export function SmsButton({ to, text, kind = 'manual', className = 'btn-secondary', label = 'SMS' }: {
  to?: string; text: string; kind?: string; className?: string; label?: string
}) {
  const { data } = useSmsStatus()
  const [open, setOpen] = useState(false)
  if (!data?.enabled || !data.platform_configured || !to) return null
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}><MessageSquareText size={16} />{label}</button>
      {open && <SmsComposer to={to} text={text} kind={kind} onClose={() => setOpen(false)} />}
    </>
  )
}

export function SmsComposer({ to, text, kind, onClose }: { to: string; text: string; kind: string; onClose: () => void }) {
  const { data } = useSmsStatus()
  const [phone, setPhone] = useState(to)
  const [body, setBody] = useState(text)
  const segs = smsSegments(body)
  const send = useAction(() => api.post('/sms/send/', { to: phone, message: body, kind }), {
    invalidate: ['sms'], success: 'تم إرسال الرسالة', onSuccess: onClose,
  })
  const short = data ? data.available < segs : false
  return (
    <Modal open onClose={onClose} title="إرسال رسالة SMS" footer={
      <button className="btn-primary flex-1" disabled={!body.trim() || !phone || short || send.isPending} onClick={() => send.mutate(undefined)}>
        <MessageSquareText size={18} />{send.isPending ? 'جاري الإرسال...' : `إرسال (${segs} رسالة)`}
      </button>
    }>
      <div className="space-y-3">
        <Field label="رقم الموبايل"><input className="input" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="نص الرسالة" hint={<span className={short ? 'text-rose-600' : ''}>{body.length} حرف · {segs} رسالة · المتاح لك {data?.available ?? '—'} رسالة</span>}>
          <textarea className="input" rows={5} maxLength={600} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <p className="text-xs text-slate-500">الرسالة العربية = 70 حرفاً لكل رسالة. تُرسل باسم «{data?.sender || '—'}» للأرقام المصرية فقط.</p>
      </div>
    </Modal>
  )
}

interface SmsLogRow {
  id: number; to: string; body: string; kind_display: string; status: 'sent' | 'failed' | 'skipped'; status_display: string
  segments: number; error: string; user: string; created_at: string
}

/** Settings → SMS: balance from the platform, automatic messages, and the send log. */
export function SmsSettingsCard() {
  const { data } = useSmsStatus()
  const { data: log } = useGet<{ results: SmsLogRow[] }>(['sms', 'log'], data?.enabled ? '/sms/messages/' : null, { page_size: 15 })
  const save = useAction((auto: Record<string, boolean>) => api.patch('/sms/', { auto }), { invalidate: ['sms'], success: 'تم الحفظ' })
  if (!data) return null
  return (
    <section className="card space-y-4 p-4">
      <h2 className="flex items-center gap-2 font-extrabold"><MessageSquareText size={18} />رسائل SMS للعملاء</h2>
      {!data.enabled || !data.platform_configured ? (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          خدمة الرسائل غير مفعلة لمحلك. تواصل مع إدارة النظام لتفعيلها وتحديد باقة الرسائل الشهرية.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-emerald-50 p-3"><div className="text-xs text-slate-500">المتاح الآن</div><div className="text-xl font-extrabold text-emerald-700">{data.available}</div></div>
            <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">المستخدم هذا الشهر</div><div className="text-xl font-extrabold">{data.used_this_month}<span className="text-sm font-normal text-slate-400"> / {data.monthly_limit}</span></div></div>
            <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">رصيد إضافي</div><div className="text-xl font-extrabold">{data.credits}</div></div>
          </div>
          <p className="text-xs text-slate-500">اسم المرسل: <b dir="ltr">{data.sender}</b>. الباقة الشهرية تتجدد أول كل شهر، والرصيد الإضافي لا ينتهي.</p>
          <div>
            <span className="label">رسائل تلقائية</span>
            <div className="space-y-2">
              {Object.entries(data.auto_kinds).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm font-bold">
                  <input type="checkbox" className="size-4" checked={!!data.auto[k]} disabled={save.isPending}
                    onChange={(e) => save.mutate({ ...data.auto, [k]: e.target.checked })} />{label}
                </label>
              ))}
            </div>
          </div>
          {!!log?.results.length && (
            <div>
              <span className="label">آخر الرسائل</span>
              <div className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                {log.results.map((m) => (
                  <div key={m.id} className="p-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs" dir="ltr">{m.to}</span>
                      <span className={`chip ${m.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : m.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{m.status_display}</span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-slate-600">{m.body}</div>
                    <div className="text-xs text-slate-400">{m.kind_display} · {m.segments} رسالة · {new Date(m.created_at).toLocaleString('ar-EG')}{m.user && ` · ${m.user}`}{m.error && ` · ${m.error}`}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
