import { CATEGORY_ORDER } from './data.js'
import { emptyFilters, hasActiveFilters, optionCounts } from './filters.js'

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function CheckboxGroup({ title, options, selected, onChange }) {
  return (
    <details className="group" open={selected.length > 0 || undefined}>
      <summary>
        {title}
        {selected.length > 0 && <span className="group-count">{selected.length} chosen</span>}
      </summary>
      <ul className="options">
        {options.map(({ value, count }) => (
          <li key={value}>
            <label>
              <input type="checkbox" checked={selected.includes(value)} onChange={() => onChange(toggle(selected, value))} />
              <span className="option-name">{value}</span>
              <span className="option-count">{count}</span>
            </label>
          </li>
        ))}
      </ul>
    </details>
  )
}

export default function FilterRail({ network, filters, setFilters, shownCount }) {
  const set = (key) => (value) => setFilters({ ...filters, [key]: value })
  const maxThemes = Math.min(8, Math.max(...network.faculty.map((p) => p.themes.length)))

  return (
    <div className="filters">
      <label className="field">
        <span className="field-label">Find a person</span>
        <input type="search" placeholder="Type a name" value={filters.search}
          onChange={(e) => set('search')(e.target.value)} />
      </label>

      <label className="field">
        <span className="field-label">Theme</span>
        <select value={filters.theme} onChange={(e) => set('theme')(e.target.value)}>
          <option value="">All themes</option>
          {CATEGORY_ORDER.map((category) => (
            <optgroup key={category} label={category}>
              {network.themes.filter((t) => t.category === category).map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="groups">
        <CheckboxGroup title="College" options={optionCounts(network.faculty, 'college', 'Not listed')}
          selected={filters.colleges} onChange={set('colleges')} />
        <CheckboxGroup title="Role" options={optionCounts(network.faculty, 'position', 'Researcher')}
          selected={filters.positions} onChange={set('positions')} />
        <CheckboxGroup title="Campus" options={optionCounts(network.faculty, 'location', 'Not listed')}
          selected={filters.locations} onChange={set('locations')} />
      </div>

      <label className="toggle">
        <input type="checkbox" checked={filters.newHireOnly} onChange={(e) => set('newHireOnly')(e.target.checked)} />
        Only people who joined in the last 3 years
      </label>

      <label className="field">
        <span className="field-label">
          {filters.minThemes === 1 ? 'Works on any number of themes' : `Works on ${filters.minThemes} or more themes`}
        </span>
        <input type="range" min="1" max={maxThemes} value={filters.minThemes}
          onChange={(e) => set('minThemes')(Number(e.target.value))} />
      </label>

      <div className="filter-footer">
        <p aria-live="polite">Showing {shownCount} of {network.faculty.length} people</p>
        {hasActiveFilters(filters) && (
          <button type="button" className="text-button" onClick={() => setFilters(emptyFilters)}>Clear all</button>
        )}
      </div>
    </div>
  )
}
