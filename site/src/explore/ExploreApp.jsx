import { useEffect, useRef, useState } from 'react'
import { THEME_DESCRIPTIONS } from '../themeInfo.js'
import { createRoom, SPOTS } from './room.js'

const DATA = `${import.meta.env.BASE_URL}../data/`
const INCUBATOR = 'https://sustainabilityincubator.sites.northeastern.edu'

// Ways to get involved, from the Sustainability Incubator's Student Pathway page
const INVOLVED = [
  { title: 'Cool Cities Design Sprint', text: 'Northeastern’s sustainability hackathon: design solutions for urban climate challenges and earn a digital badge.',
    url: `${INCUBATOR}/cool-cities-design-sprint/` },
  { title: 'Green Initiatives Board', text: 'Funding for undergraduate-driven projects that strengthen Northeastern’s commitment to sustainability.',
    url: `${INCUBATOR}/green-initiatives-board/` },
  { title: 'Sustainability Innovation Competition', text: 'Pitch an idea, in a short video, to make campus smarter and more sustainable.',
    url: 'https://sustainability.northeastern.edu/innovationweek/' },
  { title: 'Campus Interventions Course', text: 'Digital-badge modules on planning a hands-on campus sustainability project, with funding to carry it out.',
    url: 'https://sustainabilityincubator.northeastern.edu/sustainable-campus-leadership-program/' },
  { title: 'Propose your own project', text: 'Fill in the Expression of Interest form to talk through an idea, the resources it needs and whether it’s feasible.',
    url: 'https://forms.cloud.microsoft/r/VmJ9r4VuGJ' },
]

// Objects in the room that stand for one of the 20 themes
const THEME_SPOTS = { biosphere: 'Biosphere', waste: 'Waste', food: 'Sustainable Food Systems' }

// With the panel on the right, turn so the chosen thing sits in the open space to its left (phones use a bottom sheet)
const view = () => (window.innerWidth > 640 ? { shift: 0.3 } : { lift: 0.55, fov: 70 })

const LABELS = {
  people: 'The people',
  stars: 'STARS Gold',
  courses: 'The courses',
  campus: 'A living lab',
  involved: 'Get involved',
  trends: 'Course trends',
  biosphere: 'Biosphere',
  waste: 'Waste',
  food: 'Food systems',
}

// The tour order: around the room, starting at the screen
const ORDER = ['people', 'stars', 'courses', 'food', 'campus', 'waste', 'involved', 'trends', 'biosphere']

// Share of all course seats that were in sustainability courses, per academic year
function seatTrends(rows) {
  const byYear = new Map()
  for (const r of rows) {
    const y = byYear.get(r.academic_year) ?? { seats: 0, sustainability: 0 }
    y.seats += r.seats
    y.sustainability += r.sustainability_seats
    byYear.set(r.academic_year, y)
  }
  return [...byYear.entries()].sort().map(([year, y]) => ({ year, ...y, share: y.sustainability / y.seats }))
}

const pct = (x) => `${(x * 100).toFixed(1)}%`

function ThemeBody({ theme, data }) {
  const t = data.themes.find((x) => x.name === theme)
  const courses = data.courses.filter((c) => c.themes.includes(theme))
  // Confirmed and focused courses first, as the clearest examples
  const examples = [...courses].sort((a, b) => (b.label === 'reviewed') - (a.label === 'reviewed')
    || (b.focus === 'focused') - (a.focus === 'focused') || a.code.localeCompare(b.code)).slice(0, 4)
  return (
    <>
      <p className="lede">{THEME_DESCRIPTIONS[theme]}</p>
      <div className="stats">
        <div><strong>{t?.facultyCount ?? 0}</strong><span>people work on it</span></div>
        <div><strong>{courses.length}</strong><span>courses teach it</span></div>
      </div>
      {examples.length > 0 && (<>
        <h3>Courses to look at</h3>
        <ul className="ranked">
          {examples.map((c) => (
            <li key={c.code}><a href={`../curriculum/?view=courses&course=${encodeURIComponent(c.code)}`}>{c.title}</a><span>{c.code}</span></li>
          ))}
        </ul>
      </>)}
      <a className="pill" href={`../?theme=${encodeURIComponent(theme)}`}>See who works on it</a>
      <a className="text-link" href={`../curriculum/?view=courses&theme=${encodeURIComponent(theme)}`}>All {theme} courses</a>
    </>
  )
}

