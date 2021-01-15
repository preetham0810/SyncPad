const BASE = import.meta.env.VITE_API_BASE ?? '/api'

async function request(url, options = {}) {
  const res = await fetch(BASE + url, options)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function createNote(title = 'Untitled') {
  return request('/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

export function getNote(id) {
  return request(`/notes/${id}`)
}

export function updateNote(id, patch) {
  return request(`/notes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
}
