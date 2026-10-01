import { useMemo, useState } from 'react'
import { CATEGORY_COLORS } from './data.js'
import { wrapLabel } from './svgText.js'

const DOT = 4.6
const DOT_SPACING = 13
const RING_GAP = 15
const INNER = 150

function activate(handler) {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handler()
    }
  }
}

const TAU = Math.PI * 2
// Line spacing of satellite labels, in pixels (names are 15px, counts 13px)
const NAME_LINE = 17
const COUNT_LINE = 16
const anchor = (angle) => (Math.cos(angle) > 0.25 ? 'start' : Math.cos(angle) < -0.25 ? 'end' : 'middle')
const polar = (angle, r) => [Math.cos(angle) * r, Math.sin(angle) * r]

// One theme in the middle, its people in rings around it, and the other themes those people
// also work on around the outside. People are ordered so that those who share a second theme sit together.
export default function ThemeFocus({ theme, people, themes, themeCounts, selectedId, pairTheme, onSelect, onSelectPair }) {
  const [hover, setHover] = useState(null)
  const themeByName = useMemo(() => new Map(themes.map((t) => [t.name, t])), [themes])

  const layout = useMemo(() => {
    // Other themes, grouped by category and then by size
    const counts = new Map()
    for (const p of people) for (const t of p.themes) if (t !== theme.name) counts.set(t, (counts.get(t) ?? 0) + 1)
    const order = ['Values', 'Content', 'Skills']
    const others = [...counts.entries()]
      .map(([name, count]) => ({ ...themeByName.get(name), count }))
      .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || b.count - a.count)

    // One extra slot for people who only work on this theme
    const hasOnly = people.some((p) => p.themes.length === 1)
    const slots = others.length + (hasOnly ? 1 : 0)
    const slotAngle = (i) => -Math.PI / 2 + (i / Math.max(slots, 1)) * TAU
    const otherAngle = new Map(others.map((o, i) => [o.name, slotAngle(i)]))

    // Each person leans towards the other themes they work on (circular mean of those angles)
    const target = (p) => {
      const angles = p.themes.filter((t) => t !== theme.name).map((t) => otherAngle.get(t))
      if (angles.length === 0) return slotAngle(slots - 1)
      const x = angles.reduce((s, a) => s + Math.cos(a), 0)
      const y = angles.reduce((s, a) => s + Math.sin(a), 0)
      return Math.atan2(y, x)
    }
    const norm = (a) => ((a + Math.PI / 2) % TAU + TAU) % TAU
    const sorted = [...people].map((p) => ({ p, a: norm(target(p)) })).sort((a, b) => a.a - b.a || a.p.name.localeCompare(b.p.name))

    const rings = Math.max(1, Math.ceil((sorted.length * DOT_SPACING) / (TAU * (INNER + RING_GAP))))
    // Shift the whole ring so people line up with their themes as well as possible
    const offset = sorted.length === 0 ? 0 : Math.atan2(
      sorted.reduce((s, { a }, i) => s + Math.sin(a - (i / sorted.length) * TAU), 0),
      sorted.reduce((s, { a }, i) => s + Math.cos(a - (i / sorted.length) * TAU), 0),
    )
    const dots = sorted.map(({ p }, i) => {
      const angle = -Math.PI / 2 + offset + (i / sorted.length) * TAU
      const r = INNER + (i % rings) * RING_GAP
      const [x, y] = polar(angle, r)
      return { person: p, x, y, angle }
    })

    const outer = INNER + rings * RING_GAP + 100
    const maxOther = Math.max(1, ...others.map((o) => o.count))
    const satellites = others.map((o) => {
      const angle = otherAngle.get(o.name)
      const [x, y] = polar(angle, outer)
      return { ...o, x, y, angle, r: 7 + 15 * Math.sqrt(o.count / maxOther), lines: wrapLabel(o.name, 18) }
    })
    const onlyLabel = hasOnly ? { angle: slotAngle(slots - 1), xy: polar(slotAngle(slots - 1), outer) } : null

    return { dots, satellites, outer, rings, onlyLabel }
  }, [theme, people, themeByName])

  const { dots, satellites, outer, rings, onlyLabel } = layout
  const satByName = new Map(satellites.map((s) => [s.name, s]))
  // Wider than tall: labels on the left and right need room
  const extentX = outer + 170
  const extentY = outer + 100
  const color = CATEGORY_COLORS[theme.category]
  const labels = useMemo(() => placeLabels(satellites, anchor), [satellites])

  const focusPerson = hover?.kind === 'person' ? hover.id : selectedId
  // A clicked theme stays highlighted until the panel is closed; hovering another previews it
  const focusTheme = hover?.kind === 'theme' ? hover.id : (!hover && pairTheme) || null
  const isActive = (dot) => (focusPerson ? dot.person.id === focusPerson : focusTheme ? dot.person.themes.includes(focusTheme) : false)
  const anyFocus = Boolean(focusPerson || focusTheme)

  const centerLines = wrapLabel(theme.name, 14)

  const cardTheme = hover?.kind === 'theme' ? hover.id : null
  const card = cardTheme && (() => {
    const both = satByName.get(cardTheme)?.count ?? 0
    const a = people.length
    const b = themeCounts.get(cardTheme) ?? both
    // Keep the card away from the theme being hovered: bottom corner for themes in the top half
    const low = (satByName.get(cardTheme)?.y ?? 0) < 0
    return { name: cardTheme, both, either: a + b - both, onlyA: a - both, onlyB: b - both, low }
  })()

  return (
    <div className="focus-wrap">
    {card && (
      <div className={`overlap-card${card.low ? ' low' : ''}`} role="status">
        <p className="overlap-title">{theme.name} and {card.name}</p>
        <OverlapBar a={theme.name} b={card.name} onlyA={card.onlyA} both={card.both} onlyB={card.onlyB} />
        <dl>
          <div><dt>Work on both</dt><dd>{card.both}</dd></div>
          <div><dt>Work on either</dt><dd>{card.either}</dd></div>
          <div><dt>Only {theme.name}</dt><dd>{card.onlyA}</dd></div>
          <div><dt>Only {card.name}</dt><dd>{card.onlyB}</dd></div>
        </dl>
        <p className="overlap-hint">Click {card.name} to see who works on both.</p>
      </div>
    )}
    <svg className="focus" viewBox={`${-extentX} ${-extentY} ${extentX * 2} ${extentY * 2}`}
      role="group" aria-label={`${theme.name}: ${people.length} people, and the other themes they work on`}>
      <circle r={INNER + (rings - 1) * RING_GAP + 14} className="ring-band" style={{ fill: color }} />

      {/* Lines from each person to the other themes they work on */}
      <g className="focus-links">
        {dots.flatMap((d) => d.person.themes.filter((t) => satByName.has(t)).map((t) => {
          const s = satByName.get(t)
          const active = isActive(d) && (!focusTheme || t === focusTheme)
          const mid = polar((d.angle + s.angle) / 2 + (Math.abs(d.angle - s.angle) > Math.PI ? Math.PI : 0), (INNER + outer) / 2 + 10)
          return (
            <path key={`${d.person.id}-${t}`} d={`M${d.x},${d.y} Q${mid[0]},${mid[1]} ${s.x},${s.y}`}
              className={active ? 'active' : anyFocus ? 'dimmed' : ''}
              style={{ stroke: CATEGORY_COLORS[s.category] }} />
          )
        }))}
      </g>

      <g className="center" aria-hidden="true">
        <circle r={INNER - 32} style={{ fill: color }} />
        <text className="center-name" y={-(centerLines.length - 1) * 11 - 8}>
          {centerLines.map((line, i) => <tspan key={line} x="0" dy={i === 0 ? 0 : 23}>{line}</tspan>)}
        </text>
        <text className="center-count" y={centerLines.length * 11 + 14}>{people.length} {people.length === 1 ? 'person' : 'people'}</text>
      </g>

      <g className="people-dots">
        {dots.map((d) => {
          const p = d.person
          const active = isActive(d)
          return (
            <g key={p.id} transform={`translate(${d.x}, ${d.y})`}
              className={`dot${active ? ' active' : anyFocus ? ' dimmed' : ''}${p.id === selectedId ? ' selected' : ''}${p.addedFromResearch ? ' research' : ''}`}
              role="button" tabIndex="0" aria-label={`${p.name}${p.college ? `, ${p.college}` : ''}`}
              onClick={() => onSelect(p.id)} onKeyDown={activate(() => onSelect(p.id))}
              onMouseEnter={() => setHover({ kind: 'person', id: p.id })} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover({ kind: 'person', id: p.id })} onBlur={() => setHover(null)}>
              <circle r={DOT + 4} className="hit" />
              <circle r={DOT} />
            </g>
          )
        })}
      </g>

      {satellites.map((s) => {
        const { a, lx, ly, firstLine } = labels.get(s.name)
        const dimmed = anyFocus && !(focusTheme === s.name || (focusPerson && dots.find((d) => d.person.id === focusPerson)?.person.themes.includes(s.name)))
        return (
          <g key={s.id} transform={`translate(${s.x}, ${s.y})`} className={`satellite${dimmed ? ' dimmed' : ''}`}
            role="button" tabIndex="0" aria-label={`${s.name}: ${s.count} people work on both ${theme.name} and ${s.name}. Show who.`}
            onClick={() => onSelectPair(s.name)} onKeyDown={activate(() => onSelectPair(s.name))}
            onMouseEnter={() => setHover({ kind: 'theme', id: s.name })} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover({ kind: 'theme', id: s.name })} onBlur={() => setHover(null)}>
            <title>{`${s.count} work on both. Click to see who.`}</title>
            <circle r={s.r} style={{ fill: CATEGORY_COLORS[s.category] }} />
            <text x={lx} y={ly + firstLine} textAnchor={a} className="satellite-name">
              {s.lines.map((line, i) => <tspan key={line} x={lx} dy={i === 0 ? undefined : NAME_LINE}>{line}</tspan>)}
              <tspan x={lx} dy={COUNT_LINE} className="satellite-count">{s.count} shared</tspan>
            </text>
          </g>
        )
      })}

      {onlyLabel && (
        <text className="only-label" x={onlyLabel.xy[0]} y={onlyLabel.xy[1]} textAnchor={anchor(onlyLabel.angle)}>
          Only {theme.name}
        </text>
      )}

      {/* Name of the person under the pointer */}
      {hover?.kind === 'person' && (() => {
        const d = dots.find((x) => x.person.id === hover.id)
        if (!d) return null
        const [x, y] = polar(d.angle, Math.hypot(d.x, d.y) - 16)
        return <text className="hover-name" x={x} y={y} textAnchor={anchor(d.angle + Math.PI)} dy="0.35em">{d.person.name}</text>
      })()}
    </svg>
    </div>
  )
}

