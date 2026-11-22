import { ArrowLeftRight, Plus, ScanBarcode } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { CustomerPicker, ProductSearchModal } from '../components/pickers'
import { Badge, Empty, Fab, Field, Loading, Modal, Money, PageHeader, SearchBox, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { dateTime } from '../lib/format'
import { useAction, useDebounced, useList } from '../lib/hooks'
import type { Customer, Product, UsedDevice } from '../lib/types'

export default function UsedDevices() {
  const [q, setQ] = useState('')
  const [source, setSource] = useState('')
  const [adding, setAdding] = useState(false)
  const { data, isLoading } = useList<UsedDevice>('used-devices', { search: useDebounced(q), source: source || undefined })
  return (
    <div className="space-y-3">
      <PageHeader title="المستعمل والتبديل" subtitle="شراء أجهزة مستعملة من العملاء أو استلامها كاستبدال عند البيع" />
      <SearchBox value={q} onChange={setQ} placeholder="IMEI، اسم البائع، الموبايل أو الموديل" />
      <Tabs value={source} onChange={setSource} options={[{ value: '', label: 'الكل' }, { value: 'cash', label: 'شراء نقدي' }, { value: 'trade_in', label: 'استبدال' }]} />
      {isLoading ? <Loading /> : !data?.results.length ? <Empty icon={<ArrowLeftRight size={44} />} title="لا توجد أجهزة مستعملة" /> : (
        <div className="card">
          {data.results.map((d) => (
            <div key={d.id} className="list-row text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{d.product_display} <span className="font-mono text-xs font-normal text-slate-500" dir="ltr">{d.serial_number}</span></div>
                <div className="truncate text-xs text-slate-500">
                  من <Link to={`/customers/${d.customer}`} className="text-brand-700">{d.customer_name}</Link>
                  {d.customer_national_id ? ` · ${d.customer_national_id}` : ' · ⚠️ بدون رقم قومي'} · {dateTime(d.created_at)}
                </div>
                {d.condition && <div className="truncate text-xs text-slate-500">الحالة: {d.condition}</div>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Money value={d.price} className="font-extrabold" />
                {d.source === 'trade_in'
                  ? <Link to={`/invoices/${d.invoice}`}><Badge tone="violet">استبدال · فاتورة #{d.invoice_number}</Badge></Link>
                  : <Badge tone="blue">شراء نقدي</Badge>}
                {d.serial_status === 'sold' && <Badge tone="gray">تم بيعه</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Fab onClick={() => setAdding(true)} icon={<Plus size={20} />} label="شراء جهاز مستعمل" />
      <BuyUsedModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

export function BuyUsedModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [pick, setPick] = useState(false)
  const [scan, setScan] = useState(false)
  const [f, setF] = useState({ product_name: '', serial: '', price: '', resale_price: '', condition: '', accessories: '', notes: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const save = useAction(() => api.post('/used-devices/', {
    ...f, customer: customer?.id, product: product?.id ?? null, price: Number(f.price) || 0,
    resale_price: f.resale_price ? Number(f.resale_price) : null,
  }), {
    invalidate: ['used-devices', 'products', 'cash'], success: 'تم تسجيل الجهاز في المخزن',
    onSuccess: () => { setF({ product_name: '', serial: '', price: '', resale_price: '', condition: '', accessories: '', notes: '' }); setProduct(null); onClose() },
  })
  const closeScan = useCallback(() => setScan(false), [])
  const onScan = useCallback((code: string) => setF((x) => ({ ...x, serial: code })), [])
  return (
    <Modal open={open} onClose={onClose} wide title="شراء جهاز مستعمل من عميل" footer={
      <button className="btn-primary flex-1" disabled={!customer || !f.serial || !Number(f.price) || (!product && !f.product_name) || save.isPending}
        onClick={() => save.mutate(undefined)}>دفع <Money value={Number(f.price) || 0} /> وتسجيل الجهاز</button>
    }>
      <div className="space-y-3">
        <CustomerPicker value={customer} onChange={setCustomer} required />
        {customer && !customer.national_id && (
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            يُنصح بتسجيل الرقم القومي وصورة البطاقة للبائع — <Link className="font-bold underline" to={`/customers/${customer.id}`} target="_blank">فتح ملف العميل</Link>
          </p>
        )}
        <Fields f={f} set={set} product={product} setProduct={setProduct} onPick={() => setPick(true)} onScan={() => setScan(true)} />
      </div>
      <ProductSearchModal open={pick} onClose={() => setPick(false)} title="اختيار منتج (بالسيريال)"
        onPick={(p) => { if (p.track_serial) { setProduct(p); setPick(false) } else alert('اختر منتجاً يتتبع السيريال') }} />
      <BarcodeScanner open={scan} onClose={closeScan} onResult={onScan} />
    </Modal>
  )
}

/** Shared device fields (used in the standalone purchase and in the POS trade-in). */
export function Fields({ f, set, product, setProduct, onPick, onScan, priceLabel = 'سعر الشراء من العميل' }: {
  f: { product_name: string; serial: string; price: string; resale_price: string; condition: string; accessories: string }
  set: (k: 'product_name' | 'serial' | 'price' | 'resale_price' | 'condition' | 'accessories') => (e: React.ChangeEvent<HTMLInputElement>) => void
  product: Product | null; setProduct: (p: Product | null) => void; onPick: () => void; onScan: () => void; priceLabel?: string
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="الجهاز" className="col-span-2">
        {product ? (
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <span className="flex-1 font-bold">{product.name}</span>
            <button type="button" className="btn-ghost px-2 py-1" onClick={() => setProduct(null)}>تغيير</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input className="input" placeholder="مثال: iPhone 12 128GB مستعمل" value={f.product_name} onChange={set('product_name')} />
            <button type="button" className="btn-secondary shrink-0 px-3" onClick={onPick}>من المنتجات</button>
          </div>
        )}
      </Field>
      <Field label="IMEI / السيريال" className="col-span-2">
        <div className="flex gap-2">
          <input className="input font-mono" dir="ltr" value={f.serial} onChange={set('serial')} />
          <button type="button" className="btn-secondary px-3" onClick={onScan} aria-label="مسح"><ScanBarcode size={18} /></button>
        </div>
      </Field>
      <Field label={priceLabel}><input className="input font-bold" inputMode="decimal" value={f.price} onChange={set('price')} /></Field>
      {!product && <Field label="سعر إعادة البيع"><input className="input" inputMode="decimal" value={f.resale_price} onChange={set('resale_price')} /></Field>}
      <Field label="حالة الجهاز" className="col-span-2"><input className="input" placeholder="خدوش، بطارية 85%، تغيير شاشة..." value={f.condition} onChange={set('condition')} /></Field>
      <Field label="المرفقات" className="col-span-2"><input className="input" placeholder="علبة، شاحن..." value={f.accessories} onChange={set('accessories')} /></Field>
    </div>
  )
}
