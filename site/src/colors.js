// Every color the map uses. Change a value here and every view (and the CSS) follows.

export const CATEGORY_COLORS = {
  Values: '#B5446E',
  Content: '#1F6F8B',
  Skills: '#B07A12',
}

export const COLORS = {
  ink: '#16302B', // text and outlines
  inkSoft: '#4B5F5A', // secondary text
  inkHover: '#24463F', // dark buttons on hover
  mist: '#EEF2F0', // map background
  paper: '#F8FAF9', // side panels
  line: '#C9D4D0', // dividers and borders
  person: '#5F6F6A', // people dots
  link: CATEGORY_COLORS.Content, // links and keyboard focus
}

// Expose the same values to the CSS as variables (--ink, --values, ...)
export function applyColorVariables(root = document.documentElement) {
  const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
  for (const [name, value] of Object.entries(COLORS)) root.style.setProperty(`--${kebab(name)}`, value)
  for (const [name, value] of Object.entries(CATEGORY_COLORS)) root.style.setProperty(`--${name.toLowerCase()}`, value)
}
