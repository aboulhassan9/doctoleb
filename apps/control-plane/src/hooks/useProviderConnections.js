import { useCallback, useEffect, useState } from 'react'
import { controlPlaneApi } from '../lib/controlPlaneApi'

export function useProviderConnections() {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async (options = {}) => {
    setLoading(true)
    const result = await controlPlaneApi.listProviderConnections({}, options)
    if (options.signal?.aborted) return []
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
    const controller = new AbortController()
    void reload({ signal: controller.signal })
    return () => {
      controller.abort()
    }
  }, [reload])

  return {
    connections,
    loading,
    error,
    reload,
  }
}
