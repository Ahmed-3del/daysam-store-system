import { AlertTriangle, BarChart3, Clock, Plus, ShieldCheck, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { REPAIR_STATUSES, repairTone } from '../components/RepairReceipt'
import { Badge, Empty, Fab, Loading, Money, PageHeader, SearchBox, Tabs } from '../components/ui'
import { useAuth } from '../lib/auth'
import { date } from '../lib/format'
import { useDebounced, useGet, useList } from '../lib/hooks'
import type { RepairTicket } from '../lib/types'

interface Summary { [status: string]: number | { overdue: number; uncollected: number; awaiting: number } }

export default function Repairs() {
  const nav = useNavigate()
  const { user, isManager } = useAuth()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const status = params.get('tab') || (user?.role === 'technician' ? 'mine' : 'open')
  const setStatus = (v: string) => setParams({ tab: v })
  const { data: summary } = useGet<Summary>(['repairs', 'summary'], '/repairs/summary/')
  const alerts = (summary?.alerts ?? { overdue: 0, uncollected: 0, awaiting: 0 }) as { overdue: number; uncollected: number; awaiting: number }
  const count = (s: string) => (typeof summary?.[s] === 'number' ? (summary[s] as number) : 0)
  const isAlert = ['overdue', 'uncollected'].includes(status)
  const { data, isLoading } = useList<RepairTicket>('repairs', {
    search: useDebounced(q),
    open: status === 'open' || status === 'mine' ? 1 : undefined,
    mine: status === 'mine' ? 1 : undefined,
    alert: isAlert ? status : undefined,
    status: !['open', 'all', 'mine', 'overdue', 'uncollected'].includes(status) ? status : undefined,
  })
  const openCount = REPAIR_STATUSES.slice(0, 6).reduce((s, x) => s + count(x.value), 0)

  return (
    <div className="space-y-3">
      <PageHeader title="الصيانة" actions={isManager && <Link to="/repairs/report" className="btn-secondary px-3"><BarChart3 size={18} /><span className="hidden sm:inline">التقرير</span></Link>} />
      {(alerts.overdue > 0 || alerts.uncollected > 0 || alerts.awaiting > 0) && (
        <div className="flex flex-wrap gap-2">
          {alerts.overdue > 0 && <button onClick={() => setStatus('overdue')} className="chip bg-rose-100 px-3 py-1.5 text-sm text-rose-700"><AlertTriangle size={14} className="me-1" />{alerts.overdue} متأخر عن الموعد</button>}
          {alerts.uncollected > 0 && <button onClick={() => setStatus('uncollected')} className="chip bg-amber-100 px-3 py-1.5 text-sm text-amber-800"><Clock size={14} className="me-1" />{alerts.uncollected} جاهز ولم يُستلم +7 أيام</button>}
          {alerts.awaiting > 0 && <button onClick={() => setStatus('awaiting_approval')} className="chip bg-sky-100 px-3 py-1.5 text-sm text-sky-800">{alerts.awaiting} بانتظار موافقة العميل</button>}
        </div>
      )}
      <SearchBox value={q} onChange={setQ} placeholder="رقم التذكرة، العميل، الموبايل، IMEI أو الموديل" />
      <Tabs value={status} onChange={setStatus} options={[
        { value: 'open', label: `المفتوحة (${openCount})` },
        ...(typeof summary?.mine === 'number' && summary.mine > 0 || user?.role === 'technician' ? [{ value: 'mine', label: `مهامي (${count('mine')})` }] : []),
        ...REPAIR_STATUSES.map((s) => ({ value: s.value, label: `${s.label}${count(s.value) ? ` (${count(s.value)})` : ''}` })),
        { value: 'overdue', label: 'متأخرة' }, { value: 'uncollected', label: 'لم تُستلم' },
        { value: 'all', label: 'الكل' },
      ]} />
      {isLoading ? <Loading /> : !data?.results.length ? <Empty icon={<Wrench size={44} />} title="لا توجد أجهزة" /> : (
        <div className="card">
          {data.results.map((t) => {
            const late = t.expected_date && !['ready', 'delivered', 'cancelled'].includes(t.status) && new Date(t.expected_date) < new Date(new Date().toDateString())
            return (
              <Link key={t.id} to={`/repairs/${t.id}`} className="list-row hover:bg-slate-50">
                <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl font-extrabold ${t.is_warranty ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'}`}>#{t.number}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{t.brand} {t.model} — {t.customer_name}</div>
                  <div className="truncate text-xs text-slate-500">{t.fault_tags?.length ? t.fault_tags.join('، ') : t.issue}</div>
                  <div className="flex flex-wrap gap-x-2 text-xs text-slate-400">
                    <span>{date(t.created_at)}</span>
                    {t.technician_name && <span>· {t.technician_name}</span>}
                    {t.expected_date && <span className={late ? 'font-bold text-rose-600' : ''}>· موعد {date(t.expected_date)}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={repairTone(t.status)}>{t.status_display}</Badge>
                  {t.is_warranty && <Badge tone="violet"><ShieldCheck size={12} className="me-0.5" />ضمان</Badge>}
                  {Number(t.total) > 0 && <Money value={t.total} className="text-sm font-bold" />}
                </div>
              </Link>
            )
          })}
        </div>
      )}
      <Fab onClick={() => nav('/repairs/new')} icon={<Plus size={20} />} label="استلام جهاز" />
    </div>
  )
}
