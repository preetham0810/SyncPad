import { useCallback, useEffect, useRef, useState } from 'react'

function buildWsUrl(noteId) {
  if (import.meta.env.DEV) return `ws://127.0.0.1:8000/ws/notes/${noteId}`
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/ws/notes/${noteId}`
}

/*
  Manages the WebSocket lifecycle for a single note.

  Calls the provided handlers whenever the server pushes an event:
    onContent(text)        – another user's edit arrived
    onCursor({userId, color, offset}) – another user moved their cursor
    onUsers(action)        – someone joined or left; action has { type, ... }

  Returns:
    send(text)       – broadcast a content update
    sendCursor(pos)  – broadcast cursor position
    myCursor         – { userId, color } assigned by server
    connected        – boolean
*/
export function useNoteSync(noteId, { onContent, onCursor, onUsers }) {
  const wsRef = useRef(null)
  const retryRef = useRef(null)
  const [myCursor, setMyCursor] = useState(null)
  const [connected, setConnected] = useState(false)

  const send = useCallback((content) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ content }))
    }
  }, [])

  const sendCursor = useCallback((offset) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ cursor: offset }))
    }
  }, [])

  useEffect(() => {
    if (!noteId) return

    function connect() {
      const ws = new WebSocket(buildWsUrl(noteId))
      wsRef.current = ws

      ws.onopen = () => setConnected(true)

      ws.onmessage = ({ data }) => {
        try {
          const msg = JSON.parse(data)
          if (msg.type === 'init')    return setMyCursor({ userId: msg.userId, color: msg.color })
          if (msg.type === 'content') return onContent(msg.content)
          if (msg.type === 'cursor')  return onCursor({ userId: msg.userId, color: msg.color, offset: msg.offset })
          if (msg.type === 'peers')   return onUsers({ type: 'set',    peers: msg.peers })
          if (msg.type === 'joined')  return onUsers({ type: 'add',    userId: msg.userId, color: msg.color })
          if (msg.type === 'left')    return onUsers({ type: 'remove', userId: msg.userId })
        } catch (_) {}
      }

      ws.onclose = () => {
        wsRef.current = null
        setConnected(false)
        retryRef.current = setTimeout(connect, 2000)
      }
    }

    connect()
    return () => {
      clearTimeout(retryRef.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [noteId, onContent, onCursor, onUsers])

  return { send, sendCursor, myCursor, connected }
}
