import { useCallback, useEffect, useState } from 'react'
import { controlPlaneApi } from '../lib/controlPlaneApi'

export function useProviderConnections() {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    const result = await controlPlaneApi.listProviderConnections()
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return []
    }
    setError('')
    setConnections(result.data || [])
    return result.data || []
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    connections,
    loading,
    error,
    reload,
  }
}
