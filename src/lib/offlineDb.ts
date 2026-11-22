/** Tiny promise wrapper around IndexedDB: a key/value store and the offline-sales outbox. */

const DB_NAME = 'daysam-offline'
const VERSION = 1
let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'uuid' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => { dbPromise = null; reject(req.error) }
  })
  return dbPromise
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const req = fn(tx.objectStore(store))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))
}

export const kv = {
  get: <T>(key: string) => run<T | undefined>('kv', 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>),
  set: (key: string, value: unknown) => run('kv', 'readwrite', (s) => s.put(value, key)),
  del: (key: string) => run('kv', 'readwrite', (s) => s.delete(key)),
}

export type OutboxStatus = 'pending' | 'syncing' | 'failed' | 'needs_approval'

export interface OutboxSale {
  uuid: string
  created_at: string
  payload: Record<string, unknown>
  total: number
  lines: { name: string; quantity: number; unit_price: number; serial?: string }[]
  customer_name: string
  cashier: string
  status: OutboxStatus
  error?: string
  attempts: number
}

export const outbox = {
  all: () => run<OutboxSale[]>('outbox', 'readonly', (s) => s.getAll() as IDBRequest<OutboxSale[]>),
  put: (sale: OutboxSale) => run('outbox', 'readwrite', (s) => s.put(sale)),
  remove: (uuid: string) => run('outbox', 'readwrite', (s) => s.delete(uuid)),
}

/** Wipe everything stored on the device (used on logout so another account never sees this shop's data). */
export async function clearOfflineData() {
  const db = await open()
  await Promise.all(['kv', 'outbox'].map((name) => new Promise<void>((resolve) => {
    const tx = db.transaction(name, 'readwrite')
    tx.objectStore(name).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })))
}
