import { CATEGORY_COLORS } from '../colors.js'
import { facultyMapLink } from './data.js'

const THEME_CATEGORY = {
  'Human Thriving': 'Values', Ethics: 'Values', Justice: 'Values', 'Preservation for Future Generations': 'Values',
  Equity: 'Values', 'Physical Well-being': 'Values', 'Systems Thinking': 'Skills', 'Life-cycle Thinking': 'Skills',
  'Future Thinking': 'Skills', 'Interpersonal Competency': 'Skills', 'Strategic Thinking': 'Skills',
}

export function ThemeTags({ themes }) {
  if (!themes.length) return null
  return (
    <ul className="theme-tags" aria-label="Themes">
      {themes.map((t) => <li key={t} style={{ '--swatch': CATEGORY_COLORS[THEME_CATEGORY[t] ?? 'Content'] }}>{t}</li>)}
    </ul>
  )
}

export function Instructors({ instructors }) {
  if (!instructors.length) return null
  return (
    <p className="instructors">
      Taught by{' '}
      {instructors.map((p, i) => (
        <span key={p.id}>
          {i > 0 && (i === instructors.length - 1 ? ' and ' : ', ')}
          <a href={facultyMapLink(p.id)}>{p.name}</a>
        </span>
      ))}
    </p>
  )
}

// A clickable line for a course inside a list
export function CourseLine({ course, code, onSelect, note }) {
  if (!course) return <li className="course-line"><span className="code">{code}</span></li>
  return (
    <li className="course-line">
      <button type="button" onClick={() => onSelect(course.code)}>
        <span className="code">{course.code}</span> {course.title}
        {course.label === 'model' && <span className="suggested">suggested</span>}
        {note && <span className="line-note">{note}</span>}
      </button>
    </li>
  )
}

// A clickable line for a program inside a list
export function ProgramLine({ program, onSelect }) {
  return (
    <li className="course-line">
      <button type="button" onClick={() => onSelect(program.id)}>
        {program.baseName}{program.campus && program.campus !== 'Boston' ? ` (${program.campus})` : ''}
      </button>
    </li>
  )
}
