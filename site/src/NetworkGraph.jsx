import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { forceCollide } from 'd3-force'
import { CATEGORY_COLORS, COLORS } from './colors.js'

const FACULTY_COLOR = COLORS.person
const INK = COLORS.ink
const BACKGROUND = COLORS.mist

function themeRadius(node) {
  return 5 + Math.sqrt(node.facultyCount) * 1.1
}

function facultyRadius(node) {
  return 2.2 + node.themes.length * 0.45
}

function withAlpha(hex, alpha) {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0')
  return hex + a
}

export default function NetworkGraph({ data, themeById, selectedId, onSelect }) {
  const containerRef = useRef(null)
  const graphRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hoverId, setHoverId] = useState(null)
  const fitted = useRef(false)
  const mounted = size.width > 0

  // Node objects are kept between renders so filtering doesn't reset the layout
  const nodeCache = useRef(new Map())

  useEffect(() => {
    const el = containerRef.current
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const graphData = useMemo(() => {
    const cache = nodeCache.current
    const node = (item, kind) => {
      let n = cache.get(item.id)
      if (!n) {
        // Start themes where the Tableau layout had them, so the picture is familiar
        n = kind === 'theme' ? { x: item.x * 0.35, y: item.y * 0.35 } : {}
        cache.set(item.id, n)
      }
      return Object.assign(n, item, { kind })
    }
    return {
      nodes: [...data.themes.map((t) => node(t, 'theme')), ...data.faculty.map((p) => node(p, 'faculty'))],
      links: data.links.map((l) => ({ ...l })),
    }
  }, [data])

  const neighbors = useMemo(() => {
    const map = new Map()
    for (const l of data.links) {
      if (!map.has(l.source)) map.set(l.source, new Set())
      if (!map.has(l.target)) map.set(l.target, new Set())
      map.get(l.source).add(l.target)
      map.get(l.target).add(l.source)
    }
    return map
  }, [data])

  useEffect(() => {
    const fg = graphRef.current
    if (!fg) return
    fg.d3Force('charge').strength((n) => (n.kind === 'theme' ? -520 : -30)).distanceMax(600)
    fg.d3Force('link').distance(46).strength(0.3)
    // Themes get extra room so their labels don't sit on top of each other
    fg.d3Force('collide', forceCollide((n) => (n.kind === 'theme' ? themeRadius(n) + 26 : facultyRadius(n) + 1.5)))
    fg.d3ReheatSimulation()
    // The graph only mounts once the container has a size, so wait for that too
  }, [graphData, mounted])

  // Labels are drawn onto a canvas, so redraw once Lato has downloaded in case the first frames used a fallback
  useEffect(() => {
    document.fonts?.ready.then(() => graphRef.current?.refresh?.())
  }, [mounted])

  // Fit again when filters change the set of nodes
  useEffect(() => {
    fitted.current = false
  }, [data])

  const focusId = hoverId ?? selectedId
  const focusSet = useMemo(() => {
    if (!focusId) return null
    return new Set([focusId, ...(neighbors.get(focusId) ?? [])])
  }, [focusId, neighbors])

  const linkEndId = (end) => (typeof end === 'object' ? end.id : end)

  function drawNode(node, ctx, scale) {
    const dimmed = focusSet && !focusSet.has(node.id)
    const selected = node.id === selectedId

    if (node.kind === 'theme') {
      const r = themeRadius(node)
      const color = CATEGORY_COLORS[node.category] ?? INK
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
      ctx.fillStyle = dimmed ? withAlpha(color, 0.18) : color
      ctx.fill()
      if (selected) {
        ctx.lineWidth = 2 / scale
        ctx.strokeStyle = INK
        ctx.stroke()
      }
      const fontSize = Math.max(11 / scale, 3.2)
      ctx.font = `700 ${fontSize}px "Lato", system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.lineWidth = fontSize / 3
      ctx.strokeStyle = withAlpha(BACKGROUND, dimmed ? 0.4 : 0.9)
      ctx.strokeText(node.name, node.x, node.y + r + 2 / scale)
      ctx.fillStyle = dimmed ? withAlpha(INK, 0.25) : INK
      ctx.fillText(node.name, node.x, node.y + r + 2 / scale)
      return
    }

    const r = facultyRadius(node)
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    // People added from published research are drawn as rings
    if (node.addedFromResearch) {
      ctx.fillStyle = BACKGROUND
      ctx.fill()
      ctx.lineWidth = 1.4 / scale
      ctx.strokeStyle = dimmed ? withAlpha(FACULTY_COLOR, 0.15) : FACULTY_COLOR
      ctx.stroke()
    } else {
      ctx.fillStyle = dimmed ? withAlpha(FACULTY_COLOR, 0.15) : FACULTY_COLOR
      ctx.fill()
      ctx.lineWidth = 0.8 / scale
      ctx.strokeStyle = BACKGROUND
      ctx.stroke()
    }
    if (selected) {
      ctx.lineWidth = 2 / scale
      ctx.strokeStyle = INK
      ctx.stroke()
    }
    // Names only when someone is in focus, or when zoomed in far enough to read them
    if ((focusSet && !dimmed) || scale > 4.5) {
      const fontSize = 10 / scale
      ctx.font = `${fontSize}px "Lato", system-ui, sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = fontSize / 3
      ctx.strokeStyle = withAlpha(BACKGROUND, 0.9)
      ctx.strokeText(node.name, node.x + r + 2 / scale, node.y)
      ctx.fillStyle = INK
      ctx.fillText(node.name, node.x + r + 2 / scale, node.y)
    }
  }

  function linkColor(link) {
    const color = CATEGORY_COLORS[themeById.get(linkEndId(link.source))?.category] ?? INK
    if (!focusSet) return withAlpha(color, 0.22)
    const active = focusSet.has(linkEndId(link.source)) && focusSet.has(linkEndId(link.target))
      && (linkEndId(link.source) === focusId || linkEndId(link.target) === focusId)
    return active ? withAlpha(color, 0.85) : withAlpha(color, 0.05)
  }

  return (
    <div className="graph" ref={containerRef}>
      {size.width > 0 && (
        <ForceGraph2D
          ref={graphRef}
          width={size.width}
          height={size.height}
          graphData={graphData}
          backgroundColor={BACKGROUND}
          nodeId="id"
          nodeLabel={() => ''}
          nodeVal={(n) => (n.kind === 'theme' ? themeRadius(n) : facultyRadius(n)) ** 2 / 4}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(node.x, node.y, (node.kind === 'theme' ? themeRadius(node) : facultyRadius(node)) + 2, 0, 2 * Math.PI)
            ctx.fill()
          }}
          linkColor={linkColor}
          linkWidth={(l) => (focusId && (linkEndId(l.source) === focusId || linkEndId(l.target) === focusId) ? 1.4 : 0.6)}
          onNodeHover={(n) => setHoverId(n?.id ?? null)}
          onNodeClick={(n) => onSelect(n.id)}
          onBackgroundClick={() => onSelect(null)}
          cooldownTicks={180}
          onEngineStop={() => {
            if (!fitted.current) {
              const fg = graphRef.current
              fg?.zoomToFit(500, 40)
              // Small result sets would otherwise be blown up to fill the screen
              setTimeout(() => { if (fg && fg.zoom() > 2.5) fg.zoom(2.5, 300) }, 520)
              fitted.current = true
            }
          }}
        />
      )}
    </div>
  )
}
