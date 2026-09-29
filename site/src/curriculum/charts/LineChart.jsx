import { useState } from 'react'
import { useTooltip } from './Tooltip.jsx'

const W = 520
const H = 220
const PAD = { top: 16, right: 34, bottom: 30, left: 48 }

// One series over time, with a crosshair and hover details. `points` is [{x: label, y: number}]
export default function LineChart({ title, points, format = (v) => v.toLocaleString(), color, yMin = 0, note }) {
  const { show, hide, node } = useTooltip()
  const [hoverIndex, setHoverIndex] = useState(null)
  const [asTable, setAsTable] = useState(false)
  if (points.length < 2) return null

  const max = Math.max(...points.map((p) => p.y))
  const top = niceCeil(max)
  const x = (i) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right)
  const y = (v) => PAD.top + (1 - (v - yMin) / (top - yMin)) * (H - PAD.top - PAD.bottom)
  const ticks = [yMin, (yMin + top) / 2, top]
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.y)}`).join(' ')
  const last = points.at(-1)

  const onMove = (e) => {
    const svg = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - svg.left) / svg.width) * W
    const i = Math.max(0, Math.min(points.length - 1, Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (points.length - 1))))
    setHoverIndex(i)
    show(e, <><strong>{points[i].x}</strong><br />{format(points[i].y)}</>)
  }

  return (
    <figure className="chart line-chart">
      <div className="chart-header">
        <figcaption>{title}</figcaption>
        <button type="button" className="text-button table-toggle" onClick={() => setAsTable(!asTable)} aria-pressed={asTable}>
          {asTable ? 'Show as chart' : 'Show as table'}
        </button>
      </div>
      {asTable ? (
        <table className="data-table">
          <thead><tr><th scope="col">Academic year</th><th scope="col">{title}</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.x}><th scope="row">{p.x}</th><td>{format(p.y)}</td></tr>)}</tbody>
        </table>
      ) : (
        <div className="chart-frame">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${points.map((p) => `${p.x} ${format(p.y)}`).join(', ')}`}
            onMouseMove={onMove} onMouseLeave={() => { hide(); setHoverIndex(null) }}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
                <text x={PAD.left - 8} y={y(t)} className="axis" textAnchor="end" dy="0.35em">{format(t)}</text>
              </g>
            ))}
            {points.map((p, i) => <text key={p.x} x={x(i)} y={H - 8} className="axis" textAnchor="middle">{p.x}</text>)}
            {hoverIndex !== null && <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />}
            <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
            {points.map((p, i) => (
              <circle key={p.x} cx={x(i)} cy={y(p.y)} r={hoverIndex === i ? 5 : 4} fill={color} className="line-dot" />
            ))}
            <text x={x(points.length - 1)} y={y(last.y) - 12} className="end-label" textAnchor="end">{format(last.y)}</text>
          </svg>
          {node}
        </div>
      )}
      {note && <p className="chart-note">{note}</p>}
    </figure>
  )
}

function niceCeil(v) {
  if (v <= 0) return 1
  const step = 10 ** Math.floor(Math.log10(v))
  return Math.ceil(v / step) * step
}
