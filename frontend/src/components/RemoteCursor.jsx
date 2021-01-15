export default function RemoteCursor({ top, left, color, label }) {
  return (
    <div style={{ position: 'absolute', top, left, pointerEvents: 'none' }}>
      <div style={{
        width: 2,
        height: 20,
        background: color,
        borderRadius: 2,
        animation: 'cursorBlink 1s step-end infinite',
        boxShadow: `0 0 3px ${color}`,
      }} />
      <span style={{
        position: 'absolute',
        top: -22,
        left: 4,
        background: color,
        color: '#0f0f14',
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </div>
  )
}
