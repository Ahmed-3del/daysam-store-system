import { Cpu, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ProductSearchModal } from '../components/pickers'
import { Badge, Empty, Fab, Field, Loading, Modal, Money, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useAction, useList } from '../lib/hooks'
import type { Bundle, BundleItem } from '../lib/types'

export default function Bundles() {
  const { isManager } = useAuth()
  const { data, isLoading } = useList<Bundle>('bundles', { is_active: true })
  const [edit, setEdit] = useState<Bundle | 'new' | null>(null)
  return (
    <div className="space-y-3">
      <PageHeader title="التجميعات والباقات" subtitle="تجميعات كمبيوتر أو عروض مجمعة تُباع كمنتج واحد بسعر الباقة" />
      {isLoading ? <Loading /> : !data?.results.length ? (
        <Empty icon={<Cpu size={44} />} title="لا توجد باقات">مثال: ماذربورد + معالج + رامات بسعر واحد</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.results.map((b) => {
            const saving = Number(b.components_total) - Number(b.price)
            return (
              <button key={b.id} className="card space-y-2 p-4 text-start hover:ring-brand-300" onClick={() => setEdit(b)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-extrabold">{b.name}</div>
                  <Money value={b.price} className="font-extrabold text-brand-700" />
                </div>
                <ul className="space-y-0.5 text-sm text-slate-600">
                  {b.items.map((i) => (
                    <li key={i.product} className="flex justify-between">
                      <span>{i.product_name} × {i.quantity}</span>
                      <span className={Number(i.available) < i.quantity ? 'text-rose-600' : 'text-slate-400'}>متاح {i.available}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  {saving > 0 && <Badge tone="green">توفير <Money value={saving} /></Badge>}
                  {b.barcode && <Badge><span dir="ltr">{b.barcode}</span></Badge>}
                </div>
              </button>
            )
          })}
        </div>
      )}
      {isManager && <Fab onClick={() => setEdit('new')} icon={<Plus size={20} />} label="باقة جديدة" />}
      {edit && <BundleModal bundle={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} canEdit={isManager} />}
    </div>
  )
}

function BundleModal({ bundle, onClose, canEdit }: { bundle?: Bundle; onClose: () => void; canEdit: boolean }) {
  const [f, setF] = useState({ name: bundle?.name || '', barcode: bundle?.barcode || '', price: bundle ? String(bundle.price) : '', description: bundle?.description || '' })
  const [items, setItems] = useState<BundleItem[]>(bundle?.items || [])
  const [pick, setPick] = useState(false)
  const components = items.reduce((s, i) => s + Number(i.sell_price || 0) * i.quantity, 0)
  const body = { ...f, price: Number(f.price) || 0, items: items.map((i) => ({ product: i.product, quantity: i.quantity })) }
  const save = useAction(() => (bundle ? api.patch(`/bundles/${bundle.id}/`, body) : api.post('/bundles/', body)), {
    invalidate: ['bundles'], success: 'تم حفظ الباقة', onSuccess: onClose,
  })
  const remove = useAction(() => api.delete(`/bundles/${bundle!.id}/`), { invalidate: ['bundles'], success: 'تم حذف الباقة', onSuccess: onClose })
  return (
    <Modal open onClose={onClose} wide title={bundle ? bundle.name : 'باقة جديدة'} footer={canEdit && (
      <>
        <button className="btn-primary flex-1" disabled={!f.name || !items.length || !Number(f.price) || save.isPending} onClick={() => save.mutate(undefined)}>حفظ</button>
        {bundle && <button className="btn-ghost text-rose-600" onClick={() => confirm('حذف الباقة؟') && remove.mutate(undefined)}><Trash2 size={18} /></button>}
      </>
    )}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="اسم الباقة" className="col-span-2"><input className="input" disabled={!canEdit} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="سعر الباقة" hint={components > 0 && <>مجموع المكونات <Money value={components} /></>}>
            <input className="input font-bold" inputMode="decimal" disabled={!canEdit} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          </Field>
          <Field label="باركود (اختياري)"><input className="input" dir="ltr" disabled={!canEdit} value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} /></Field>
        </div>
        <div className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
          {items.map((i, idx) => (
            <div key={i.product} className="flex items-center gap-2 p-2.5 text-sm">
              <span className="flex-1 font-bold">{i.product_name}</span>
              <Money value={i.sell_price} className="text-slate-500" />
              <input className="input w-16 text-center" inputMode="numeric" disabled={!canEdit} value={i.quantity}
                onChange={(e) => setItems(items.map((x, j) => (j === idx ? { ...x, quantity: Math.max(1, parseInt(e.target.value) || 1) } : x)))} />
              {canEdit && <button className="btn-ghost px-1.5 text-rose-500" onClick={() => setItems(items.filter((_, j) => j !== idx))} aria-label="حذف"><Trash2 size={16} /></button>}
            </div>
          ))}
          {canEdit && <div className="p-2.5"><button className="btn-secondary w-full" onClick={() => setPick(true)}><Plus size={16} />إضافة مكون</button></div>}
        </div>
        {Number(f.price) > 0 && components > Number(f.price) && (
          <p className="text-sm text-emerald-700">يظهر الفرق (<Money value={components - Number(f.price)} />) كخصم باقة في الفاتورة، ولا يحتاج موافقة.</p>
        )}
      </div>
      <ProductSearchModal open={pick} onClose={() => setPick(false)} onPick={(p) => {
        if (!items.some((i) => i.product === p.id)) {
          setItems([...items, { product: p.id, product_name: p.name, quantity: 1, sell_price: p.sell_price, track_serial: p.track_serial }])
        }
        setPick(false)
      }} />
    </Modal>
  )
}
