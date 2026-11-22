import JsBarcode from 'jsbarcode'
import { AlertTriangle, Barcode, Printer, Wand2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { ProductSearchModal } from '../components/pickers'
import { Empty, Field, Loading, PageHeader, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { num } from '../lib/format'
import { useAction, useGet } from '../lib/hooks'
import type { Category, Product } from '../lib/types'

interface LabelProduct {
  id: number; name: string; brand: string; barcode: string; price: number | string; quantity: number
  category: number | null; category_name: string; track_serial: boolean; serials: string[]
}
interface LabelItem { key: string; code: string; name: string; price: number | string; sub?: string }

/** Label stock: thermal rolls print one label per page; A4 sheets are a fixed grid (mm). */
const SIZES = {
  'r38x25': { label: 'رول حراري 38×25 مم', w: 38, h: 25 },
  'r40x30': { label: 'رول حراري 40×30 مم', w: 40, h: 30 },
  'r50x30': { label: 'رول حراري 50×30 مم', w: 50, h: 30 },
  'r58x40': { label: 'رول حراري 58×40 مم', w: 58, h: 40 },
  'a4x24': { label: 'ورق A4 — 24 ملصق (3×8)', w: 70, h: 37, cols: 3, rows: 8, top: 0.5, side: 0, gapX: 0 },
  'a4x40': { label: 'ورق A4 — 40 ملصق (4×10)', w: 52.5, h: 29.7, cols: 4, rows: 10, top: 0, side: 0, gapX: 0 },
  'a4x65': { label: 'ورق A4 — 65 ملصق (5×13)', w: 38.1, h: 21.2, cols: 5, rows: 13, top: 10.7, side: 4.75, gapX: 2.5 },
} as const
type SizeKey = keyof typeof SIZES
type Sheet = { w: number; h: number; cols: number; rows: number; top: number; side: number; gapX: number }
const sheetOf = (k: SizeKey) => ('cols' in SIZES[k] ? SIZES[k] as unknown as Sheet : null)

interface Opts {
  size: SizeKey; copies: 'stock' | 'fixed'; fixed: number; serials: boolean; inStock: boolean
  showShop: boolean; showName: boolean; showPrice: boolean; showDigits: boolean
}
const OPTS_KEY = 'daysam.labels'
const defaults: Opts = { size: 'r38x25', copies: 'fixed', fixed: 1, serials: false, inStock: false, showShop: true, showName: true, showPrice: true, showDigits: true }
function loadOpts(): Opts {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(OPTS_KEY) || '{}') } } catch { return defaults }
}

const MAX_LABELS = 3000

function validEan13(c: string) {
  if (!/^\d{13}$/.test(c)) return false
  const sum = [...c.slice(0, 12)].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === Number(c[12])
}

/** Barcode bars stretched to fill the box; digits drawn as text so they stay crisp on small labels. */
function BarcodeSvg({ code }: { code: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const opts = { displayValue: false, margin: 0, height: 60, width: 2 }
    try {
      JsBarcode(el, code, { ...opts, format: validEan13(code) ? 'EAN13' : 'CODE128' })
    } catch {
      try { JsBarcode(el, code, { ...opts, format: 'CODE128' }) } catch { return }
    }
    const w = el.getAttribute('width')?.replace('px', '') || '100'
    const h = el.getAttribute('height')?.replace('px', '') || '60'
    el.setAttribute('viewBox', `0 0 ${w} ${h}`)
    el.setAttribute('preserveAspectRatio', 'none')
    el.setAttribute('shape-rendering', 'crispEdges')
    el.removeAttribute('width'); el.removeAttribute('height')
    el.removeAttribute('style')
  }, [code])
  return <svg ref={ref} className="block h-full w-full" />
}

