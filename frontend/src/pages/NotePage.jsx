import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getNote, updateNote } from '../api'
import RemoteCursor from '../components/RemoteCursor'
import UserBadge from '../components/UserBadge'
import { useNoteSync } from '../useWebSocket'

const SAVE_DELAY    = 1500  // ms after last keystroke before persisting to DB
const SEND_DEBOUNCE = 120   // ms debounce for broadcasting over WS
const CURSOR_DELAY  = 60    // ms debounce for cursor position updates

const editorBase = {
  width: '100%',
  minHeight: 420,
  resize: 'vertical',
  padding: 16,
  fontFamily: 'monospace',
  fontSize: 14,
  lineHeight: '21px',
  border: '1px solid #3f3f46',
  borderRadius: 6,
  background: '#18181b',
  color: '#e4e4e7',
  outline: 'none',
}

export default function NotePage() {
  const { id } = useParams()

  const [note, setNote]         = useState(null)
  const [title, setTitle]       = useState('')
  const [content, setContent]   = useState('')
  const [error, setError]       = useState(null)
  const [saving, setSaving]     = useState(false)
  const [users, setUsers]       = useState({})    // { [userId]: { color } }
  const [cursors, setCursors]   = useState({})    // { [userId]: { offset, color } }
  const [pixels, setPixels]     = useState({})    // cursor pixel positions
  const [overlayH, setOverlayH] = useState(0)

  const isDirty    = useRef(false)
  const isRemote   = useRef(false)
  const textaRef   = useRef(null)
  const mirrorRef  = useRef(null)
  const overlayRef = useRef(null)
  const sendTimer  = useRef(null)
  const curTimer   = useRef(null)

  // ── WS event callbacks ──────────────────────────────────────────────────────

  const onContent = useCallback((text) => {
    isRemote.current = true
    setContent(text)
  }, [])

  const onCursor = useCallback(({ userId, color, offset }) => {
    setUsers((prev) => ({ ...prev, [userId]: { color } }))
    setCursors((prev) => ({ ...prev, [userId]: { offset, color } }))
  }, [])

  const onUsers = useCallback((action) => {
    setUsers((prev) => {
      if (action.type === 'set') {
        const next = {}
        action.peers.forEach((p) => { next[p.userId] = { color: p.color } })
        return next
      }
      if (action.type === 'add') return { ...prev, [action.userId]: { color: action.color } }
      if (action.type === 'remove') {
        const next = { ...prev }
        delete next[action.userId]
        setCursors((c) => { const n = { ...c }; delete n[action.userId]; return n })
        return next
      }
      return prev
    })
  }, [])

  const { send, sendCursor, myCursor, connected } = useNoteSync(id, { onContent, onCursor, onUsers })

  // ── load note ───────────────────────────────────────────────────────────────

  useEffect(() => {
    let stale = false
    setError(null)
    setUsers({})
    setCursors({})
    getNote(id)
      .then((n) => {
        if (stale) return
        setNote(n)
        setTitle(n.title)
        setContent(n.content)
        isDirty.current = false
      })
      .catch((e) => { if (!stale) setError(e.message) })
    return () => { stale = true }
  }, [id])

  // ── auto-save ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!note || !isDirty.current) return
    const t = setTimeout(() => {
      setSaving(true)
      updateNote(id, { title, content })
        .then(setNote)
        .catch(console.error)
        .finally(() => setSaving(false))
    }, SAVE_DELAY)
    return () => clearTimeout(t)
  }, [id, title, content, note])

  // ── user edits ──────────────────────────────────────────────────────────────

  function handleContentChange(e) {
    const val = e.target.value
    isDirty.current  = true
    isRemote.current = false
    setContent(val)
    clearTimeout(sendTimer.current)
    sendTimer.current = setTimeout(() => send(val), SEND_DEBOUNCE)
  }

  function handleTitleChange(e) {
    isDirty.current = true
    setTitle(e.target.value)
  }

  // ── cursor broadcasting ─────────────────────────────────────────────────────

  const reportCursor = useCallback(() => {
    clearTimeout(curTimer.current)
    curTimer.current = setTimeout(() => {
      const el = textaRef.current
      if (el) sendCursor(el.selectionStart)
    }, CURSOR_DELAY)
  }, [sendCursor])

  const syncOverlayScroll = useCallback(() => {
    if (textaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textaRef.current.scrollTop
    }
  }, [])

  // ── cursor pixel positioning ────────────────────────────────────────────────
  // Uses a hidden mirror div with identical styles to convert character offsets
  // into (top, left) pixel coordinates for the cursor overlays.

  useLayoutEffect(() => {
    const mirror = mirrorRef.current
    if (!mirror?.firstChild) { setPixels({}); return }

    const rect = mirror.getBoundingClientRect()
    const text = content || '\u200b'
    const next = {}

    for (const [uid, { offset, color }] of Object.entries(cursors)) {
      const pos = Math.min(Math.max(0, offset ?? 0), text.length)
      try {
        const range = document.createRange()
        range.setStart(mirror.firstChild, pos)
        range.setEnd(mirror.firstChild, pos)
        const r = range.getBoundingClientRect()
        next[uid] = { top: r.top - rect.top, left: r.left - rect.left, color }
      } catch (_) {}
    }

    setPixels(next)
    if (mirror.scrollHeight) setOverlayH(mirror.scrollHeight)
    requestAnimationFrame(syncOverlayScroll)
  }, [content, cursors, syncOverlayScroll])

  // ── render ──────────────────────────────────────────────────────────────────

  if (error) return (
    <div style={{ padding: 24 }}>
      <p style={{ color: '#f87171', marginBottom: 12 }}>{error}</p>
      <Link to="/">← Back</Link>
    </div>
  )

  if (!note) return (
    <div style={{ padding: 24, color: '#71717a' }}>Loading…</div>
  )

  return (
    <div style={{ maxWidth: 740, margin: '0 auto', padding: '24px 16px' }}>

      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link to="/" style={{ color: '#71717a', fontSize: 13, marginRight: 4 }}>← Back</Link>

        {myCursor && <UserBadge color={myCursor.color} label={`You · ${myCursor.userId}`} solid />}

        {Object.entries(users).map(([uid, { color }]) => (
          <UserBadge key={uid} color={color} label={uid} />
        ))}

        <span style={{ marginLeft: 'auto', fontSize: 12, color: connected ? '#34d399' : '#f87171' }}>
          {connected ? '● Live' : '○ Reconnecting'}
        </span>
        {saving && <span style={{ fontSize: 12, color: '#71717a' }}>Saving…</span>}
      </div>

      {/* title */}
      <input
        value={title}
        onChange={handleTitleChange}
        placeholder="Untitled"
        style={{
          display: 'block', width: '100%', marginBottom: 16,
          fontSize: 22, fontWeight: 700,
          background: 'transparent', border: 'none',
          borderBottom: '1px solid #3f3f46',
          color: '#e4e4e7', outline: 'none', paddingBottom: 10,
        }}
      />

      {/* editor */}
      <div style={{ position: 'relative' }}>

        {/* mirror — hidden, same layout as textarea, used to locate cursor pixels */}
        <div
          ref={mirrorRef}
          aria-hidden
          style={{
            ...editorBase,
            position: 'absolute', inset: 0,
            opacity: 0, pointerEvents: 'none',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden',
          }}
        >
          {content || '\u200b'}
        </div>

        <textarea
          ref={textaRef}
          value={content}
          onChange={handleContentChange}
          onKeyUp={reportCursor}
          onClick={reportCursor}
          onSelect={reportCursor}
          onScroll={syncOverlayScroll}
          placeholder="Start typing…"
          style={{ ...editorBase, position: 'relative', zIndex: 1 }}
        />

        {/* cursor overlay */}
        <div
          ref={overlayRef}
          style={{
            position: 'absolute', inset: 0,
            pointerEvents: 'none', zIndex: 2, overflow: 'hidden',
          }}
        >
          <div style={{ position: 'relative', minHeight: overlayH }}>
            {Object.entries(pixels).map(([uid, { top, left, color }]) => (
              <RemoteCursor key={uid} top={top} left={left} color={color} label={uid} />
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes cursorBlink { 50% { opacity: 0.25; } }`}</style>
    </div>
  )
}
