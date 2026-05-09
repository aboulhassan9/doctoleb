import { useCallback, useEffect, useState } from 'react'
import { controlPlaneApi } from '../lib/controlPlaneApi'

export function useTenantDetail(tenantId) {
  const [tenantDetail, setTenantDetail] = useState(null)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!tenantId) {
      setTenantDetail(null)
      setError('')
      return
    }
    const result = await controlPlaneApi.getTenant(tenantId)
    if (result.error) {
      setError(result.error)
      return
    }
    setError('')
    setTenantDetail(result.data)
  }, [tenantId])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    tenantDetail,
    error,
    reload,
  }
}
