import { useQuery } from '@tanstack/react-query'
import {
  Check, Cpu, Plus, Radio, Settings2, ShoppingBag, Smartphone, Store, Tv, Wrench, X, type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useToast } from '../components/toast'
import { Field, Loading } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useAction } from '../lib/hooks'
import type { ShopConfig } from '../lib/types'

export interface Preset { key: string; label: string; description: string; hidden_sections: string[]; categories: string[] }

export const TYPE_ICONS: Record<string, LucideIcon> = {
  mobile: Smartphone, computer: Cpu, electronics: Tv, accessories: ShoppingBag, repair_center: Wrench, central: Radio, general: Store,
}

export function usePresets() {
  return useQuery({ queryKey: ['presets'], queryFn: async () => (await api.get<Preset[]>('/shop/presets/')).data, staleTime: Infinity })
}

/** First-run wizard: pick the business type, then the sections this shop uses. */
export default function SetupWizard() {
  const { shop, sections, refresh, logout } = useAuth()
  const toast = useToast()
  const { data: presets } = usePresets()
  const [type, setType] = useState('mobile')
  const [hidden, setHidden] = useState<string[]>([])
  const [step, setStep] = useState(1)
  const preset = presets?.find((p) => p.key === type)
  useEffect(() => { if (preset) setHidden(preset.hidden_sections) }, [preset])

  const finish = useAction(() => api.post('/shop/setup/', { business_type: type, hidden_sections: hidden, seed_categories: true }), {
    onSuccess: async () => { await refresh(); toast.ok('تم تجهيز النظام لمحلك 🎉') },
  })

  if (!presets) return <Loading />
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-700 to-brand-800 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 text-center text-white">
          <div className="text-sm text-white/70">خطوة {step} من 2</div>
          <h1 className="text-2xl font-extrabold">أهلاً بك في دايسام — لنجهّز النظام لـ «{shop?.name}»</h1>
        </div>
        <div className="card p-5">
          {step === 1 ? (
            <>
              <h2 className="mb-1 text-lg font-extrabold">ما نوع نشاطك؟</h2>
              <p className="mb-4 text-sm text-slate-500">نجهّز الأقسام والتصنيفات وقوائم الماركات والأعطال حسب نشاطك. تقدر تغيّر أي شيء لاحقاً من الإعدادات.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {presets.map((p) => {
                  const Icon = TYPE_ICONS[p.key] ?? Store
                  const on = p.key === type
                  return (
                    <button key={p.key} onClick={() => setType(p.key)}
                      className={`flex items-start gap-3 rounded-2xl p-4 text-start ring-2 transition ${on ? 'bg-brand-50 ring-brand-600' : 'bg-white ring-slate-200 hover:ring-slate-300'}`}>
                      <div className={`rounded-xl p-2.5 ${on ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon size={22} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold">{p.label}{p.key === 'mobile' && <span className="chip ms-2 bg-amber-100 text-amber-800">الأكثر استخداماً</span>}</div>
                        <div className="text-sm text-slate-500">{p.description}</div>
                      </div>
                      {on && <Check className="shrink-0 text-brand-700" />}
                    </button>
                  )
                })}
              </div>
              <button className="btn-primary mt-5 w-full py-3" onClick={() => setStep(2)}>التالي</button>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-extrabold">الأقسام التي تستخدمها</h2>
              <p className="mb-4 text-sm text-slate-500">اخترنا لك الأقسام المناسبة لـ «{preset?.label}». فعّل أو أخفِ ما تريد.</p>
              <SectionToggles sections={sections} hidden={hidden} onChange={setHidden} />
              {preset && (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="mb-1 font-bold">تصنيفات المنتجات التي سنضيفها:</div>
                  <div className="flex flex-wrap gap-1.5">{preset.categories.map((c) => <span key={c} className="chip bg-white text-slate-600 ring-1 ring-slate-200">{c}</span>)}</div>
                </div>
              )}
              <div className="mt-5 flex gap-2">
                <button className="btn-secondary" onClick={() => setStep(1)}>رجوع</button>
                <button className="btn-primary flex-1 py-3" disabled={finish.isPending} onClick={() => finish.mutate(undefined)}>
                  {finish.isPending ? 'جاري التجهيز...' : 'ابدأ استخدام النظام'}
                </button>
              </div>
            </>
          )}
        </div>
        <button className="mx-auto mt-4 block text-sm text-white/70 underline" onClick={logout}>تسجيل الخروج</button>
      </div>
    </div>
  )
}

export function SectionToggles({ sections, hidden, onChange }: { sections: Record<string, string>; hidden: string[]; onChange: (h: string[]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {Object.entries(sections).map(([k, label]) => {
        const on = !hidden.includes(k)
        return (
          <button key={k} type="button" onClick={() => onChange(on ? [...hidden, k] : hidden.filter((x) => x !== k))}
            className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start text-sm font-bold ring-1 transition ${on ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-slate-50 text-slate-400 ring-slate-200'}`}>
            <span>{label}</span>{on ? <Check size={16} /> : <X size={16} />}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Settings: «تخصيص النظام» ---------- */

function ListEditor({ label, hint, value, onChange }: { label: ReactNode; hint?: ReactNode; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const items = draft.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean)
    if (items.length) onChange([...new Set([...value, ...items])])
    setDraft('')
  }
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {value.map((x) => (
          <span key={x} className="chip gap-1 bg-slate-100 py-1 text-slate-700">
            {x}<button type="button" className="text-slate-400 hover:text-rose-600" onClick={() => onChange(value.filter((v) => v !== x))} aria-label={`حذف ${x}`}><X size={12} /></button>
          </span>
        ))}
        {!value.length && <span className="text-xs text-slate-400">فارغة</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <input className="input py-1.5" placeholder="إضافة (افصل بفاصلة للإضافة المتعددة)" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <button type="button" className="btn-secondary px-3 py-1.5" onClick={add} aria-label="إضافة"><Plus size={16} /></button>
      </div>
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </div>
  )
}

export function CustomizationCard() {
  const { shop, refresh, sections } = useAuth()
  const { data: presets } = usePresets()
  const [cfg, setCfg] = useState<ShopConfig | null>(shop?.config ?? null)
  const [hidden, setHidden] = useState<string[]>(shop?.hidden_sections ?? [])
  const [newType, setNewType] = useState(shop?.business_type ?? 'mobile')
  useEffect(() => { if (shop) { setCfg(shop.config); setHidden(shop.hidden_sections); setNewType(shop.business_type) } }, [shop])

  const save = useAction(() => api.patch('/shop/', { customization: cfg, hidden_sections: hidden }), {
    success: 'تم حفظ التخصيص', onSuccess: () => refresh(),
  })
  const changeType = useAction(() => api.post('/shop/setup/', { business_type: newType, seed_categories: true }), {
    success: 'تم تطبيق نوع النشاط الجديد', onSuccess: () => refresh(),
  })
  if (!cfg || !shop) return null
  const set = <K extends keyof ShopConfig>(k: K, v: ShopConfig[K]) => setCfg({ ...cfg, [k]: v })
  const current = presets?.find((p) => p.key === shop.business_type)
  const Icon = TYPE_ICONS[shop.business_type] ?? Store

  return (
    <section className="card space-y-5 p-4">
      <h2 className="flex items-center gap-2 font-extrabold"><Settings2 size={18} />تخصيص النظام حسب نشاطك</h2>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-3">
        <div className="rounded-xl bg-brand-700 p-2.5 text-white"><Icon size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-500">نوع النشاط</div>
          <div className="font-extrabold">{current?.label ?? shop.business_type}</div>
        </div>
        <select className="input w-auto" value={newType} onChange={(e) => setNewType(e.target.value)}>
          {presets?.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <button className="btn-secondary" disabled={newType === shop.business_type || changeType.isPending}
          onClick={() => {
            if (confirm('تغيير نوع النشاط يعيد القوائم والأقسام الظاهرة لإعدادات النوع الجديد، ويضيف تصنيفاته (بدون حذف أي بيانات). متابعة؟')) changeType.mutate(undefined)
          }}>تطبيق</button>
      </div>

      <div>
        <span className="label">الأقسام الظاهرة في محلك</span>
        <SectionToggles sections={sections} hidden={hidden} onChange={setHidden} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Field label="اسم رقم التتبع للأجهزة" hint="يظهر في البيع والصيانة والفواتير — مثال: IMEI / السيريال، رقم الشاسيه، السيريال">
          <input className="input" value={cfg.serial_label} onChange={(e) => set('serial_label', e.target.value)} />
        </Field>
        <Field label="مدة الضمان الافتراضية (أيام)" hint="تُقترح تلقائياً للمنتجات الجديدة وإصلاحات الصيانة">
          <input className="input" inputMode="numeric" value={cfg.default_warranty_days} onChange={(e) => set('default_warranty_days', Number(e.target.value.replace(/\D/g, '')) || 0)} />
        </Field>
        <ListEditor label="الماركات" value={cfg.brands} onChange={(v) => set('brands', v)} />
        <ListEditor label="أنواع الأجهزة (الصيانة)" value={cfg.device_types} onChange={(v) => set('device_types', v)} />
        <ListEditor label="الأعطال الشائعة (الصيانة)" value={cfg.fault_tags} onChange={(v) => set('fault_tags', v)} />
        <ListEditor label="المرفقات المستلمة مع الجهاز" value={cfg.accessories} onChange={(v) => set('accessories', v)} />
        <ListEditor label="بنود فحص الجهاز عند الاستلام" hint="تظهر كقائمة فحص في استلام الصيانة وتُطبع على الإيصال"
          value={cfg.repair_checklist.map((i) => i.label)}
          onChange={(labels) => set('repair_checklist', labels.map((l) => cfg.repair_checklist.find((i) => i.label === l) ?? { key: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, label: l }))} />
        <ListEditor label="بنود المصروفات" value={cfg.expense_categories} onChange={(v) => set('expense_categories', v)} />
      </div>

      <SpecTemplatesEditor value={cfg.spec_templates} onChange={(v) => set('spec_templates', v)} />

      <button className="btn-primary w-full" disabled={save.isPending} onClick={() => save.mutate(undefined)}>حفظ التخصيص</button>
    </section>
  )
}

function SpecTemplatesEditor({ value, onChange }: { value: Record<string, string[]>; onChange: (v: Record<string, string[]>) => void }) {
  const [name, setName] = useState('')
  return (
    <div>
      <span className="label">قوالب مواصفات المنتجات</span>
      <div className="grid gap-3 lg:grid-cols-2">
        {Object.entries(value).map(([tpl, fields]) => (
          <div key={tpl} className="rounded-xl p-3 ring-1 ring-slate-200">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold">قالب «{tpl}»</span>
              <button type="button" className="btn-ghost px-1.5 py-1 text-rose-500" onClick={() => { const c = { ...value }; delete c[tpl]; onChange(c) }} aria-label="حذف القالب"><X size={14} /></button>
            </div>
            <ListEditor label="الخصائص" value={fields} onChange={(f) => onChange({ ...value, [tpl]: f })} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input className="input py-1.5" placeholder="اسم قالب جديد (مثال: لابتوب)" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="btn-secondary px-3 py-1.5" disabled={!name.trim()} onClick={() => { onChange({ ...value, [name.trim()]: [] }); setName('') }}><Plus size={16} />قالب</button>
      </div>
    </div>
  )
}
