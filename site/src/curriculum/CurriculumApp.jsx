import { useEffect, useMemo, useState } from 'react'
import { formatDate } from '../data.js'
import SharePanel from '../SharePanel.jsx'
import { loadCurriculum, PROGRAM_TYPES } from './data.js'
import CollegeChart from './CollegeChart.jsx'
import ProgramList from './ProgramList.jsx'
import ProgramPanel from './ProgramPanel.jsx'
import CourseList from './CourseList.jsx'
import CoursePanel from './CoursePanel.jsx'
import OverviewView from './OverviewView.jsx'
import StarsView from './StarsView.jsx'

const VIEWS = { majors: 'Programs', courses: 'Courses', overview: 'Overview', stars: 'STARS report' }

const DEFAULTS = {
  view: 'majors', q: '', level: 'Undergraduate', type: "Bachelor's", campus: 'Boston', college: '', theme: '', sort: 'most',
  major: '', focus: '',
}
const KEYS = Object.keys(DEFAULTS)

function readUrl() {
  const params = new URLSearchParams(window.location.search)
  const state = { ...DEFAULTS }
  for (const key of KEYS) if (params.has(key)) state[key] = params.get(key)
  return { state, program: params.get('program'), course: params.get('course'), embed: params.get('embed') === '1' }
}

function toQuery(state, selection, embed) {
  const params = new URLSearchParams()
  for (const key of KEYS) if (state[key] !== DEFAULTS[key]) params.set(key, state[key])
  if (selection?.kind === 'program') params.set('program', selection.id)
  if (selection?.kind === 'course') params.set('course', selection.id)
  if (embed) params.set('embed', '1')
  const query = params.toString()
  return query ? `?${query}` : ''
}

const initial = readUrl()

