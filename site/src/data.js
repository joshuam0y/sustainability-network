// Loads the network data built by pipeline/build_data.py

const files = ['nodes_keywords', 'faculty_nodes', 'links', 'meta']

export async function loadNetwork() {
  const [themes, faculty, links, meta] = await Promise.all(
    files.map(async (name) => {
      const res = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`)
      if (!res.ok) throw new Error(`Couldn't load data/${name}.json (${res.status})`)
      return res.json()
    }),
  )
  return { themes, faculty, links, meta }
}

export { CATEGORY_COLORS } from './colors.js'

export const CATEGORY_ORDER = ['Values', 'Content', 'Skills']

export function profileLink(person) {
  return person.profileUrl ?? `https://www.google.com/search?q=${encodeURIComponent(person.name + ' Northeastern')}`
}

export function formatDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
