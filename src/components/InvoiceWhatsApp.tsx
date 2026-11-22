import { toPng } from 'html-to-image'
import { Image, MessageCircle, Send } from 'lucide-react'
import { useEffect, useState, type RefObject } from 'react'
import { date, money, waNumber, whatsappLink } from '../lib/format'
import type { Invoice, Shop } from '../lib/types'
import { useToast } from './toast'
import { Field, Modal } from './ui'

/** WhatsApp-formatted invoice: bold headings, one line per item, totals, and the public link. */
export function invoiceWhatsAppText(inv: Invoice, shop: Shop) {
  const cur = shop.currency
  const link = `${window.location.origin}/i/${inv.public_token}`
  const serialLabel = shop.config?.serial_label?.includes('IMEI') ? 'IMEI' : 'SN'
  const extraDiscount = Number(inv.discount) - Number(inv.bundle_discount)
  const lines: (string | null)[] = [
    `*${shop.name}*`,
    `فاتورة رقم *#${inv.number}* — ${date(inv.created_at)}`,
    inv.customer_name ? `العميل: ${inv.customer_name}` : null,
    '━━━━━━━━━━',
    ...inv.items.flatMap((i) => [
      `▪️ ${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ''} — ${money(i.line_total, cur)}`,
      i.serial_number ? `    ${serialLabel}: ${i.serial_number}` : null,
      i.warranty_days > 0 ? `    ضمان ${i.warranty_days} يوم` : null,
    ]),
    '━━━━━━━━━━',
    Number(inv.bundle_discount) > 0 ? `خصم الباقات: ${money(inv.bundle_discount, cur)}` : null,
    extraDiscount > 0 ? `الخصم: ${money(extraDiscount, cur)}` : null,
    Number(inv.trade_in_value) > 0 ? `قيمة الجهاز المستبدل: ${money(inv.trade_in_value, cur)}` : null,
    `*الإجمالي: ${money(inv.total, cur)}*`,
    Number(inv.remaining) > 0 ? `المدفوع: ${money(inv.paid, cur)}` : null,
    Number(inv.remaining) > 0 ? `*المتبقي: ${money(inv.remaining, cur)}*` : null,
    Number(inv.returned_total) > 0 ? `مرتجع: ${money(inv.returned_total, cur)}` : null,
    '',
    `🧾 عرض وطباعة الفاتورة:`,
    link,
    shop.invoice_footer ? `\n${shop.invoice_footer}` : null,
  ]
  return lines.filter((l) => l !== null).join('\n').trim()
}

async function receiptPng(node: HTMLElement) {
  const opts = { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true }
  try {
    return await toPng(node, opts)
  } catch {
    // A logo from another origin can taint the canvas: retry without images (QR is a data URL and stays).
    return toPng(node, { ...opts, filter: (n) => !(n instanceof HTMLImageElement) || n.src.startsWith('data:') })
  }
}

export function InvoiceWhatsAppButton({ invoice, shop, receiptRef }: { invoice: Invoice; shop: Shop; receiptRef: RefObject<HTMLDivElement | null> }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn-success" onClick={() => setOpen(true)}><MessageCircle size={18} />إرسال واتساب</button>
      {open && <InvoiceWhatsAppModal invoice={invoice} shop={shop} receiptRef={receiptRef} onClose={() => setOpen(false)} />}
    </>
  )
}

function InvoiceWhatsAppModal({ invoice, shop, receiptRef, onClose }: {
  invoice: Invoice; shop: Shop; receiptRef: RefObject<HTMLDivElement | null>; onClose: () => void
}) {
  const toast = useToast()
  const [phone, setPhone] = useState(invoice.customer_phone || '')
  const [text, setText] = useState(() => invoiceWhatsAppText(invoice, shop))
  const [img, setImg] = useState<{ file: File; url: string } | 'error' | null>(null)
  // Build the picture up front: share() must run straight from the tap, and rendering takes a moment.
  useEffect(() => {
    let live = true
    const node = receiptRef.current
    if (!node) { setImg('error'); return }
    receiptPng(node).then(async (url) => {
      const blob = await (await fetch(url)).blob()
      if (live) setImg({ url, file: new File([blob], `invoice-${invoice.number}.png`, { type: 'image/png' }) })
    }).catch((e) => { console.warn('invoice image failed', e); if (live) setImg('error') })
    return () => { live = false }
  }, [receiptRef, invoice.number])
  const number = waNumber(phone)
  const badNumber = !!phone && !/^\d{10,15}$/.test(number)

  const sendText = () => { window.open(whatsappLink(phone, text), '_blank', 'noopener'); onClose() }

  const sendImage = () => {
    if (!img || img === 'error') return
    if (navigator.canShare?.({ files: [img.file] })) {
      // Phones: the share sheet attaches the picture; pick WhatsApp then the customer.
      navigator.share({ files: [img.file], text: `${shop.name} — فاتورة #${invoice.number}` })
        .then(onClose)
        .catch((e) => {
          if ((e as DOMException)?.name === 'AbortError') return
          console.warn('invoice image share failed', e)
          toast.error('تعذرت المشاركة، أرسل الفاتورة كنص ورابط.')
        })
      return
    }
    // Desktop: save the picture and open the chat with the text — then drag the picture in.
    const a = document.createElement('a')
    a.href = img.url; a.download = img.file.name; a.click()
    window.open(whatsappLink(phone, text), '_blank', 'noopener')
    toast.ok('تم حفظ صورة الفاتورة — أرفقها في محادثة واتساب')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`إرسال فاتورة #${invoice.number} واتساب`} footer={
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <button className="btn-success flex-1" disabled={badNumber} onClick={sendText}><Send size={18} />إرسال الفاتورة (نص + رابط)</button>
        {img !== 'error' && <button className="btn-secondary flex-1" disabled={!img || badNumber} onClick={sendImage}><Image size={18} />{img ? 'إرسال صورة الفاتورة' : 'جاري تجهيز الصورة...'}</button>}
      </div>
    }>
      <div className="space-y-3">
        <Field label="رقم واتساب العميل" hint={badNumber ? <span className="text-rose-600">رقم غير صحيح</span> : !phone ? 'اتركه فارغاً لاختيار المحادثة من واتساب' : <span dir="ltr">+{number}</span>}>
          <input className="input" dir="ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="نص الرسالة">
          <textarea className="input font-mono text-sm leading-6" rows={10} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <p className="text-xs text-slate-500">الرابط يفتح الفاتورة كاملة للعميل ويمكنه طباعتها. «صورة الفاتورة» ترسل نفس شكل الإيصال المطبوع.</p>
      </div>
    </Modal>
  )
}
