import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { QUEUED } from '../components/approval'
import { useToast } from '../components/toast'
import { api, type Paginated } from './api'

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function useList<T>(resource: string, params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [resource.replace(/\//g, ''), params],
    queryFn: async () => (await api.get<Paginated<T>>(`/${resource}/`, { params })).data,
  })
}

export function useGet<T>(key: QueryKey, url: string | null, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: key,
    queryFn: async () => (await api.get<T>(url!, { params })).data,
    enabled: !!url,
  })
}

/** POST/PATCH/DELETE helper that toasts errors and invalidates the given query roots on success. */
export function useAction<TVars = unknown, TRes = unknown>(
  fn: (vars: TVars) => Promise<TRes>,
  opts: { invalidate?: string[]; success?: string; onSuccess?: (r: TRes) => void } = {},
) {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      if ((r as unknown) === QUEUED) return  // waiting for a manager; the approval dialog already informed the user
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      if (opts.success) toast.ok(opts.success)
      opts.onSuccess?.(r)
    },
    onError: (e) => { if ((e as Error)?.message !== 'cancelled') toast.error(e) },
  })
}
