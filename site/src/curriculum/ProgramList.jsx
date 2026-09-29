import { STANDING, standing } from './data.js'

const score = (p) => p.required.length * 3 + p.options.length

// Every program as a row: dark squares for required sustainability courses, light ones for options
export default function ProgramList({ programs, sort, onSort, selectedId, onSelect }) {
  const sorted = [...programs].sort((a, b) =>
    (sort === 'fewest' ? score(a) - score(b) : score(b) - score(a)) || a.name.localeCompare(b.name))

  if (programs.length === 0) {
    return <p className="empty">No programs match these filters. Try another level, kind of program or campus.</p>
  }

  return (
    <section className="program-list" aria-labelledby="program-list-title">
      <div className="list-heading">
        <h2 id="program-list-title">Programs</h2>
        <label className="sort">
          Sort by
          <select value={sort} onChange={(e) => onSort(e.target.value)}>
            <option value="most">Most sustainability first</option>
            <option value="fewest">Least sustainability first</option>
          </select>
        </label>
      </div>
      <ul>
        {sorted.map((p) => {
          const s = standing(p)
          return (
            <li key={p.id}>
              <button type="button" className={`program-row${p.id === selectedId ? ' selected' : ''}`} onClick={() => onSelect(p.id)}>
                <span className="program-name">
                  {p.baseName}
                  <span className="program-meta">{p.college}{p.campus && p.campus !== 'Boston' ? `, ${p.campus}` : ''}</span>
                </span>
                <span className="program-counts" aria-label={`${p.required.length} required, ${p.options.length} options`}>
                  {s === 'none' ? (
                    <span className="none-note">{STANDING.none.short}</span>
                  ) : (
                    <>
                      <span className="squares" aria-hidden="true">
                        {p.required.slice(0, 20).map((c) => <span key={c} className="square required" />)}
                        {p.options.slice(0, Math.max(0, 30 - Math.min(20, p.required.length))).map((c) => <span key={c} className="square option" />)}
                      </span>
                      <span className="count-text">
                        {p.required.length > 0 && `${p.required.length} required`}
                        {p.required.length > 0 && p.options.length > 0 && ', '}
                        {p.options.length > 0 && `${p.options.length} ${p.options.length === 1 ? 'option' : 'options'}`}
                      </span>
                    </>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
