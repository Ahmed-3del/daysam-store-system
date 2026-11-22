import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/toast'
import { Field } from '../components/ui'
import { useAuth } from '../lib/auth'

function Shell({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-700 to-brand-800 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-white">
          <img src="/pwa-192.png" alt="" className="mb-3 size-16 rounded-2xl shadow-lg ring-4 ring-white/20" />
          <div className="text-2xl font-extrabold">دايسام</div>
          <div className="text-sm text-white/70">إدارة محلات الموبايلات والصيانة</div>
        </div>
        <div className="card p-6">
          <h1 className="mb-4 text-lg font-extrabold">{title}</h1>
          {children}
        </div>
        <div className="mt-4 text-center text-sm text-white/80">{footer}</div>
      </div>
    </div>
  )
}

export function Login() {
  const { login } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ username: '', password: '' })
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true)
    try { await login(form.username.trim(), form.password) } catch (err) {
      const e = err as { response?: { status: number }; message?: string }
      toast.error(e.response?.status === 401 ? 'اسم المستخدم أو كلمة المرور غير صحيحة.' : e.response ? err : (e.message || err))
    } finally { setBusy(false) }
  }
  return (
    <Shell title="تسجيل الدخول" footer={<>ليس لديك حساب؟ <Link to="/register" className="font-bold text-white underline">سجّل محلك</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="اسم المستخدم"><input className="input" dir="ltr" autoComplete="username" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
        <Field label="كلمة المرور"><input className="input" dir="ltr" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'جاري الدخول...' : 'دخول'}</button>
      </form>
    </Shell>
  )
}

export function Register() {
  const { register } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ shop_name: '', shop_phone: '', full_name: '', username: '', password: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true)
    try { await register(form) } catch (err) { toast.error(err) } finally { setBusy(false) }
  }
  return (
    <Shell title="تسجيل محل جديد" footer={<>لديك حساب؟ <Link to="/login" className="font-bold text-white underline">تسجيل الدخول</Link></>}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="اسم المحل"><input className="input" required value={form.shop_name} onChange={set('shop_name')} /></Field>
        <Field label="تليفون المحل"><input className="input" dir="ltr" inputMode="tel" value={form.shop_phone} onChange={set('shop_phone')} /></Field>
        <Field label="اسمك"><input className="input" required value={form.full_name} onChange={set('full_name')} /></Field>
        <Field label="اسم المستخدم (بالإنجليزي)"><input className="input" dir="ltr" required autoComplete="username" value={form.username} onChange={set('username')} /></Field>
        <Field label="كلمة المرور" hint="6 أحرف على الأقل"><input className="input" dir="ltr" type="password" required minLength={6} autoComplete="new-password" value={form.password} onChange={set('password')} /></Field>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'جاري التسجيل...' : 'إنشاء الحساب'}</button>
      </form>
    </Shell>
  )
}
