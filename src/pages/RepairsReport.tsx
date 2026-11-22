import { useState } from 'react'
import { InfoRow, Loading, Money, PageHeader, StatCard, Tabs } from '../components/ui'
import { num, todayISO } from '../lib/format'
import { useGet } from '../lib/hooks'

interface Report {
  received: number; delivered: number; warranty_returns: number; cancelled: number; labor_total: number
  parts_total: number; revenue: number; profit: number; avg_turnaround_hours: number | null
  quotes_approved: number; quotes_rejected: number
  technicians: { technician: number | null; name: string; count: number; labor: number; profit: number; commission_percent: number; commission: number }[]
  top_faults: { tag: string; count: number }[]
  top_brands: { brand: string; count: number }[]
}

function shift(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export default function RepairsReport() {
  const [preset, setPreset] = useState('month')
  const [range, setRange] = useState({ from: `${todayISO().slice(0, 8)}01`, to: todayISO() })
  const choose = (p: string) => {
    setPreset(p)
    const to = todayISO()
    if (p === 'today') setRange({ from: to, to })
    if (p === 'week') setRange({ from: shift(6), to })
    if (p === 'month') setRange({ from: `${to.slice(0, 8)}01`, to })
    if (p === '90') setRange({ from: shift(89), to })
  }
  const { data: r, isLoading } = useGet<Report>(['repairs', 'report', range], '/repairs/report/', range)
  const maxFault = Math.max(1, ...(r?.top_faults.map((f) => f.count) || [1]))
  const turnaround = r?.avg_turnaround_hours == null ? '—' : r.avg_turnaround_hours < 48 ? `${num(r.avg_turnaround_hours)} ساعة` : `${num((r.avg_turnaround_hours / 24).toFixed(1))} يوم`

  return (
    <div className="space-y-4">
      <PageHeader back="/repairs" title="تقرير الصيانة" />
      <Tabs value={preset} onChange={choose} options={[
        { value: 'today', label: 'اليوم' }, { value: 'week', label: '7 أيام' }, { value: 'month', label: 'هذا الشهر' },
        { value: '90', label: '90 يوم' }, { value: 'custom', label: 'مخصص' },
      ]} />
      {preset === 'custom' && (
        <div className="flex gap-2">
          <input className="input" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <input className="input" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </div>
      )}
      {isLoading || !r ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="أجهزة مستلمة" value={num(r.received)} hint={`${num(r.warranty_returns)} رجوع ضمان`} />
            <StatCard label="تم تسليمها" value={num(r.delivered)} hint={`${num(r.cancelled)} ملغي`} tone="green" />
            <StatCard label="إيراد الصيانة" value={<Money value={r.revenue} />} hint={<>أجرة يد <Money value={r.labor_total} /></>} tone="violet" />
            <StatCard label="ربح الصيانة" value={<Money value={r.profit} />} hint={`متوسط مدة الإصلاح ${turnaround}`} tone="green" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-4">
              <h2 className="mb-2 font-extrabold">أداء الفنيين وعمولاتهم</h2>
              {!r.technicians.length ? <p className="text-sm text-slate-500">لا توجد أجهزة مسلمة في الفترة.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-slate-500"><th className="py-1 text-start">الفني</th><th>أجهزة</th><th>أجرة اليد</th><th className="text-end">العمولة</th></tr></thead>
                  <tbody>
                    {r.technicians.map((t) => (
                      <tr key={t.technician ?? 0} className="border-t border-slate-100">
                        <td className="py-2 font-bold">{t.name}</td>
                        <td className="text-center">{num(t.count)}</td>
                        <td className="text-center"><Money value={t.labor} /></td>
                        <td className="text-end"><Money value={t.commission} className="font-bold text-emerald-700" /><div className="text-[10px] text-slate-400">{num(t.commission_percent)}%</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-2 text-xs text-slate-500">نسبة العمولة تُحدد لكل فني من الإعدادات ← فريق العمل.</p>
            </section>
            <section className="card p-4">
              <h2 className="mb-3 font-extrabold">أكثر الأعطال</h2>
              {!r.top_faults.length ? <p className="text-sm text-slate-500">لا توجد بيانات.</p> : r.top_faults.map((f) => (
                <div key={f.tag} className="mb-2">
                  <div className="flex justify-between text-sm"><span>{f.tag}</span><span className="font-bold">{num(f.count)}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(f.count / maxFault) * 100}%` }} /></div>
                </div>
              ))}
            </section>
            <section className="card p-4">
              <h2 className="mb-2 font-extrabold">الماركات</h2>
              {r.top_brands.map((b) => <InfoRow key={b.brand} label={b.brand}>{num(b.count)}</InfoRow>)}
            </section>
            <section className="card p-4">
              <h2 className="mb-2 font-extrabold">عروض الأسعار</h2>
              <InfoRow label="وافق العميل">{num(r.quotes_approved)}</InfoRow>
              <InfoRow label="رفض العميل">{num(r.quotes_rejected)}</InfoRow>
              <InfoRow label="قطع الغيار المباعة"><Money value={r.parts_total} /></InfoRow>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
