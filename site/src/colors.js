// Every color the map uses. Change a value here and every view (and the CSS) follows.

// Checked with a colorblind-safety validator: every pair stays distinguishable for red-green and blue-yellow
// color blindness. Change them together and re-check.
export const CATEGORY_COLORS = {
  Values: '#B5446E',
  Content: '#2A7FBF',
  Skills: '#B07A12',
}

// For ordered categories (requires > offers options > names none; focused > includes): one hue, dark to light
export const STRENGTH = {
  strong: '#1C4E78',
  medium: '#5B9BD0',
  weak: '#C9DCEC',
}

export const COLORS = {
  ink: '#16302B', // text and outlines
  inkSoft: '#4B5F5A', // secondary text
  inkHover: '#24463F', // dark buttons on hover
  mist: '#EEF2F0', // map background
  paper: '#F8FAF9', // side panels
  line: '#C9D4D0', // dividers and borders
  person: '#5F6F6A', // people dots
  link: '#1F6F8B', // links and keyboard focus (darker than the Content theme so text stays readable)
}

// Expose the same values to the CSS as variables (--ink, --values, ...)
export function applyColorVariables(root = document.documentElement) {
  const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
  for (const [name, value] of Object.entries(COLORS)) root.style.setProperty(`--${kebab(name)}`, value)
  for (const [name, value] of Object.entries(CATEGORY_COLORS)) root.style.setProperty(`--${name.toLowerCase()}`, value)
  for (const [name, value] of Object.entries(STRENGTH)) root.style.setProperty(`--strength-${name}`, value)
}
