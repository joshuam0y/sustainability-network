import { STANDING, standing } from './data.js'

const ORDER = ['required', 'option', 'none']

// One bar per college: what share of its programs require, offer or name no sustainability course
export default function CollegeChart({ programs, activeCollege, onSelectCollege }) {
  const colleges = new Map()
  for (const p of programs) {
    if (!colleges.has(p.college)) colleges.set(p.college, { required: 0, option: 0, none: 0, total: 0 })
    const c = colleges.get(p.college)
    c[standing(p)] += 1
    c.total += 1
  }
  const rows = [...colleges.entries()]
    .filter(([, c]) => c.total >= 2)
    .sort((a, b) => (b[1].required + b[1].option / 2) / b[1].total - (a[1].required + a[1].option / 2) / a[1].total)
  const totals = { required: 0, option: 0, none: 0, total: programs.length }
  for (const p of programs) totals[standing(p)] += 1

  if (programs.length === 0) return null
  const pct = (n, d) => Math.round((n / d) * 100)

  return (
    <section className="college-chart" aria-labelledby="college-chart-title">
      <h2 id="college-chart-title">
        {pct(totals.required, totals.total)}% of these programs require a sustainability course.{' '}
        {pct(totals.none, totals.total)}% don’t name one at all.
      </h2>
      <ul className="chart-key" aria-label="Key">
        {ORDER.map((s) => <li key={s}><span className={`key-swatch ${s}`} />{STANDING[s].label}</li>)}
      </ul>
      <ol className="college-rows">
        {rows.map(([college, c]) => (
          <li key={college}>
            <button type="button" className={`college-row${activeCollege === college ? ' active' : ''}`}
              aria-pressed={activeCollege === college}
              aria-label={`${college}: ${c.required} of ${c.total} programs require a sustainability course, ${c.option} offer one as an option, ${c.none} name none. Show only this college.`}
              onClick={() => onSelectCollege(activeCollege === college ? '' : college)}>
              <span className="college-name">{college}</span>
              <span className="bar" aria-hidden="true">
                {ORDER.map((s) => c[s] > 0 && (
                  <span key={s} className={`segment ${s}`} style={{ flexGrow: c[s] }}>
                    {c[s] / c.total >= 0.12 && pct(c[s], c.total) + '%'}
                  </span>
                ))}
              </span>
              <span className="college-total">{c.total}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
