import { Plus, Trash2, Truck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ContactSearchModal, ProductSearchModal } from '../components/pickers'
import { Field, Money, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { todayISO } from '../lib/format'
import { useAction } from '../lib/hooks'
import type { Product, Supplier } from '../lib/types'

type Row = { product: Product; quantity: string; unit_cost: string; serials: string }

export default function PurchaseForm() {
  const nav = useNavigate()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [pickSupplier, setPickSupplier] = useState(false)
  const [pickProduct, setPickProduct] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [paid, setPaid] = useState('')
  const [d, setD] = useState(todayISO())
  const [notes, setNotes] = useState('')

  const total = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unit_cost) || 0), 0)
  const upd = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const serialList = (s: string) => s.split(/[\s,]+/).filter(Boolean)

  const save = useAction(() => api.post('/purchases/', {
    supplier: supplier?.id ?? null, date: d, notes, paid: supplier ? Number(paid) || 0 : total,
    items: rows.map((r) => ({
      product: r.product.id, unit_cost: Number(r.unit_cost) || 0,
      quantity: r.product.track_serial ? serialList(r.serials).length : Number(r.quantity) || 0,
      serials: r.product.track_serial ? serialList(r.serials) : [],
    })),
  }), { invalidate: ['purchases', 'products', 'suppliers', 'cash'], success: 'تم حفظ فاتورة التوريد', onSuccess: () => nav('/purchases') })

  return (
    <div className="space-y-4">
      <PageHeader back title="فاتورة توريد جديدة" />
      <div className="card grid gap-3 p-4 sm:grid-cols-2">
        <Field label="المورد">
          <button type="button" className="btn-secondary w-full justify-start" onClick={() => setPickSupplier(true)}>
            <Truck size={18} />{supplier ? supplier.name : 'اختر المورد (اختياري)'}
          </button>
        </Field>
        <Field label="التاريخ"><input className="input" type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field>
      </div>

      <div className="card divide-y divide-slate-100">
        {rows.map((r, i) => (
          <div key={i} className="space-y-2 p-3">
            <div className="flex items-center justify-between">
              <div className="font-bold">{r.product.name}</div>
              <button className="btn-ghost px-2 text-rose-500" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="حذف"><Trash2 size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {r.product.track_serial ? (
                <Field label={`السيريالات / IMEI (${serialList(r.serials).length})`} className="col-span-2">
                  <textarea className="input font-mono" dir="ltr" rows={3} placeholder="كل سيريال في سطر" value={r.serials} onChange={(e) => upd(i, { serials: e.target.value, quantity: String(serialList(e.target.value).length) })} />
                </Field>
              ) : (
                <Field label="الكمية"><input className="input" inputMode="numeric" value={r.quantity} onChange={(e) => upd(i, { quantity: e.target.value })} /></Field>
              )}
              <Field label="سعر شراء الوحدة"><input className="input" inputMode="decimal" value={r.unit_cost} onChange={(e) => upd(i, { unit_cost: e.target.value })} /></Field>
            </div>
          </div>
        ))}
        <div className="p-3">
          <button className="btn-secondary w-full" onClick={() => setPickProduct(true)}><Plus size={18} />إضافة صنف</button>
        </div>
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex justify-between text-lg font-extrabold"><span>الإجمالي</span><Money value={total} /></div>
        {supplier ? (
          <Field label="المدفوع الآن من الخزينة" hint="الباقي يُسجل على حساب المورد">
            <input className="input" inputMode="decimal" value={paid} placeholder="0" onChange={(e) => setPaid(e.target.value)} />
          </Field>
        ) : <p className="text-sm text-slate-500">بدون مورد: سيتم خصم الإجمالي من الخزينة.</p>}
        <Field label="ملاحظات"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <button className="btn-primary w-full py-3" disabled={!rows.length || save.isPending} onClick={() => save.mutate(undefined)}>حفظ الفاتورة</button>
      </div>

      <ContactSearchModal kind="suppliers" open={pickSupplier} onClose={() => setPickSupplier(false)} onPick={(s) => { setSupplier(s as Supplier); setPickSupplier(false) }} />
      <ProductSearchModal open={pickProduct} onClose={() => setPickProduct(false)} onPick={(p) => {
        setRows([...rows, { product: p, quantity: '1', unit_cost: String(p.cost_price || ''), serials: '' }]); setPickProduct(false)
      }} />
    </div>
  )
}
