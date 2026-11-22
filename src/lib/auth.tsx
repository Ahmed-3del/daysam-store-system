import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, tokenStore } from './api'
import { clearOfflineData } from './offlineDb'
import type { Shop, ShopConfig, User } from './types'

const ME_KEY = 'daysam.me'
const PLATFORM_TOKENS = 'daysam.platform_tokens'
interface MeResponse {
  user: User; shop: Shop | null; sections: Record<string, string>; pending_approvals: number
  platform_admin?: boolean; blocked?: { detail: string; code: string } | null; impersonated_by?: string | null
}

interface AuthState {
  user: User | null
  shop: Shop | null
  sections: Record<string, string>
  pendingApprovals: number
  /** Section visible in this shop (not hidden) and allowed for this user. */
  can: (section?: string) => boolean
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (data: Record<string, string>) => Promise<void>
  logout: () => void
  refresh: () => Promise<string | null>
  isManager: boolean
  /** Super-admin of the SaaS (no shop). */
  platformAdmin: boolean
  /** Set when the shop is suspended or its subscription expired. */
  blocked: { detail: string; code: string } | null
  /** Username of the platform admin currently logged in as this shop's owner (support). */
  impersonatedBy: string | null
  impersonate: (tokens: { access: string; refresh: string }) => Promise<void>
  stopImpersonating: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [shop, setShop] = useState<Shop | null>(null)
  const [sections, setSections] = useState<Record<string, string>>({})
  const [pendingApprovals, setPending] = useState(0)
  const [platformAdmin, setPlatformAdmin] = useState(false)
  const [blocked, setBlocked] = useState<{ detail: string; code: string } | null>(null)
  const [impersonatedBy, setImpersonatedBy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (): Promise<string | null> => {
    if (!tokenStore.get()) { setLoading(false); return null }
    const apply = (data: MeResponse) => {
      setUser(data.user); setShop(data.shop); setSections(data.sections || {}); setPending(data.pending_approvals || 0)
      setPlatformAdmin(!!data.platform_admin); setBlocked(data.blocked ?? null); setImpersonatedBy(data.impersonated_by ?? null)
    }
    try {
      const { data } = await api.get<MeResponse>('/auth/me/')
      apply(data)
      try { localStorage.setItem(ME_KEY, JSON.stringify(data)) } catch { /* ignore */ }
      return null
    } catch (e) {
      const res = (e as { response?: { status: number; data?: { detail?: string } } }).response
      if (res) {
        // The server rejected this session (expired, or the account has no shop): never fall back to a cached profile.
        tokenStore.set(null); setUser(null); setShop(null)
        try { localStorage.removeItem(ME_KEY) } catch { /* ignore */ }
        return res.data?.detail || 'تعذر تسجيل الدخول.'
      }
      // Offline: keep working with the last known profile — but only if it belongs to this same login.
      try {
        const cached = JSON.parse(localStorage.getItem(ME_KEY) || 'null') as MeResponse | null
        if (cached && cached.user.id === tokenUserId()) apply(cached)
      } catch { /* ignore */ }
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    tokenStore.set(null); setUser(null); setShop(null); qc.clear()
    setPlatformAdmin(false); setBlocked(null); setImpersonatedBy(null)
    try { localStorage.removeItem(ME_KEY); localStorage.removeItem('daysam.cart'); localStorage.removeItem(PLATFORM_TOKENS) } catch { /* ignore */ }
    clearOfflineData().catch(() => undefined)
  }, [qc])

  useEffect(() => {
    refresh()
    window.addEventListener('daysam:logout', logout)
    // Keep the pending-approvals badge fresh for managers.
    const t = setInterval(() => { if (tokenStore.get() && document.visibilityState === 'visible') refresh() }, 60_000)
    return () => { window.removeEventListener('daysam:logout', logout); clearInterval(t) }
  }, [refresh, logout])

  const login = async (username: string, password: string) => {
    try { localStorage.removeItem(ME_KEY) } catch { /* ignore */ }
    const { data } = await api.post('/auth/login/', { username, password })
    tokenStore.set(data)
    const error = await refresh()
    if (error) throw new Error(error)
  }

  const register = async (payload: Record<string, string>) => {
    const { data } = await api.post('/auth/register/', payload)
    tokenStore.set({ access: data.access, refresh: data.refresh })
    await refresh()
  }

  const switchTo = async (tokens: { access: string; refresh: string } | null) => {
    qc.clear()
    try { localStorage.removeItem(ME_KEY); localStorage.removeItem('daysam.cart') } catch { /* ignore */ }
    await clearOfflineData().catch(() => undefined)
    tokenStore.set(tokens)
    setLoading(true)
    await refresh()
  }
  const impersonate = async (tokens: { access: string; refresh: string }) => {
    try { localStorage.setItem(PLATFORM_TOKENS, JSON.stringify(tokenStore.get())) } catch { /* ignore */ }
    await switchTo(tokens)
  }
  const stopImpersonating = async () => {
    let back = null
    try { back = JSON.parse(localStorage.getItem(PLATFORM_TOKENS) || 'null'); localStorage.removeItem(PLATFORM_TOKENS) } catch { /* ignore */ }
    if (back) await switchTo(back); else logout()
  }

  const isManager = user?.role === 'owner' || user?.role === 'manager'
  const can = (section?: string) => {
    if (!section) return true
    if (shop?.hidden_sections?.includes(section)) return false
    if (isManager || !user?.allowed_sections?.length) return true
    return user.allowed_sections.includes(section)
  }

  return (
    <AuthContext.Provider value={{
      user, shop, sections, pendingApprovals, can, loading, login, register, logout, refresh, isManager,
      platformAdmin, blocked, impersonatedBy, impersonate, stopImpersonating,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}

export function useCurrency() {
  return useAuth().shop?.currency || 'ج.م'
}

/** user_id claim of the current access token (to match the offline profile cache to the same account). */
function tokenUserId(): number | null {
  try {
    const payload = tokenStore.get()?.access.split('.')[1]
    if (!payload) return null
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).user_id ?? null
  } catch { return null }
}

const FALLBACK_CONFIG: ShopConfig = {
  serial_label: 'IMEI / السيريال', device_types: ['موبايل', 'أخرى'], brands: [], fault_tags: [], repair_checklist: [],
  accessories: [], spec_templates: {}, expense_categories: [], default_warranty_days: 0,
}

/** The shop's business-type preset merged with its own customization. */
export function useShopConfig() {
  return useAuth().shop?.config ?? FALLBACK_CONFIG
}
