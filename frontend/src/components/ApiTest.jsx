import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'

function ApiTest() {
  const [status, setStatus] = useState('loading') // loading | success | error
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiClient
      .get('/api/integration/check')
      .then((result) => {
        setData(result)
        setStatus('success')
      })
      .catch((err) => {
        setError(err.message)
        setStatus('error')
      })
  }, [])

  if (status === 'loading') return <p>Đang gọi Backend...</p>
  if (status === 'error') return <p>Lỗi: {error}</p>
  return <pre>{JSON.stringify(data, null, 2)}</pre>
}

export default ApiTest