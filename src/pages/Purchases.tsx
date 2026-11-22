import { Plus, Truck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Empty, Fab, Loading, Money, PageHeader, SearchBox } from '../components/ui'
import { date } from '../lib/format'
import { useDebounced, useList } from '../lib/hooks'
import type { Purchase } from '../lib/types'

export default function Purchases() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const { data, isLoading } = useList<Purchase>('purchases', { search: useDebounced(q) })
  return (
    <div className="space-y-3">
      <PageHeader title="فواتير التوريد" />
      <SearchBox value={q} onChange={setQ} placeholder="رقم الفاتورة أو المورد" />
      {isLoading ? <Loading /> : !data?.results.length ? <Empty icon={<Truck size={44} />} title="لا توجد فواتير توريد" /> : (
        <div className="card">
          {data.results.map((p) => (
            <div key={p.id} className="border-b border-slate-100 last:border-0">
              <button className="list-row w-full text-start hover:bg-slate-50" onClick={() => setOpen(open === p.id ? null : p.id)}>
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 font-extrabold text-amber-700">#{p.number}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{p.supplier_name || 'بدون مورد'}</div>
                  <div className="text-xs text-slate-500">{date(p.date)} · {p.items.length} صنف</div>
                </div>
                <div className="text-end">
                  <Money value={p.total} className="block font-extrabold" />
                  {Number(p.total) > Number(p.paid) && <Badge tone="amber">متبقي <Money value={Number(p.total) - Number(p.paid)} /></Badge>}
                </div>
              </button>
              {open === p.id && (
                <div className="bg-slate-50 px-4 py-2 text-sm">
                  {p.items.map((i) => (
                    <div key={i.id} className="flex justify-between py-1"><span>{i.product_name} × {i.quantity}</span><Money value={i.unit_cost * i.quantity} /></div>
                  ))}
                  {p.notes && <div className="pt-1 text-xs text-slate-500">{p.notes}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Fab onClick={() => nav('/purchases/new')} icon={<Plus size={20} />} label="فاتورة توريد" />
    </div>
  )
}
