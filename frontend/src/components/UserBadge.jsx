export default function UserBadge({ color, label, solid }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 12,
      fontWeight: 600,
      borderRadius: 20,
      padding: '3px 10px',
      background: solid ? color : `${color}26`,
      color: solid ? '#0f0f14' : color,
      border: `1px solid ${color}60`,
      userSelect: 'none',
    }}>
      <span style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }} />
      {label}
    </span>
  )
}
