import { Instructors, ThemeTags } from './CourseItems.jsx'

export default function CourseList({ courses, selectedCode, onSelect }) {
  if (courses.length === 0) {
    return <p className="empty">No sustainability courses match these filters. Try another theme, college or level.</p>
  }
  const sorted = [...courses].sort((a, b) => b.programs.length - a.programs.length || a.code.localeCompare(b.code))

  return (
    <section className="course-list" aria-label="Sustainability courses">
      <ul>
        {sorted.map((c) => (
          <li key={c.code} className={`course-card${c.code === selectedCode ? ' selected' : ''}`}>
            <button type="button" className="course-title" onClick={() => onSelect(c.code)}>
              <span className="code">{c.code}</span>
              <span>{c.title}</span>
              {c.label === 'model' && <span className="suggested">suggested</span>}
            </button>
            <p className="course-meta">{c.department ?? c.college}</p>
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
