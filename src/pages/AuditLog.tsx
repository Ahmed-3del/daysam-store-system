import { ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { Badge, Empty, Loading, Modal, PageHeader, SearchBox, Tabs } from '../components/ui'
import { dateTime, todayISO } from '../lib/format'
import { useDebounced, useGet, useList } from '../lib/hooks'
import type { AuditEntry, User } from '../lib/types'

const methodTone = { POST: 'green', PATCH: 'blue', PUT: 'blue', DELETE: 'red' } as const

export default function AuditLog() {
  const [q, setQ] = useState('')
  const [user, setUser] = useState('')
  const [day, setDay] = useState(todayISO())
  const [failed, setFailed] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<AuditEntry | null>(null)
  const { data: team } = useGet<User[]>(['users'], '/users/')
  const { data, isLoading } = useList<AuditEntry>('audit-log', {
    search: useDebounced(q), user: user || undefined, page, page_size: 50,
    created_at__date__gte: day || undefined, created_at__date__lte: day || undefined,
    status_code__gte: failed === '1' ? 400 : undefined, status_code__lt: failed === '0' ? 400 : undefined,
  })

  return (
    <div className="space-y-3">
      <PageHeader title="سجل الرقابة" subtitle="كل عملية إضافة أو تعديل أو حذف مسجلة باسم الموظف ووقتها" />
      <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="بحث في الوصف (مثال: فاتورة، حذف، مرتجع)" />
      <div className="flex flex-wrap gap-2">
        <select className="input w-auto" value={user} onChange={(e) => { setUser(e.target.value); setPage(1) }}>
          <option value="">كل الموظفين</option>
          {team?.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
        </select>
        <input className="input w-auto" type="date" value={day} onChange={(e) => { setDay(e.target.value); setPage(1) }} />
        <button className="btn-ghost" onClick={() => setDay('')}>كل الأيام</button>
      </div>
      <Tabs value={failed} onChange={(v) => { setFailed(v); setPage(1) }} options={[
        { value: '', label: 'الكل' }, { value: '0', label: 'ناجحة' }, { value: '1', label: '⚠️ مرفوضة / محاولات' },
      ]} />
      {isLoading ? <Loading /> : !data?.results.length ? <Empty icon={<ClipboardList size={44} />} title="لا توجد عمليات" /> : (
        <div className="card">
          {data.results.map((e) => (
            <button key={e.id} className="list-row w-full text-start text-sm hover:bg-slate-50" onClick={() => setOpen(e)}>
              <Badge tone={methodTone[e.method as keyof typeof methodTone] ?? 'gray'}>{e.method}</Badge>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{e.description}</div>
                <div className="text-xs text-slate-500">{e.user_name} · {dateTime(e.created_at)}</div>
              </div>
              {e.status_code >= 400 && <Badge tone="red">{e.status_code === 403 ? 'مرفوض' : `خطأ ${e.status_code}`}</Badge>}
              {e.status_code === 202 && <Badge tone="amber">بانتظار موافقة</Badge>}
            </button>
          ))}
        </div>
      )}
      {data && (data.next || data.previous) && (
        <div className="flex justify-center gap-2">
          <button className="btn-secondary" disabled={!data.previous} onClick={() => setPage(page - 1)}>السابق</button>
          <button className="btn-secondary" disabled={!data.next} onClick={() => setPage(page + 1)}>التالي</button>
        </div>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title="تفاصيل العملية" wide>
        {open && (
          <div className="space-y-2 text-sm">
            <div className="font-bold">{open.description}</div>
            <div className="text-slate-500">{open.user_name} · {dateTime(open.created_at)} · IP {open.ip}</div>
            <div dir="ltr" className="font-mono text-xs text-slate-500">{open.method} {open.path} → {open.status_code}</div>
            <pre dir="ltr" className="max-h-80 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(open.payload, null, 2)}</pre>
          </div>
        )}
      </Modal>
    </div>
  )
}
