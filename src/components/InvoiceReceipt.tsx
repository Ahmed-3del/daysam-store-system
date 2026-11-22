import { money, dateTime } from '../lib/format'
import type { Invoice, Shop } from '../lib/types'
import { ReceiptFrame, useQr } from './ReceiptFrame'

/** Printable invoice (thermal 58/80mm or A4) used in-app and on the public link. */
export function InvoiceReceipt({ invoice, shop }: { invoice: Invoice; shop: Shop }) {
  const cur = shop.currency
  const showQr = shop.receipt_show_qr ?? true
  const showWarranty = shop.receipt_show_warranty ?? true
  const qr = useQr(showQr && invoice.public_token ? `${window.location.origin}/i/${invoice.public_token}` : null)
  return (
    <ReceiptFrame shop={shop} title={`فاتورة بيع رقم #${invoice.number}`}
      subtitle={<>{dateTime(invoice.created_at)}{(shop.receipt_show_cashier ?? true) && invoice.cashier && <> · الكاشير: {invoice.cashier}</>}</>}>
      {(invoice.customer_name || invoice.customer_phone) && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
          العميل: <b>{invoice.customer_name}</b> {invoice.customer_phone && <span dir="ltr">({invoice.customer_phone})</span>}
        </div>
      )}
      <table className="mt-3 w-full">
        <thead><tr className="border-b border-slate-300 text-slate-500"><th className="py-1 text-start">الصنف</th><th>الكمية</th><th className="text-end">الإجمالي</th></tr></thead>
        <tbody>
          {invoice.items.map((i, idx) => (
            <tr key={i.id} className="border-b border-dashed border-slate-200 align-top">
              <td className="py-1.5">
                {i.bundle_name && invoice.items[idx - 1]?.bundle_name !== i.bundle_name && <div className="text-[11px] font-bold text-violet-700">باقة: {i.bundle_name}</div>}
                <div className="font-bold">{i.name}</div>
                {showWarranty && i.serial_number && <div className="text-[0.9em] text-slate-500" dir="ltr">{shop.config?.serial_label?.includes('IMEI') ? 'IMEI' : 'SN'}: {i.serial_number}</div>}
                {showWarranty && i.warranty_days > 0 && <div className="text-[0.9em] text-slate-500">ضمان {i.warranty_days} يوم</div>}
                {i.returned_quantity > 0 && <div className="text-[11px] text-rose-600">مرتجع {i.returned_quantity}</div>}
              </td>
              <td className="py-1.5 text-center">{i.quantity} × {money(i.unit_price, '')}</td>
              <td className="py-1.5 text-end font-bold">{money(i.line_total, '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 space-y-1">
        {Number(invoice.bundle_discount) > 0 && <Row k="خصم الباقات" v={money(-Number(invoice.bundle_discount), cur)} />}
        {Number(invoice.discount) - Number(invoice.bundle_discount) > 0 && <Row k="الخصم" v={money(-(Number(invoice.discount) - Number(invoice.bundle_discount)), cur)} />}
        <Row k="الإجمالي" v={money(invoice.total, cur)} bold />
        {Number(invoice.trade_in_value) > 0 && <Row k="جهاز مستبدل" v={money(invoice.trade_in_value, cur)} />}
        <Row k={`المدفوع (${invoice.payment_method_display})`} v={money(Number(invoice.paid) - Number(invoice.trade_in_value), cur)} />
        {Number(invoice.remaining) > 0 && <Row k={invoice.payment_method === 'installment' ? 'المتبقي بالتقسيط' : 'المتبقي (آجل)'} v={money(invoice.remaining, cur)} />}
        {Number(invoice.returned_total) > 0 && <Row k="مرتجعات" v={money(invoice.returned_total, cur)} />}
      </div>
      {shop.invoice_footer && <div className="mt-4 whitespace-pre-line border-t border-dashed border-slate-300 pt-3 text-center text-slate-600">{shop.invoice_footer}</div>}
      {qr && (
        <div className="mt-3 flex flex-col items-center gap-1 text-[0.85em] text-slate-500">
          <img src={qr} alt="QR" className="size-20" />امسح لعرض الفاتورة إلكترونياً
        </div>
      )}
    </ReceiptFrame>
  )
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? 'text-[1.25em] font-extrabold' : ''}`}><span>{k}</span><span className="tabular-nums">{v}</span></div>
}