// Three-part bar: only the first theme, both, only the second. Widths are shares of everyone in either.
export function OverlapBar({ a, b, onlyA, both, onlyB }) {
  const total = Math.max(1, onlyA + both + onlyB)
  const part = (n, cls, label) => n > 0 && (
    <span className={`overlap-part ${cls}`} style={{ flexGrow: n }} title={`${label}: ${n}`}>{n / total >= 0.12 ? n : ''}</span>
  )
  return (
    <div className="overlap-bar" role="img" aria-label={`Only ${a}: ${onlyA}. Both: ${both}. Only ${b}: ${onlyB}.`}>
      {part(onlyA, 'only-a', `Only ${a}`)}{part(both, 'both', 'Both')}{part(onlyB, 'only-b', `Only ${b}`)}
    </div>
  )
}

// Labels sit below circles in the bottom part of the ring, above the one at the very top, and beside all
// others, so none runs into its own circle. Then labels that would still touch a neighbor are nudged apart.
function placeLabels(satellites, anchorFor) {
  const placed = satellites.map((s) => {
    const a = anchorFor(s.angle)
    const height = (s.lines.length - 1) * NAME_LINE + COUNT_LINE
    const below = Math.sin(s.angle) > 0.5
    const side = !below && a !== 'middle'
    const lx = side ? Math.sign(Math.cos(s.angle)) * (s.r + 8) : below ? Math.cos(s.angle) * (s.r + 10) : 0
    const ly = side ? 0 : below ? Math.sin(s.angle) * (s.r + 10) : -(s.r + 6)
    const firstLine = side ? 4 - height / 2 : below ? 14 : -4 - height
    // Rough box in drawing coordinates, from the longest line at about 9px per character, a little generous
    const width = Math.max(...s.lines.map((l) => l.length)) * 9.3
    const x0 = s.x + lx - (a === 'end' ? width : a === 'middle' ? width / 2 : 0)
    return { s, a, lx, ly, firstLine, place: side ? 'side' : below ? 'below' : 'above', x0, x1: x0 + width, top: s.y + ly + firstLine - 13, bottom: s.y + ly + firstLine + height + 3 }
  })
  for (let pass = 0; pass < 40; pass++) {
    let moved = false
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const p = placed[i]
        const q = placed[j]
        if (p.x0 >= q.x1 || q.x0 >= p.x1) continue
        const overlap = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) + 6
        if (overlap <= 0) continue
        // Push the higher label up and the lower one down, but never back toward its own circle
        const [up, down] = p.top < q.top ? [p, q] : [q, p]
        const canUp = up.place !== 'below'
        const canDown = down.place !== 'above'
        if (!canUp && !canDown) continue
        const share = canUp && canDown ? overlap / 2 : overlap
        for (const [l, d] of [[up, canUp ? -share : 0], [down, canDown ? share : 0]]) { l.firstLine += d; l.top += d; l.bottom += d }
        moved = true
      }
    }
    if (!moved) break
  }
  return new Map(placed.map((p) => [p.s.name, p]))
}
