import { MessageCircle, Printer, RotateCcw, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { InvoiceReceipt } from '../components/InvoiceReceipt'
import { Field, InfoRow, Loading, Modal, Money, PageHeader } from '../components/ui'
import { useApproval } from '../components/approval'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { money, whatsappLink } from '../lib/format'
import { useAction, useGet } from '../lib/hooks'
import type { Invoice } from '../lib/types'

export default function InvoiceDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { shop, isManager } = useAuth()
  const { data: inv, isLoading, refetch } = useGet<Invoice>(['invoices', id], `/invoices/${id}/`)
  const [returning, setReturning] = useState(false)
  if (isLoading || !inv || !shop) return <Loading />

  const link = `${window.location.origin}/i/${inv.public_token}`
  const waText = [
    `${shop.name}`, `فاتورة رقم #${inv.number}`,
    ...inv.items.map((i) => `• ${i.name}${i.serial_number ? ` (${i.serial_number})` : ''} × ${i.quantity} = ${money(i.line_total, shop.currency)}`),
    `الإجمالي: ${money(inv.total, shop.currency)}`,
    Number(inv.remaining) > 0 ? `المتبقي: ${money(inv.remaining, shop.currency)}` : '',
    `عرض الفاتورة: ${link}`, shop.invoice_footer,
  ].filter(Boolean).join('\n')
  const canReturn = inv.status !== 'returned'

  return (
    <div className="space-y-4">
      <PageHeader back="/invoices" title={`فاتورة #${inv.number}`} subtitle={params.get('new') ? 'تم حفظ الفاتورة بنجاح ✅' : inv.status_display} />
      <div className="no-print flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => window.print()}><Printer size={18} />طباعة</button>
        <a className="btn-success" target="_blank" rel="noreferrer" href={whatsappLink(inv.customer_phone, waText)}><MessageCircle size={18} />إرسال واتساب</a>
        {canReturn && <button className="btn-secondary" onClick={() => setReturning(true)}><RotateCcw size={18} />مرتجع</button>}
        {params.get('new') && <Link to="/pos" className="btn-secondary"><ShoppingCart size={18} />بيع جديد</Link>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InvoiceReceipt invoice={inv} shop={shop} />
        <div className="no-print card h-fit p-4">
          <h2 className="mb-2 font-extrabold">تفاصيل</h2>
          <InfoRow label="الكاشير">{inv.cashier}</InfoRow>
          <InfoRow label="طريقة الدفع">{inv.payment_method_display}</InfoRow>
          {inv.customer && <InfoRow label="العميل"><Link className="text-brand-700" to={`/customers/${inv.customer}`}>{inv.customer_name}</Link></InfoRow>}
          {isManager && inv.profit !== undefined && <InfoRow label="ربح الفاتورة"><Money value={inv.profit} className="text-emerald-600" /></InfoRow>}
          {inv.notes && <InfoRow label="ملاحظات">{inv.notes}</InfoRow>}
        </div>
      </div>
      <ReturnModal invoice={inv} open={returning} onClose={() => setReturning(false)} onDone={() => { setReturning(false); refetch() }} />
    </div>
  )
}

function ReturnModal({ invoice, open, onClose, onDone }: { invoice: Invoice; open: boolean; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState<Record<number, number>>({})
  const [refund, setRefund] = useState<'cash' | 'credit'>('cash')
  const [restock, setRestock] = useState(true)
  const [reason, setReason] = useState('')
  const ratio = Number(invoice.subtotal) ? Number(invoice.total) / Number(invoice.subtotal) : 1
  const amount = invoice.items.reduce((s, i) => s + (qty[i.id] || 0) * Number(i.unit_price) * ratio, 0)
  const approval = useApproval()
  const save = useAction(
    () => approval.run((extra) => api.post(`/invoices/${invoice.id}/return/`, { ...extra,
      items: Object.entries(qty).filter(([, q]) => q > 0).map(([item, quantity]) => ({ item: Number(item), quantity })),
      refund_method: refund, restock, reason,
    })),
    { invalidate: ['invoices', 'products', 'cash', 'customers', 'installments'], success: 'تم تسجيل المرتجع', onSuccess: () => { setQty({}); onDone() } },
  )
  return (
    <Modal open={open} onClose={onClose} title="مرتجع من الفاتورة" footer={
      <button className="btn-danger flex-1" disabled={amount <= 0 || save.isPending} onClick={() => save.mutate(undefined)}>
        تأكيد المرتجع (<Money value={amount.toFixed(2)} />)
      </button>
    }>
      <div className="space-y-3">
        {invoice.items.map((i) => {
          const max = i.quantity - i.returned_quantity
          return (
            <div key={i.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{i.name}</div>
                <div className="text-xs text-slate-500">متاح للإرجاع: {max}{i.serial_number && ` · ${i.serial_number}`}</div>
              </div>
              <input className="input w-20 text-center" inputMode="numeric" disabled={max <= 0} value={qty[i.id] ?? ''} placeholder="0"
                onChange={(e) => setQty({ ...qty, [i.id]: Math.min(max, Math.max(0, parseInt(e.target.value) || 0)) })} />
            </div>
          )
        })}
        {invoice.payment_method === 'installment' && (
          <p className="rounded-xl bg-sky-50 p-3 text-xs text-sky-800">
            فاتورة تقسيط: قيمة المرتجع تُخصم أولاً من الأقساط غير المدفوعة (من آخر قسط)، وما يزيد عنها فقط يُرد للعميل
            بالطريقة المختارة. عند إرجاع كل الأصناف تُغلق خطة التقسيط ويُلغى أي متبقي.
          </p>
        )}
        <Field label="طريقة رد المبلغ">
          <select className="input" value={refund} onChange={(e) => setRefund(e.target.value as 'cash' | 'credit')}>
            <option value="cash">نقدي من الدرج</option>
            {invoice.customer && <option value="credit">خصم من حساب العميل</option>}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="size-4" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
          إرجاع الأصناف للمخزون (غير تالفة)
        </label>
        <Field label="السبب"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
