import { useCallback, useEffect, useState } from 'react'
import { controlPlaneApi } from '../lib/controlPlaneApi'

export function useTenantList() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async (options = {}) => {
    setLoading(true)
    setError('')
    const result = await controlPlaneApi.listTenants(options)
    if (options.signal?.aborted) return []
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return []
    }
    const nextTenants = result.data || []
    setTenants(nextTenants)
    return nextTenants
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void reload({ signal: controller.signal })
    return () => {
      controller.abort()
    }
  }, [reload])

  return {
    tenants,
    loading,
    error,
    reload,
  }
}
