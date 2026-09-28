import { profileLink } from './data.js'

function toCsv(people) {
  const columns = ['name', 'position', 'college', 'location', 'email', 'themes', 'topics']
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = people.map((p) => columns.map((c) => escape(Array.isArray(p[c]) ? p[c].join('; ') : p[c])).join(','))
  return [columns.join(','), ...rows].join('\n')
}

function download(people) {
  const url = URL.createObjectURL(new Blob([toCsv(people)], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'sustainability_faculty.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function FacultyList({ people, onSelect }) {
  const sorted = [...people].sort((a, b) => a.name.split(' ').at(-1).localeCompare(b.name.split(' ').at(-1)))

  if (sorted.length === 0) {
    return <p className="empty">No one matches these filters. Try removing one, or choose Clear all.</p>
  }

  return (
    <div className="list">
      <div className="list-actions">
        <button type="button" className="button" onClick={() => download(sorted)}>Download {sorted.length} as CSV</button>
      </div>
      <table>
        <thead>
          <tr><th scope="col">Name</th><th scope="col">Position</th><th scope="col">College</th><th scope="col">Themes</th></tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id}>
              <td>
                <button type="button" className="text-button name-button" onClick={() => onSelect(p.id)}>{p.name}</button>
                <a className="row-link" href={profileLink(p)} target="_blank" rel="noreferrer" aria-label={`Profile for ${p.name}`}>Profile</a>
              </td>
              <td>{p.position ?? 'Researcher'}</td>
              <td>{p.college ?? 'Not listed'}</td>
              <td>{p.themes.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
