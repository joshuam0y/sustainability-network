import { Instructors, ProgramLine, ThemeTags } from './CourseItems.jsx'
import { problemLink } from './data.js'

export default function CoursePanel({ course, programById, contact, onSelectProgram, onClose }) {
  const programs = course.programs.map((id) => programById.get(id)).filter(Boolean)
    .sort((a, b) => a.baseName.localeCompare(b.baseName))
  const required = programs.filter((p) => p.required.includes(course.code))
  const options = programs.filter((p) => !p.required.includes(course.code))

  return (
    <aside className="detail" aria-label={`${course.code} details`}>
      <button type="button" className="close" onClick={onClose} aria-label="Close details">×</button>
      <p className="detail-category">{course.code}, {course.hours} {course.hours === '1' ? 'credit' : 'credits'}</p>
      <h2>{course.title}</h2>
      <p className="detail-lede">{course.department ?? course.college}</p>
      <p className="focus-note">
        {course.focusReviewed
          ? (course.focus === 'focused' ? 'Focused on sustainability' : 'Includes sustainability')
          : <>Not yet designated <span>(the title suggests {course.focus === 'focused' ? 'focused' : 'includes'}).{' '}
            <a href="../review/?show=unreviewed">Designate it</a></span></>}
      </p>
      {course.label === 'model' && (
        <p className="panel-note">
          Suggested: this course is newer than the sustainability team’s review, so a model trained on their choices
          picked it ({Math.round(course.confidence * 100)}% sure). It hasn’t been checked by a person yet.
        </p>
      )}
      <ThemeTags themes={course.themes} />
      <p className="course-description">{course.description}</p>
      <Instructors instructors={course.instructors} />

      <h3>Required by {required.length} {required.length === 1 ? 'program' : 'programs'}</h3>
      {required.length > 0 ? <ul className="course-lines">{required.map((p) => <ProgramLine key={p.id} program={p} onSelect={onSelectProgram} />)}</ul> : <p className="panel-note">No program requires it.</p>}
      <h3>An option in {options.length} {options.length === 1 ? 'program' : 'programs'}</h3>
      {options.length > 0 ? <ul className="course-lines">{options.map((p) => <ProgramLine key={p.id} program={p} onSelect={onSelectProgram} />)}</ul> : <p className="panel-note">No program lists it as an option.</p>}
    <p className="sources">
        <a href={problemLink(contact, `${course.code} ${course.title}`)} target="_blank" rel="noreferrer">Report a problem with this course</a>
      </p>
    </aside>
  )
}
