import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeftRight, CloudOff, Cpu, Globe, Minus, Plus, Printer, ScanBarcode, ShoppingCart, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { QUEUED, useApproval } from '../components/approval'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { CustomerPicker, ProductSearchModal } from '../components/pickers'
import { useToast } from '../components/toast'
import { Empty, Field, Modal, Money, PageHeader, SearchBox, Tabs } from '../components/ui'
import { api, type Paginated } from '../lib/api'
import { useAuth, useShopConfig } from '../lib/auth'
import { todayISO } from '../lib/format'
import { useDebounced, useGet, useList } from '../lib/hooks'
import { searchSnapshot, useOffline } from '../lib/offline'
import type { OutboxSale } from '../lib/offlineDb'
import { InvoiceReceipt } from '../components/InvoiceReceipt'
import type { Bundle, Customer, Invoice, Product, SerialItem, Shift } from '../lib/types'
import { POS_ORDER_KEY } from './CatalogOrders'
import { Fields as TradeInFields } from './UsedDevices'

type BundleTag = { id: number; name: string; price: number; instance: string }
type Line = {
  key: string; product: Product; serial?: { id: number; serial: string }; quantity: number; unit_price: number
  bundle?: BundleTag
}
type Method = 'cash' | 'card' | 'wallet' | 'credit' | 'installment'
type OrderRef = { id: number; number: number; name: string; phone: string }

const METHODS: { value: Method; label: string }[] = [
  { value: 'cash', label: 'نقدي' }, { value: 'card', label: 'فيزا' }, { value: 'wallet', label: 'محفظة' },
  { value: 'credit', label: 'آجل' }, { value: 'installment', label: 'تقسيط' },
]
const CART_KEY = 'daysam.cart'
const emptyTrade = { product_name: '', serial: '', price: '', resale_price: '', condition: '', accessories: '' }

function readJSON<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback }
}

