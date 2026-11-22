import { Camera, FileText, HandCoins, MessageCircle, Pencil, Phone, Trash2 } from 'lucide-react'
import { SmsButton } from '../components/Sms'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Field, InfoRow, Loading, Modal, Money, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { useCurrency } from '../lib/auth'
import { dateTime, money, whatsappLink } from '../lib/format'
import { useAction, useGet } from '../lib/hooks'
import { useAuth } from '../lib/auth'
import type { Customer, CustomerDocument, LedgerEntry, Supplier } from '../lib/types'
import { ContactFormModal } from './Contacts'

const refLink: Record<string, string> = { invoice: '/invoices/', repairticket: '/repairs/' }

function ContactDetail({ kind }: { kind: 'customers' | 'suppliers' }) {
  const { id } = useParams()
  const cur = useCurrency()
  const { data: c, isLoading } = useGet<Customer & Supplier>([kind, id], `/${kind}/${id}/`)
  const { data: entries } = useGet<LedgerEntry[]>([kind, id, 'statement'], `/${kind}/${id}/statement/`)
  const [paying, setPaying] = useState(false)
  const [editing, setEditing] = useState(false)
  if (isLoading || !c) return <Loading />
  const isCust = kind === 'customers'
  const bal = Number(c.balance)

  return (
    <div className="space-y-4">
      <PageHeader back={`/${kind}`} title={c.name} actions={<button className="btn-secondary px-3" onClick={() => setEditing(true)} aria-label="تعديل"><Pencil size={18} /></button>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card space-y-3 p-4">
          <div className={`rounded-2xl p-4 text-center ${bal > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
            <div className="text-sm text-slate-600">{bal > 0 ? (isCust ? 'مستحق على العميل' : 'مستحق للمورد') : bal < 0 ? 'رصيد دائن' : 'لا يوجد رصيد'}</div>
            <Money value={Math.abs(bal)} className="text-2xl font-extrabold" />
          </div>
          {bal > 0 && <button className="btn-primary w-full" onClick={() => setPaying(true)}><HandCoins size={18} />{isCust ? 'تحصيل دفعة' : 'سداد دفعة'}</button>}
          <div className="flex gap-2">
            {c.phone && <a className="btn-secondary flex-1" href={`tel:${c.phone}`}><Phone size={18} />اتصال</a>}
            {c.phone && isCust && (
              <a className="btn-success flex-1" target="_blank" rel="noreferrer"
                href={whatsappLink(c.phone, bal > 0 ? `مرحباً ${c.name}، نود تذكيركم بأن المستحق عليكم ${money(bal, cur)}. شكراً لتعاملكم معنا.` : `مرحباً ${c.name}`)}>
                <MessageCircle size={18} />واتساب
              </a>
            )}
            {isCust && <SmsButton to={c.phone} kind="debt" className="btn-secondary flex-1"
              text={bal > 0 ? `مرحباً ${c.name}، نود تذكيركم بأن المستحق عليكم ${money(bal, cur)}. شكراً لتعاملكم معنا.` : `مرحباً ${c.name}`} />}
          </div>
          <div>
            <InfoRow label="الموبايل"><span dir="ltr">{c.phone || '—'}</span></InfoRow>
            {isCust ? c.national_id && <InfoRow label="الرقم القومي">{c.national_id}</InfoRow> : c.company && <InfoRow label="الشركة">{c.company}</InfoRow>}
            {c.address && <InfoRow label="العنوان">{c.address}</InfoRow>}
            {c.notes && <InfoRow label="ملاحظات">{c.notes}</InfoRow>}
          </div>
          {isCust && <Documents customerId={c.id} />}
        </div>
        <div className="card lg:col-span-2">
          <h2 className="border-b border-slate-100 px-4 py-3 font-extrabold">كشف الحساب</h2>
          {!entries?.length ? <p className="p-6 text-center text-sm text-slate-500">لا توجد حركات.</p> : entries.map((e) => {
            const link = e.ref_id && refLink[e.ref_type] ? `${refLink[e.ref_type]}${e.ref_id}` : null
            const body = (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{e.description}</div>
                  <div className="text-xs text-slate-500">{dateTime(e.created_at)}</div>
                </div>
                <span className={`font-extrabold tabular-nums ${e.amount > 0 ? 'text-amber-600' : 'text-emerald-600'}`} dir="ltr">{e.amount > 0 ? '+' : ''}{money(e.amount, '')}</span>
                <span className="w-24 text-end text-xs text-slate-500">الرصيد {money(e.balance_after, '')}</span>
              </>
            )
            return link ? <Link key={e.id} to={link} className="list-row hover:bg-slate-50">{body}</Link> : <div key={e.id} className="list-row">{body}</div>
          })}
        </div>
      </div>
      <PayModal kind={kind} contact={c} open={paying} onClose={() => setPaying(false)} />
      {editing && <ContactFormModal kind={kind} open initial={c} onClose={() => setEditing(false)} />}
    </div>
  )
}

function PayModal({ kind, contact, open, onClose }: { kind: string; contact: Customer | Supplier; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const pay = useAction(() => api.post(`/${kind}/${contact.id}/pay/`, { amount, note }), {
    invalidate: [kind, 'cash'], success: 'تم تسجيل الدفعة', onSuccess: () => { setAmount(''); setNote(''); onClose() },
  })
  return (
    <Modal open={open} onClose={onClose} title={kind === 'customers' ? 'تحصيل من العميل' : 'سداد للمورد'}
      footer={<button className="btn-primary flex-1" disabled={!Number(amount) || pay.isPending} onClick={() => pay.mutate(undefined)}>تأكيد</button>}>
      <div className="space-y-3">
        <Field label="المبلغ" hint={<>المستحق: <Money value={contact.balance} /></>}>
          <input className="input text-lg font-bold" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="ملاحظة"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

export const CustomerDetail = () => <ContactDetail kind="customers" />
export const SupplierDetail = () => <ContactDetail kind="suppliers" />

const DOC_KINDS = [
  ['id_front', 'البطاقة (وجه)'], ['id_back', 'البطاقة (ظهر)'], ['signature', 'توقيع'], ['contract', 'عقد / إيصال أمانة'], ['other', 'أخرى'],
]

function Documents({ customerId }: { customerId: number }) {
  const { isManager } = useAuth()
  const base = `/customers/${customerId}/documents/`
  const { data: docs } = useGet<CustomerDocument[]>(['customers', customerId, 'docs'], base)
  const [kind, setKind] = useState('id_front')
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null)
  const upload = useAction((file: File) => {
    const fd = new FormData()
    fd.append('file', file); fd.append('kind', kind)
    return api.post(base, fd)
  }, { invalidate: ['customers'], success: 'تم رفع المستند' })
  const del = useAction((id: number) => api.delete(`${base}${id}/`), { invalidate: ['customers'], success: 'تم الحذف' })
  const open = async (d: CustomerDocument) => {
    const r = await api.get(`${base}${d.id}/`, { responseType: 'blob' })
    setPreview({ url: URL.createObjectURL(r.data), type: d.content_type })
  }
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])

  return (
    <div className="border-t border-slate-100 pt-3">
      <div className="mb-2 font-extrabold">مستندات العميل (KYC)</div>
      <div className="flex gap-2">
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          {DOC_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn-secondary shrink-0 px-3" disabled={upload.isPending} onClick={() => input.current?.click()}>
          <Camera size={18} />{upload.isPending ? '...' : 'رفع'}
        </button>
        <input ref={input} type="file" accept="image/*,application/pdf" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = '' }} />
      </div>
      <div className="mt-2 space-y-1">
        {docs?.map((d) => (
          <div key={d.id} className="flex items-center gap-2 text-sm">
            <button className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-start hover:bg-slate-50" onClick={() => open(d)}>
              <FileText size={16} className="text-brand-700" />
              <span className="font-bold">{d.kind_display}</span>
              <span className="truncate text-xs text-slate-500">{dateTime(d.created_at)} · {d.user}</span>
            </button>
            {isManager && <button className="btn-ghost px-1.5 text-rose-500" onClick={() => confirm('حذف المستند؟') && del.mutate(d.id)} aria-label="حذف"><Trash2 size={16} /></button>}
          </div>
        ))}
        {docs && !docs.length && <p className="text-xs text-slate-500">لا توجد مستندات. صوّر البطاقة للأقساط وشراء المستعمل.</p>}
      </div>
      <Modal open={!!preview} onClose={() => setPreview(null)} title="عرض المستند" wide>
        {preview && (preview.type === 'application/pdf'
          ? <iframe src={preview.url} title="pdf" className="h-[70vh] w-full rounded-xl" />
          : <img src={preview.url} alt="" className="mx-auto max-h-[70vh] rounded-xl" />)}
      </Modal>
    </div>
  )
}
