import { useEffect, useMemo, useState } from 'react'

// A list of Northeastern's sustainability programs, like a university sustainability office's "Academic
// Programs" page. Built from the same catalog data as the curriculum map (pipeline/curriculum/build_curriculum.py
// decides which list each program goes in; data/base/program_directory.csv overrides it).

const DATA = `${import.meta.env.BASE_URL}../data/curriculum/`

// Groups on the page, in order
const GROUPS = [
  { key: 'majors', short: 'Majors', title: 'Undergraduate majors', test: (p) => p.level === 'Undergraduate' && p.type === "Bachelor's" },
  { key: 'minors', short: 'Minors', title: 'Undergraduate minors', test: (p) => p.level === 'Undergraduate' && p.type === 'Minor' },
  { key: 'graduate', short: 'Graduate degrees', title: "Graduate degrees (master's and PhD)", test: (p) => p.level === 'Graduate' && (p.type === "Master's" || p.type === 'Doctorate') },
  { key: 'certificates', short: 'Certificates', title: 'Graduate certificates', test: (p) => p.level === 'Graduate' && p.type === 'Certificate' },
  { key: 'other', short: 'Other', title: 'Other programs', test: () => true },
]

// The catalog lists a program once per campus; show it once with every campus
function mergeCampuses(programs) {
  const byName = new Map()
  for (const p of programs) {
    const key = `${p.baseName}|${p.type}|${p.level}`
    const entry = byName.get(key) ?? { ...p, campuses: [], ids: [] }
    if (p.campus && !entry.campuses.includes(p.campus)) entry.campuses.push(p.campus)
    if (p.campus === 'Boston') Object.assign(entry, { id: p.id, campus: p.campus, url: p.url, description: p.description || entry.description, notice: p.notice || entry.notice })
    entry.required = p.required.length > entry.required.length ? p.required : entry.required
    entry.options = p.options.length > entry.options.length ? p.options : entry.options
    byName.set(key, entry)
  }
  return [...byName.values()].map((p) => ({ ...p, campuses: p.campuses.sort() }))
}

// The first sentence or two of the catalog's description
function summary(text) {
  if (!text) return ''
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text]
  let out = ''
  for (const s of sentences) {
    if (out && (out + s).length > 260) break
    out += s
  }
  return out.trim()
}

// The catalog writes some names with a long dash ("MBA\u2014Full-Time"); show a comma instead
const title = (name) => name.replace(/\s*\u2014\s*/g, ', ')

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function Program({ p }) {
  const req = p.required.length
  const opt = p.options.length
  return (
    <li className="program">
      <h4><a href={p.url} target="_blank" rel="noopener">{title(p.baseName)}</a></h4>
      <p className="program-meta">
        {p.college}{p.campuses.length ? ` · ${p.campuses.join(', ')}` : ''}
      </p>
      {p.notice && <p className="program-notice">{p.notice}</p>}
      {p.description && <p className="program-desc">{summary(p.description)}</p>}
      <p className="program-courses">
        {req || opt
          ? <>{req ? `Requires ${plural(req, 'sustainability course')}` : 'Sustainability courses to choose from'}{req && opt ? `, plus ${opt} more to choose from` : !req ? ` (${opt})` : ''}. </>
          : null}
        <a href={`../curriculum/?program=${encodeURIComponent(p.id)}&level=${encodeURIComponent(p.level)}&type=${encodeURIComponent(p.type)}&campus=${encodeURIComponent(p.campus)}`}>See its courses</a>
      </p>
    </li>
  )
}

function Section({ title, intro, programs }) {
  if (!programs.length) return null
  const groups = GROUPS.map((g) => ({ ...g, items: [] }))
  for (const p of programs) groups.find((g) => g.test(p)).items.push(p)
  return (
    <section className="program-list">
      <h2>{title}</h2>
      <p className="list-intro">{intro}</p>
      {groups.filter((g) => g.items.length).map((g) => (
        <div key={g.key} className="group">
          <h3>{g.title} <span className="count">{g.items.length}</span></h3>
          <ul>{g.items.sort((a, b) => a.baseName.localeCompare(b.baseName)).map((p) => <Program key={`${p.baseName}${p.type}${p.level}`} p={p} />)}</ul>
        </div>
      ))}
    </section>
  )
}

