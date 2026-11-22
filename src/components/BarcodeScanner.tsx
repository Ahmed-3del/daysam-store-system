import type { IScannerControls } from '@zxing/browser'
import { ScanLine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Modal } from './ui'

/** Camera barcode / QR / IMEI scanner. Calls onResult once per successful scan, then closes. */
export function BarcodeScanner({ open, onClose, onResult }: {
  open: boolean; onClose: () => void; onResult: (code: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    let controls: IScannerControls | undefined
    let done = false
    let cancelled = false
    import('@zxing/browser')
      .then(({ BrowserMultiFormatReader }) => new BrowserMultiFormatReader().decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current!, (result, _err, ctl) => {
        if (result && !done) {
          done = true
          ctl.stop()
          navigator.vibrate?.(60)
          onResult(result.getText().trim())
          onClose()
        }
      }))
      .then((c) => { controls = c; if (done || cancelled) c.stop() })
      .catch(() => setError('تعذر فتح الكاميرا. اسمح للتطبيق باستخدام الكاميرا (يتطلب HTTPS).'))
    return () => { cancelled = true; controls?.stop() }
  }, [open, onClose, onResult])

  return (
    <Modal open={open} onClose={onClose} title="مسح الباركود / IMEI">
      {error ? (
        <p className="py-8 text-center text-rose-600">{error}</p>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-rose-500/80 shadow-[0_0_12px_2px] shadow-rose-500/60" />
          <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1 text-xs text-white/80">
            <ScanLine size={14} /> وجّه الكاميرا نحو الكود
          </div>
        </div>
      )}
    </Modal>
  )
}
