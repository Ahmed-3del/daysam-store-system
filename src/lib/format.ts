const nf = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 })

export const num = (v: number | string | null | undefined) => nf.format(Number(v || 0))

export const money = (v: number | string | null | undefined, currency = 'ج.م') => `${num(v)} ${currency}`

export const date = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

export const dateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

export const todayISO = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/** Egyptian mobile → international format for wa.me links. */
export function waNumber(phone?: string) {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('20')) return digits
  if (digits.startsWith('0')) return `20${digits.slice(1)}`
  return digits
}

export function whatsappLink(phone: string | undefined, text: string) {
  const n = waNumber(phone)
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}
