import { useState } from 'react'
import { STRENGTH } from '../colors.js'
import BarRows from './charts/BarRows.jsx'
import LineChart from './charts/LineChart.jsx'

const FOCUS_SERIES = [
  { key: 'focused', label: 'Focused on sustainability', color: STRENGTH.strong },
  { key: 'inclusive', label: 'Include sustainability', color: STRENGTH.medium },
]

// Shares here are small, so bars are scaled to the largest one (rounded up to the next 5%)
const scaleFor = (rows) => Math.min(1, Math.ceil(Math.max(...rows.map((r) => (r.focused + r.inclusive) / r.total), 0.05) * 20) / 20)

const toRow = (key, label, d) => ({ key, label, focused: d.focused, inclusive: d.inclusive, total: d.courses })

// Charlie's Sustainability Overview dashboard, rebuilt: university, college, department and trends
export default function OverviewView({ overview, college, onSelectCollege }) {
  const [allDepartments, setAllDepartments] = useState(false)
  const u = overview.university
  const pct = (n, d) => `${((n / d) * 100).toFixed(1)}%`

  const departments = overview.departments.filter((d) => !college || d.college === college)
  const shownDepartments = allDepartments || college ? departments : departments.slice(0, 15)

  const collegeRows = overview.colleges.map((c) => toRow(c.college, c.college, c))
  const departmentRows = shownDepartments.map((d) => toRow(`${d.college}|${d.department}`, d.department, d))

  const years = [...new Set(overview.trends.map((t) => t.academic_year))].sort()
  const sumYear = (year, key) => overview.trends
    .filter((t) => t.academic_year === year && (!college || t.college === college))
    .reduce((n, t) => n + t[key], 0)
  const coursesPoints = years.map((y) => ({ x: y, y: sumYear(y, 'sustainability_courses') }))
  const seatPoints = years.map((y) => ({ x: y, y: (sumYear(y, 'sustainability_seats') / Math.max(1, sumYear(y, 'seats'))) * 100 }))

  return (
    <div className="overview-view">
      <section aria-labelledby="university-title">
        <h2 id="university-title" className="section-title">Across the university, {overview.year}</h2>
        <dl className="stat-tiles">
          <div><dt>Sustainability courses offered</dt><dd>{u.sustainability.toLocaleString()}</dd><p>of {u.courses.toLocaleString()} courses ({pct(u.sustainability, u.courses)})</p></div>
          <div><dt>Focused on sustainability</dt><dd>{u.focused}</dd><p>sustainability is the main subject</p></div>
          <div><dt>Include sustainability</dt><dd>{u.inclusive}</dd><p>sustainability is one part of the course</p></div>
          <div><dt>Undergraduate / graduate</dt><dd>{overview.byLevel.Undergraduate.sustainability} / {overview.byLevel.Graduate.sustainability}</dd><p>sustainability courses at each level</p></div>
        </dl>
      </section>

      <section aria-labelledby="college-title">
        <h2 id="college-title" className="section-title">Share of each college’s courses that are sustainability courses</h2>
        <p className="section-note">Choose a college to see its departments and trend below.</p>
        <BarRows caption="Sustainability courses by college" label="College" valueLabel="Courses offered" series={FOCUS_SERIES}
          rows={collegeRows} scale={scaleFor(collegeRows)}
          activeKey={college} onSelect={(key) => onSelectCollege(key === college ? '' : key)} />
      </section>

      <section aria-labelledby="trend-title">
        <h2 id="trend-title" className="section-title">Trends{college ? `: ${college}` : ''}</h2>
        <div className="trend-grid">
          <LineChart title="Sustainability courses offered each year" points={coursesPoints} color={STRENGTH.strong} />
          <LineChart title="Share of all course seats in sustainability courses" points={seatPoints} color={STRENGTH.strong}
            format={(v) => `${v.toFixed(1)}%`} />
        </div>
        <p className="section-note">
          From the Registrar’s course records, {years[0]} to {years.at(-1)}. Courses are marked using the 2023–24 review, so
          courses that stopped running before then aren’t counted and early years may be slightly low.
        </p>
      </section>

      <section aria-labelledby="dept-title">
        <h2 id="dept-title" className="section-title">
          {college ? `Departments in ${college}` : 'Departments with the highest share of sustainability courses'}
        </h2>
        <BarRows caption="Sustainability courses by department" label="Department" valueLabel="Courses offered" series={FOCUS_SERIES}
          rows={departmentRows} scale={scaleFor(departmentRows)} />
        {!college && departments.length > 15 && (
          <button type="button" className="text-button" onClick={() => setAllDepartments(!allDepartments)}>
            {allDepartments ? 'Show the top 15' : `Show all ${departments.length} departments`}
          </button>
        )}
      </section>
    </div>
  )
}
