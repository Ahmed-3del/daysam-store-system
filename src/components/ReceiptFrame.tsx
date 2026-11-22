import QRCode from 'qrcode'
import { useEffect, useState, type ReactNode } from 'react'
import type { Shop } from '../lib/types'

type ReceiptShop = Pick<Shop, 'name' | 'phone' | 'address'> & Partial<Pick<Shop, 'logo' | 'receipt_width' | 'receipt_header'>>

const WIDTH = { '58': { screen: 'max-w-[240px] text-[11px]', page: '58mm', body: '54mm' }, '80': { screen: 'max-w-[320px] text-xs', page: '80mm', body: '76mm' }, a4: { screen: 'max-w-xl text-sm', page: 'A4', body: 'auto' } } as const

/** Paper-size aware receipt shell: logo, shop header, and @page rules for thermal printers. */
export function ReceiptFrame({ shop, title, subtitle, children }: { shop: ReceiptShop; title: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  const w = WIDTH[shop.receipt_width ?? '80'] ?? WIDTH['80']
  const thermal = shop.receipt_width !== 'a4'
  return (
    <div className={`receipt mx-auto rounded-2xl bg-white p-4 ring-1 ring-slate-200 print:max-w-none print:rounded-none print:p-0 print:ring-0 ${w.screen}`}>
      <style>{`@media print { @page { size: ${w.page}${thermal ? ' auto' : ''}; margin: ${thermal ? '2mm' : '10mm'}; } .receipt { width: ${w.body}; } }`}</style>
      <div className="text-center">
        {shop.logo && <img src={shop.logo} alt="" className="mx-auto mb-1 max-h-16 max-w-[70%] object-contain" />}
        <div className="text-base font-extrabold">{shop.name}</div>
        {shop.receipt_header && <div className="text-[0.9em] text-slate-600">{shop.receipt_header}</div>}
        {shop.address && <div className="text-[0.9em] text-slate-500">{shop.address}</div>}
        {shop.phone && <div className="text-[0.9em] text-slate-500" dir="ltr">{shop.phone}</div>}
        <div className="mt-2 font-bold">{title}</div>
        {subtitle && <div className="text-[0.9em] text-slate-500">{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

export function useQr(text: string | null, width = 160) {
  const [qr, setQr] = useState('')
  useEffect(() => {
    if (!text) { setQr(''); return }
    QRCode.toDataURL(text, { margin: 0, width }).then(setQr).catch(() => setQr(''))
  }, [text, width])
  return qr
}
