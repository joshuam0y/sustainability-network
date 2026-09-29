import { useState } from 'react'

// Hover details that follow the pointer inside a chart's frame
export function useTooltip() {
  const [tip, setTip] = useState(null)
  const show = (e, content) => {
    const frame = e.currentTarget.closest('.chart-frame').getBoundingClientRect()
    setTip({ x: e.clientX - frame.left, y: e.clientY - frame.top, content })
  }
  const hide = () => setTip(null)
  const node = tip && (
    <div className="chart-tooltip" role="status" style={{ left: tip.x, top: tip.y }}>{tip.content}</div>
  )
  return { show, hide, node }
}
