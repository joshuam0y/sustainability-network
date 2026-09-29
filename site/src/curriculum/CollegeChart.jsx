import { STRENGTH } from '../colors.js'
import BarRows from './charts/BarRows.jsx'
import { standing } from './data.js'

const SERIES = [
  { key: 'required', label: 'Requires a sustainability course', color: STRENGTH.strong },
  { key: 'option', label: 'Offers them as options only', color: STRENGTH.medium },
]

// One bar per college: share of its programs that require or offer sustainability courses.
// The empty part of each bar is programs that name none.
export default function CollegeChart({ programs, activeCollege, onSelectCollege }) {
  if (programs.length === 0) return null
  const colleges = new Map()
  for (const p of programs) {
    if (!colleges.has(p.college)) colleges.set(p.college, { key: p.college, label: p.college, required: 0, option: 0, none: 0, total: 0 })
    const c = colleges.get(p.college)
    c[standing(p)] += 1
    c.total += 1
  }
  const rows = [...colleges.values()].filter((c) => c.total >= 2)
    .sort((a, b) => (b.required + b.option / 2) / b.total - (a.required + a.option / 2) / a.total)
  const count = (s) => programs.filter((p) => standing(p) === s).length
  const pct = (n) => Math.round((n / programs.length) * 100)

  return (
    <section className="college-chart" aria-labelledby="college-chart-title">
      <h2 id="college-chart-title" className="section-title">
        {pct(count('required'))}% of these programs require a sustainability course. {pct(count('none'))}% don’t name one at all.
      </h2>
      <p className="section-note">The unfilled part of each bar is programs that name no sustainability course. Choose a college to list only its programs.</p>
      <BarRows caption="Programs by college" label="College" valueLabel="Programs" series={SERIES} rows={rows}
        activeKey={activeCollege} onSelect={(key) => onSelectCollege(activeCollege === key ? '' : key)} />
    </section>
  )
}
