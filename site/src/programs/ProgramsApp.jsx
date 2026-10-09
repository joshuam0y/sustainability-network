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

// The catalog description's first sentence (two if the first is very short)
function summary(text) {
  if (!text) return ''
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text]
  let out = ''
  for (const s of sentences) {
    if (out && (out.length > 90 || (out + s).length > 240)) break
    out += s
  }
  return out.trim()
}

// The catalog writes some names with a long dash ("MBA—Full-Time"); show a comma instead
const title = (name) => name.replace(/\s*—\s*/g, ', ')

const curriculumLink = (p) =>
  `../curriculum/?program=${encodeURIComponent(p.id)}&level=${encodeURIComponent(p.level)}&type=${encodeURIComponent(p.type)}&campus=${encodeURIComponent(p.campus)}`

function Program({ p }) {
  const where = [p.college, p.campuses.length > 1 || p.campuses[0] !== 'Boston' ? p.campuses.join(', ') : ''].filter(Boolean).join(', ')
  return (
    <li>
      <a className="program-name" href={p.url} target="_blank" rel="noopener">{title(p.baseName)}</a>
      {where && <span className="program-where"> ({where})</span>}
      {p.notice && <em className="program-notice"> {p.notice}</em>}
      <br />
      {summary(p.description)}{' '}
      <a className="program-courses" href={curriculumLink(p)}>Sustainability courses</a>
    </li>
  )
}

function ProgramList({ programs, grouped }) {
  const sorted = [...programs].sort((a, b) => a.baseName.localeCompare(b.baseName))
  if (!grouped) return <ul className="programs">{sorted.map((p) => <Program key={`${p.baseName}${p.type}${p.level}`} p={p} />)}</ul>
  return GROUPS.map((g) => {
    const items = sorted.filter((p) => GROUPS.find((x) => x.test(p)) === g)
    return items.length ? (
      <div key={g.key}>
        <h3>{g.title}</h3>
        <ul className="programs">{items.map((p) => <Program key={`${p.baseName}${p.type}${p.level}`} p={p} />)}</ul>
      </div>
    ) : null
  })
}

const TABS = [{ key: 'all', short: 'All programs' }, ...GROUPS.filter((g) => g.key !== 'other')]

// The chosen tab stays in the address (?kind=minors), so a link opens the same tab
const initialKind = TABS.some((t) => t.key === new URLSearchParams(window.location.search).get('kind'))
  ? new URLSearchParams(window.location.search).get('kind') : 'all'

export default function ProgramsApp() {
  const [programs, setPrograms] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [kind, setKind] = useState(initialKind)

  useEffect(() => {
    fetch(`${DATA}programs.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Couldn't load the program list (${res.status})`))))
      .then(setPrograms)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    window.history.replaceState(null, '', kind === 'all' ? window.location.pathname : `?kind=${kind}`)
  }, [kind])

  const all = useMemo(() => mergeCampuses((programs ?? []).filter((p) => p.list === 'focused' || p.list === 'related')), [programs])
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = all.filter((p) =>
    (kind === 'all' || GROUPS.find((g) => g.test(p)).key === kind) &&
    words.every((w) => `${p.baseName} ${p.college} ${p.description}`.toLowerCase().includes(w)))
  const focused = shown.filter((p) => p.list === 'focused')
  const related = shown.filter((p) => p.list === 'related')

  return (
    <main className="programs-page">
      <p className="crumbs"><a href="../">Sustainability Network</a> <span aria-hidden="true">›</span> Academic Programs</p>
      <h1>Academic Programs in Sustainability</h1>

      <p>
        Northeastern offers majors, minors, graduate degrees and certificates focused on sustainability, and many
        other programs include sustainability coursework. Program descriptions are from the{' '}
        <a href="https://catalog.northeastern.edu/" target="_blank" rel="noopener">Academic Catalog</a>.
      </p>

      <div className="tabs" role="group" aria-label="Kind of program">
        {TABS.map((t) => (
          <button key={t.key} type="button" aria-pressed={t.key === kind} onClick={() => setKind(t.key)}>{t.short}</button>
        ))}
      </div>

      <label className="search">
        <span className="visually-hidden">Search programs</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search programs" />
      </label>

      {error && <p>{error}</p>}
      {!programs && !error && <p>Loading programs…</p>}
      {programs && (<>
        {focused.length > 0 && (<>
          <h2>Sustainability-focused programs</h2>
          <ProgramList programs={focused} grouped={kind === 'all'} />
        </>)}
        {related.length > 0 && (<>
          <h2>Other programs that offer sustainability courses</h2>
          <p>These programs require several sustainability courses.</p>
          <ProgramList programs={related} grouped={kind === 'all'} />
        </>)}
        {!focused.length && !related.length && (
          <p>No programs match. <button type="button" className="link-button" onClick={() => { setQ(''); setKind('all') }}>Show all programs</button></p>
        )}
        <hr />
        <p className="foot">
          See every sustainability course on the <a href="../curriculum/?view=courses">curriculum map</a>, or find
          sustainability faculty on the <a href="../">faculty map</a>.
        </p>
      </>)}
    </main>
  )
}