function Label({ item, o, shopName }: { item: LabelItem; o: Opts; shopName: string }) {
  const { w, h } = SIZES[o.size]
  const fs = Math.max(1.9, Math.min(3, h / 10)) // mm
  return (
    <div className="label-cell flex flex-col overflow-hidden bg-white text-black"
      style={{ width: `${w}mm`, height: `${h}mm`, padding: '1.2mm 1.6mm', fontSize: `${fs}mm`, lineHeight: 1.15 }}>
      {o.showShop && shopName && <div className="truncate text-center font-bold" style={{ fontSize: `${fs * 0.8}mm` }}>{shopName}</div>}
      {o.showName && <div className="line-clamp-2 text-center font-bold">{item.name}</div>}
      {item.sub && <div className="truncate text-center" style={{ fontSize: `${fs * 0.8}mm` }}>{item.sub}</div>}
      <div className="min-h-0 flex-1" style={{ padding: `0.6mm ${Math.min(3, w * 0.07)}mm` }}><BarcodeSvg code={item.code} /></div>
      <div className="flex items-baseline justify-between gap-1">
        {o.showDigits && <span dir="ltr" className="font-mono tracking-wider" style={{ fontSize: `${fs * 0.85}mm` }}>{item.code}</span>}
        {o.showPrice && <span className="ms-auto whitespace-nowrap font-extrabold">{num(Number(item.price))} ج</span>}
      </div>
    </div>
  )
}

