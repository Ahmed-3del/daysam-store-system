import { useQuery } from '@tanstack/react-query'
import { PackageX, Plus, Trash2, Truck } from 'lucide-react'
import { useState } from 'react'
import { ContactSearchModal, ProductSearchModal } from '../components/pickers'
import { Badge, Empty, Fab, Field, Loading, Modal, Money, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { dateTime } from '../lib/format'
import { useAction, useList } from '../lib/hooks'
import type { Product, SerialItem, Supplier, SupplierReturn } from '../lib/types'

export default function SupplierReturns() {
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const { data, isLoading } = useList<SupplierReturn>('supplier-returns')
  return (
    <div className="space-y-3">
      <PageHeader title="مرتجعات الموردين" subtitle="إرجاع بضاعة معيبة أو زائدة للمورد وخصمها من حسابه" />
      {isLoading ? <Loading /> : !data?.results.length ? <Empty icon={<PackageX size={44} />} title="لا توجد مرتجعات" /> : (
        <div className="card">
          {data.results.map((r) => (
            <div key={r.id} className="border-b border-slate-100 last:border-0">
              <button className="list-row w-full text-start hover:bg-slate-50" onClick={() => setOpen(open === r.id ? null : r.id)}>
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 font-extrabold text-rose-700">#{r.number}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{r.supplier_name}</div>
                  <div className="text-xs text-slate-500">{dateTime(r.created_at)} · {r.items.length} صنف{r.reason && ` · ${r.reason}`}</div>
                </div>
                <div className="text-end">
                  <Money value={r.total} className="block font-extrabold" />
                  <Badge tone={r.refund_method === 'cash' ? 'green' : 'blue'}>{r.refund_method_display}</Badge>
                </div>
              </button>
              {open === r.id && (
                <div className="bg-slate-50 px-4 py-2 text-sm">
                  {r.items.map((i) => (
                    <div key={i.id} className="flex justify-between py-1">
                      <span>{i.product_name} {i.serial_number && <span className="font-mono text-xs" dir="ltr">({i.serial_number})</span>} × {i.quantity}</span>
                      <Money value={i.unit_cost * i.quantity} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Fab onClick={() => setAdding(true)} icon={<Plus size={20} />} label="مرتجع للمورد" />
      {adding && <NewReturnModal onClose={() => setAdding(false)} />}
    </div>
  )
}

type Line = { product: Product; quantity: string; unit_cost: string; serials: number[] }

function NewReturnModal({ onClose }: { onClose: () => void }) {
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [pickSupplier, setPickSupplier] = useState(false)
  const [pickProduct, setPickProduct] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [refund, setRefund] = useState('credit')
  const [reason, setReason] = useState('')
  const total = lines.reduce((s, l) => s + (l.product.track_serial ? 0 : (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0)), 0)
  const upd = (i: number, p: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)))
  const save = useAction(() => api.post('/supplier-returns/', {
    supplier: supplier?.id, refund_method: refund, reason,
    lines: lines.map((l) => ({ product: l.product.id, quantity: Number(l.quantity) || 0, serials: l.serials, unit_cost: l.unit_cost === '' ? null : Number(l.unit_cost) })),
  }), { invalidate: ['supplier-returns', 'products', 'suppliers', 'cash'], success: 'تم تسجيل المرتجع', onSuccess: onClose })

  return (
    <Modal open onClose={onClose} wide title="مرتجع جديد للمورد" footer={
      <button className="btn-danger flex-1" disabled={!supplier || !lines.length || save.isPending} onClick={() => save.mutate(undefined)}>تسجيل المرتجع</button>
    }>
      <div className="space-y-3">
        <button className="btn-secondary w-full justify-start" onClick={() => setPickSupplier(true)}><Truck size={18} />{supplier ? supplier.name : 'اختر المورد'}</button>
        {lines.map((l, i) => (
          <div key={l.product.id} className="space-y-2 rounded-xl p-3 ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <span className="font-bold">{l.product.name}</span>
              <button className="btn-ghost px-1.5 text-rose-500" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="حذف"><Trash2 size={16} /></button>
            </div>
            {l.product.track_serial ? (
              <SerialChooser productId={l.product.id} value={l.serials} onChange={(serials) => upd(i, { serials })} />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Field label={`الكمية (المتاح ${l.product.quantity})`}><input className="input" inputMode="numeric" value={l.quantity} onChange={(e) => upd(i, { quantity: e.target.value })} /></Field>
                <Field label="تكلفة الوحدة"><input className="input" inputMode="decimal" value={l.unit_cost} onChange={(e) => upd(i, { unit_cost: e.target.value })} /></Field>
              </div>
            )}
          </div>
        ))}
        <button className="btn-secondary w-full" onClick={() => setPickProduct(true)}><Plus size={16} />إضافة صنف</button>
        <div className="grid grid-cols-2 gap-3">
          <Field label="طريقة التسوية">
            <select className="input" value={refund} onChange={(e) => setRefund(e.target.value)}>
              <option value="credit">خصم من حساب المورد</option>
              <option value="cash">استلام نقدي في الدرج</option>
            </select>
          </Field>
          <Field label="السبب"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
        {total > 0 && <p className="text-sm">إجمالي الأصناف بالكمية: <Money value={total} className="font-bold" /> (+ تكلفة السيريالات المختارة)</p>}
      </div>
      <ContactSearchModal kind="suppliers" open={pickSupplier} onClose={() => setPickSupplier(false)} onPick={(s) => { setSupplier(s as Supplier); setPickSupplier(false) }} />
      <ProductSearchModal open={pickProduct} onClose={() => setPickProduct(false)} onPick={(p) => {
        if (!lines.some((l) => l.product.id === p.id)) setLines([...lines, { product: p, quantity: '1', unit_cost: String(p.cost_price ?? ''), serials: [] }])
        setPickProduct(false)
      }} />
    </Modal>
  )
}

function SerialChooser({ productId, value, onChange }: { productId: number; value: number[]; onChange: (v: number[]) => void }) {
  const { data } = useQuery({
    queryKey: ['serials', productId, 'in_stock'],
    queryFn: async () => (await api.get<SerialItem[]>(`/products/${productId}/serials/`, { params: { status: 'in_stock' } })).data,
  })
  if (!data) return <Loading />
  if (!data.length) return <p className="text-sm text-slate-500">لا توجد سيريالات في المخزن.</p>
  return (
    <div className="flex flex-wrap gap-2">
      {data.map((s) => {
        const on = value.includes(s.id)
        return (
          <button key={s.id} type="button" dir="ltr" onClick={() => onChange(on ? value.filter((x) => x !== s.id) : [...value, s.id])}
            className={`chip px-3 py-1.5 font-mono ${on ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{s.serial}</button>
        )
      })}
    </div>
  )
}
