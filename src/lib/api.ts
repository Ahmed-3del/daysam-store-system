import axios, { AxiosError } from 'axios'

const TOKEN_KEY = 'daysam.tokens'

export interface Tokens { access: string; refresh: string }

export const tokenStore = {
  get(): Tokens | null {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null') } catch { return null }
  },
  set(t: Tokens | null) {
    try { t ? localStorage.setItem(TOKEN_KEY, JSON.stringify(t)) : localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
  },
}

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

api.interceptors.request.use((config) => {
  const t = tokenStore.get()
  if (t?.access) config.headers.Authorization = `Bearer ${t.access}`
  return config
})

let refreshing: Promise<string | null> | null = null

async function refreshAccess(): Promise<string | null> {
  const t = tokenStore.get()
  if (!t?.refresh) return null
  try {
    const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh/`, { refresh: t.refresh })
    tokenStore.set({ access: data.access, refresh: data.refresh || t.refresh })
    return data.access
  } catch {
    tokenStore.set(null)
    return null
  }
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined
  if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/auth/')) {
    original._retry = true
    refreshing ??= refreshAccess().finally(() => { refreshing = null })
    const access = await refreshing
    if (access) {
      original.headers.Authorization = `Bearer ${access}`
      return api(original)
    }
    window.dispatchEvent(new Event('daysam:logout'))
  }
  return Promise.reject(error)
})

/** Turn a DRF error payload into one readable Arabic message. */
export function errorMessage(err: unknown): string {
  const e = err as AxiosError<Record<string, unknown>>
  if (!e?.response) return e?.message === 'Network Error' ? 'تعذر الاتصال بالخادم. تحقق من الإنترنت.' : 'حدث خطأ غير متوقع.'
  const data = e.response.data
  if (!data || typeof data !== 'object') return `خطأ ${e.response.status}`
  const flatten = (v: unknown): string =>
    Array.isArray(v) ? v.map(flatten).join(' ') : typeof v === 'object' && v ? Object.values(v).map(flatten).join(' ') : String(v)
  if ('detail' in data) return flatten(data.detail)
  return Object.values(data).map(flatten).join(' — ')
}

export interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[] }