/** All labels laid out for printing: roll = one per page; sheet = grid pages. */
function Pages({ items, o, shopName }: { items: LabelItem[]; o: Opts; shopName: string }) {
  const sheet = sheetOf(o.size)
  if (!sheet) {
    return <>{items.map((it) => <div key={it.key} className="label-page"><Label item={it} o={o} shopName={shopName} /></div>)}</>
  }
  const per = sheet.cols * sheet.rows
  const pages = Array.from({ length: Math.ceil(items.length / per) }, (_, i) => items.slice(i * per, (i + 1) * per))
  return (
    <>
      {pages.map((pg, i) => (
        <div key={i} className="label-page" style={{ width: '210mm', height: '297mm', paddingTop: `${sheet.top}mm`, paddingInline: `${sheet.side}mm` }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sheet.cols}, ${sheet.w}mm)`, gridAutoRows: `${sheet.h}mm`, columnGap: `${sheet.gapX}mm` }}>
            {pg.map((it) => <Label key={it.key} item={it} o={o} shopName={shopName} />)}
          </div>
        </div>
      ))}
    </>
  )
}

export default function Labels() {
  const { shop } = useAuth()
  const [params] = useSearchParams()
  const initialIds = (params.get('ids') || '').split(',').filter(Boolean)
  const [scope, setScope] = useState<'all' | 'categories' | 'products'>(initialIds.length ? 'products' : params.get('category') ? 'categories' : 'all')
  const [cats, setCats] = useState<string[]>(params.get('category') ? [params.get('category')!] : [])
  const [picked, setPicked] = useState<{ id: number; name: string }[]>([])
  const [ids, setIds] = useState<string[]>(initialIds)
  const [searching, setSearching] = useState(false)
  const [o, setO] = useState<Opts>(loadOpts)
  const set = (patch: Partial<Opts>) => setO((x) => { const n = { ...x, ...patch }; try { localStorage.setItem(OPTS_KEY, JSON.stringify(n)) } catch { /* private mode */ } return n })

  const { data: categories } = useGet<Category[]>(['categories'], '/categories/')
  const query = {
    scope, categories: cats.join(','), ids: ids.join(','),
    in_stock: o.inStock ? 1 : undefined, serials: o.serials ? 1 : undefined,
  }
  const ready = scope === 'all' || (scope === 'categories' ? cats.length > 0 : ids.length > 0)
  const { data, isFetching } = useGet<LabelProduct[]>(['products', 'labels', query], ready ? '/products/labels/' : null, query)
  const assign = useAction(() => api.post<{ assigned: number }>('/products/assign-barcodes/', query).then((r) => r.data), {
    invalidate: ['products'], success: 'تم توليد الأكواد',
  })

  // Names for products preselected from a link (?ids=) so the chips aren't blank.
  useEffect(() => {
    if (data && scope === 'products' && !picked.length && ids.length) setPicked(data.map((p) => ({ id: p.id, name: p.name })))
  }, [data, scope, picked.length, ids.length])

  const products = useMemo(() => data ?? [], [data])
  const missing = products.filter((p) => !p.barcode && !(o.serials && p.track_serial && p.serials.length)).length
  const items = useMemo(() => {
    const out: LabelItem[] = []
    for (const p of products) {
      if (o.serials && p.track_serial && p.serials.length) {
        for (const s of p.serials) out.push({ key: `${p.id}-${s}`, code: s, name: p.name, price: p.price, sub: 'IMEI' })
        continue
      }
      if (!p.barcode) continue
      const n = o.copies === 'stock' ? Math.max(0, p.quantity) : Math.max(1, o.fixed || 1)
      for (let i = 0; i < n; i++) out.push({ key: `${p.id}-${i}`, code: p.barcode, name: p.name, price: p.price })
    }
    return out
  }, [products, o.serials, o.copies, o.fixed])
  const printable = items.slice(0, MAX_LABELS)
  const sheet = sheetOf(o.size)
  const { w, h } = SIZES[o.size]

  useEffect(() => {
    document.body.classList.add('print-isolate')
    return () => document.body.classList.remove('print-isolate')
  }, [])

  const toggleCat = (id: string) => setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  const addProduct = (p: Product) => {
    if (ids.includes(String(p.id))) return
    setIds((x) => [...x, String(p.id)]); setPicked((x) => [...x, { id: p.id, name: p.name }])
  }
  const removeProduct = (id: number) => { setIds((x) => x.filter((v) => v !== String(id))); setPicked((x) => x.filter((v) => v.id !== id)) }
  const shopName = shop?.name ?? ''

  return (
    <div className="space-y-4">
      <PageHeader back="/products" title="طباعة الباركود والملصقات" subtitle="ملصقات بالكود والسعر للصقها على منتجات المخزن" />
      <style>{`@media print {
        @page { size: ${sheet ? 'A4' : `${w}mm ${h}mm`}; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important; }
        .label-page { break-after: page; page-break-after: always; overflow: hidden; }
        .label-page:last-child { break-after: auto; page-break-after: auto; }
        .label-cell { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }`}</style>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card space-y-4 p-4 lg:col-span-1">
          <div>
            <span className="label">ماذا تطبع؟</span>
            <Tabs value={scope} onChange={setScope} options={[
              { value: 'all', label: 'كل المخزن' }, { value: 'categories', label: 'أقسام معينة' }, { value: 'products', label: 'منتجات محددة' },
            ]} />
          </div>
          {scope === 'categories' && (
            <div className="flex flex-wrap gap-2">
              {[...(categories || []).map((c) => ({ id: String(c.id), name: `${c.name} (${c.products_count})` })), { id: '-1', name: 'بدون قسم' }].map((c) => (
                <button key={c.id} type="button" onClick={() => toggleCat(c.id)}
                  className={`chip px-3 py-1.5 text-sm ${cats.includes(c.id) ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700'}`}>{c.name}</button>
              ))}
            </div>
          )}
          {scope === 'products' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {picked.map((p) => (
                  <span key={p.id} className="chip bg-slate-100 py-1 text-sm">{p.name}
                    <button type="button" onClick={() => removeProduct(p.id)} aria-label="إزالة"><X size={14} /></button></span>
                ))}
              </div>
              <button type="button" className="btn-secondary w-full" onClick={() => setSearching(true)}>+ إضافة منتج</button>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" className="size-4" checked={o.inStock} onChange={(e) => set({ inStock: e.target.checked })} />المنتجات الموجودة في المخزن فقط
          </label>

          <Field label="مقاس الملصق">
            <select className="input" value={o.size} onChange={(e) => set({ size: e.target.value as SizeKey })}>
              {Object.entries(SIZES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </select>
          </Field>
          <div>
            <span className="label">عدد النسخ لكل منتج</span>
            <div className="flex items-center gap-2">
              <Tabs value={o.copies} onChange={(v) => set({ copies: v })} options={[{ value: 'fixed', label: 'عدد ثابت' }, { value: 'stock', label: 'حسب الكمية' }]} />
              {o.copies === 'fixed' && <input className="input w-20 text-center" inputMode="numeric" value={o.fixed || ''}
                onChange={(e) => set({ fixed: Math.min(500, Number(e.target.value.replace(/\D/g, '')) || 0) })} />}
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm font-bold">
            <input type="checkbox" className="mt-0.5 size-4" checked={o.serials} onChange={(e) => set({ serials: e.target.checked })} />
            <span>الأجهزة بالسيريال: ملصق لكل جهاز بالـ IMEI<span className="block text-xs font-normal text-slate-500">يُقرأ في نقطة البيع ويحدد الجهاز نفسه</span></span>
          </label>
          <div>
            <span className="label">محتوى الملصق</span>
            <div className="grid grid-cols-2 gap-2 text-sm font-bold">
              {([['showShop', 'اسم المحل'], ['showName', 'اسم المنتج'], ['showPrice', 'السعر'], ['showDigits', 'أرقام الكود']] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={o[k]} onChange={(e) => set({ [k]: e.target.checked })} />{l}</label>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 lg:col-span-2">
          {!ready ? (
            <div className="card p-6 text-center text-sm text-slate-500">{scope === 'categories' ? 'اختر قسماً أو أكثر.' : 'أضف المنتجات التي تريد طباعة ملصقاتها.'}</div>
          ) : !data ? <Loading /> : (
            <>
              {missing > 0 && (
                <div className="card flex flex-wrap items-center gap-3 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle size={18} />
                  <span className="flex-1">{num(missing)} منتج بدون باركود — لن تُطبع لها ملصقات.</span>
                  <button className="btn-primary px-3 py-1.5" disabled={assign.isPending}
                    onClick={() => confirm(`توليد باركود داخلي لـ ${missing} منتج؟ يمكنك تعديله لاحقاً من صفحة المنتج.`) && assign.mutate(undefined)}>
                    <Wand2 size={16} />{assign.isPending ? 'جاري التوليد...' : 'توليد أكواد لها'}
                  </button>
                </div>
              )}
              <div className="card flex flex-wrap items-center gap-3 p-3">
                <div className="flex-1 text-sm">
                  <b>{num(items.length)}</b> ملصق من <b>{num(products.length)}</b> منتج
                  {sheet && <> · {num(Math.ceil(printable.length / (sheet.cols * sheet.rows)))} ورقة A4</>}
                  {isFetching && <span className="text-slate-400"> · تحديث...</span>}
                  {items.length > MAX_LABELS && <div className="text-xs text-rose-600">الحد الأقصى {num(MAX_LABELS)} ملصق في المرة — اطبع على دفعات (اختر أقساماً).</div>}
                </div>
                <button className="btn-primary" disabled={!printable.length} onClick={() => window.print()}><Printer size={18} />طباعة</button>
              </div>
              {!items.length ? <Empty icon={<Barcode size={44} />} title="لا توجد ملصقات للطباعة" /> : (
                <div className="card overflow-x-auto bg-slate-100 p-3">
                  <div className="mb-2 text-xs text-slate-500">معاينة (أول {num(Math.min(printable.length, 24))})</div>
                  <div className="flex flex-wrap gap-2" dir="rtl">
                    {printable.slice(0, 24).map((it) => <div key={it.key} className="shadow-sm ring-1 ring-slate-300"><Label item={it} o={o} shopName={shopName} /></div>)}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {sheet ? 'اطبع بمقاس A4 بدون هوامش وبنسبة 100% (بدون «ملاءمة للصفحة»).' : `في إعدادات الطابعة الحرارية اختر مقاس الورق ${w}×${h} مم وهوامش صفر.`}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {createPortal(<div className="print-portal print-only" dir="rtl"><Pages items={printable} o={o} shopName={shopName} /></div>, document.body)}
      {searching && <ProductSearchModal open onClose={() => setSearching(false)} onPick={(p: Product) => { addProduct(p); setSearching(false) }} />}
    </div>
  )
}