function Panel({ id, data, onClose, onNext }) {
  const { themes, meta, stars, curriculum, trends } = data
  const top = [...themes].sort((a, b) => b.facultyCount - a.facultyCount).slice(0, 5)
  const r = stars.reported
  const first = trends[0]
  const last = trends.at(-1)
  const maxShare = Math.max(...trends.map((t) => t.share))
  const body = THEME_SPOTS[id] ? <ThemeBody theme={THEME_SPOTS[id]} data={data} /> : {
    people: (
      <>
        <p className="lede">{meta.people} faculty, staff and researchers work on sustainability at Northeastern, across {themes.length} themes.</p>
        <h3>Most people work on</h3>
        <ul className="ranked">
          {top.map((t) => (
            <li key={t.id}><a href={`../?theme=${encodeURIComponent(t.name)}`}>{t.name}</a><span>{t.facultyCount}</span></li>
          ))}
        </ul>
        <a className="pill" href="../">Find someone to work with</a>
      </>
    ),
    stars: (
      <>
        <p className="lede">Northeastern earned a <strong>{r.rating}</strong> rating, {r.score} points, in its 2026 STARS report.</p>
        <p>STARS is how colleges measure and report their sustainability to AASHE, across academics, campus operations, engagement and planning. The rating is valid through May 21, 2029.</p>
        <a className="pill" href={r.url} target="_blank" rel="noreferrer">Read the report</a>
        <a className="text-link" href="../curriculum/?view=stars">See the academic numbers</a>
      </>
    ),
    courses: (
      <>
        <p className="lede">{curriculum.sustainabilityCourses} courses in the catalog are about sustainability or include it.</p>
        <p>{stars.programs.Undergraduate.requiring} of {stars.programs.Undergraduate.total} undergraduate programs require at least one of them.</p>
        <a className="pill" href="../curriculum/?view=courses">Find a course</a>
        <a className="text-link" href="../curriculum/">See what your major includes</a>
      </>
    ),
    campus: (
      <>
        <p className="lede">Northeastern uses its campus as a living lab: a place to test new ideas, technologies and approaches.</p>
        <blockquote>“For a university like Northeastern, with a strong emphasis on experiential learning, living lab student projects are a true
          complement to ongoing instruction.”<cite>Sustainability Incubator</cite></blockquote>
        <p>Students take part through classes and capstones, competitions, and their own projects.</p>
        <a className="pill" href="https://sustainabilityincubator.northeastern.edu/living-lab/student-pathway/" target="_blank" rel="noreferrer">Student Pathway</a>
        <a className="text-link" href={`${INCUBATOR}/existing-and-past-projects/`} target="_blank" rel="noreferrer">See past projects</a>
      </>
    ),
    involved: (
      <ul className="involved">
        {INVOLVED.map((item) => (
          <li key={item.title}>
            <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
            <p>{item.text}</p>
          </li>
        ))}
      </ul>
    ),
    trends: (
      <>
        <p className="lede">
          In {last.year}, {pct(last.share)} of all course seats were in sustainability courses,
          {last.share >= first.share ? ' up' : ' down'} from {pct(first.share)} in {first.year}.
        </p>
        <div className="bars" role="img" aria-label={trends.map((t) => `${t.year}: ${pct(t.share)}`).join(', ')}>
          {trends.map((t, i) => (
            <div key={t.year} className={i === trends.length - 1 ? 'bar latest' : 'bar'}>
              <span className="bar-value">{pct(t.share)}</span>
              <span className="bar-fill" style={{ height: `${(t.share / maxShare) * 100}%` }} />
              <span className="bar-year">{t.year}</span>
            </div>
          ))}
        </div>
        <p className="note">From Registrar course records: {last.sustainability.toLocaleString()} of {last.seats.toLocaleString()} seats in {last.year}.</p>
        <a className="pill" href="../curriculum/?view=overview">See the charts</a>
      </>
    ),
  }[id]
  return (
    <aside className="panel" aria-label={LABELS[id]}>
      <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
      <p className="kicker">{THEME_SPOTS[id] ? 'Theme' : 'Explore'}</p>
      <h2>{THEME_SPOTS[id] ?? LABELS[id]}</h2>
      {body}
      <div className="panel-foot">
        <span className="step">{ORDER.indexOf(id) + 1} of {ORDER.length}</span>
        <button type="button" className="next" onClick={onNext}>Next: {LABELS[ORDER[(ORDER.indexOf(id) + 1) % ORDER.length]]} →</button>
      </div>
    </aside>
  )
}

