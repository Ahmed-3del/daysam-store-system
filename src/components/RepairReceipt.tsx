import { date, dateTime, money } from '../lib/format'
import { ReceiptFrame, useQr } from './ReceiptFrame'
import type { RepairStatus, RepairTicket, Shop } from '../lib/types'
import type { Tone } from './ui'

export const REPAIR_STATUSES: { value: RepairStatus; label: string; tone: Tone }[] = [
  { value: 'received', label: 'تم الاستلام', tone: 'gray' },
  { value: 'diagnosing', label: 'قيد الفحص', tone: 'blue' },
  { value: 'awaiting_approval', label: 'بانتظار موافقة العميل', tone: 'amber' },
  { value: 'waiting_parts', label: 'بانتظار قطع غيار', tone: 'amber' },
  { value: 'in_progress', label: 'جاري الإصلاح', tone: 'violet' },
  { value: 'ready', label: 'جاهز للتسليم', tone: 'green' },
  { value: 'delivered', label: 'تم التسليم', tone: 'brand' },
  { value: 'cancelled', label: 'ملغي', tone: 'red' },
]
export const repairTone = (s: RepairStatus) => REPAIR_STATUSES.find((x) => x.value === s)?.tone ?? 'gray'

/** Intake receipt (إيصال استلام) handed to the customer. */
export function RepairReceipt({ t, shop, trackUrl }: { t: RepairTicket; shop: Shop; trackUrl: string }) {
  const qr = useQr(trackUrl)
  return (
    <ReceiptFrame shop={shop} title={`إيصال استلام صيانة #${t.number}`} subtitle={dateTime(t.created_at)}>
      <div className="mt-3 space-y-1">
        <R k="العميل" v={`${t.customer_name} ${t.customer_phone ? `(${t.customer_phone})` : ''}`} />
        <R k="الجهاز" v={`${t.device_type} ${t.brand} ${t.model}`} />
        {t.serial && <R k="IMEI / السيريال" v={t.serial} />}
        <R k="العطل" v={[t.fault_tags?.join('، '), t.issue].filter(Boolean).join(' — ')} />
        {t.condition_notes && <R k="حالة الجهاز" v={t.condition_notes} />}
        {t.accessories && <R k="المرفقات" v={t.accessories} />}
        {t.battery_health != null && <R k="صحة البطارية" v={`${t.battery_health}%`} />}
        {Object.keys(t.checklist || {}).length > 0 && (
          <R k="أعطال عند الاستلام" v={Object.entries(t.checklist).filter(([, v]) => v === 'bad').map(([k]) => CHECK_LABELS[k] ?? k).join('، ') || 'كل البنود المفحوصة سليمة'} />
        )}
        {t.is_warranty && <R k="نوع التذكرة" v={`رجوع ضمان على #${t.parent_number}`} />}
        {Number(t.estimated_cost) > 0 && <R k="التكلفة المتوقعة" v={money(t.estimated_cost, shop.currency)} />}
        {Number(t.deposit) > 0 && <R k="المقدم" v={money(t.deposit, shop.currency)} />}
        {t.expected_date && <R k="موعد الاستلام المتوقع" v={date(t.expected_date)} />}
      </div>
      <div className="mt-4 flex items-center gap-3 border-t border-dashed border-slate-300 pt-3">
        {qr && <img src={qr} alt="QR" className="size-20" />}
        <div>
          <div>كود المتابعة</div>
          <div className="font-mono text-lg font-extrabold tracking-widest" dir="ltr">{t.tracking_code}</div>
          <div className="text-slate-500">امسح الكود لمتابعة حالة جهازك</div>
        </div>
      </div>
      {shop.repair_terms && <div className="mt-3 whitespace-pre-line text-[0.9em] text-slate-500">{shop.repair_terms}</div>}
      <div className="mt-6 flex justify-between gap-2 text-slate-500"><span>توقيع العميل: .........</span><span>توقيع المحل: .........</span></div>
    </ReceiptFrame>
  )
}

function R({ k, v }: { k: string; v: string }) {
  return <div className="flex gap-2"><span className="w-28 shrink-0 text-slate-500">{k}:</span><span className="font-bold">{v}</span></div>
}

const CHECK_LABELS: Record<string, string> = {
  power: 'يفتح', screen: 'الشاشة', touch: 'اللمس', front_camera: 'الكاميرا الأمامية', back_camera: 'الكاميرا الخلفية',
  speaker: 'السماعة الخارجية', earpiece: 'سماعة المكالمات', mic: 'الميكروفون', charging: 'الشحن', wifi: 'الواي فاي',
  network: 'الشبكة', biometric: 'البصمة/Face ID', buttons: 'الأزرار', vibration: 'الهزاز', back_glass: 'الظهر/الإطار',
}
