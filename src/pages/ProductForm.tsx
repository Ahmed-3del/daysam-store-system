import { Plus, ScanBarcode, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { useToast } from '../components/toast'
import { Field, Loading, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { useAuth, useShopConfig } from '../lib/auth'
import { useAction, useGet } from '../lib/hooks'
import type { Category, Product } from '../lib/types'


const empty = {
  name: '', barcode: '', category: '' as string | number, brand: '', cost_price: '', sell_price: '', min_price: '',
  low_stock_threshold: '1', track_serial: false, is_service: false, warranty_days: '0', notes: '',
  show_in_catalog: false, is_used: false,
}

export default function ProductForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { isManager } = useAuth()
  const showCost = isManager || !id
  const cfg = useShopConfig()
  const SPEC_TEMPLATES = cfg.spec_templates
  const { data: product, isLoading } = useGet<Product>(['products', id], id ? `/products/${id}/` : null)
  const { data: cats, refetch: refetchCats } = useGet<Category[]>(['categories'], '/categories/')
  const [f, setF] = useState(() => ({ ...empty, warranty_days: String(cfg.default_warranty_days ?? 0) }))
  const [specs, setSpecs] = useState<[string, string][]>([])
  const [scan, setScan] = useState(false)
  const [opening, setOpening] = useState('')

  useEffect(() => {
    if (!product) return
    setF({
      name: product.name, barcode: product.barcode, category: product.category ?? '', brand: product.brand,
      cost_price: String(product.cost_price ?? ''), sell_price: String(product.sell_price), min_price: String(product.min_price),
      low_stock_threshold: String(product.low_stock_threshold), track_serial: product.track_serial,
      is_service: product.is_service, warranty_days: String(product.warranty_days), notes: product.notes,
      show_in_catalog: product.show_in_catalog, is_used: product.is_used,
    })
    setSpecs(Object.entries(product.specs || {}))
  }, [product])

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })

  const addCategory = async () => {
    const name = prompt('اسم التصنيف الجديد')
    if (!name) return
    try {
      const { data } = await api.post('/categories/', { name })
      await refetchCats(); setF((x) => ({ ...x, category: data.id }))
    } catch (e) { toast.error(e) }
  }

  const save = useAction(async () => {
    const body = {
      ...f, category: f.category || null, cost_price: Number(f.cost_price) || 0, sell_price: Number(f.sell_price) || 0,
      min_price: Number(f.min_price) || 0, low_stock_threshold: Number(f.low_stock_threshold) || 0,
      warranty_days: Number(f.warranty_days) || 0, specs: Object.fromEntries(specs.filter(([k]) => k.trim())),
    } as Record<string, unknown>
    if (!showCost) delete body.cost_price
    const { data } = id ? await api.patch<Product>(`/products/${id}/`, body) : await api.post<Product>('/products/', body)
    if (!id && Number(opening) > 0 && !data.track_serial && !data.is_service) {
      await api.post(`/products/${data.id}/adjust/`, { kind: 'opening', quantity: Number(opening) })
    }
    return data
  }, { invalidate: ['products', 'categories'], success: 'تم حفظ المنتج', onSuccess: (p) => nav(`/products/${p.id}`, { replace: true }) })

  const closeScan = useCallback(() => setScan(false), [])
  const onScan = useCallback((code: string) => setF((x) => ({ ...x, barcode: code })), [])

  if (id && isLoading) return <Loading />
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(undefined) }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PageHeader back title={id ? 'تعديل منتج' : 'منتج جديد'} />
      <div className="card grid gap-4 p-4 sm:grid-cols-2">
        <Field label="اسم المنتج" className="sm:col-span-2"><input className="input" required value={f.name} onChange={set('name')} /></Field>
        <Field label="الباركود">
          <div className="flex gap-2">
            <input className="input" dir="ltr" value={f.barcode} onChange={set('barcode')} />
            <button type="button" className="btn-secondary px-3" onClick={() => setScan(true)} aria-label="مسح"><ScanBarcode size={18} /></button>
          </div>
        </Field>
        <Field label="الماركة"><input className="input" value={f.brand} onChange={set('brand')} /></Field>
        <Field label="التصنيف">
          <div className="flex gap-2">
            <select className="input" value={f.category} onChange={set('category')}>
              <option value="">بدون تصنيف</option>
              {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" className="btn-secondary px-3" onClick={addCategory} aria-label="تصنيف جديد"><Plus size={18} /></button>
          </div>
        </Field>
        <Field label="الضمان (أيام)"><input className="input" inputMode="numeric" value={f.warranty_days} onChange={set('warranty_days')} /></Field>
        {showCost && <Field label="سعر الشراء"><input className="input" inputMode="decimal" value={f.cost_price} onChange={set('cost_price')} /></Field>}
        <Field label="سعر البيع"><input className="input" inputMode="decimal" required value={f.sell_price} onChange={set('sell_price')} /></Field>
        <Field label="أقل سعر بيع مسموح" hint="الكاشير لا يستطيع البيع بأقل منه"><input className="input" inputMode="decimal" value={f.min_price} onChange={set('min_price')} /></Field>
        <Field label="تنبيه النواقص عند"><input className="input" inputMode="numeric" value={f.low_stock_threshold} onChange={set('low_stock_threshold')} /></Field>
        <div className="space-y-2 sm:col-span-2">
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="size-4" checked={f.track_serial} disabled={!!product?.quantity} onChange={set('track_serial')} />تتبع بـ {cfg.serial_label} (لكل قطعة رقم مميز)</label>
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="size-4" checked={f.is_service} onChange={set('is_service')} />خدمة بدون مخزون (مثل: تحميل برامج، كارت شحن)</label>
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="size-4" checked={f.is_used} onChange={set('is_used')} />منتج مستعمل</label>
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="size-4" checked={f.show_in_catalog} onChange={set('show_in_catalog')} />يظهر في المتجر الإلكتروني</label>
        </div>
        {!id && !f.track_serial && !f.is_service && (
          <Field label="رصيد افتتاحي (اختياري)" hint="للكميات الموجودة حالياً بالمحل"><input className="input" inputMode="numeric" value={opening} onChange={(e) => setOpening(e.target.value)} /></Field>
        )}
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-extrabold">المواصفات الفنية</h2>
          <div className="flex gap-1">
            {Object.keys(SPEC_TEMPLATES).map((t) => (
              <button type="button" key={t} className="btn-ghost px-2 py-1 text-xs" onClick={() => setSpecs(SPEC_TEMPLATES[t].map((k) => [k, specs.find(([sk]) => sk === k)?.[1] || '']))}>قالب {t}</button>
            ))}
          </div>
        </div>
        {specs.map(([k, v], i) => (
          <div key={i} className="flex gap-2">
            <input className="input" placeholder="الخاصية" value={k} onChange={(e) => setSpecs(specs.map((s, j) => (j === i ? [e.target.value, s[1]] : s)))} />
            <input className="input" placeholder="القيمة" value={v} onChange={(e) => setSpecs(specs.map((s, j) => (j === i ? [s[0], e.target.value] : s)))} />
            <button type="button" className="btn-ghost px-2 text-rose-500" onClick={() => setSpecs(specs.filter((_, j) => j !== i))} aria-label="حذف"><Trash2 size={18} /></button>
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={() => setSpecs([...specs, ['', '']])}><Plus size={16} />إضافة خاصية</button>
        <Field label="ملاحظات"><textarea className="input" rows={2} value={f.notes} onChange={set('notes')} /></Field>
      </div>

      <button className="btn-primary w-full py-3" disabled={save.isPending}>{save.isPending ? 'جاري الحفظ...' : 'حفظ المنتج'}</button>
      <BarcodeScanner open={scan} onClose={closeScan} onResult={onScan} />
    </form>
  )
}
