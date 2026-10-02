import { useEffect, useMemo, useRef, useState } from 'react'
import { forceCollide, forceSimulation, forceX, forceY } from 'd3-force'
import { CATEGORY_COLORS, CATEGORY_ORDER } from './data.js'
import { CATEGORY_DESCRIPTIONS } from './themeInfo.js'
import { wrapLabel } from './svgText.js'

const CLUSTER_X = { Values: -350, Content: 0, Skills: 350 }
// On phones the three groups stack top to bottom instead
const CLUSTER_Y_NARROW = { Values: -440, Content: 0, Skills: 480 }

// Stack the groups only when the space the drawing gets is actually narrow (a phone, or a thin embed).
// Measuring the drawing's own container avoids relying on the window size, which can be stale in embeds.
function useNarrow(ref, below = 460) {
  const [narrow, setNarrow] = useState(() => window.innerWidth < below)
  useEffect(() => {
    const el = ref.current?.parentElement
    if (!el) return undefined
    const update = () => {
      const width = el.getBoundingClientRect().width
      if (width > 0) setNarrow(width < below)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, below])
  return narrow
}
const MAX_RADIUS = 64
const MIN_RADIUS = 9

function activate(handler) {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handler()
    }
  }
}

// Theme bubbles sized by how many (filtered) people work on each, grouped by category
export default function ThemeOverview({ themes, counts, onOpenTheme }) {
  const [hover, setHover] = useState(null)
  const svgRef = useRef(null)
  const narrow = useNarrow(svgRef)
  const maxCount = Math.max(1, ...themes.map((t) => counts.get(t.name) ?? 0))

  const layout = useMemo(() => {
    const nodes = themes.map((t) => {
      const count = counts.get(t.name) ?? 0
      return {
        ...t,
        count,
        r: count === 0 ? MIN_RADIUS : Math.max(MIN_RADIUS + 3, MAX_RADIUS * Math.sqrt(count / maxCount)),
        lines: wrapLabel(t.name, 16),
      }
    })
    forceSimulation(nodes)
      .force('x', forceX((n) => (narrow ? 0 : CLUSTER_X[n.category] ?? 0)).strength(narrow ? 0.09 : 0.18))
      .force('y', forceY((n) => (narrow ? CLUSTER_Y_NARROW[n.category] ?? 0 : 20)).strength(narrow ? 0.2 : 0.09))
      // Room for the label under each bubble as well as the bubble itself
      .force('collide', forceCollide((n) => n.r + 18 + n.lines.length * 9).iterations(4))
      .stop()
      .tick(320)
    return nodes
  }, [themes, counts, maxCount, narrow])

  const clusterTop = (category) => Math.min(...layout.filter((n) => n.category === category).map((n) => n.y - n.r))

  // Fit the drawing to where the bubbles, their labels and the category titles actually ended up
  const pad = 24
  const minX = Math.min(...layout.map((n) => n.x - Math.max(n.r, 62))) - pad
  const maxX = Math.max(...layout.map((n) => n.x + Math.max(n.r, 62))) + pad
  const minY = Math.min(...CATEGORY_ORDER.map((c) => clusterTop(c) - 60)) - pad
  const maxY = Math.max(...layout.map((n) => n.y + n.r + 20 + (n.lines.length + (n.r < 22 ? 1 : 0)) * 15)) + pad

  return (
    <svg ref={svgRef} className="overview" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      role="group" aria-label="Sustainability themes. Choose a theme to see who works on it.">
      {CATEGORY_ORDER.map((category) => (
        <g key={category} className="cluster-label" transform={`translate(${narrow ? 0 : CLUSTER_X[category]}, ${clusterTop(category) - 38})`}>
          <text className="cluster-name" style={{ fill: CATEGORY_COLORS[category] }}>{category}</text>
          <text className="cluster-description" y="17">{CATEGORY_DESCRIPTIONS[category]}</text>
        </g>
      ))}
      {layout.map((n) => {
        const color = CATEGORY_COLORS[n.category]
        const empty = n.count === 0
        const label = `${n.name}, ${n.count} ${n.count === 1 ? 'person' : 'people'}`
        return (
          <g
            key={n.id}
            className={`bubble${empty ? ' empty' : ''}${hover === n.id ? ' hover' : ''}`}
            transform={`translate(${n.x}, ${n.y})`}
            role="button"
            tabIndex={empty ? -1 : 0}
            aria-label={label}
            aria-disabled={empty || undefined}
            onClick={() => !empty && onOpenTheme(n.name)}
            onKeyDown={activate(() => !empty && onOpenTheme(n.name))}
            onMouseEnter={() => setHover(n.id)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(n.id)}
            onBlur={() => setHover(null)}
          >
            <title>{empty ? `${label}. No one matches your filters.` : `${label}. Click to see who.`}</title>
            <circle r={n.r + 5} className="bubble-halo" style={{ stroke: color }} />
            <circle r={n.r} style={{ fill: color }} />
            {n.count > 0 && n.r >= 22 && (
              <text className="bubble-count" dy="0.35em">{n.count}</text>
            )}
            <text className="bubble-name" y={n.r + 16}>
              {n.lines.map((line, i) => <tspan key={line} x="0" dy={i === 0 ? 0 : 15}>{line}</tspan>)}
            </text>
            {n.r < 22 && (
              <text className="bubble-small-count" y={n.r + 16 + n.lines.length * 15}>
                {n.count} {n.count === 1 ? 'person' : 'people'}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