const LISTS = [
  { key: 'focused', label: 'Sustainability-focused' },
  { key: 'related', label: 'Strong sustainability coursework' },
  { key: 'all', label: 'Both' },
]
const KINDS = [{ key: 'all', label: 'All kinds' }, ...GROUPS.map((g) => ({ key: g.key, label: g.short }))]

// A row of buttons where one is pressed, e.g. Majors | Minors | Certificates
function Toggle({ label, options, value, onChange, counts }) {
  return (
    <div className="toggle" role="group" aria-label={label}>
      <span className="toggle-label">{label}</span>
      <div className="toggle-options">
        {options.filter((o) => counts[o.key] || o.key === value || o.key === 'all').map((o) => (
          <button key={o.key} type="button" aria-pressed={o.key === value} onClick={() => onChange(o.key)}>
            {o.label} <span className="count">{counts[o.key] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Keep the chosen toggles in the address, so a link opens the same view
const params = new URLSearchParams(window.location.search)
const initialList = LISTS.some((l) => l.key === params.get('show')) ? params.get('show') : 'focused'
const initialKind = KINDS.some((k) => k.key === params.get('kind')) ? params.get('kind') : 'all'

export default function ProgramsApp() {
  const [programs, setPrograms] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [list, setList] = useState(initialList)
  const [kind, setKind] = useState(initialKind)

  useEffect(() => {
    fetch(`${DATA}programs.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Couldn't load the program list (${res.status})`))))
      .then(setPrograms)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    const next = new URLSearchParams()
    if (list !== 'focused') next.set('show', list)
    if (kind !== 'all') next.set('kind', kind)
    const query = next.toString()
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname)
  }, [list, kind])

  const all = useMemo(() => mergeCampuses((programs ?? []).filter((p) => p.list === 'focused' || p.list === 'related')), [programs])
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const searched = all.filter((p) => words.every((w) => `${p.baseName} ${p.college} ${p.description}`.toLowerCase().includes(w)))
  const kindOf = (p) => GROUPS.find((g) => g.test(p)).key
  const inList = (p, l) => l === 'all' || p.list === l
  const inKind = (p, k) => k === 'all' || kindOf(p) === k

  const listCounts = Object.fromEntries(LISTS.map((l) => [l.key, searched.filter((p) => inList(p, l.key) && inKind(p, kind)).length]))
  const kindCounts = Object.fromEntries(KINDS.map((k) => [k.key, searched.filter((p) => inList(p, list) && inKind(p, k.key)).length]))
  const shown = searched.filter((p) => inKind(p, kind))
  const focused = list === 'related' ? [] : shown.filter((p) => p.list === 'focused')
  const related = list === 'focused' ? [] : shown.filter((p) => p.list === 'related')

  return (
    <main className="programs-page">
      <header>
        <p className="eyebrow">Northeastern University · Sustainability</p>
        <h1>Academic Programs in Sustainability</h1>
        <p className="intro">
          Sustainability runs through Northeastern’s curriculum. Some programs are built around it: environmental and
          sustainability sciences, climate and energy, marine science, environmental engineering and more. Many others,
          from business to architecture to public policy, require sustainability courses as part of the degree.
          Descriptions come from the Northeastern Academic Catalog, and the list updates every month.
        </p>
      </header>
      {error && <p className="none">{error}</p>}
      {!programs && !error && <p className="none">Loading programs…</p>}
      {programs && (<>
        <div className="controls">
          <Toggle label="Show" options={LISTS} value={list} onChange={setList} counts={listCounts} />
          <Toggle label="Kind" options={KINDS} value={kind} onChange={setKind} counts={kindCounts} />
          <label className="search">
            <span className="visually-hidden">Search programs</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search programs, colleges or topics" />
          </label>
        </div>
        <Section title="Sustainability-focused programs" programs={focused}
          intro="Majors, minors, degrees and certificates centered on sustainability, the environment, climate or energy." />
        <Section title="Programs with strong sustainability coursework" programs={related}
          intro="Programs in other fields that require several sustainability courses." />
        {!focused.length && !related.length && (
          <p className="none">
            No programs match.{' '}
            <button type="button" className="link-button" onClick={() => { setQ(''); setKind('all'); setList('all') }}>Show all programs</button>
          </p>
        )}
        <p className="foot">
          Looking for individual courses? See every sustainability course in the{' '}
          <a href="../curriculum/?view=courses">curriculum map</a>, or find faculty working on sustainability on the{' '}
          <a href="../">faculty map</a>.
        </p>
      </>)}
    </main>
  )
}
