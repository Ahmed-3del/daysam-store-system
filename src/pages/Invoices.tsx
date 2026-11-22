import { Receipt } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Empty, Loading, Money, PageHeader, SearchBox, Tabs, type Tone } from '../components/ui'
import { dateTime } from '../lib/format'
import { useDebounced, useList } from '../lib/hooks'
import type { Invoice } from '../lib/types'

const statusTone: Record<string, Tone> = { completed: 'green', partially_returned: 'amber', returned: 'red' }

export default function Invoices() {
  const [q, setQ] = useState('')
  const [method, setMethod] = useState('')
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const { data, isLoading } = useList<Invoice>('invoices', { search: dq, payment_method: method || undefined, page })

  return (
    <div className="space-y-3">
      <PageHeader title="الفواتير" actions={<Link to="/pos" className="btn-primary">بيع جديد</Link>} />
      <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="رقم الفاتورة، العميل، الموبايل أو IMEI" />
      <Tabs value={method} onChange={(v) => { setMethod(v); setPage(1) }} options={[
        { value: '', label: 'الكل' }, { value: 'cash', label: 'نقدي' }, { value: 'credit', label: 'آجل' },
        { value: 'installment', label: 'تقسيط' }, { value: 'card', label: 'فيزا' }, { value: 'wallet', label: 'محفظة' },
      ]} />
      {isLoading ? <Loading /> : !data?.results.length ? <Empty icon={<Receipt size={44} />} title="لا توجد فواتير" /> : (
        <div className="card">
          {data.results.map((inv) => (
            <Link key={inv.id} to={`/invoices/${inv.id}`} className="list-row hover:bg-slate-50">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-extrabold text-brand-700">#{inv.number}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{inv.customer_name || 'عميل نقدي'}</div>
                <div className="truncate text-xs text-slate-500">{dateTime(inv.created_at)} · {inv.items.length} صنف · {inv.cashier}</div>
              </div>
              <div className="text-end">
                <Money value={inv.total} className="block font-extrabold" />
                <div className="mt-0.5 flex justify-end gap-1">
                  <Badge tone="gray">{inv.payment_method_display}</Badge>
                  {inv.status !== 'completed' && <Badge tone={statusTone[inv.status]}>{inv.status_display}</Badge>}
                </div>
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
    </div>
  )
}