export default function ExploreApp() {
  const canvasRef = useRef(null)
  const roomRef = useRef(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(null)
  const [seen, setSeen] = useState(() => new Set())
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    const get = (path) => fetch(DATA + path).then((r) => {
      if (!r.ok) throw new Error(`Couldn’t load ${path}`)
      return r.json()
    })
    Promise.all([get('nodes_keywords.json'), get('meta.json'), get('curriculum/stars.json'), get('curriculum/meta.json'),
      get('curriculum/overview.json'), get('curriculum/courses.json'),
      document.fonts.load('900 40px Lato'), document.fonts.load('700 40px Lato'), document.fonts.load('400 40px Lato')])
      .then(([themes, meta, stars, curriculum, overview, courses]) =>
        setData({ themes, meta, stars, curriculum, courses, trends: seatTrends(overview.trends) }))
      .catch((e) => setError(e.message))
  }, [])

  const choose = (id) => {
    setOpen(id)
    setSeen((s) => new Set(s).add(id))
    roomRef.current?.lookAt(id, view())
  }

  useEffect(() => {
    if (!data || !canvasRef.current) return undefined
    const room = createRoom(canvasRef.current, {
      themes: data.themes, people: data.meta.people, courseCount: data.curriculum.sustainabilityCourses,
      score: data.stars.reported.score, involved: INVOLVED, trends: data.trends,
    })
    roomRef.current = room
    room.onPick(choose)
    room.onHover(setHovered)
    // A link can open the room on one thing, e.g. ?spot=waste
    const start = new URLSearchParams(window.location.search).get('spot')
    if (SPOTS[start]) setTimeout(() => choose(start), 400)
    for (const id of Object.keys(SPOTS)) room.setMarker(id, document.getElementById(`marker-${id}`))
    return () => room.dispose()
  }, [data])

  if (error) return <p className="status">{error}</p>
  const total = Object.keys(SPOTS).length

  return (
    <div className="explore">
      <canvas ref={canvasRef} className="room" aria-hidden="true" />
      {!data && <p className="status">Setting up the room…</p>}

      <header className="intro-card">
        <span className="bar" />
        <h1>Explore sustainability at Northeastern</h1>
        <p>Drag to look around. Click anything with a red marker.</p>
        <p className="found" aria-live="polite">
          <span className="found-track"><span style={{ width: `${(seen.size / total) * 100}%` }} /></span>
          {seen.size === total ? 'You found everything!' : `Found ${seen.size} of ${total}`}
        </p>
      </header>

      {data && Object.keys(SPOTS).map((id) => (
        <button key={id} id={`marker-${id}`} type="button"
          className={`marker${open === id ? ' active' : ''}${seen.has(id) ? ' seen' : ''}${hovered === id ? ' hover' : ''}`} onClick={() => choose(id)}>
          <span className="ring" /><span className="marker-label">{LABELS[id]}</span>
        </button>
      ))}

      <nav className="jump" aria-label="Things to explore">
        {ORDER.map((id) => (
          <button key={id} type="button" aria-pressed={open === id} onClick={() => choose(id)}>{LABELS[id]}</button>
        ))}
      </nav>

      {data && open && <Panel id={open} data={data} onClose={() => setOpen(null)} onNext={() => choose(ORDER[(ORDER.indexOf(open) + 1) % ORDER.length])} />}
    </div>
  )
}
