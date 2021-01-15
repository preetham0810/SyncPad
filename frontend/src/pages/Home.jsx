import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createNote } from '../api'

export default function Home() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState('')
  const [error, setError] = useState(null)

  async function handleCreate() {
    setLoading(true)
    setError(null)
    try {
      const note = await createNote()
      navigate(`/notes/${note.id}`)
    } catch {
      setError('Could not create note. Is the backend running?')
      setLoading(false)
    }
  }

  function handleOpen(e) {
    e.preventDefault()
    const id = openId.trim()
    if (id) navigate(`/notes/${id}`)
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>SyncPad</h1>
      <p style={{ color: '#71717a', marginBottom: 40, fontSize: 15 }}>
        Real-time collaborative notes
      </p>

      <button onClick={handleCreate} disabled={loading} style={{ width: '100%', marginBottom: 12, padding: '10px 0' }}>
        {loading ? 'Creating…' : '+ New note'}
      </button>

      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <form onSubmit={handleOpen}>
        <input
          type="text"
          placeholder="Paste a note ID to open"
          value={openId}
          onChange={(e) => setOpenId(e.target.value)}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <button type="submit" style={{ width: '100%', background: '#27272a', border: '1px solid #3f3f46' }}>
          Open note
        </button>
      </form>
    </div>
  )
}
