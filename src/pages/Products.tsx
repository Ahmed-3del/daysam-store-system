import { Boxes, Plus, ScanBarcode } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { useToast } from '../components/toast'
import { Badge, Empty, Fab, Loading, Money, PageHeader, SearchBox, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { num } from '../lib/format'
import { useDebounced, useGet, useList } from '../lib/hooks'
import type { Category, Product } from '../lib/types'

export default function Products() {
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [scan, setScan] = useState(false)
  const dq = useDebounced(q)
  const filter = params.get('low_stock') ? 'low' : params.get('category') || ''
  const { data: cats } = useGet<Category[]>(['categories'], '/categories/')
  const { data, isLoading } = useList<Product>('products', {
    search: dq, page, is_active: true,
    low_stock: filter === 'low' ? 1 : undefined,
    category: filter && filter !== 'low' ? filter : undefined,
  })
  const closeScan = useCallback(() => setScan(false), [])
  const onScan = useCallback(async (code: string) => {
    try {
      const { data } = await api.get('/products/lookup/', { params: { code } })
      nav(`/products/${data.product.id}`)
    } catch { toast.error(`لا يوجد منتج بالكود ${code}`); setQ(code) }
  }, [nav, toast])

  return (
    <div className="space-y-3">
      <PageHeader title="المنتجات والمخزون" actions={<Link to="/purchases/new" className="btn-secondary">توريد</Link>} />
      <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="اسم، ماركة أو باركود"
        trailing={<button className="btn-ghost px-2" onClick={() => setScan(true)} aria-label="مسح"><ScanBarcode size={20} /></button>} />
      <Tabs value={filter} onChange={(v) => { setPage(1); setParams(v === 'low' ? { low_stock: '1' } : v ? { category: v } : {}) }} options={[
        { value: '', label: 'الكل' }, { value: 'low', label: '⚠️ النواقص' },
        ...(cats || []).map((c) => ({ value: String(c.id), label: `${c.name} (${c.products_count})` })),
      ]} />
      {isLoading ? <Loading /> : !data?.results.length ? (
        <Empty icon={<Boxes size={44} />} title="لا توجد منتجات"><Link to="/products/new" className="btn-primary mt-2">إضافة منتج</Link></Empty>
      ) : (
        <div className="card">
          {data.results.map((p) => (
            <Link key={p.id} to={`/products/${p.id}`} className="list-row hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{p.name}</div>
                <div className="flex flex-wrap gap-1 pt-0.5 text-xs text-slate-500">
                  {p.category_name && <Badge>{p.category_name}</Badge>}
                  {p.track_serial && <Badge tone="violet">سيريال</Badge>}
                  {p.is_service && <Badge tone="blue">خدمة</Badge>}
                  {p.barcode && <span dir="ltr">{p.barcode}</span>}
                </div>
              </div>
              <div className="text-end">
                <Money value={p.sell_price} className="block font-extrabold" />
                {!p.is_service && <span className={`text-xs font-bold ${p.is_low_stock ? 'text-rose-600' : 'text-slate-500'}`}>المتاح: {num(p.quantity)}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
      {data && (data.next || data.previous) && (
        <div className="flex justify-center gap-2">
          <button className="btn-secondary" disabled={!data.previous} onClick={() => setPage(page - 1)}>السابق</button>
          <button className="btn-secondary" disabled={!data.next} onClick={() => setPage(page + 1)}>التالي</button>
        </div>
      )}
      <Fab onClick={() => nav('/products/new')} icon={<Plus size={20} />} label="منتج جديد" />
      <BarcodeScanner open={scan} onClose={closeScan} onResult={onScan} />
    </div>
  )
}
