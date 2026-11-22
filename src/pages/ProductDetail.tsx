import { Camera, ClipboardCheck, Globe, Pencil, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Field, InfoRow, Loading, Modal, Money, PageHeader, Tabs, type Tone } from '../components/ui'
import { useApproval } from '../components/approval'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { date, dateTime, num } from '../lib/format'
import { useAction, useGet } from '../lib/hooks'
import type { Product, SerialItem, StockMovement } from '../lib/types'

const serialTone: Record<string, Tone> = { in_stock: 'green', sold: 'gray', damaged: 'red', returned_to_supplier: 'amber' }
const serialLabel: Record<string, string> = { in_stock: 'في المخزن', sold: 'مباع', damaged: 'تالف', returned_to_supplier: 'مرتجع للمورد' }

export default function ProductDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { isManager } = useAuth()
  const { data: p, isLoading } = useGet<Product>(['products', id], `/products/${id}/`)
  const [tab, setTab] = useState<'serials' | 'moves'>('moves')
  const [adjust, setAdjust] = useState(false)
  const { data: serials } = useGet<SerialItem[]>(['products', id, 'serials'], p?.track_serial ? `/products/${id}/serials/` : null)
  const { data: moves } = useGet<StockMovement[]>(['products', id, 'moves'], `/products/${id}/movements/`)
  const approval = useApproval()
  const archive = useAction(() => approval.run((extra) => api.delete(`/products/${id}/`, { data: extra })),
    { invalidate: ['products'], success: 'تمت أرشفة المنتج', onSuccess: () => nav('/products') })
  if (isLoading || !p) return <Loading />

  return (
    <div className="space-y-4">
      <PageHeader back="/products" title={p.name} subtitle={p.category_name} actions={
        <>
          <Link to={`/products/${p.id}/edit`} className="btn-secondary px-3"><Pencil size={18} /></Link>
          {<button className="btn-ghost px-3 text-rose-600" onClick={() => confirm('أرشفة المنتج؟') && archive.mutate(undefined)} aria-label="أرشفة"><Trash2 size={18} /></button>}
        </>
      } />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <ProductImage product={p} />
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">الكمية المتاحة</div>
              <div className={`text-3xl font-extrabold ${p.is_low_stock ? 'text-rose-600' : ''}`}>{p.is_service ? '∞' : num(p.quantity)}</div>
            </div>
            {!p.is_service && <button className="btn-primary" onClick={() => setAdjust(true)}><ClipboardCheck size={18} />جرد / تسوية</button>}
          </div>
          <InfoRow label="سعر البيع"><Money value={p.sell_price} /></InfoRow>
          {isManager && <InfoRow label="سعر الشراء"><Money value={p.cost_price} /></InfoRow>}
          <InfoRow label="أقل سعر"><Money value={p.min_price} /></InfoRow>
          {p.barcode && <InfoRow label="الباركود"><span dir="ltr">{p.barcode}</span></InfoRow>}
          {p.brand && <InfoRow label="الماركة">{p.brand}</InfoRow>}
          <InfoRow label="الضمان">{p.warranty_days ? `${p.warranty_days} يوم` : 'بدون'}</InfoRow>
          {Object.entries(p.specs || {}).map(([k, v]) => <InfoRow key={k} label={k}>{v}</InfoRow>)}
          {p.notes && <p className="mt-2 text-sm text-slate-600">{p.notes}</p>}
        </div>

        <div className="space-y-3 lg:col-span-2">
          <Tabs value={tab} onChange={setTab} options={[
            { value: 'moves', label: 'حركة المخزون' },
            ...(p.track_serial ? [{ value: 'serials' as const, label: `السيريالات (${serials?.length ?? 0})` }] : []),
          ]} />
          <div className="card">
            {tab === 'serials' && p.track_serial ? (
              serials?.length ? serials.map((s) => (
                <div key={s.id} className="list-row text-sm">
                  <span className="flex-1 font-mono" dir="ltr">{s.serial}</span>
                  <span className="text-xs text-slate-500">{s.sold_at ? `بيع ${date(s.sold_at)}` : date(s.created_at)}</span>
                  <Badge tone={serialTone[s.status]}>{serialLabel[s.status]}</Badge>
                </div>
              )) : <p className="p-6 text-center text-sm text-slate-500">لا توجد سيريالات بعد — أضفها من التوريد أو الجرد.</p>
            ) : moves?.length ? moves.map((m) => (
              <div key={m.id} className="list-row text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{m.kind_display}</div>
                  <div className="truncate text-xs text-slate-500">{dateTime(m.created_at)} · {m.user} {m.note && `· ${m.note}`}</div>
                </div>
                <span className={`font-extrabold tabular-nums ${m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`} dir="ltr">{m.quantity > 0 ? '+' : ''}{m.quantity}</span>
                <span className="w-12 text-end text-xs text-slate-500">= {m.quantity_after}</span>
              </div>
            )) : <p className="p-6 text-center text-sm text-slate-500">لا توجد حركات.</p>}
          </div>
        </div>
      </div>
      <AdjustModal product={p} open={adjust} onClose={() => setAdjust(false)} />
    </div>
  )
}

