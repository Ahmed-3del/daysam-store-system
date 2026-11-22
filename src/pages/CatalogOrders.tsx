import { Copy, ExternalLink, Globe, MessageCircle, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useToast } from '../components/toast'
import { Badge, Empty, Loading, Money, PageHeader, Tabs, type Tone } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateTime, money, whatsappLink } from '../lib/format'
import { useAction, useList } from '../lib/hooks'
import type { CatalogOrder, Product } from '../lib/types'

const tone: Record<CatalogOrder['status'], Tone> = { new: 'amber', confirmed: 'blue', completed: 'green', cancelled: 'red' }
export const POS_ORDER_KEY = 'daysam.pos.order'

export default function CatalogOrders() {
  const { shop } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [status, setStatus] = useState('new')
  const { data, isLoading } = useList<CatalogOrder>('catalog-orders', { status: status || undefined })
  const setOrderStatus = useAction(({ id, s }: { id: number; s: string }) => api.patch(`/catalog-orders/${id}/`, { status: s }), {
    invalidate: ['catalog-orders'], success: 'تم تحديث الطلب',
  })
  const url = shop?.catalog_slug ? `${window.location.origin}/s/${shop.catalog_slug}` : ''

  const openInPos = async (o: CatalogOrder) => {
    try {
      const products = await Promise.all(o.items.map((i) => api.get<Product>(`/products/${i.product}/`).then((r) => r.data)))
      const lines = o.items.flatMap((i, idx) => {
        const p = products[idx]
        const n = p.track_serial ? i.quantity : 1
        return Array.from({ length: n }, (_, k) => ({
          key: `o${o.id}-${p.id}-${k}`, product: p, quantity: p.track_serial ? 1 : i.quantity, unit_price: Number(i.unit_price),
        }))
      })
      localStorage.setItem('daysam.cart', JSON.stringify(lines))
      localStorage.setItem(POS_ORDER_KEY, JSON.stringify({ id: o.id, number: o.number, name: o.customer_name, phone: o.customer_phone }))
      nav('/pos')
    } catch (e) { toast.error(e) }
  }

  return (
    <div className="space-y-3">
      <PageHeader title="المتجر الإلكتروني" subtitle="طلبات العملاء من الكتالوج الرقمي لمحلك" />
      {shop?.catalog_enabled && url ? (
        <div className="card flex flex-wrap items-center gap-2 p-3 text-sm">
          <Globe size={18} className="text-brand-700" />
          <span className="flex-1 truncate font-mono" dir="ltr">{url}</span>
          <button className="btn-secondary px-3 py-1.5" onClick={() => { navigator.clipboard?.writeText(url); toast.ok('تم نسخ الرابط') }}><Copy size={16} />نسخ</button>
          <a className="btn-secondary px-3 py-1.5" href={url} target="_blank" rel="noreferrer"><ExternalLink size={16} />فتح</a>
          <a className="btn-success px-3 py-1.5" target="_blank" rel="noreferrer" href={whatsappLink('', `تصفح منتجات ${shop.name} واطلب أونلاين:\n${url}`)}><MessageCircle size={16} />مشاركة</a>
        </div>
      ) : (
        <div className="card p-4 text-sm">
          المتجر الإلكتروني غير مفعل. فعّله واختر رابطاً من <Link to="/settings" className="font-bold text-brand-700">الإعدادات</Link>،
          ثم حدد المنتجات الظاهرة من صفحة كل منتج («يظهر في المتجر الإلكتروني»).
        </div>
      )}
      <Tabs value={status} onChange={setStatus} options={[
        { value: 'new', label: 'جديدة' }, { value: 'confirmed', label: 'مؤكدة' }, { value: 'completed', label: 'تم البيع' },
        { value: 'cancelled', label: 'ملغية' }, { value: '', label: 'الكل' },
      ]} />
      {isLoading ? <Loading /> : !data?.results.length ? <Empty icon={<Globe size={44} />} title="لا توجد طلبات" /> : (
        <div className="space-y-3">
          {data.results.map((o) => (
            <div key={o.id} className="card space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-extrabold">طلب #{o.number} — {o.customer_name}</div>
                  <div className="text-xs text-slate-500"><span dir="ltr">{o.customer_phone}</span> · {dateTime(o.created_at)}</div>
                  {o.address && <div className="text-xs text-slate-500">{o.address}</div>}
                </div>
                <Badge tone={tone[o.status]}>{o.status_display}</Badge>
              </div>
              <ul className="rounded-xl bg-slate-50 p-3 text-sm">
                {o.items.map((i) => <li key={i.product} className="flex justify-between"><span>{i.name} × {i.quantity}</span><Money value={i.unit_price * i.quantity} /></li>)}
                <li className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-extrabold"><span>الإجمالي</span><Money value={o.total} /></li>
              </ul>
              {o.notes && <p className="text-sm text-slate-600">{o.notes}</p>}
              <div className="flex flex-wrap gap-2">
                <a className="btn-success px-3 py-2" target="_blank" rel="noreferrer"
                  href={whatsappLink(o.customer_phone, `مرحباً ${o.customer_name}، استلمنا طلبك رقم #${o.number} من ${shop?.name} بإجمالي ${money(o.total, shop?.currency)}. سنتواصل معك للتأكيد.`)}>
                  <MessageCircle size={16} />واتساب
                </a>
                {o.status !== 'completed' && o.status !== 'cancelled' && (
                  <>
                    {o.status === 'new' && <button className="btn-secondary px-3 py-2" onClick={() => setOrderStatus.mutate({ id: o.id, s: 'confirmed' })}>تأكيد</button>}
                    <button className="btn-primary px-3 py-2" onClick={() => openInPos(o)}><ShoppingCart size={16} />فتح في نقطة البيع</button>
                    <button className="btn-ghost px-3 py-2 text-rose-600" onClick={() => confirm('إلغاء الطلب؟') && setOrderStatus.mutate({ id: o.id, s: 'cancelled' })}>إلغاء</button>
                  </>
                )}
                {o.invoice && <Link to={`/invoices/${o.invoice}`} className="btn-ghost px-3 py-2 text-brand-700">فاتورة #{o.invoice_number}</Link>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
