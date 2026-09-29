import { useEffect, useMemo, useState } from 'react'
import { THEME_DESCRIPTIONS } from '../themeInfo.js'

const DATA = `${import.meta.env.BASE_URL}../data/curriculum/`
const STORAGE_KEY = 'sustainability-course-review'
const REPO = 'https://github.com/joshuam0y/sustainability-network'

const DECISIONS = [
  { value: 'focused', label: 'Focused on sustainability', hint: 'Sustainability is the main subject' },
  { value: 'inclusive', label: 'Includes sustainability', hint: 'Sustainability is one part of it' },
  { value: 'no', label: 'Not a sustainability course', hint: 'Remove it' },
]

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? { reviewer: '', decisions: {} }
  } catch {
    return { reviewer: '', decisions: {} }
  }
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Private windows can block storage; decisions still work until the tab closes
  }
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

// A page for the sustainability team to confirm or correct which courses count, one course at a time.
// Decisions stay in this browser until downloaded and uploaded to the repository.
export default function ReviewApp() {
  const [courses, setCourses] = useState(null)
  const [existing, setExisting] = useState([])
  const [error, setError] = useState(null)
  const [state, setState] = useState(loadSaved)
  const [filter, setFilter] = useState('suggested')

  useEffect(() => {
    Promise.all(['courses', 'reviews'].map((n) => fetch(`${DATA}${n}.json`).then((r) => {
      if (!r.ok) throw new Error(`Couldn't load ${n}.json`)
      return r.json()
    }))).then(([c, r]) => { setCourses(c); setExisting(r) }).catch((e) => setError(e.message))
  }, [])

  useEffect(() => save(state), [state])

  const reviewedBefore = useMemo(() => new Map(existing.map((r) => [r.code, r])), [existing])
  const decide = (code, decision) => setState((s) => ({
    ...s, decisions: { ...s.decisions, [code]: { decision, date: new Date().toISOString().slice(0, 10), note: s.decisions[code]?.note ?? '' } },
  }))
  const note = (code, text) => setState((s) => ({
    ...s, decisions: { ...s.decisions, [code]: { ...(s.decisions[code] ?? {}), note: text } },
  }))
  const undo = (code) => setState((s) => {
    const next = { ...s.decisions }
    delete next[code]
    return { ...s, decisions: next }
  })

  if (error) return <p className="status">{error}</p>
  if (!courses) return <p className="status">Loading courses…</p>

  const needsReview = (c) => !reviewedBefore.has(c.code) && (c.label === 'model' || !c.focusReviewed)
  const shown = courses.filter((c) =>
    filter === 'suggested' ? c.label === 'model' && !reviewedBefore.has(c.code)
      : filter === 'unreviewed' ? needsReview(c)
        : filter === 'mine' ? state.decisions[c.code]
          : true)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0) || a.code.localeCompare(b.code))
  const mine = Object.entries(state.decisions).filter(([, d]) => d.decision)

  const download = () => {
    const rows = new Map(existing.map((r) => [r.code, r]))
    for (const [code, d] of mine) rows.set(code, { code, decision: d.decision, note: d.note, reviewed_by: state.reviewer, date: d.date })
    const lines = [['code', 'decision', 'note', 'reviewed_by', 'date'],
      ...[...rows.values()].sort((a, b) => a.code.localeCompare(b.code)).map((r) => [r.code, r.decision, r.note, r.reviewed_by, r.date])]
    const url = URL.createObjectURL(new Blob([lines.map((l) => l.map(csvCell).join(',')).join('\n') + '\n'], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'course_reviews.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="review-app">
      <header className="review-header">
        <h1>Review sustainability courses</h1>
        <p>
          For the sustainability team. Decide whether each course belongs on the curriculum map and whether it is focused on
          sustainability or only includes it. Your decisions stay in this browser until you download them.
        </p>
        <div className="review-controls">
          <label className="field">
            <span className="field-label">Your name</span>
            <input value={state.reviewer} onChange={(e) => setState({ ...state, reviewer: e.target.value })} placeholder="So others know who decided" />
          </label>
          <label className="field">
            <span className="field-label">Show</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="suggested">Suggested by the model, not yet checked</option>
              <option value="unreviewed">Everything not yet checked</option>
              <option value="mine">My decisions</option>
              <option value="all">All {courses.length} sustainability courses</option>
            </select>
          </label>
        </div>
      </header>

      <section className="finish" aria-labelledby="finish-title">
        <h2 id="finish-title">{mine.length} {mine.length === 1 ? 'decision' : 'decisions'} so far</h2>
        <ol>
          <li><button type="button" className="button" disabled={!mine.length} onClick={download}>Download course_reviews.csv</button></li>
          <li>
            Open <a href={`${REPO}/upload/main/data/base`} target="_blank" rel="noreferrer">the upload page on GitHub</a>,
            drag the file in, and choose <strong>Commit changes</strong>. It replaces the old file and keeps earlier decisions.
          </li>
          <li>Both sites update within a few minutes. Then you can clear this browser’s copy.</li>
        </ol>
        {mine.length > 0 && (
          <button type="button" className="text-button" onClick={() => {
            if (window.confirm('Clear the decisions saved in this browser? Download them first if you haven’t.')) setState({ ...state, decisions: {} })
          }}>Clear this browser’s decisions</button>
        )}
      </section>

      <ul className="review-list">
        {shown.length === 0 && <li className="empty">Nothing here. Choose another option under Show.</li>}
        {shown.map((c) => {
          const mineNow = state.decisions[c.code]
          const before = reviewedBefore.get(c.code)
          return (
            <li key={c.code} className={`review-card${mineNow?.decision ? ' decided' : ''}`}>
              <h3><span className="code">{c.code}</span> {c.title}</h3>
              <p className="course-meta">
                {c.department ?? c.college}.{' '}
                {c.label === 'model'
                  ? `Suggested by the model (${Math.round(c.confidence * 100)}% sure).`
                  : 'On the 2023–24 reviewed list.'}{' '}
                Currently counted as {c.focus === 'focused' ? 'focused' : 'including sustainability'}
                {c.focusReviewed ? '' : ' (estimated from the title)'}.
                {before && ` Decided earlier by ${before.reviewed_by || 'the team'}: ${before.decision}.`}
              </p>
              <p className="course-description">{c.description}</p>
              <div className="decision-buttons" role="group" aria-label={`Decision for ${c.code}`}>
                {DECISIONS.map((d) => (
                  <button key={d.value} type="button" className={`decision${mineNow?.decision === d.value ? ' chosen' : ''}`}
                    aria-pressed={mineNow?.decision === d.value} onClick={() => decide(c.code, d.value)}>
                    <span>{d.label}</span><small>{d.hint}</small>
                  </button>
                ))}
              </div>
              {mineNow?.decision && (
                <div className="decision-extra">
                  <label className="field">
                    <span className="field-label">Note (optional)</span>
                    <input value={mineNow.note ?? ''} onChange={(e) => note(c.code, e.target.value)} placeholder="Why, if it isn’t obvious" />
                  </label>
                  <button type="button" className="text-button" onClick={() => undo(c.code)}>Undo</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <section className="theme-check" aria-labelledby="themes-title">
        <h2 id="themes-title">Check the theme descriptions</h2>
        <p>
          These one-line descriptions appear on the faculty map. If one is wrong, change it in{' '}
          <a href={`${REPO}/edit/main/site/src/themeInfo.js`} target="_blank" rel="noreferrer">themeInfo.js on GitHub</a>.
        </p>
        <dl>
          {Object.entries(THEME_DESCRIPTIONS).map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
        </dl>
      </section>
    </div>
  )
}