function AdjustModal({ product, open, onClose }: { product: Product; open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<'adjustment' | 'damage' | 'opening'>(product.track_serial ? 'opening' : 'adjustment')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const save = useAction(() => {
    const body: Record<string, unknown> = { kind, note }
    if (product.track_serial) body.serials = value.split(/[\s,]+/).filter(Boolean)
    else if (kind === 'adjustment') body.counted_quantity = Number(value)
    else body.quantity = Number(value)
    return api.post(`/products/${product.id}/adjust/`, body)
  }, { invalidate: ['products'], success: 'تم تحديث المخزون', onSuccess: () => { setValue(''); setNote(''); onClose() } })

  const kinds = product.track_serial
    ? [{ v: 'opening', l: 'إضافة سيريالات' }, { v: 'damage', l: 'تسجيل تالف' }]
    : [{ v: 'adjustment', l: 'جرد (الكمية الفعلية)' }, { v: 'opening', l: 'إضافة رصيد' }, { v: 'damage', l: 'تالف' }]
  return (
    <Modal open={open} onClose={onClose} title="جرد وتسوية المخزون" footer={
      <button className="btn-primary flex-1" disabled={!value || save.isPending} onClick={() => save.mutate(undefined)}>حفظ</button>
    }>
      <div className="space-y-3">
        <Field label="نوع العملية">
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {kinds.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
          </select>
        </Field>
        {product.track_serial ? (
          <Field label="السيريالات / IMEI" hint="كل سيريال في سطر">
            <textarea className="input font-mono" dir="ltr" rows={5} value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        ) : (
          <Field label={kind === 'adjustment' ? `الكمية الفعلية بالمحل (المسجل ${product.quantity})` : 'الكمية'}>
            <input className="input" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        )}
        <Field label="ملاحظة"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function ProductImage({ product }: { product: Product }) {
  const input = useRef<HTMLInputElement>(null)
  const upload = useAction((file: File) => {
    const fd = new FormData()
    fd.append('image', file)
    return api.post(`/products/${product.id}/image/`, fd)
  }, { invalidate: ['products'], success: 'تم رفع الصورة' })
  const remove = useAction(() => api.delete(`/products/${product.id}/image/`), { invalidate: ['products'] })
  return (
    <div className="mb-3 flex items-center gap-3">
      <button className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200" onClick={() => input.current?.click()} aria-label="صورة المنتج">
        {product.image ? <img src={product.image} alt="" className="size-full object-cover" /> : <Camera className="m-auto text-slate-400" />}
      </button>
      <div className="space-y-1 text-xs">
        <button className="btn-secondary px-2.5 py-1.5" disabled={upload.isPending} onClick={() => input.current?.click()}>{upload.isPending ? 'جاري الرفع...' : product.image ? 'تغيير الصورة' : 'إضافة صورة'}</button>
        {product.image && <button className="btn-ghost px-2 py-1 text-rose-600" onClick={() => remove.mutate(undefined)}>حذف</button>}
        {product.show_in_catalog && <div className="flex items-center gap-1 text-emerald-700"><Globe size={14} />يظهر في المتجر الإلكتروني</div>}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = '' }} />
    </div>
  )
}
