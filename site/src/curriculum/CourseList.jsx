import { Instructors, ThemeTags } from './CourseItems.jsx'

function Designation({ course }) {
  if (course.focusReviewed) {
    return <span className={`designation ${course.focus}`}>{course.focus === 'focused' ? 'Focused' : 'Includes sustainability'}</span>
  }
  return (
    <span className="designation undesignated" title="Estimated from the course title until someone designates it">
      Not yet designated <small>(title suggests {course.focus === 'focused' ? 'focused' : 'includes'})</small>
    </span>
  )
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

function download(courses) {
  const header = ['code', 'title', 'college', 'department', 'designation', 'title_suggests', 'suggested_by_model', 'programs_it_counts_toward', 'description']
  const rows = courses.map((c) => [c.code, c.title, c.college, c.department,
    c.focusReviewed ? c.focus : 'not yet designated', c.focusReviewed ? '' : c.focus,
    c.label === 'model' ? 'yes' : 'no', c.programs.length, c.description])
  const url = URL.createObjectURL(new Blob([[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n'], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'sustainability_courses.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function CourseList({ courses, selectedCode, onSelect, designation }) {
  if (courses.length === 0) {
    return <p className="empty">No sustainability courses match these filters. Try another theme, college or level.</p>
  }
  const sorted = [...courses].sort((a, b) => b.programs.length - a.programs.length || a.code.localeCompare(b.code))
  const undesignated = courses.filter((c) => !c.focusReviewed).length

  return (
    <section className="course-list" aria-label="Sustainability courses">
      <div className="course-list-actions">
        <button type="button" className="button" onClick={() => download(sorted)}>Download these {sorted.length} as a spreadsheet</button>
        {undesignated > 0 && (
          <p>
            {designation === 'undesignated' ? `These ${undesignated} courses` : `${undesignated} of these courses`} haven’t been designated
            focused or inclusive yet. <a href="../review/?show=unreviewed">Designate them on the review page</a>.
          </p>
        )}
      </div>
      <ul>
        {sorted.map((c) => (
          <li key={c.code} className={`course-card${c.code === selectedCode ? ' selected' : ''}`}>
            <button type="button" className="course-title" onClick={() => onSelect(c.code)}>
              <span className="code">{c.code}</span>
              <span>{c.title}</span>
              {c.label === 'model' && <span className="suggested">suggested</span>}
            </button>
            <p className="course-meta"><Designation course={c} /> {c.department ?? c.college}</p>
            {c.programs.length > 0 && (
              <p className="course-meta">Counts toward {c.programs.length} {c.programs.length === 1 ? 'program' : 'programs'}</p>
            )}
            <p className="course-summary">{c.description}</p>
            <ThemeTags themes={c.themes} />
            <Instructors instructors={c.instructors} />
          </li>
        ))}
      </ul>
    </section>
  )
}
