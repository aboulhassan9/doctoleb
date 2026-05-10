import { useCallback, useEffect, useState } from 'react'
import { controlPlaneApi } from '../lib/controlPlaneApi'

export function useTenantDetail(tenantId) {
  const [tenantDetail, setTenantDetail] = useState(null)
  const [error, setError] = useState('')

  const reload = useCallback(async (options = {}) => {
    if (!tenantId) {
      setTenantDetail(null)
      setError('')
      return
    }
    const result = await controlPlaneApi.getTenant(tenantId, options)
    if (options.signal?.aborted) return
    if (result.error) {
      setError(result.error)
      return
    }
    setError('')
    setTenantDetail(result.data)
  }, [tenantId])

  useEffect(() => {
    const controller = new AbortController()
    void reload({ signal: controller.signal })
    return () => {
      controller.abort()
    }
  }, [reload])

  return {
    tenantDetail,
    error,
    reload,
  }
}
