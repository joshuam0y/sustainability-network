import { CourseLine } from './CourseItems.jsx'
import { problemLink } from './data.js'

// A program's sustainability report card
export default function ProgramPanel({ program, programs, courseByCode, history, contact, onSelectCourse, onClose }) {
  const listed = new Set([...program.required, ...program.options])

  // Sustainability courses that similar programs (same college and kind) point students to, but this one doesn't
  const peers = programs.filter((p) => p.college === program.college && p.type === program.type && p.baseName !== program.baseName)
  const counts = new Map()
  for (const p of peers) for (const code of [...p.required, ...p.options]) if (!listed.has(code)) counts.set(code, (counts.get(code) ?? 0) + 1)
  const ideas = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <aside className="detail" aria-label={`${program.name} details`}>
      <button type="button" className="close" onClick={onClose} aria-label="Close details">×</button>
      <p className="detail-category">{program.type}{program.campus ? `, ${program.campus}` : ''}</p>
      <h2>{program.baseName}</h2>
      <p className="detail-lede">{program.college}</p>
      <p className="profile-link"><a href={program.url} target="_blank" rel="noreferrer">See the requirements in the catalog</a></p>

      {program.completion && (
        <p className="completion">
          <strong>{Math.round(program.completion.rate * 100)}%</strong> of its graduates took at least one sustainability
          course ({program.completion.graduates.toLocaleString()} graduates, {program.completion.year}).
        </p>
      )}
      {history?.programs?.[program.id] && (
        <p className="panel-note">
          Changed over time:{' '}
          {history.programs[program.id].map((h) => `${h.month}: ${h.required} required, ${h.options} options`).join('; ')}.
        </p>
      )}

      <h3>Required sustainability courses ({program.required.length})</h3>
      {program.required.length > 0
        ? <ul className="course-lines">{program.required.map((c) => <CourseLine key={c} code={c} course={courseByCode.get(c)} onSelect={onSelectCourse} />)}</ul>
        : <p className="panel-note">None. Students can finish this program without taking a sustainability course.</p>}

      <h3>Sustainability courses students can choose ({program.options.length})</h3>
      {program.options.length > 0
        ? <ul className="course-lines">{program.options.map((c) => <CourseLine key={c} code={c} course={courseByCode.get(c)} onSelect={onSelectCourse} />)}</ul>
        : <p className="panel-note">None are named in its elective lists.</p>}

      {program.inRanges.length > 0 && (
        <p className="panel-note">
          {program.inRanges.length} more sustainability {program.inRanges.length === 1 ? 'course falls' : 'courses fall'} inside
          broad course ranges the program allows (like “any course numbered 2000 to 4999”).
        </p>
      )}

      {ideas.length > 0 && (
        <>
          <h3>Used by similar programs</h3>
          <p className="panel-note">Sustainability courses other {program.type.toLowerCase()} programs in this college list, and this one doesn’t.</p>
          <ul className="course-lines">
            {ideas.map(([code, n]) => (
              <CourseLine key={code} code={code} course={courseByCode.get(code)} onSelect={onSelectCourse}
                note={`${n} ${n === 1 ? 'program' : 'programs'}`} />
            ))}
          </ul>
        </>
      )}
      <p className="sources">
        Counts only courses the program’s requirements name. Open electives aren’t counted.{' '}
        <a href={problemLink(contact, program.name)} target="_blank" rel="noreferrer">Report a problem with this program</a>
      </p>
    </aside>
  )
}
