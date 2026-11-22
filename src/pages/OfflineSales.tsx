import { CheckCircle2, CloudOff, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { QUEUED, useApproval } from '../components/approval'
import { api } from '../lib/api'
import { useToast } from '../components/toast'
import { Badge, Empty, Money, PageHeader, type Tone } from '../components/ui'
import { dateTime } from '../lib/format'
import { useOffline } from '../lib/offline'
import type { OutboxSale } from '../lib/offlineDb'

const STATUS: Record<OutboxSale['status'], { label: string; tone: Tone }> = {
  pending: { label: 'بانتظار المزامنة', tone: 'amber' },
  syncing: { label: 'جاري الإرسال', tone: 'blue' },
  failed: { label: 'فشلت المزامنة', tone: 'red' },
  needs_approval: { label: 'تحتاج موافقة المدير', tone: 'violet' },
}

export default function OfflineSales() {
  const { online, sales, syncing, syncNow, syncOne, discard, snapshot } = useOffline()
  const approval = useApproval()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const qc = useQueryClient()

  const retry = async (s: OutboxSale) => {
    setBusy(s.uuid)
    try {
      if (s.status === 'needs_approval') {
        // Same flow as a live sale: manager PIN now, or a request the manager approves later.
        const res = await approval.run((extra) => api.post('/invoices/checkout/', {
          ...s.payload, ...extra, client_uuid: s.uuid, offline_created_at: s.created_at,
        }))
        if (res === QUEUED) return  // the manager's approval creates the invoice with this same id; next sync clears it
        await discard(s.uuid)
        ;['invoices', 'products', 'cash', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
        toast.ok('تمت مزامنة الفاتورة')
      } else {
        const r = await syncOne(s.uuid)
        if (r === 'done') toast.ok('تمت مزامنة الفاتورة')
        else if (r === 'offline') toast.error('لا يوجد اتصال بالإنترنت')
      }
    } catch (e) {
      if ((e as Error)?.message !== 'cancelled') toast.error(e)
    } finally { setBusy(null) }
  }

  return (
    <div className="space-y-3">
      <PageHeader title="مبيعات بدون إنترنت" subtitle="فواتير محفوظة على هذا الجهاز تُرحّل تلقائياً عند عودة الاتصال"
        actions={online && sales.length > 0 && <button className="btn-primary" disabled={syncing} onClick={syncNow}><RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />مزامنة الآن</button>} />
      <div className={`card flex items-center gap-3 p-4 text-sm ${online ? '' : 'bg-slate-800 text-white'}`}>
        {online ? <CheckCircle2 className="text-emerald-500" /> : <CloudOff />}
        <div className="flex-1">
          <div className="font-bold">{online ? 'متصل بالإنترنت' : 'غير متصل — البيع مستمر من النسخة المحفوظة'}</div>
          <div className={online ? 'text-slate-500' : 'text-white/70'}>
            {snapshot ? `آخر تحديث لبيانات المنتجات: ${dateTime(snapshot.generated_at)} · ${snapshot.products.length} منتج` : 'لم يتم حفظ نسخة من المنتجات على هذا الجهاز بعد — افتح نقطة البيع وأنت متصل.'}
          </div>
        </div>
      </div>
      {!sales.length ? <Empty icon={<CheckCircle2 size={44} className="text-emerald-400" />} title="كل المبيعات متزامنة">لا توجد فواتير بانتظار الترحيل</Empty> : (
        <div className="space-y-3">
          {sales.map((s) => (
            <div key={s.uuid} className="card space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-extrabold">فاتورة مؤقتة <span className="font-mono" dir="ltr">{s.uuid.slice(0, 8).toUpperCase()}</span></div>
                  <div className="text-xs text-slate-500">{dateTime(s.created_at)} · {s.cashier}{s.customer_name && ` · ${s.customer_name}`}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Money value={s.total} className="font-extrabold" />
                  <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                </div>
              </div>
              <ul className="rounded-xl bg-slate-50 p-3 text-sm">
                {s.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{l.name} × {l.quantity}{l.serial && <span className="font-mono text-xs text-slate-500" dir="ltr"> ({l.serial})</span>}</span>
                    <Money value={l.unit_price * l.quantity} />
                  </li>
                ))}
              </ul>
              {s.error && <p className={`text-sm ${s.status === 'needs_approval' ? 'text-violet-700' : 'text-rose-600'}`}>{s.error}</p>}
              {s.status !== 'pending' && (
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary px-3 py-2" disabled={!online || busy === s.uuid} onClick={() => retry(s)}>
                    {s.status === 'needs_approval' ? <><ShieldCheck size={16} />موافقة المدير والمزامنة</> : <><RefreshCw size={16} />إعادة المحاولة</>}
                  </button>
                  <button className="btn-ghost px-3 py-2 text-rose-600" onClick={() => confirm('حذف هذه الفاتورة من الجهاز نهائياً؟ لن تُسجل في النظام.') && discard(s.uuid)}>
                    <Trash2 size={16} />حذف
                  </button>
                </div>
              )}
              {s.status === 'failed' && <p className="text-xs text-slate-500">مثال: السيريال بيع من جهاز آخر أثناء انقطاع الإنترنت، أو لا توجد وردية مفتوحة. عالج السبب ثم أعد المحاولة، أو احذف الفاتورة وسجلها من جديد.</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
