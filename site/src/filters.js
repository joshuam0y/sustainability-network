// Filter state, the logic that turns it into the visible part of the network, and URL syncing

export const emptyFilters = {
  search: '',
  theme: '',
  positions: [],
  colleges: [],
  locations: [],
  newHireOnly: false,
  minThemes: 1,
  backedOnly: false,
}

export function hasActiveFilters(f) {
  return f.search.trim() !== '' || f.theme !== '' || f.positions.length > 0 || f.colleges.length > 0
    || f.locations.length > 0 || f.newHireOnly || f.minThemes > 1 || f.backedOnly
}

const inList = (list, value) => list.length === 0 || list.includes(value)

// Everything except the theme, so theme views can show how many people match per theme
export function filterPeople(faculty, f, { ignoreTheme = false } = {}) {
  const query = f.search.trim().toLowerCase()
  return faculty.filter((p) =>
    (query === '' || p.name.toLowerCase().includes(query))
    && inList(f.positions, p.position ?? 'Researcher')
    && inList(f.colleges, p.college ?? 'Not listed')
    && inList(f.locations, p.location ?? 'Not listed')
    && (!f.newHireOnly || p.newHire)
    && p.themes.length >= f.minThemes
    && (ignoreTheme || f.theme === '' || p.themes.includes(f.theme)))
}

export function applyFilters({ themes, faculty, links }, f) {
  // "Only backed connections": keep connections supported by papers or courses, and judge each person
  // (theme filter, number of themes) by those alone
  let people = faculty
  let usable = links
  if (f.backedOnly) {
    usable = links.filter((l) => l.backed)
    const themeName = new Map(themes.map((t) => [t.id, t.name]))
    const backedThemes = new Map()
    for (const l of usable) backedThemes.set(l.target, [...(backedThemes.get(l.target) ?? []), themeName.get(l.source)])
    people = faculty.filter((p) => backedThemes.has(p.id)).map((p) => ({ ...p, themes: backedThemes.get(p.id).sort() }))
  }
  const visibleFaculty = filterPeople(people, f)
  const ids = new Set(visibleFaculty.map((p) => p.id))
  return finish(themes, visibleFaculty, usable.filter((l) => ids.has(l.target)))
}

function finish(themes, faculty, links) {
  const linked = new Set(links.map((l) => l.source))
  return { themes: themes.filter((t) => linked.has(t.id)), faculty, links }
}

// Option lists with counts, for the filter checkboxes
export function optionCounts(faculty, key, fallback) {
  const counts = new Map()
  for (const p of faculty) {
    const value = p[key] ?? fallback
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }))
}

// ---- URL <-> state, so filtered views can be shared and embedded

const LIST_KEYS = { positions: 'role', colleges: 'college', locations: 'campus' }
export const VIEWS = ['themes', 'everyone', 'list']

export function readUrl(search = window.location.search) {
  const params = new URLSearchParams(search)
  const filters = { ...emptyFilters }
  filters.search = params.get('q') ?? ''
  filters.theme = params.get('theme') ?? ''
  for (const [key, param] of Object.entries(LIST_KEYS)) filters[key] = params.getAll(param)
  filters.newHireOnly = params.get('new') === '1'
  filters.minThemes = Math.max(1, Number(params.get('min')) || 1)
  filters.backedOnly = params.get('backed') === '1'
  const view = VIEWS.includes(params.get('view')) ? params.get('view') : 'themes'
  return { filters, view, embed: params.get('embed') === '1', person: params.get('person') }
}

export function toQuery({ filters, view, embed, person }) {
  const params = new URLSearchParams()
  if (view !== 'themes') params.set('view', view)
  if (filters.theme) params.set('theme', filters.theme)
  if (filters.search.trim()) params.set('q', filters.search.trim())
  for (const [key, param] of Object.entries(LIST_KEYS)) filters[key].forEach((v) => params.append(param, v))
  if (filters.newHireOnly) params.set('new', '1')
  if (filters.minThemes > 1) params.set('min', String(filters.minThemes))
  if (filters.backedOnly) params.set('backed', '1')
  if (person) params.set('person', person)
  if (embed) params.set('embed', '1')
  const query = params.toString()
  return query ? `?${query}` : ''
}
