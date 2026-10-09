import { useEffect, useMemo, useState } from 'react'

// A list of Northeastern's sustainability programs, like a university sustainability office's "Academic
// Programs" page. Built from the same catalog data as the curriculum map (pipeline/curriculum/build_curriculum.py
// decides which list each program goes in; data/base/program_directory.csv overrides it).

const DATA = `${import.meta.env.BASE_URL}../data/curriculum/`

// Groups on the page, in order
const GROUPS = [
  { key: 'majors', title: 'Undergraduate majors', test: (p) => p.level === 'Undergraduate' && p.type === "Bachelor's" },
  { key: 'minors', title: 'Undergraduate minors', test: (p) => p.level === 'Undergraduate' && p.type === 'Minor' },
  { key: 'graduate', title: "Graduate degrees (master's and PhD)", test: (p) => p.level === 'Graduate' && (p.type === "Master's" || p.type === 'Doctorate') },
  { key: 'certificates', title: 'Graduate certificates', test: (p) => p.level === 'Graduate' && p.type === 'Certificate' },
  { key: 'other', title: 'Other programs', test: () => true },
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

export default function ProgramsApp() {
  const [programs, setPrograms] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    fetch(`${DATA}programs.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Couldn't load the program list (${res.status})`))))
      .then(setPrograms)
      .catch((e) => setError(e.message))
  }, [])

  const { focused, related } = useMemo(() => {
    const all = mergeCampuses((programs ?? []).filter((p) => p.list === 'focused' || p.list === 'related'))
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    const match = (p) => words.every((w) => `${p.baseName} ${p.college} ${p.description}`.toLowerCase().includes(w))
    const shown = all.filter(match)
    return { focused: shown.filter((p) => p.list === 'focused'), related: shown.filter((p) => p.list === 'related') }
  }, [programs, q])

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
        <label className="search">
          <span className="visually-hidden">Search programs</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search programs, colleges or topics" />
        </label>
      </header>
      {error && <p className="none">{error}</p>}
      {!programs && !error && <p className="none">Loading programs…</p>}
      {programs && (<>
        <Section title="Sustainability-focused programs" programs={focused}
          intro="Majors, minors, degrees and certificates centered on sustainability, the environment, climate or energy." />
        <Section title="Programs with strong sustainability coursework" programs={related}
          intro="Programs in other fields that require several sustainability courses." />
        {!focused.length && !related.length && <p className="none">No programs match your search.</p>}
        <p className="foot">
          Looking for individual courses? See every sustainability course in the{' '}
          <a href="../curriculum/?view=courses">curriculum map</a>, or find faculty working on sustainability on the{' '}
          <a href="../">faculty map</a>.
        </p>
      </>)}
    </main>
  )
}
