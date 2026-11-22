import { Bell, BellOff, BellRing, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from './toast'

interface PushInfo {
  configured: boolean; public_key: string; events: Record<string, string>
  subscribed: boolean; my_events: Record<string, boolean>; devices: number
}

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

function urlB64ToUint8Array(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function deviceName() {
  const ua = navigator.userAgent
  const os = /iphone/i.test(ua) ? 'iPhone' : /ipad/i.test(ua) ? 'iPad' : /android/i.test(ua) ? 'Android' : /mac/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows' : 'جهاز'
  const br = /edg/i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : /firefox/i.test(ua) ? 'Firefox' : ''
  return `${os}${br ? ` · ${br}` : ''}`
}

async function currentSubscription() {
  if (!supported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

/** This device's push state + actions (manager only). */
export function usePush() {
  const { isManager } = useAuth()
  const toast = useToast()
  const [info, setInfo] = useState<PushInfo | null>(null)
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!isManager) return
    const sub = await currentSubscription().catch(() => null)
    setEndpoint(sub?.endpoint ?? null)
    const { data } = await api.get<PushInfo>('/notify/push/', { params: { endpoint: sub?.endpoint } })
    setInfo(data)
  }, [isManager])
  useEffect(() => { load().catch(() => setInfo(null)) }, [load])

  const enable = async (events?: Record<string, boolean>) => {
    if (!info?.public_key) return
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        toast.error('لم يتم السماح بالإشعارات. فعّلها من إعدادات المتصفح لهذا الموقع ثم أعد المحاولة.')
        return
      }
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(info.public_key) })
      await api.post('/notify/push/', { ...sub.toJSON(), device: deviceName(), events: events ?? info.my_events })
      toast.ok('تم تفعيل الإشعارات على هذا الجهاز')
      await load()
    } catch (e) {
      toast.error(e)
    } finally { setBusy(false) }
  }

  const disable = async () => {
    setBusy(true)
    try {
      const sub = await currentSubscription()
      if (sub) {
        await api.delete('/notify/push/', { data: { endpoint: sub.endpoint } })
        await sub.unsubscribe().catch(() => undefined)
      }
      toast.ok('تم إيقاف الإشعارات على هذا الجهاز')
      await load()
    } catch (e) { toast.error(e) } finally { setBusy(false) }
  }

  const setEvent = async (k: string, v: boolean) => {
    if (!info) return
    const events = { ...info.my_events, [k]: v }
    setInfo({ ...info, my_events: events })
    const sub = await currentSubscription()
    if (sub) await api.post('/notify/push/', { ...sub.toJSON(), device: deviceName(), events }).catch((e) => toast.error(e))
  }

  const test = async () => {
    setBusy(true)
    try { await api.post('/notify/push/test/', { endpoint }); toast.ok('تم إرسال إشعار تجربة') } catch (e) { toast.error(e) } finally { setBusy(false) }
  }

  const active = !!info?.subscribed && !!endpoint && typeof Notification !== 'undefined' && Notification.permission === 'granted'
  return { info, active, busy, enable, disable, setEvent, test }
}

export function PushSettingsCard() {
  const p = usePush()
  if (!p.info) return null
  const iosNeedsInstall = isIos() && !standalone()
  return (
    <section className="card space-y-4 p-4">
      <h2 className="flex items-center gap-2 font-extrabold"><BellRing size={18} />إشعارات الموبايل</h2>
      <p className="text-sm text-slate-600">تنبيه فوري على موبايلك بكل عملية بيع أو صيانة يقوم بها فريقك — حتى والتطبيق مغلق.</p>
      {!p.info.configured ? (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">الإشعارات غير مفعلة على الخادم بعد.</p>
      ) : !supported() || iosNeedsInstall ? (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {iosNeedsInstall
            ? <>على الآيفون: افتح الموقع من Safari ← زر المشاركة ← <b>«إضافة إلى الشاشة الرئيسية»</b>، ثم افتح التطبيق من الأيقونة وفعّل الإشعارات من هنا (iOS 16.4 أو أحدث).</>
            : 'هذا المتصفح لا يدعم الإشعارات. استخدم Chrome على أندرويد أو التطبيق المثبت على الآيفون.'}
        </div>
      ) : (
        <>
          <div className={`flex flex-wrap items-center gap-3 rounded-xl p-3 ${p.active ? 'bg-emerald-50' : 'bg-slate-50'}`}>
            {p.active ? <Bell className="text-emerald-700" size={20} /> : <BellOff className="text-slate-400" size={20} />}
            <span className="flex-1 text-sm font-bold">{p.active ? 'الإشعارات مفعلة على هذا الجهاز' : 'الإشعارات غير مفعلة على هذا الجهاز'}</span>
            {p.active ? (
              <>
                <button className="btn-secondary px-3 py-1.5" disabled={p.busy} onClick={p.test}>تجربة</button>
                <button className="btn-ghost px-3 py-1.5 text-rose-600" disabled={p.busy} onClick={p.disable}>إيقاف</button>
              </>
            ) : <button className="btn-primary px-3 py-1.5" disabled={p.busy} onClick={() => p.enable()}><Bell size={16} />تفعيل</button>}
          </div>
          {p.active && (
            <div>
              <span className="label">أرسل لي إشعاراً عند</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(p.info.events).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-sm font-bold">
                    <input type="checkbox" className="size-4" checked={p.info!.my_events[k] ?? true} onChange={(e) => p.setEvent(k, e.target.checked)} />{label}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">لا تصلك إشعارات عن العمليات التي تقوم بها أنت. فعّلها على كل موبايل تريد التنبيه عليه.</p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

const DISMISS_KEY = 'daysam.push.dismissed'

/** One-time nudge on the dashboard for managers who haven't turned notifications on. */
export function PushPrompt() {
  const p = usePush()
  const [hidden, setHidden] = useState(() => { try { return !!localStorage.getItem(DISMISS_KEY) } catch { return false } })
  if (hidden || !p.info?.configured || p.active || !supported() || (isIos() && !standalone())) return null
  const dismiss = () => { setHidden(true); try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode */ } }
  return (
    <div className="card flex flex-wrap items-center gap-3 bg-brand-50 p-3">
      <BellRing className="text-brand-700" size={22} />
      <div className="min-w-0 flex-1 text-sm"><b>تابع محلك من موبايلك</b><div className="text-slate-600">إشعار فوري بكل بيع وصيانة وطلب موافقة.</div></div>
      <button className="btn-primary px-3 py-1.5" disabled={p.busy} onClick={() => p.enable()}>تفعيل الإشعارات</button>
      <button className="btn-ghost px-2" onClick={dismiss} aria-label="إغلاق"><X size={18} /></button>
    </div>
  )
}
