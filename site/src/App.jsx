import { useEffect, useMemo, useState } from 'react'
import { CATEGORY_COLORS, CATEGORY_ORDER, formatDate, loadNetwork } from './data.js'
import { applyFilters, readUrl, toQuery } from './filters.js'
import ThemeOverview from './ThemeOverview.jsx'
import ThemeFocus from './ThemeFocus.jsx'
import NetworkGraph from './NetworkGraph.jsx'
import FilterRail from './FilterRail.jsx'
import DetailPanel from './DetailPanel.jsx'
import FacultyList from './FacultyList.jsx'
import SharePanel from './SharePanel.jsx'
import SiteSwitch from './SiteSwitch.jsx'

const initial = readUrl()

function isFramed() {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

// Below this width the filters move into a bar above the map. Embeds keep them at the side for longer,
// because the host page usually gives the map less height than width.
const compactQuery = (embedded) => `(max-width: ${embedded ? 800 : 1100}px)`
const startsEmbedded = initial.embed || isFramed()
document.documentElement.classList.toggle('embedded', startsEmbedded)
document.documentElement.classList.toggle('compact', window.matchMedia(compactQuery(startsEmbedded)).matches)

const VIEW_LABELS = { themes: 'Themes', everyone: 'Everyone', list: 'List' }

export default function App() {
  const [network, setNetwork] = useState(null)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(initial.filters)
  const [view, setView] = useState(initial.view)
  const [selectedId, setSelectedId] = useState(initial.person)
  // In narrow spaces (e.g. embedded in another site) the people list would cover the map, so it starts closed
  const narrow = () => window.matchMedia(compactQuery(initial.embed || isFramed())).matches
  const [themePanelOpen, setThemePanelOpen] = useState(!initial.embed && !narrow())
  const [shareOpen, setShareOpen] = useState(false)
  // Inside another website's frame, always use the compact layout, even if the embed code left out ?embed=1
  const embed = initial.embed || isFramed()
  const [pairName, setPairName] = useState(null)

  useEffect(() => {
    loadNetwork().then(setNetwork).catch((e) => setError(e.message))
  }, [])

  // Embedded in another page, everything is drawn a little smaller so it fits a normal browser window
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('embedded', embed)
    const m = window.matchMedia(compactQuery(embed))
    const update = () => root.classList.toggle('compact', m.matches)
    update()
    m.addEventListener('change', update)
    return () => m.removeEventListener('change', update)
  }, [embed])

  const state = { filters, view, person: selectedId }
  const query = toQuery({ ...state, embed: false })
  const fullQuery = toQuery({ ...state, embed })
  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname + fullQuery)
  }, [fullQuery])

  const visible = useMemo(() => (network ? applyFilters(network, filters) : null), [network, filters])
  const themeCounts = useMemo(() => {
    const counts = new Map()
    if (!network) return counts
    // Counts per theme under every filter except the theme itself (applyFilters also handles "backed only")
    for (const p of applyFilters(network, { ...filters, theme: '' }).faculty) {
      for (const t of p.themes) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return counts
  }, [network, filters])
  const byId = useMemo(() => new Map(network ? [...network.themes, ...network.faculty].map((n) => [n.id, n]) : []), [network])
  const themeById = useMemo(() => new Map(network ? network.themes.map((t) => [t.id, t]) : []), [network])

  if (error) return <p className="status">The map couldn’t load its data: {error}</p>
  if (!network) return <p className="status">Loading the map…</p>

  const focusTheme = network.themes.find((t) => t.name === filters.theme)
  const openTheme = (name) => {
    setPairName(null)
    setFilters({ ...filters, theme: name })
    setSelectedId(null)
    setThemePanelOpen(!narrow())
    setShareOpen(false)
    if (view !== 'list') setView('themes')
  }
  const selectedPerson = byId.get(selectedId)
  const pairTheme = focusTheme && pairName ? network.themes.find((t) => t.name === pairName) : null
  const panelItem = selectedPerson && !selectedPerson.id.startsWith('theme:')
    ? { ...selectedPerson, kind: 'person' }
    : pairTheme && view === 'themes'
      ? { kind: 'pair', id: `pair:${pairTheme.name}`, name: `${focusTheme.name} and ${pairTheme.name}`, a: focusTheme, b: pairTheme,
        totalB: themeCounts.get(pairTheme.name) ?? 0 }
    : focusTheme && view === 'themes' && themePanelOpen ? { ...focusTheme, kind: 'theme' } : null

  return (
    <div className={embed ? 'app embed' : 'app'}>
      <header className="rail">
        <SiteSwitch current="faculty" theme={filters.theme} embed={embed} />
        <h1>Who works on sustainability at Northeastern?</h1>
        {!embed && (
          <p className="intro">
            {network.faculty.length} faculty, staff and researchers whose work connects to sustainability,
            organized into 20 themes. Pick a theme to see who works on it, or search for someone by name.
          </p>
        )}
        <FilterRail network={network} filters={filters} setFilters={(f) => { setFilters(f); setSelectedId(null); setPairName(null) }}
          shownCount={visible.faculty.length} />
        {embed ? (
          <p className="rail-note"><a href={window.location.pathname + query} target="_blank" rel="noreferrer">Open the full map</a></p>
        ) : (
          <>
          <ul className="rail-links">
            <li><a href="curriculum/">How much sustainability is in each major</a></li>
            <li><a href="curriculum/?view=overview">Sustainability course charts and trends</a></li>
          </ul>
          <details className="about">
            <summary>How this map is made</summary>
            <p>
              People were first identified by Northeastern’s sustainability team from Faculty Insight profiles,
              faculty web pages, research records and the courses people teach. Their work was then matched
              to the 20 themes.
            </p>
            <p>
              The map also reads recent published research from <a href="https://openalex.org" target="_blank" rel="noreferrer">OpenAlex</a>,
              a free public index of research papers, and adds Northeastern researchers with several recent
              sustainability papers. Research was last updated {formatDate(network.meta.researchUpdated)}.
            </p>
            <p>
              A person’s connection to a theme is “backed” when their published papers or a course they teach supports it.
              Other connections come from matching profile keywords to themes, which is looser.
            </p>
            <p>Something missing or wrong? <a href={network.meta.contact} target="_blank" rel="noreferrer">Tell the sustainability team</a>.</p>
          </details>
          </>
        )}
      </header>

      <main className="stage">
        <div className="toolbar">
          <div className="view-switch" role="tablist" aria-label="View">
            {Object.entries(VIEW_LABELS).map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={view === key}
                onClick={() => { setView(key); setShareOpen(false) }}>{label}</button>
            ))}
          </div>
          {view === 'themes' && focusTheme && (
            <nav className="breadcrumb" aria-label="Theme">
              <button type="button" className="text-button" onClick={() => { setFilters({ ...filters, theme: '' }); setSelectedId(null); setPairName(null) }}>
                All themes
              </button>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{focusTheme.name}</span>
            </nav>
          )}
          {view === 'themes' && focusTheme && !panelItem && (
            <button type="button" className="button people-button" onClick={() => { setThemePanelOpen(true); setShareOpen(false) }}>
              See the {visible.faculty.length} people
            </button>
          )}
          <button type="button" className="button share-button" onClick={() => setShareOpen(!shareOpen)} aria-expanded={shareOpen}>
            Share or embed
          </button>
        </div>

        <div className="canvas">
          {visible.faculty.length === 0 && !(view === 'themes' && !focusTheme) ? (
            <p className="empty">No one matches these filters. Try removing one, or choose Clear all.</p>
          ) : view === 'themes' ? (
            focusTheme
              ? <ThemeFocus theme={focusTheme} people={visible.faculty} themes={network.themes} themeCounts={themeCounts}
                selectedId={selectedId} pairTheme={pairName} onSelect={setSelectedId}
                onSelectPair={(name) => { setSelectedId(null); setShareOpen(false); setPairName(name) }} />
              : <ThemeOverview themes={network.themes} counts={themeCounts} onOpenTheme={openTheme} />
          ) : view === 'everyone' ? (
            <>
            <p className="visually-hidden">
              This view is a drawing of every connection. With a keyboard or screen reader, use the List view instead.
            </p>
            <NetworkGraph data={visible} themeById={themeById} selectedId={selectedId}
              onSelect={(id) => (id?.startsWith('theme:') ? openTheme(byId.get(id).name) : setSelectedId(id))} />
            </>
          ) : (
            <FacultyList people={visible.faculty} onSelect={setSelectedId} />
          )}
        </div>

        {view !== 'list' && visible.faculty.length > 0 && (
          <ul className="legend" aria-label="Key">
            {CATEGORY_ORDER.map((c) => (
              <li key={c}><span className="legend-dot category" style={{ '--swatch': CATEGORY_COLORS[c] }} />{c} themes</li>
            ))}
            {(view === 'everyone' || focusTheme) && (
              <>
                <li><span className="legend-dot" />Person</li>
                <li><span className="legend-dot research" />Added from published research</li>
              </>
            )}
            {view === 'themes' && !focusTheme && <li>Bigger circles mean more people</li>}
          </ul>
        )}

        {shareOpen && (
          <SharePanel query={query} embedQuery={toQuery({ ...state, embed: true })} onClose={() => setShareOpen(false)} />
        )}
        {!shareOpen && (
          <DetailPanel item={panelItem} visibleFaculty={visible.faculty} themes={network.themes} links={network.links}
            onSelect={setSelectedId} onOpenTheme={openTheme}
            onClose={() => (selectedPerson ? setSelectedId(null) : pairName ? setPairName(null) : setThemePanelOpen(false))} />
        )}
      </main>
    </div>
  )
}
