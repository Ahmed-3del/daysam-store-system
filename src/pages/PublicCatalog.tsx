import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, MessageCircle, Minus, Phone, Plus, ShoppingBag, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Field, Loading, Modal, SearchBox, Tabs } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { money, whatsappLink } from '../lib/format'

interface PubProduct {
  id: number; name: string; brand: string; category: number | null; category_name: string | null; sell_price: number
  specs: Record<string, string>; image: string | null; is_used: boolean; warranty_days: number; in_stock: boolean
}
interface CatalogData {
  shop: { name: string; phone: string; address: string; currency: string; catalog_about: string; catalog_whatsapp: string }
  categories: { id: number; name: string }[]
  products: PubProduct[]
}

export default function PublicCatalog() {
  const { slug } = useParams()
  const cartKey = `daysam.store.${slug}`
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-catalog', slug],
    queryFn: async () => (await api.get<CatalogData>(`/public/catalog/${slug}/`)).data,
  })
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [cart, setCart] = useState<Record<number, number>>(() => { try { return JSON.parse(localStorage.getItem(cartKey) || '{}') } catch { return {} } })
  const [view, setView] = useState<PubProduct | null>(null)
  const [checkout, setCheckout] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  useEffect(() => { try { localStorage.setItem(cartKey, JSON.stringify(cart)) } catch { /* ignore */ } }, [cart, cartKey])
  useEffect(() => { if (data) document.title = data.shop.name }, [data])

  const products = useMemo(() => (data?.products || []).filter((p) =>
    (!cat || String(p.category) === cat) && (!q || `${p.name} ${p.brand}`.toLowerCase().includes(q.toLowerCase()))), [data, cat, q])
  if (isLoading) return <Loading />
  if (isError || !data) return <div className="flex min-h-screen items-center justify-center p-6 text-slate-500">المتجر غير متاح.</div>

  const cur = data.shop.currency
  const byId = Object.fromEntries(data.products.map((p) => [p.id, p]))
  const lines = Object.entries(cart).filter(([id, n]) => byId[id] && n > 0).map(([id, n]) => ({ p: byId[id], n }))
  const count = lines.reduce((s, l) => s + l.n, 0)
  const total = lines.reduce((s, l) => s + l.n * Number(l.p.sell_price), 0)
  const add = (id: number, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + d) }))
  const wa = data.shop.catalog_whatsapp || data.shop.phone

  return (
    <div className="min-h-screen pb-28">
      <header className="bg-gradient-to-b from-brand-700 to-brand-800 px-4 pb-6 pt-8 text-white">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-extrabold">{data.shop.name}</h1>
          {data.shop.catalog_about && <p className="mt-1 max-w-xl text-sm text-white/80">{data.shop.catalog_about}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {data.shop.phone && <a href={`tel:${data.shop.phone}`} className="chip bg-white/15 px-3 py-1.5 text-white"><Phone size={14} className="me-1" /><span dir="ltr">{data.shop.phone}</span></a>}
            {wa && <a href={whatsappLink(wa, `مرحباً ${data.shop.name}`)} target="_blank" rel="noreferrer" className="chip bg-emerald-500 px-3 py-1.5 text-white"><MessageCircle size={14} className="me-1" />واتساب</a>}
            {data.shop.address && <span className="chip bg-white/15 px-3 py-1.5 text-white">{data.shop.address}</span>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-3 px-4 pt-4">
        <SearchBox value={q} onChange={setQ} placeholder="ابحث عن منتج" />
        {data.categories.length > 1 && (
          <Tabs value={cat} onChange={setCat} options={[{ value: '', label: 'الكل' }, ...data.categories.map((c) => ({ value: String(c.id), label: c.name }))]} />
        )}
        {!products.length ? <p className="py-16 text-center text-slate-500">لا توجد منتجات.</p> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <div key={p.id} className="card flex flex-col overflow-hidden">
                <button className="aspect-square bg-slate-100" onClick={() => setView(p)}>
                  {p.image ? <img src={p.image} alt={p.name} loading="lazy" className="size-full object-cover" /> :
                    <div className="flex size-full items-center justify-center text-slate-300"><ShoppingBag size={40} /></div>}
                </button>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <button className="text-start text-sm font-bold leading-snug" onClick={() => setView(p)}>{p.name}</button>
                  <div className="flex flex-wrap gap-1 text-[11px]">
                    {p.is_used && <span className="chip bg-amber-100 text-amber-800">مستعمل</span>}
                    {!p.in_stock && <span className="chip bg-slate-100 text-slate-500">غير متوفر</span>}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="font-extrabold text-brand-700">{money(p.sell_price, cur)}</span>
                    {p.in_stock && (cart[p.id] ? (
                      <div className="flex items-center gap-1">
                        <button className="btn-secondary size-7 p-0" onClick={() => add(p.id, -1)} aria-label="إنقاص"><Minus size={14} /></button>
                        <span className="w-5 text-center text-sm font-bold">{cart[p.id]}</span>
                        <button className="btn-secondary size-7 p-0" onClick={() => add(p.id, 1)} aria-label="زيادة"><Plus size={14} /></button>
                      </div>
                    ) : <button className="btn-primary size-8 p-0" onClick={() => add(p.id, 1)} aria-label="أضف للسلة"><Plus size={16} /></button>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {count > 0 && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
          <button className="btn-primary mx-auto flex w-full max-w-md py-3.5 text-base" onClick={() => setCheckout(true)}>
            <ShoppingBag size={20} />إتمام الطلب ({count}) — {money(total, cur)}
          </button>
        </div>
      )}

      <Modal open={!!view} onClose={() => setView(null)} title={view?.name}>
        {view && (
          <div className="space-y-3">
            {view.image && <img src={view.image} alt={view.name} className="w-full rounded-2xl" />}
            <div className="text-xl font-extrabold text-brand-700">{money(view.sell_price, cur)}</div>
            {Object.entries(view.specs || {}).map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span className="text-slate-500">{k}</span><span className="font-bold">{v}</span></div>)}
            {view.warranty_days > 0 && <div className="text-sm text-slate-600">ضمان {view.warranty_days} يوم</div>}
            {view.in_stock && <button className="btn-primary w-full" onClick={() => { add(view.id, 1); setView(null) }}><Plus size={18} />أضف للسلة</button>}
          </div>
        )}
      </Modal>

      {checkout && <CheckoutModal slug={slug!} lines={lines} total={total} cur={cur} wa={wa} shopName={data.shop.name}
        onClose={() => setCheckout(false)} onRemove={(id) => setCart((c) => ({ ...c, [id]: 0 }))}
        onDone={(n) => { setCart({}); setCheckout(false); setDone(n) }} />}

      <Modal open={done !== null} onClose={() => setDone(null)} title="تم استلام طلبك">
        <div className="space-y-3 py-4 text-center">
          <CheckCircle2 size={56} className="mx-auto text-emerald-500" />
          <div className="text-lg font-extrabold">رقم الطلب #{done}</div>
          <p className="text-sm text-slate-600">سيتواصل معك {data.shop.name} قريباً لتأكيد الطلب.</p>
        </div>
      </Modal>
    </div>
  )
}

function CheckoutModal({ slug, lines, total, cur, wa, shopName, onClose, onRemove, onDone }: {
  slug: string; lines: { p: PubProduct; n: number }[]; total: number; cur: string; wa: string; shopName: string
  onClose: () => void; onRemove: (id: number) => void; onDone: (n: number) => void
}) {
  const [f, setF] = useState({ customer_name: '', customer_phone: '', address: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const { data } = await api.post(`/public/catalog/${slug}/orders/`, { ...f, items: lines.map((l) => ({ product: l.p.id, quantity: l.n })) })
      onDone(data.number)
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  const waText = `طلب جديد من ${shopName}:\n${lines.map((l) => `• ${l.p.name} × ${l.n}`).join('\n')}\nالإجمالي: ${money(total, cur)}`
  return (
    <Modal open onClose={onClose} title="إتمام الطلب">
      <form onSubmit={submit} className="space-y-3">
        <div className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
          {lines.map((l) => (
            <div key={l.p.id} className="flex items-center gap-2 p-2.5 text-sm">
              <span className="flex-1">{l.p.name} × {l.n}</span>
              <span className="font-bold">{money(l.n * Number(l.p.sell_price), cur)}</span>
              <button type="button" className="btn-ghost px-1" onClick={() => onRemove(l.p.id)} aria-label="حذف"><X size={16} /></button>
            </div>
          ))}
          <div className="flex justify-between p-2.5 font-extrabold"><span>الإجمالي</span><span>{money(total, cur)}</span></div>
        </div>
        <Field label="الاسم"><input className="input" required value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} /></Field>
        <Field label="رقم الموبايل"><input className="input" required dir="ltr" inputMode="tel" value={f.customer_phone} onChange={(e) => setF({ ...f, customer_phone: e.target.value })} /></Field>
        <Field label="العنوان (للتوصيل)"><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <Field label="ملاحظات"><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button className="btn-primary w-full py-3" disabled={busy || !lines.length}>{busy ? 'جاري الإرسال...' : 'إرسال الطلب'}</button>
        {wa && <a className="btn-success w-full" target="_blank" rel="noreferrer" href={whatsappLink(wa, waText)}><MessageCircle size={18} />أو اطلب عبر واتساب</a>}
      </form>
    </Modal>
  )
}
