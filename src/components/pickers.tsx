import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { api, type Paginated } from '../lib/api'
import type { Customer, Product, Supplier } from '../lib/types'
import { useDebounced } from '../lib/hooks'
import { searchSnapshot, useOffline } from '../lib/offline'
import { useToast } from './toast'
import { Badge, Field, Modal, Money, SearchBox } from './ui'

/** Selected-customer chip that opens a searchable picker with inline quick-create. */
export function CustomerPicker({ value, onChange, required }: {
  value: Customer | null; onChange: (c: Customer | null) => void; required?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {value ? (
        <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2">
          <UserRound size={18} className="text-brand-700" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{value.name}</div>
            <div className="text-xs text-slate-500">{value.phone || '—'}{Number(value.balance) > 0 && <> · عليه <Money value={value.balance} /></>}</div>
          </div>
          <button className="btn-ghost px-1.5" onClick={() => onChange(null)} aria-label="إزالة العميل"><X size={16} /></button>
        </div>
      ) : (
        <button type="button" className={`btn-secondary w-full justify-start ${required ? 'ring-amber-400' : ''}`} onClick={() => setOpen(true)}>
          <UserRound size={18} /> {required ? 'اختر العميل (مطلوب)' : 'اختيار عميل (اختياري)'}
        </button>
      )}
      <ContactSearchModal kind="customers" open={open} onClose={() => setOpen(false)}
        onPick={(c) => { onChange(c as Customer); setOpen(false) }} />
    </>
  )
}

export function ContactSearchModal({ kind, open, onClose, onPick }: {
  kind: 'customers' | 'suppliers'; open: boolean; onClose: () => void; onPick: (c: Customer | Supplier) => void
}) {
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '' })
  const qc = useQueryClient()
  const toast = useToast()
  const { online, snapshot } = useOffline()
  const offlineList = kind === 'customers' && !online
  const { data: remote } = useQuery({
    queryKey: [kind, 'search', dq],
    queryFn: async () => (await api.get<Paginated<Customer | Supplier>>(`/${kind}/`, { params: { search: dq, page_size: 20 } })).data,
    enabled: open && !offlineList,
  })
  const data = offlineList
    ? { results: (snapshot?.customers || []).filter((c) => !dq || `${c.name} ${c.phone}`.includes(dq)).slice(0, 20) as unknown as (Customer | Supplier)[] }
    : remote
  const create = async () => {
    try {
      const { data } = await api.post(`/${kind}/`, form)
      qc.invalidateQueries({ queryKey: [kind] })
      setCreating(false); setForm({ name: '', phone: '' })
      onPick(data)
    } catch (e) { toast.error(e) }
  }
  const label = kind === 'customers' ? 'عميل' : 'مورد'
  return (
    <Modal open={open} onClose={onClose} title={`اختيار ${label}`}>
      {creating ? (
        <div className="space-y-3">
          <Field label="الاسم"><input className="input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="رقم الموبايل"><input className="input" inputMode="tel" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={!form.name} onClick={create}>حفظ</button>
            <button className="btn-secondary" onClick={() => setCreating(false)}>إلغاء</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <SearchBox value={q} onChange={setQ} placeholder="ابحث بالاسم أو الموبايل" autoFocus />
          {offlineList ? (
            <p className="rounded-xl bg-slate-100 p-2 text-xs text-slate-600">بدون إنترنت: تظهر العملاء المحفوظين على الجهاز فقط. لعميل جديد اكتب اسمه في ملاحظات الفاتورة.</p>
          ) : (
            <button className="btn-secondary w-full" onClick={() => { setForm({ name: q, phone: '' }); setCreating(true) }}>
              <Plus size={18} /> {label} جديد
            </button>
          )}
          <div className="divide-y divide-slate-100">
            {data?.results.map((c) => (
              <button key={c.id} className="flex w-full items-center justify-between py-2.5 text-start hover:bg-slate-50" onClick={() => onPick(c)}>
                <div>
                  <div className="font-bold">{c.name}</div>
                  <div className="text-xs text-slate-500" dir="ltr">{c.phone}</div>
                </div>
                {Number(c.balance) !== 0 && <Badge tone={Number(c.balance) > 0 ? 'amber' : 'green'}><Money value={c.balance} /></Badge>}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

export function ProductSearchModal({ open, onClose, onPick, title = 'اختيار منتج' }: {
  open: boolean; onClose: () => void; onPick: (p: Product) => void; title?: string
}) {
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const { online, snapshot } = useOffline()
  const { data: remote } = useQuery({
    queryKey: ['products', 'search', dq],
    queryFn: async () => (await api.get<Paginated<Product>>('/products/', { params: { search: dq, is_active: true, page_size: 30 } })).data,
    enabled: open && online,
  })
  const data = online ? remote : { results: dq ? searchSnapshot(snapshot, dq) : (snapshot?.products || []).slice(0, 30) }
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        <SearchBox value={q} onChange={setQ} placeholder="اسم المنتج أو الباركود" autoFocus />
        <div className="divide-y divide-slate-100">
          {data?.results.map((p) => (
            <button key={p.id} className="flex w-full items-center justify-between gap-3 py-2.5 text-start hover:bg-slate-50" onClick={() => onPick(p)}>
              <div className="min-w-0">
                <div className="truncate font-bold">{p.name}</div>
                <div className="text-xs text-slate-500">{p.is_service ? 'خدمة' : `المتاح: ${p.quantity}`}{p.track_serial && ' · بالسيريال'}</div>
              </div>
              <Money value={p.sell_price} className="shrink-0 text-sm font-bold" />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