export default function POS() {
  const toast = useToast()
  const nav = useNavigate()
  const approval = useApproval()
  const { shop, user } = useAuth()
  const serialWord = useShopConfig().serial_label
  const off = useOffline()
  const online = off.online
  const [offlineReceipt, setOfflineReceipt] = useState<OutboxSale | null>(null)
  useEffect(() => { off.refreshSnapshot() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [lines, setLines] = useState<Line[]>(() => readJSON(CART_KEY, []))
  const [order, setOrder] = useState<OrderRef | null>(() => readJSON(POS_ORDER_KEY, null))
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 250)
  const [scan, setScan] = useState(false)
  const [serialFor, setSerialFor] = useState<{ product: Product; lineKey?: string } | null>(null)
  const [bundlePicker, setBundlePicker] = useState(false)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [discount, setDiscount] = useState('')
  const [method, setMethod] = useState<Method>('cash')
  const [received, setReceived] = useState('')
  const [inst, setInst] = useState({ down_payment: '', months: '6', interest_rate: '0', start_date: '', guarantor_name: '', guarantor_phone: '' })
  const [notes, setNotes] = useState('')
  const [tradeOn, setTradeOn] = useState(false)
  const [trade, setTrade] = useState(emptyTrade)
  const [tradeProduct, setTradeProduct] = useState<Product | null>(null)
  const [tradePick, setTradePick] = useState(false)
  const [tradeScan, setTradeScan] = useState(false)
  const [busy, setBusy] = useState(false)
  const closeScan = useCallback(() => setScan(false), [])
  const closeTradeScan = useCallback(() => setTradeScan(false), [])
  const onTradeScan = useCallback((code: string) => setTrade((t) => ({ ...t, serial: code })), [])

  const { data: shift } = useGet<Shift | null>(['shifts', 'current'], shop?.require_shift ? '/shifts/current/' : null)

  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(lines)) } catch { /* ignore */ } }, [lines])

  const { data: remoteResults } = useQuery({
    queryKey: ['products', 'pos', dq],
    queryFn: async () => (await api.get<Paginated<Product>>('/products/', { params: { search: dq, is_active: true, page_size: 12 } })).data.results,
    enabled: dq.length > 0 && online,
  })
  const results = online ? remoteResults : (dq ? searchSnapshot(off.snapshot, dq) : undefined)
  const productById = useCallback(async (id: number) => {
    const local = off.snapshot?.products.find((p) => p.id === id)
    if (!online && local) return local
    try { return (await api.get<Product>(`/products/${id}/`)).data } catch (e) { if (local) return local; throw e }
  }, [off.snapshot, online])

  const addProduct = useCallback((p: Product, serial?: { id: number; serial: string }) => {
    if (p.track_serial && !serial) { setSerialFor({ product: p }); return }
    setLines((ls) => {
      if (serial) {
        if (ls.some((l) => l.serial?.id === serial.id)) { toast.error('هذا السيريال موجود بالفعل في السلة.'); return ls }
        return [...ls, { key: `s${serial.id}`, product: p, serial, quantity: 1, unit_price: Number(p.sell_price) }]
      }
      const ex = ls.find((l) => l.product.id === p.id && !l.serial && !l.bundle)
      if (ex) return ls.map((l) => (l === ex ? { ...l, quantity: l.quantity + 1 } : l))
      return [...ls, { key: `p${p.id}`, product: p, quantity: 1, unit_price: Number(p.sell_price) }]
    })
    setQ('')
  }, [toast])

  const addBundle = useCallback(async (b: Bundle) => {
    const instance = `${b.id}-${Date.now()}`
    const tag: BundleTag = { id: b.id, name: b.name, price: Number(b.price), instance }
    try {
      const products = await Promise.all(b.items.map((i) => productById(i.product)))
      const newLines: Line[] = b.items.flatMap((i, idx) => {
        const p = products[idx]
        if (p.track_serial) {
          return Array.from({ length: i.quantity }, (_, k) => ({ key: `b${instance}-${p.id}-${k}`, product: p, quantity: 1, unit_price: Number(p.sell_price), bundle: tag }))
        }
        return [{ key: `b${instance}-${p.id}`, product: p, quantity: i.quantity, unit_price: Number(p.sell_price), bundle: tag }]
      })
      setLines((ls) => [...ls, ...newLines])
      setQ('')
      if (newLines.some((l) => l.product.track_serial)) toast.ok(`اختر ${serialWord} لمكونات الباقة المميزة بالأصفر`)
    } catch (e) { toast.error(e) }
  }, [toast, productById])

  const lookup = useCallback(async (code: string) => {
    if (!online) {
      const snap = off.snapshot
      const s = snap?.serials.find((x) => x.serial === code)
      if (s) {
        if (off.reservedSerials.has(s.id)) { toast.error(`السيريال ${code} مباع في فاتورة لم تُزامن بعد.`); return }
        const p = snap!.products.find((x) => x.id === s.product_id)
        if (p) { addProduct(p, { id: s.id, serial: s.serial }); return }
      }
      const b = snap?.bundles.find((x) => x.barcode && x.barcode === code)
      if (b) { addBundle(b); return }
      const p = snap?.products.find((x) => x.barcode && x.barcode === code)
      if (p) { addProduct(p); return }
      toast.error(`لا يوجد منتج بالكود ${code} في النسخة المحفوظة على الجهاز`)
      return
    }
    try {
      const { data } = await api.get<{ product: Product | null; serial: SerialItem | null; bundle?: Bundle }>('/products/lookup/', { params: { code } })
      if (data.bundle) { addBundle(data.bundle); return }
      if (data.serial && data.serial.status !== 'in_stock') { toast.error(`السيريال ${code} حالته: ${data.serial.status === 'sold' ? 'مباع' : 'غير متاح'}`); return }
      addProduct(data.product!, data.serial ? { id: data.serial.id, serial: data.serial.serial } : undefined)
    } catch { toast.error(`لا يوجد منتج بالكود ${code}`) }
  }, [addProduct, addBundle, toast, online, off.snapshot, off.reservedSerials])

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    const code = q.trim()
    if (!code) return
    if (results?.length === 1) addProduct(results[0])
    else lookup(code)
  }

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.unit_price * l.quantity, 0), [lines])
  const bundleDiscount = useMemo(() => {
    const groups = new Map<string, { price: number; sum: number }>()
    lines.forEach((l) => {
      if (!l.bundle) return
      const g = groups.get(l.bundle.instance) ?? { price: l.bundle.price, sum: 0 }
      g.sum += l.unit_price * l.quantity
      groups.set(l.bundle.instance, g)
    })
    return [...groups.values()].reduce((s, g) => s + Math.max(0, g.sum - g.price), 0)
  }, [lines])
  const disc = Math.min(Number(discount) || 0, subtotal - bundleDiscount)
  const total = Math.max(0, subtotal - bundleDiscount - disc)
  const tradeValue = tradeOn ? Math.min(Number(trade.price) || 0, total) : 0
  const due = total - tradeValue
  const receivedNum = received === '' ? due : Number(received)
  const change = method === 'cash' ? receivedNum - due : 0
  const financed = Math.max(0, total - tradeValue - (Number(inst.down_payment) || 0))
  const monthly = financed * (1 + (Number(inst.interest_rate) || 0) / 100) / Math.max(1, Number(inst.months) || 1)
  const needsCustomer = tradeOn || method === 'credit' || method === 'installment' || (method !== 'cash' && receivedNum < due)
  const pendingSerials = lines.filter((l) => l.product.track_serial && !l.serial)
  const discountPct = subtotal - bundleDiscount > 0 ? (disc / (subtotal - bundleDiscount)) * 100 : 0
  const shiftMissing = shop?.require_shift && shift === null

  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const remove = (line: Line) => setLines((ls) => ls.filter((l) => (line.bundle ? l.bundle?.instance !== line.bundle.instance : l.key !== line.key)))
  const clearOrder = () => { setOrder(null); try { localStorage.removeItem(POS_ORDER_KEY) } catch { /* ignore */ } }
  const reset = () => {
    setLines([]); setCustomer(null); setDiscount(''); setReceived(''); setNotes(''); setMethod('cash')
    setTradeOn(false); setTrade(emptyTrade); setTradeProduct(null); clearOrder()
  }

  const saveOffline = async (payload: Record<string, unknown>, uuid: string) => {
    const sale: Omit<OutboxSale, 'status' | 'attempts'> = {
      uuid, created_at: new Date().toISOString(), payload, total,
      lines: lines.map((l) => ({ name: l.product.name, quantity: l.quantity, unit_price: l.unit_price, serial: l.serial?.serial })),
      customer_name: customer?.name || String(payload.customer_name || ''), cashier: user?.display_name || '',
    }
    await off.enqueue(sale)
    reset()
    setOfflineReceipt({ ...sale, status: 'pending', attempts: 0 })
    toast.ok('تم حفظ البيع على الجهاز — سيتم ترحيله تلقائياً عند عودة الإنترنت')
  }

  const checkout = async () => {
    if (!lines.length) return
    if (!online && (method === 'installment' || tradeOn)) { toast.error('التقسيط والاستبدال يحتاجان اتصالاً بالإنترنت.'); return }
    if (pendingSerials.length) { toast.error(`اختر ${serialWord} لـ «${pendingSerials[0].product.name}».`); return }
    if (needsCustomer && !customer) { toast.error(tradeOn ? 'اختر العميل (بائع الجهاز المستعمل).' : 'اختر العميل أولاً.'); return }
    if (method === 'cash' && receivedNum < due && !customer) { toast.error('المبلغ المستلم أقل من المطلوب — اختر عميلاً لتسجيل الباقي آجل.'); return }
    if (tradeOn && (!trade.serial || !tradeValue || (!tradeProduct && !trade.product_name))) { toast.error('أكمل بيانات الجهاز المستبدل.'); return }
    setBusy(true)
    try {
      const payload: Record<string, unknown> = {
        customer: customer?.id ?? null,
        customer_name: order && !customer ? order.name : '', customer_phone: order && !customer ? order.phone : '',
        items: lines.map((l) => ({
          product: l.product.id, quantity: l.quantity, unit_price: l.unit_price, serial: l.serial?.id ?? null,
          bundle: l.bundle?.id ?? null, bundle_instance: l.bundle?.instance ?? '',
        })),
        discount: disc, payment_method: method,
        notes: [order ? `طلب أونلاين #${order.number}` : '', notes].filter(Boolean).join(' — '),
      }
      if (tradeOn) {
        payload.trade_in = {
          product: tradeProduct?.id ?? null, product_name: trade.product_name, serial: trade.serial, value: tradeValue,
          resale_price: trade.resale_price ? Number(trade.resale_price) : null, condition: trade.condition, accessories: trade.accessories,
        }
      }
      if (method === 'installment') {
        payload.installment = { ...inst, down_payment: Number(inst.down_payment) || 0, start_date: inst.start_date || null }
      } else if (method === 'credit') {
        payload.paid = Number(received) || 0
      } else {
        payload.paid = Math.min(receivedNum, due)
      }
      const uuid = newUuid()
      payload.client_uuid = uuid
      if (!online) { await saveOffline(payload, uuid); return }
      let res: Invoice | typeof QUEUED
      try {
        res = await approval.run((extra) => api.post<Invoice>('/invoices/checkout/', { ...payload, ...extra }))
      } catch (e) {
        // Connection dropped mid-sale: keep it on the device (the same id prevents duplicates if it did go through).
        if (!(e as { response?: unknown }).response && (e as Error)?.message !== 'cancelled' && !tradeOn && method !== 'installment') {
          await saveOffline(payload, uuid); return
        }
        throw e
      }
      if (res === QUEUED) { reset(); return }
      if (order) await api.patch(`/catalog-orders/${order.id}/`, { status: 'completed', invoice: res.id }).catch(() => undefined)
      reset()
      toast.ok(`تم حفظ الفاتورة #${res.number}`)
      nav(`/invoices/${res.id}?new=1`)
    } catch (e) {
      if ((e as Error)?.message !== 'cancelled') toast.error(e)
    } finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader title="نقطة البيع" actions={lines.length > 0 && <button className="btn-ghost text-rose-600" onClick={reset}><Trash2 size={18} />تفريغ</button>} />
      {!online && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-slate-800 p-3 text-sm text-white">
          <CloudOff size={18} />
          <span>وضع بدون إنترنت: البحث من النسخة المحفوظة{off.snapshot && ` (${new Date(off.snapshot.generated_at).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })})`}. التقسيط والاستبدال غير متاحين.</span>
        </div>
      )}
      {shiftMissing && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
          <AlertTriangle size={18} /> لا توجد وردية مفتوحة — البيع يتطلب فتح وردية.
          <Link to="/shifts" className="btn-primary ms-auto px-3 py-1.5">فتح وردية</Link>
        </div>
      )}
      {order && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-sky-50 p-3 text-sm font-bold text-sky-800">
          <Globe size={18} /> طلب أونلاين #{order.number} — {order.name} <span dir="ltr">{order.phone}</span>
          <button className="btn-ghost ms-auto px-2" onClick={clearOrder} aria-label="إلغاء الربط"><X size={16} /></button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <div className="flex gap-2">
            <form onSubmit={onSearchSubmit} className="relative flex-1">
              <SearchBox value={q} onChange={setQ} placeholder={`ابحث بالاسم أو اكتب/امسح الباركود أو ${serialWord}`} autoFocus
                trailing={<button type="button" className="btn-primary px-3 py-2" onClick={() => setScan(true)} aria-label="مسح بالكاميرا"><ScanBarcode size={18} /></button>} />
              {dq && results && (
                <div className="card absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto">
                  {results.length === 0 ? <div className="p-4 text-center text-sm text-slate-500">لا نتائج — اضغط Enter للبحث بالسيريال أو باركود الباقة</div> :
                    results.map((p) => (
                      <button type="button" key={p.id} onClick={() => addProduct(p)} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-start last:border-0 hover:bg-slate-50">
                        <div className="min-w-0">
                          <div className="truncate font-bold">{p.name}</div>
                          <div className={`text-xs ${!p.is_service && p.quantity <= 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                            {p.is_service ? 'خدمة' : `المتاح: ${p.quantity}`}{p.track_serial && ' · بالسيريال'}{p.is_used && ' · مستعمل'}
                          </div>
                        </div>
                        <Money value={p.sell_price} className="shrink-0 font-bold text-brand-700" />
                      </button>
                    ))}
                </div>
              )}
            </form>
            <button className="btn-secondary px-3" onClick={() => setBundlePicker(true)}><Cpu size={18} /><span className="hidden sm:inline">باقة</span></button>
          </div>

          <div className="card">
            {lines.length === 0 ? (
              <Empty icon={<ShoppingCart size={48} />} title="السلة فارغة">ابحث عن منتج أو امسح الباركود لإضافته</Empty>
            ) : lines.map((l, idx) => {
              const firstOfBundle = l.bundle && lines[idx - 1]?.bundle?.instance !== l.bundle.instance
              const needsSerial = l.product.track_serial && !l.serial
              return (
                <div key={l.key}>
                  {firstOfBundle && (
                    <div className="flex items-center justify-between bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-800">
                      <span className="flex items-center gap-1.5"><Cpu size={16} />{l.bundle!.name}</span>
                      <span className="flex items-center gap-2">
                        <Money value={l.bundle!.price} />
                        <button className="btn-ghost px-1 text-rose-500" onClick={() => remove(l)} aria-label="حذف الباقة"><Trash2 size={16} /></button>
                      </span>
                    </div>
                  )}
                  <div className={`flex flex-wrap items-center gap-3 border-b border-slate-100 p-3 ${l.bundle ? 'ps-6' : ''} ${needsSerial ? 'bg-amber-50' : ''}`}>
                    <div className="min-w-0 flex-1 basis-40">
                      <div className="truncate font-bold">{l.product.name}</div>
                      {l.serial && <div className="text-xs text-slate-500" dir="ltr">{l.serial.serial}</div>}
                      {needsSerial && (
                        <button className="mt-1 text-xs font-bold text-amber-700 underline" onClick={() => setSerialFor({ product: l.product, lineKey: l.key })}>اختر {serialWord}</button>
                      )}
                      {!l.bundle && l.unit_price < Number(l.product.min_price) && <div className="text-xs font-bold text-amber-600">أقل من الحد الأدنى — يحتاج موافقة</div>}
                    </div>
                    {l.bundle ? (
                      <span className="px-2 text-sm text-slate-500">{l.quantity} × <Money value={l.unit_price} /></span>
                    ) : (
                      <>
                        <div className="flex items-center gap-1">
                          {!l.product.track_serial ? (
                            <>
                              <button className="btn-secondary size-9 p-0" onClick={() => l.quantity > 1 ? update(l.key, { quantity: l.quantity - 1 }) : remove(l)} aria-label="إنقاص"><Minus size={16} /></button>
                              <input className="input w-14 px-1 text-center" inputMode="numeric" value={l.quantity}
                                onChange={(e) => update(l.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} />
                              <button className="btn-secondary size-9 p-0" onClick={() => update(l.key, { quantity: l.quantity + 1 })} aria-label="زيادة"><Plus size={16} /></button>
                            </>
                          ) : <span className="px-2 text-sm text-slate-500">1 ×</span>}
                        </div>
                        <input className="input w-24 text-center font-bold" inputMode="decimal" value={l.unit_price}
                          onChange={(e) => update(l.key, { unit_price: Number(e.target.value) || 0 })} aria-label="السعر" />
                        <Money value={l.unit_price * l.quantity} className="w-24 text-end font-extrabold" />
                        <button className="btn-ghost px-2 text-rose-500" onClick={() => remove(l)} aria-label="حذف"><Trash2 size={18} /></button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card sticky top-4 space-y-4 p-4">
            <CustomerPicker value={customer} onChange={setCustomer} required={needsCustomer} />
            <Tabs value={method} onChange={(m) => { setMethod(m); setReceived('') }} options={METHODS} />

            <div className="grid grid-cols-2 gap-3">
              <Field label="خصم" hint={discountPct > Number(shop?.max_discount_percent ?? 100) ? <span className="text-amber-600">أكبر من {shop?.max_discount_percent}% — يحتاج موافقة</span> : undefined}>
                <input className="input" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
              </Field>
              {method !== 'installment' && (
                <Field label={method === 'cash' ? 'المبلغ المستلم' : method === 'credit' ? 'المدفوع الآن' : 'المدفوع'}>
                  <input className="input" inputMode="decimal" value={received} placeholder={method === 'credit' ? '0' : String(due)} onChange={(e) => setReceived(e.target.value)} />
                </Field>
              )}
            </div>

            <div className="rounded-xl ring-1 ring-slate-200">
              <label className="flex cursor-pointer items-center gap-2 p-3 text-sm font-bold">
                <input type="checkbox" className="size-4" checked={tradeOn} onChange={(e) => setTradeOn(e.target.checked)} />
                <ArrowLeftRight size={16} className="text-violet-600" />استبدال جهاز قديم من العميل
              </label>
              {tradeOn && (
                <div className="border-t border-slate-100 p-3">
                  <TradeInFields f={trade} set={(k) => (e) => setTrade({ ...trade, [k]: e.target.value })} product={tradeProduct}
                    setProduct={setTradeProduct} onPick={() => setTradePick(true)} onScan={() => setTradeScan(true)} priceLabel="قيمة الجهاز المستبدل" />
                </div>
              )}
            </div>

            {method === 'installment' && (
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                <Field label="المقدم النقدي"><input className="input" inputMode="decimal" value={inst.down_payment} onChange={(e) => setInst({ ...inst, down_payment: e.target.value })} /></Field>
                <Field label="عدد الأشهر"><input className="input" inputMode="numeric" value={inst.months} onChange={(e) => setInst({ ...inst, months: e.target.value })} /></Field>
                <Field label="الفائدة %"><input className="input" inputMode="decimal" value={inst.interest_rate} onChange={(e) => setInst({ ...inst, interest_rate: e.target.value })} /></Field>
                <Field label="أول قسط"><input className="input" type="date" min={todayISO()} value={inst.start_date} onChange={(e) => setInst({ ...inst, start_date: e.target.value })} /></Field>
                <Field label="اسم الضامن"><input className="input" value={inst.guarantor_name} onChange={(e) => setInst({ ...inst, guarantor_name: e.target.value })} /></Field>
                <Field label="موبايل الضامن"><input className="input" dir="ltr" inputMode="tel" value={inst.guarantor_phone} onChange={(e) => setInst({ ...inst, guarantor_phone: e.target.value })} /></Field>
                <div className="col-span-2 text-sm">القسط الشهري ≈ <Money value={monthly.toFixed(2)} className="font-extrabold text-brand-700" /></div>
              </div>
            )}

            <Field label="ملاحظات"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

            <div className="space-y-1 border-t border-dashed border-slate-200 pt-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">الإجمالي قبل الخصم</span><Money value={subtotal} /></div>
              {bundleDiscount > 0 && <div className="flex justify-between text-violet-700"><span>خصم الباقات</span><Money value={-bundleDiscount} /></div>}
              {disc > 0 && <div className="flex justify-between text-rose-600"><span>الخصم</span><Money value={-disc} /></div>}
              <div className="flex justify-between text-xl font-extrabold"><span>الإجمالي</span><Money value={total} /></div>
              {tradeValue > 0 && <div className="flex justify-between text-violet-700"><span>الجهاز المستبدل</span><Money value={-tradeValue} /></div>}
              {tradeValue > 0 && <div className="flex justify-between font-extrabold"><span>المطلوب</span><Money value={due} /></div>}
              {method === 'cash' && change > 0 && <div className="flex justify-between font-bold text-emerald-600"><span>الباقي للعميل</span><Money value={change} /></div>}
              {method === 'cash' && change < 0 && <div className="flex justify-between font-bold text-amber-600"><span>آجل على العميل</span><Money value={-change} /></div>}
            </div>
            <button className="btn-primary w-full py-3.5 text-base" disabled={!lines.length || busy || !!shiftMissing} onClick={checkout}>
              {busy ? 'جاري الحفظ...' : 'إتمام البيع'}
            </button>
          </div>
        </div>
      </div>

      <BarcodeScanner open={scan} onClose={closeScan} onResult={lookup} />
      <BarcodeScanner open={tradeScan} onClose={closeTradeScan} onResult={onTradeScan} />
      <ProductSearchModal open={tradePick} title="منتج الجهاز المستبدل (بالسيريال)" onClose={() => setTradePick(false)}
        onPick={(p) => { if (p.track_serial) { setTradeProduct(p); setTradePick(false) } else toast.error('اختر منتجاً يتتبع السيريال') }} />
      {offlineReceipt && shop && <OfflineReceiptModal sale={offlineReceipt} onClose={() => setOfflineReceipt(null)} />}
      <BundlePicker open={bundlePicker} onClose={() => setBundlePicker(false)} onPick={(b) => { addBundle(b); setBundlePicker(false) }} />
      <SerialPicker product={serialFor?.product ?? null} exclude={lines.flatMap((l) => (l.serial ? [l.serial.id] : []))}
        onClose={() => setSerialFor(null)}
        onPick={(s) => {
          if (serialFor?.lineKey) update(serialFor.lineKey, { serial: s })
          else addProduct(serialFor!.product, s)
          setSerialFor(null)
        }} />
    </div>
  )
}

function BundlePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (b: Bundle) => void }) {
  const { online, snapshot } = useOffline()
  const { data: remote } = useList<Bundle>('bundles', { is_active: true, page_size: 100 })
  const data = online ? remote : { results: snapshot?.bundles || [] }
  return (
    <Modal open={open} onClose={onClose} title="اختيار باقة / تجميعة">
      {!data?.results.length ? <p className="py-6 text-center text-sm text-slate-500">لا توجد باقات — أضفها من «التجميعات والباقات».</p> : (
        <div className="divide-y divide-slate-100">
          {data.results.map((b) => (
            <button key={b.id} className="flex w-full items-center justify-between gap-3 py-3 text-start hover:bg-slate-50" onClick={() => onPick(b)}>
              <div className="min-w-0">
                <div className="font-bold">{b.name}</div>
                <div className="truncate text-xs text-slate-500">{b.items.map((i) => `${i.product_name}×${i.quantity}`).join('، ')}</div>
              </div>
              <Money value={b.price} className="shrink-0 font-extrabold text-brand-700" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

function SerialPicker({ product, exclude, onClose, onPick }: {
  product: Product | null; exclude: number[]; onClose: () => void; onPick: (s: { id: number; serial: string }) => void
}) {
  const [q, setQ] = useState('')
  const { online, snapshot, reservedSerials } = useOffline()
  const { data: remote } = useQuery({
    queryKey: ['serials', product?.id],
    queryFn: async () => (await api.get<SerialItem[]>(`/products/${product!.id}/serials/`, { params: { status: 'in_stock' } })).data,
    enabled: !!product && online,
  })
  const data = online ? remote : (snapshot?.serials || []).filter((s) => s.product_id === product?.id)
    .map((s) => ({ id: s.id, serial: s.serial, condition: s.condition }) as SerialItem)
  const list = (data || []).filter((s) => !exclude.includes(s.id) && !reservedSerials.has(s.id) && s.serial.includes(q.trim()))
  return (
    <Modal open={!!product} onClose={onClose} title={`اختر السيريال — ${product?.name ?? ''}`}>
      <div className="space-y-3">
        <SearchBox value={q} onChange={setQ} placeholder="ابحث في السيريالات" />
        {list.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">لا توجد سيريالات متاحة لهذا المنتج.</p> :
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {list.map((s) => (
              <button key={s.id} className="btn-secondary flex-col items-start justify-start gap-0" onClick={() => onPick({ id: s.id, serial: s.serial })}>
                <span className="font-mono" dir="ltr">{s.serial}</span>
                {s.condition && <span className="text-[11px] font-normal text-slate-500">{s.condition}</span>}
              </button>
            ))}
          </div>}
      </div>
    </Modal>
  )
}

function newUuid(): string {
  const c = globalThis.crypto as Crypto & { randomUUID?: () => string }
  if (c.randomUUID) return c.randomUUID()
  const b = c.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Temporary receipt for a sale saved on the device while offline. */
function OfflineReceiptModal({ sale, onClose }: { sale: OutboxSale; onClose: () => void }) {
  const { shop } = useAuth()
  const p = sale.payload as { discount?: number; paid?: number; payment_method?: string }
  const subtotal = sale.lines.reduce((s, l) => s + l.unit_price * l.quantity, 0)
  const invoice = {
    id: 0, number: 0, public_token: '', customer: null, customer_name: sale.customer_name, customer_phone: '',
    subtotal, discount: subtotal - sale.total, bundle_discount: 0, trade_in_value: 0, total: sale.total,
    paid: Number(p.paid ?? sale.total), remaining: Math.max(0, sale.total - Number(p.paid ?? sale.total)), returned_total: 0,
    payment_method: p.payment_method || 'cash', payment_method_display: { cash: 'نقدي', card: 'فيزا', wallet: 'محفظة', credit: 'آجل' }[p.payment_method || 'cash'] || '',
    status: 'completed', status_display: '', notes: '', cashier: sale.cashier, created_at: sale.created_at,
    items: sale.lines.map((l, i) => ({ id: i, product: 0, name: l.name, serial: null, serial_number: l.serial ?? null, quantity: l.quantity,
      returned_quantity: 0, unit_price: l.unit_price, line_total: l.unit_price * l.quantity, warranty_days: 0, bundle_name: '' })),
  }
  useEffect(() => {
    document.body.classList.add('print-isolate')
    return () => document.body.classList.remove('print-isolate')
  }, [])
  const receipt = <InvoiceReceipt invoice={{ ...invoice, number: sale.uuid.slice(0, 8).toUpperCase() as unknown as number }} shop={{ ...shop!, receipt_show_qr: false }} />
  return (
    <>
    {/* Modals are hidden when printing: print an isolated copy rendered directly under <body>. */}
    {createPortal(<div className="print-portal print-only">{receipt}</div>, document.body)}
    <Modal open onClose={onClose} title="فاتورة مؤقتة (بدون إنترنت)" footer={
      <>
        <button className="btn-primary flex-1" onClick={() => window.print()}><Printer size={18} />طباعة</button>
        <button className="btn-secondary" onClick={onClose}>بيع جديد</button>
      </>
    }>
      <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">
        محفوظة على هذا الجهاز وستأخذ رقمها النهائي عند المزامنة. كود الفاتورة: <span dir="ltr" className="font-mono">{sale.uuid.slice(0, 8).toUpperCase()}</span>
      </p>
      {receipt}
    </Modal>
    </>
  )
}
