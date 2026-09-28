import { useEffect, useMemo, useState } from 'react'
import { formatDate, loadNetwork } from './data.js'
import { applyFilters, filterPeople, readUrl, toQuery } from './filters.js'
import ThemeOverview from './ThemeOverview.jsx'
import ThemeFocus from './ThemeFocus.jsx'
import NetworkGraph from './NetworkGraph.jsx'
import FilterRail from './FilterRail.jsx'
import DetailPanel from './DetailPanel.jsx'
import FacultyList from './FacultyList.jsx'
import SharePanel from './SharePanel.jsx'

const initial = readUrl()

const VIEW_LABELS = { themes: 'Themes', everyone: 'Everyone', list: 'List' }

export default function App() {
  const [network, setNetwork] = useState(null)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(initial.filters)
  const [view, setView] = useState(initial.view)
  const [selectedId, setSelectedId] = useState(initial.person)
  // Embeds are usually narrow, so the people list starts closed there
  const [themePanelOpen, setThemePanelOpen] = useState(!initial.embed)
  const [shareOpen, setShareOpen] = useState(false)
  const embed = initial.embed

  useEffect(() => {
    loadNetwork().then(setNetwork).catch((e) => setError(e.message))
  }, [])

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
    for (const p of filterPeople(network.faculty, filters, { ignoreTheme: true })) {
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
    setFilters({ ...filters, theme: name })
    setSelectedId(null)
    setThemePanelOpen(true)
    setShareOpen(false)
    if (view !== 'list') setView('themes')
  }
  const selectedPerson = byId.get(selectedId)
  const panelItem = selectedPerson && !selectedPerson.id.startsWith('theme:')
    ? { ...selectedPerson, kind: 'person' }
    : focusTheme && view === 'themes' && themePanelOpen ? { ...focusTheme, kind: 'theme' } : null

  return (
    <div className={embed ? 'app embed' : 'app'}>
      <header className="rail">
        <h1>Who works on sustainability at Northeastern?</h1>
        {!embed && (
          <p className="intro">
            {network.faculty.length} faculty, staff and researchers whose work connects to sustainability,
            organized into 20 themes. Pick a theme to see who works on it, or search for someone by name.
          </p>
        )}
        <FilterRail network={network} filters={filters} setFilters={(f) => { setFilters(f); setSelectedId(null) }}
          shownCount={visible.faculty.length} />
        {embed ? (
          <p className="rail-note"><a href={window.location.pathname + query} target="_blank" rel="noreferrer">Open the full map</a></p>
        ) : (
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
            <p>Something missing or wrong? Email the sustainability team so it can be corrected.</p>
          </details>
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
              <button type="button" className="text-button" onClick={() => { setFilters({ ...filters, theme: '' }); setSelectedId(null) }}>
                All themes
              </button>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{focusTheme.name}</span>
            </nav>
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
              ? <ThemeFocus theme={focusTheme} people={visible.faculty} themes={network.themes}
                selectedId={selectedId} onSelect={setSelectedId} onOpenTheme={openTheme} />
              : <ThemeOverview themes={network.themes} counts={themeCounts} onOpenTheme={openTheme} />
          ) : view === 'everyone' ? (
            <NetworkGraph data={visible} themeById={themeById} selectedId={selectedId}
              onSelect={(id) => (id?.startsWith('theme:') ? openTheme(byId.get(id).name) : setSelectedId(id))} />
          ) : (
            <FacultyList people={visible.faculty} onSelect={setSelectedId} />
          )}
        </div>

        {shareOpen && (
          <SharePanel query={query} embedQuery={toQuery({ ...state, embed: true })} onClose={() => setShareOpen(false)} />
        )}
        {!shareOpen && (
          <DetailPanel item={panelItem} visibleFaculty={visible.faculty} themes={network.themes}
            onSelect={setSelectedId} onOpenTheme={openTheme}
            onClose={() => (selectedPerson ? setSelectedId(null) : setThemePanelOpen(false))} />
        )}
      </main>
    </div>
  )
}
