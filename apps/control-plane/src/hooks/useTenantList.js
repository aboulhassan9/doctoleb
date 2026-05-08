import { useCallback, useEffect, useState } from 'react'
import { controlPlaneApi } from '../lib/controlPlaneApi'

export function useTenantList() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await controlPlaneApi.listTenants()
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setTenants(result.data || [])
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    tenants,
    loading,
    error,
    reload,
  }
}