function Select({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(({ value: v, label: l }) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

// Type a program name; the filter applies once it matches one from the list
function MajorInput({ names, value, onChange }) {
  const [text, setText] = useState(value)
  return (
    <label className="field">
      <span className="field-label">Counts toward this program</span>
      <input list="major-names" value={text} placeholder="Type your major"
        onChange={(e) => {
          setText(e.target.value)
          if (!e.target.value || names.includes(e.target.value)) onChange(e.target.value)
        }} />
      <datalist id="major-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
    </label>
  )
}

const byCount = (items) => {
  const counts = new Map()
  for (const item of items) if (item) counts.set(item, (counts.get(item) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value)
}

export default function CurriculumApp() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [state, setState] = useState(initial.state)
  const [selection, setSelection] = useState(
    initial.program ? { kind: 'program', id: initial.program } : initial.course ? { kind: 'course', id: initial.course } : null)
  const [shareOpen, setShareOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const embed = initial.embed || (() => { try { return window.self !== window.top } catch { return true } })()
  const set = (key) => (value) => { setState({ ...state, [key]: value }); setSelection(null) }

  useEffect(() => {
    loadCurriculum().then(setData).catch((e) => setError(e.message))
  }, [])

  const fullQuery = toQuery(state, selection, embed)
  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname + fullQuery)
  }, [fullQuery])

  const derived = useMemo(() => {
    if (!data) return null
    const programById = new Map(data.programs.map((p) => [p.id, p]))
    const courseByCode = new Map(data.courses.map((c) => [c.code, c]))
    const query = state.q.trim().toLowerCase()

    // Programs matching everything except the college, so the chart can compare colleges
    const programsAllColleges = data.programs.filter((p) =>
      (!state.level || p.level === state.level)
      && (!state.type || p.type === state.type)
      && (!state.campus || (p.campus ?? 'Boston') === state.campus)
      && (!query || p.name.toLowerCase().includes(query)))
    const programs = programsAllColleges.filter((p) => !state.college || p.college === state.college)

    // "Counts toward my major": every program with that name, on any campus
    const majorIds = state.major ? new Set(data.programs.filter((p) => p.baseName === state.major).map((p) => p.id)) : null
    const courses = data.courses.filter((c) =>
      (!majorIds || c.programs.some((id) => majorIds.has(id)))
      && (!state.focus || c.focus === state.focus)
      && (!state.college || c.college === state.college)
      && (!state.theme || c.themes.includes(state.theme))
      && (!query || `${c.code} ${c.title} ${c.description}`.toLowerCase().includes(query))
      && (!state.level || (state.level === 'Graduate') === (Number(c.code.split(' ')[1]) >= 5000)))
    const majorNames = [...new Set(data.programs.filter((p) => !state.level || p.level === state.level).map((p) => p.baseName))].sort()

    return {
      programById, courseByCode, programsAllColleges, programs, courses,
      colleges: byCount(data.programs.map((p) => p.college)),
      campuses: byCount(data.programs.map((p) => p.campus ?? 'Boston')),
      themes: byCount(data.courses.flatMap((c) => c.themes)),
      majorNames,
    }
  }, [data, state])

  if (error) return <p className="status">The curriculum map couldn’t load its data: {error}</p>
  if (!data) return <p className="status">Loading the curriculum…</p>

  const { programById, courseByCode, programsAllColleges, programs, courses } = derived
  const selected = selection?.kind === 'program' ? programById.get(selection.id)
    : selection?.kind === 'course' ? courseByCode.get(selection.id) : null
  const openProgram = (id) => { setSelection({ kind: 'program', id }); setShareOpen(false) }
  const openCourse = (code) => { setSelection({ kind: 'course', id: code }); setShareOpen(false) }
  const isMajors = state.view === 'majors'
  const isCourses = state.view === 'courses'
  const isReport = state.view === 'overview' || state.view === 'stars'

  return (
    <div className={embed ? 'app embed curriculum' : 'app curriculum'}>
      <header className="rail">
        <h1>How much sustainability is in each major?</h1>
        {!embed && (
          <p className="intro">
            Every Northeastern program’s requirements, checked against {data.meta.sustainabilityCourses} sustainability
            courses in the catalog. Pick a program to see which sustainability courses it requires or lets students choose.
          </p>
        )}
        <div className="filters">
          {!isReport && (<>
          <label className="field">
            <span className="field-label">{isMajors ? 'Find a program' : 'Find a course'}</span>
            <input type="search" value={state.q} placeholder={isMajors ? 'Type a major or degree' : 'Type a course name or code'}
              onChange={(e) => set('q')(e.target.value)} />
          </label>
          </>)}
          <button type="button" className="button filters-button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
            {filtersOpen ? 'Hide filters' : 'Filters'}
          </button>
          <div className={filtersOpen ? 'phone-filters open' : 'phone-filters'}>
          {!isReport && (<>
          <Select label="Level" value={state.level} onChange={set('level')}
            options={[{ value: 'Undergraduate', label: 'Undergraduate' }, { value: 'Graduate', label: 'Graduate' }, { value: '', label: 'Both' }]} />
          </>)}
          {isMajors && (
            <>
              <Select label="Kind of program" value={state.type} onChange={set('type')}
                options={[...PROGRAM_TYPES.map((t) => ({ value: t, label: t === "Bachelor's" ? "Bachelor's (majors)" : t })), { value: '', label: 'All kinds' }]} />
              <Select label="Campus" value={state.campus} onChange={set('campus')}
                options={[...derived.campuses.map((c) => ({ value: c, label: c })), { value: '', label: 'All campuses' }]} />
            </>
          )}
          <Select label="College" value={state.college} onChange={set('college')}
            options={[{ value: '', label: 'All colleges' }, ...derived.colleges.map((c) => ({ value: c, label: c }))]} />
          {isCourses && (
            <>
              <MajorInput names={derived.majorNames} value={state.major} onChange={set('major')} />
              <Select label="Theme" value={state.theme} onChange={set('theme')}
                options={[{ value: '', label: 'All themes' }, ...derived.themes.map((t) => ({ value: t, label: t }))]} />
              <Select label="How much sustainability" value={state.focus} onChange={set('focus')}
                options={[{ value: '', label: 'Any' }, { value: 'focused', label: 'Focused on sustainability' }, { value: 'inclusive', label: 'Includes sustainability' }]} />
            </>
          )}
          </div>
          {!isReport && (
            <p className="filter-footer" aria-live="polite">
              {isMajors ? `Showing ${programs.length} programs` : `Showing ${courses.length} of ${data.courses.length} sustainability courses`}
            </p>
          )}
        </div>
        {embed ? (
          <p className="rail-note"><a href={window.location.pathname + toQuery(state, selection, false)} target="_blank" rel="noreferrer">Open the full curriculum map</a></p>
        ) : (
          <>
            <p className="rail-note"><a href="../">See who works on sustainability: the faculty map</a></p>
            <details className="about">
              <summary>How this is worked out</summary>
              <p>
                Program requirements and course descriptions come from the public
                <a href="https://catalog.northeastern.edu" target="_blank" rel="noreferrer"> Northeastern academic catalog</a>,
                last read {formatDate(data.meta.catalogUpdated)}.
              </p>
              <p>
                {data.meta.reviewed} sustainability courses were identified and reviewed with faculty by Northeastern’s
                sustainability team for the 2023–24 catalog. They include courses focused on sustainability and courses that
                include it. {data.meta.model} newer courses were suggested by a model trained on those reviews and are
                marked “suggested”.
              </p>
              <p>
                A course is “required” when every student in the program takes it, and an “option” when it appears on a list
                students choose from. Students can often take other courses as open electives, which isn’t counted here.
              </p>
            </details>
          </>
        )}
      </header>

      <main className="stage">
        <div className="toolbar">
          <div className="view-switch" role="tablist" aria-label="View">
            {Object.entries(VIEWS).map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={state.view === key} onClick={() => set('view')(key)}>{label}</button>
            ))}
          </div>
          <button type="button" className="button share-button" onClick={() => setShareOpen(!shareOpen)} aria-expanded={shareOpen}>
            Share or embed
          </button>
        </div>

        <div className="scroll-area">
          {isMajors ? (
            <>
              <CollegeChart programs={programsAllColleges} activeCollege={state.college} onSelectCollege={set('college')} />
              <ProgramList programs={programs} sort={state.sort} onSort={set('sort')} selectedId={selection?.id} onSelect={openProgram} />
            </>
          ) : isCourses ? (
            <CourseList courses={courses} selectedCode={selection?.id} onSelect={openCourse} />
          ) : state.view === 'overview' ? (
            <OverviewView overview={data.overview} college={state.college} onSelectCollege={set('college')} />
          ) : (
            <StarsView stars={data.stars} meta={data.meta} />
          )}
        </div>

        {shareOpen && (
          <SharePanel title="Sustainability in the Curriculum" query={toQuery(state, selection, false)}
            embedQuery={toQuery(state, selection, true)} onClose={() => setShareOpen(false)} />
        )}
        {!shareOpen && selection?.kind === 'program' && selected && (
          <ProgramPanel program={selected} programs={data.programs} courseByCode={courseByCode} history={data.history}
            contact={data.meta.contact}
            onSelectCourse={openCourse} onClose={() => setSelection(null)} />
        )}
        {!shareOpen && selection?.kind === 'course' && selected && (
          <CoursePanel course={selected} programById={programById} onSelectProgram={openProgram} onClose={() => setSelection(null)}
            contact={data.meta.contact} />
        )}
      </main>
    </div>
  )
}
