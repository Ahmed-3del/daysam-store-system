import { Check, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Empty, Loading, PageHeader, Tabs, type Tone } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateTime } from '../lib/format'
import { useAction, useList } from '../lib/hooks'
import type { Approval } from '../lib/types'

const tone: Record<Approval['status'], Tone> = { pending: 'amber', approved: 'green', rejected: 'red', failed: 'red' }

function resultLink(a: Approval) {
  const r = a.result as Record<string, number>
  if (r.invoice_id) return { to: `/invoices/${r.invoice_id}`, label: `فاتورة #${r.invoice_number ?? r.invoice_id}` }
  if (r.ticket_id) return { to: `/repairs/${r.ticket_id}`, label: 'تذكرة الصيانة' }
  if (r.product_id) return { to: `/products/${r.product_id}`, label: 'المنتج' }
  if (a.kind === 'sale_return' && a.target_id) return { to: `/invoices/${a.target_id}`, label: 'الفاتورة' }
  return null
}

export default function Approvals() {
  const { isManager, refresh } = useAuth()
  const [status, setStatus] = useState('pending')
  const { data, isLoading } = useList<Approval>('approvals', { status: status || undefined })
  const decide = useAction(
    ({ id, approve, note }: { id: number; approve: boolean; note?: string }) =>
      api.post<Approval>(`/approvals/${id}/${approve ? 'approve' : 'reject'}/`, { note }),
    {
      invalidate: ['approvals', 'invoices', 'products', 'cash', 'repairs', 'wallets'],
      onSuccess: () => refresh(),
    },
  )

  return (
    <div className="space-y-3">
      <PageHeader title={isManager ? 'طلبات الموافقة' : 'طلباتي'} subtitle="العمليات الحساسة التي يطلبها الموظفون تنتظر موافقة المدير" />
      <Tabs value={status} onChange={setStatus} options={[
        { value: 'pending', label: 'بانتظار الموافقة' }, { value: 'approved', label: 'تمت الموافقة' },
        { value: 'rejected', label: 'مرفوضة' }, { value: 'failed', label: 'فشل التنفيذ' }, { value: '', label: 'الكل' },
      ]} />
      {isLoading ? <Loading /> : !data?.results.length ? <Empty icon={<ShieldCheck size={44} />} title="لا توجد طلبات" /> : (
        <div className="space-y-3">
          {data.results.map((a) => {
            const link = resultLink(a)
            return (
              <div key={a.id} className="card space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-extrabold">{a.kind_display}</div>
                    <div className="text-xs text-slate-500">{a.requested_by} · {dateTime(a.created_at)}</div>
                  </div>
                  <Badge tone={tone[a.status]}>{a.status_display}</Badge>
                </div>
                <p className="rounded-xl bg-slate-50 p-3 text-sm">{a.summary}</p>
                {a.decided_by_name && (
                  <div className="text-xs text-slate-500">
                    {a.status === 'rejected' ? 'رفض' : 'قرار'}: {a.decided_by_name} · {dateTime(a.decided_at)}{a.decision_note && ` — ${a.decision_note}`}
                  </div>
                )}
                {a.status === 'failed' && <p className="text-sm text-rose-600">{String(a.result.error ?? '')}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {link && <Link to={link.to} className="btn-ghost px-2 py-1 text-brand-700">{link.label}</Link>}
                  {isManager && a.status === 'pending' && (
                    <>
                      <button className="btn-success" disabled={decide.isPending} onClick={() => decide.mutate({ id: a.id, approve: true })}><Check size={18} />موافقة وتنفيذ</button>
                      <button className="btn-secondary text-rose-600" disabled={decide.isPending}
                        onClick={() => { const note = prompt('سبب الرفض (اختياري)') ?? undefined; decide.mutate({ id: a.id, approve: false, note }) }}>
                        <X size={18} />رفض
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
