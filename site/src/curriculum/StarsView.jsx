import { useEffect, useState } from 'react'

// Numbers for the AASHE STARS report (Academics), with draft method text to copy
export default function StarsView({ stars, meta }) {
  const [research, setResearch] = useState(null)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}../data/faculty_nodes.json`).then((r) => r.json()).then(setResearch).catch(() => setResearch([]))
  }, [])

  const ug = stars.undergraduate
  const gr = stars.graduate
  const byCollege = research ? countBy(research.filter((p) => p.college), (p) => p.college) : []
  const withPapers = research ? research.filter((p) => p.paperCount).length : 0

  const courseText = `A full list of courses offered in the ${stars.year} academic year was compiled from the Office of the University Registrar. `
    + 'Northeastern’s sustainability team labeled a subset of courses as sustainability-related or not, trained a language model on those labels to label the remaining courses, '
    + 'and then re-verified every course by hand with the faculty who taught it. Courses are counted once, at the level of their course number '
    + '(numbers below 5000 are undergraduate). Courses whose titles are about sustainability are counted as sustainability-focused and the rest as sustainability-inclusive'
    + (stars.focusReviewed ? `; ${stars.focusReviewed} of these were confirmed by hand.` : '; this split has not yet been confirmed by hand.')
  const researchText = 'Researchers were identified from Faculty Insight profiles, faculty web pages, research records and course listings, cross-referenced with a human resources report, '
    + `and supplemented with recent publications indexed by OpenAlex that address sustainability topics (updated ${meta?.researchUpdated ?? 'monthly'}).`

  const rows = [
    ['Undergraduate courses offered', ug.courses], ['Undergraduate sustainability courses', ug.sustainability],
    ['  focused', ug.focused], ['  inclusive', ug.inclusive],
    ['Graduate courses offered', gr.courses], ['Graduate sustainability courses', gr.sustainability],
    ['  focused', gr.focused], ['  inclusive', gr.inclusive],
    ['Academic departments offering courses', stars.departments],
    ['Departments offering at least one sustainability course', stars.departmentsWithSustainability],
    ['Degree programs (undergraduate) requiring a sustainability course', `${stars.programs.Undergraduate.requiring} of ${stars.programs.Undergraduate.total}`],
    ['Degree programs (graduate) requiring a sustainability course', `${stars.programs.Graduate.requiring} of ${stars.programs.Graduate.total}`],
  ]

  const csv = () => {
    const lines = [['Measure', 'Value'], ...rows.map(([k, v]) => [k.trim(), v]),
      ...byCollege.map(([c, n]) => [`Sustainability researchers: ${c}`, n])]
    const url = URL.createObjectURL(new Blob([lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = `stars_academics_${stars.year}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="stars-view">
      <h2 className="section-title">STARS report numbers, {stars.year}</h2>
      <p className="section-note">
        For the Academics section of AASHE STARS (Academic Courses, and Research and Scholarship). These update when the
        course review or the research data changes. Check them against STARS’ current definitions before submitting.
      </p>
      <button type="button" className="button" onClick={csv}>Download as CSV</button>

      {stars.reported && <Reported reported={stars.reported} stars={stars} />}

      <h3 className="subsection">Academic courses</h3>
      <table className="data-table stars-table">
        <tbody>{rows.map(([k, v]) => <tr key={k}><th scope="row" className={k.startsWith('  ') ? 'indent' : ''}>{k.trim()}</th><td>{typeof v === 'number' ? v.toLocaleString() : v}</td></tr>)}</tbody>
      </table>
      <CopyBlock title="Draft: how sustainability courses were identified" text={courseText} />

      <h3 className="subsection">Research and scholarship</h3>
      {research ? (
        <>
          <table className="data-table stars-table">
            <tbody>
              <tr><th scope="row">People on the faculty map</th><td>{research.length}</td></tr>
              <tr><th scope="row">With recent sustainability publications</th><td>{withPapers}</td></tr>
              {byCollege.map(([c, n]) => <tr key={c}><th scope="row" className="indent">{c}</th><td>{n}</td></tr>)}
            </tbody>
          </table>
          <p className="section-note">
            STARS asks for researchers by department. The faculty map records college, not department, so department
            counts still need the HR report.
          </p>
        </>
      ) : <p className="section-note">Loading research numbers…</p>}
      <CopyBlock title="Draft: how sustainability research was identified" text={researchText} />
    </div>
  )
}

function countBy(items, key) {
  const m = new Map()
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

function CopyBlock({ title, text }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="copy-block">
      <div className="copy-block-head">
        <h4>{title}</h4>
        <button type="button" className="text-button" onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p>{text}</p>
    </div>
  )
}

const pct = (n, d) => `${((100 * n) / d).toFixed(1)}%`

// What Northeastern submitted in its latest STARS report, next to what this site counts from the catalog
function Reported({ reported, stars }) {
  const r = reported
  const rows = [
    {
      measure: 'Departments with a sustainability course',
      report: `${r.departmentsWithSustainability} of ${r.departments} (${pct(r.departmentsWithSustainability, r.departments)})`,
      site: `${stars.departmentsWithSustainability} of ${stars.departments} (${pct(stars.departmentsWithSustainability, stars.departments)})`,
      why: 'The report groups interdisciplinary units into one “non-traditional department” and leaves out practice-only departments. This site counts every department that owns a course in the catalog.',
    },
    {
      measure: 'Departments engaged in sustainability research',
      report: `${r.researchDepartmentsEngaged} of ${r.researchDepartments} (${pct(r.researchDepartmentsEngaged, r.researchDepartments)})`,
      site: '—',
      why: 'The faculty map records each person’s college, not their department, so it can’t count departments yet.',
    },
    ...['Undergraduate', 'Graduate'].map((level) => {
      const q = r.qualifications[level]
      return {
        measure: `${level} degrees awarded with a sustainability requirement (${q.year})`,
        report: `${(q.focused + q.requirement).toLocaleString()} of ${q.awarded.toLocaleString()} (${pct(q.focused + q.requirement, q.awarded)})`,
        site: `${stars.programs[level].requiring} of ${stars.programs[level].total} programs require a sustainability course`,
        why: 'STARS counts graduates, which needs Registrar data. The catalog shows which programs could count, so it can help find more qualifying programs.',
      }
    }),
  ]
  return (
    <section className="stars-reported" aria-labelledby="reported-title">
      <h3 id="reported-title" className="subsection">Compared with the 2026 STARS submission</h3>
      <p className="section-note">
        From {r.source}: {r.rating}, {r.score} points.{' '}
        {Object.entries(r.areas).map(([area, [got, of]]) => `${area} ${got} of ${of}`).join(', ')}.
        The course list in the report is from {r.courseYear}.
      </p>
      <table className="data-table stars-table">
        <thead><tr><th scope="col">Measure</th><th scope="col">2026 report</th><th scope="col">This site</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.measure}>
              <th scope="row">{row.measure}<span className="row-note">{row.why}</span></th>
              <td>{row.report}</td>
              <td>{row.site}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details className="stars-credits">
        <summary>Academics points by credit</summary>
        <table className="data-table stars-table">
          <tbody>{r.credits.map(([name, got, of]) => <tr key={name}><th scope="row">{name}</th><td>{got} of {of}</td></tr>)}</tbody>
        </table>
      </details>
    </section>
  )
}
