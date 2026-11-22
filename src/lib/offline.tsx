import { useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, errorMessage } from './api'
import { useAuth } from './auth'
import { kv, outbox, type OutboxSale } from './offlineDb'
import type { Bundle, Product } from './types'

export interface Snapshot {
  generated_at: string
  products: Product[]
  serials: { id: number; product_id: number; serial: string; condition: string }[]
  bundles: Bundle[]
  customers: { id: number; name: string; phone: string; national_id: string; balance: number }[]
}

interface OfflineState {
  online: boolean
  snapshot: Snapshot | null
  sales: OutboxSale[]
  pending: number
  syncing: boolean
  refreshSnapshot: () => Promise<void>
  enqueue: (sale: Omit<OutboxSale, 'status' | 'attempts'>) => Promise<void>
  syncNow: () => Promise<void>
  /** Send one queued sale now; `extra` carries approval fields (manager_pin / request_approval). */
  syncOne: (uuid: string, extra?: Record<string, unknown>) => Promise<'done' | 'failed' | 'offline' | 'queued'>
  discard: (uuid: string) => Promise<void>
  /** Serial ids already sold in queued (unsynced) sales — must not be sold again offline. */
  reservedSerials: Set<number>
}

const Ctx = createContext<OfflineState | null>(null)
const SNAPSHOT_KEY = 'snapshot'
const SNAPSHOT_TTL = 5 * 60_000

export function OfflineProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  // Only an active shop account syncs (not the platform admin, not a suspended/expired shop).
  const user = auth.shop && !auth.blocked ? auth.user : null
  const qc = useQueryClient()
  const [online, setOnline] = useState(() => navigator.onLine)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [sales, setSales] = useState<OutboxSale[]>([])
  const [syncing, setSyncing] = useState(false)
  const busy = useRef(false)

  const reload = useCallback(async () => {
    try { setSales((await outbox.all()).sort((a, b) => a.created_at.localeCompare(b.created_at))) } catch { /* IDB unavailable */ }
  }, [])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    kv.get<Snapshot>(SNAPSHOT_KEY).then((s) => s && setSnapshot(s)).catch(() => undefined)
    reload()
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [reload])

  const refreshSnapshot = useCallback(async () => {
    if (!navigator.onLine || !user) return
    try {
      const { data } = await api.get<Snapshot>('/products/offline-snapshot/')
      setSnapshot(data)
      await kv.set(SNAPSHOT_KEY, data)
    } catch { /* keep the last copy */ }
  }, [user])

  const syncOne = useCallback(async (uuid: string, extra: Record<string, unknown> = {}) => {
    const sale = (await outbox.all()).find((s) => s.uuid === uuid)
    if (!sale) return 'done' as const
    try {
      const res = await api.post('/invoices/checkout/', {
        ...sale.payload, ...extra, client_uuid: sale.uuid, offline_created_at: sale.created_at,
      })
      if (res.status === 202) {
        await outbox.put({ ...sale, status: 'needs_approval', error: 'تم إرسال طلب موافقة للمدير — أعد المزامنة بعد الموافقة', attempts: sale.attempts + 1 })
        return 'queued' as const
      }
      await outbox.remove(uuid)
      return 'done' as const
    } catch (e) {
      const err = e as AxiosError<{ code?: string }>
      if (!err.response) return 'offline' as const
      const needsApproval = err.response.status === 403 && err.response.data?.code === 'approval_required'
      await outbox.put({ ...sale, status: needsApproval ? 'needs_approval' : 'failed', error: errorMessage(e), attempts: sale.attempts + 1 })
      return 'failed' as const
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (busy.current || !navigator.onLine || !user) return
    busy.current = true; setSyncing(true)
    try {
      // needs_approval is retried too: once a manager approves, the server already holds the invoice (same id).
      const queue = (await outbox.all()).filter((s) => s.status === 'pending' || s.status === 'needs_approval').sort((a, b) => a.created_at.localeCompare(b.created_at))
      let synced = 0
      for (const s of queue) {
        const r = await syncOne(s.uuid)
        if (r === 'offline') break
        if (r === 'done') synced++
      }
      if (synced) {
        ;['invoices', 'products', 'cash', 'customers', 'dashboard', 'installments'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
        await refreshSnapshot()
      }
    } finally {
      busy.current = false; setSyncing(false); reload()
    }
  }, [user, syncOne, qc, refreshSnapshot, reload])

  // Sync when the connection comes back, on start, and every 30s while sales are waiting.
  useEffect(() => {
    if (!user) return
    if (online) { syncNow(); refreshSnapshot() }
    const t = setInterval(() => {
      if (!navigator.onLine) return
      syncNow()
      kv.get<Snapshot>(SNAPSHOT_KEY).then((s) => {
        if (!s || Date.now() - new Date(s.generated_at).getTime() > SNAPSHOT_TTL) refreshSnapshot()
      }).catch(() => undefined)
    }, 30_000)
    return () => clearInterval(t)
  }, [online, user, syncNow, refreshSnapshot])

  const enqueue = useCallback(async (sale: Omit<OutboxSale, 'status' | 'attempts'>) => {
    await outbox.put({ ...sale, status: 'pending', attempts: 0 })
    // Reflect the sale in the local stock copy so the same items aren't oversold offline.
    setSnapshot((snap) => {
      if (!snap) return snap
      const items = sale.payload.items as { product: number; quantity: number; serial: number | null }[]
      const next = {
        ...snap,
        products: snap.products.map((p) => {
          const sold = items.filter((i) => i.product === p.id).reduce((s, i) => s + (i.serial ? 1 : i.quantity), 0)
          return sold && !p.is_service ? { ...p, quantity: p.quantity - sold } : p
        }),
      }
      kv.set(SNAPSHOT_KEY, next).catch(() => undefined)
      return next
    })
    await reload()
  }, [reload])

  const discard = useCallback(async (uuid: string) => { await outbox.remove(uuid); await reload() }, [reload])

  const reservedSerials = useMemo(() => new Set(sales.flatMap((s) =>
    (s.payload.items as { serial: number | null }[]).map((i) => i.serial).filter((x): x is number => !!x))), [sales])

  const syncOneAndReload = useCallback(async (uuid: string, extra?: Record<string, unknown>) => {
    const r = await syncOne(uuid, extra)
    await reload()
    if (r === 'done') ['invoices', 'products', 'cash', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
    return r
  }, [syncOne, reload, qc])

  return (
    <Ctx.Provider value={{
      online, snapshot, sales, pending: sales.length, syncing, refreshSnapshot, enqueue, syncNow,
      syncOne: syncOneAndReload, discard, reservedSerials,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useOffline() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useOffline outside provider')
  return c
}

/** Local product search used by the POS when there is no connection. */
export function searchSnapshot(snap: Snapshot | null, q: string) {
  if (!snap || !q.trim()) return []
  const t = q.trim().toLowerCase()
  return snap.products.filter((p) => `${p.name} ${p.brand} ${p.barcode}`.toLowerCase().includes(t)).slice(0, 12)
}
