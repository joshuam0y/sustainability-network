// Switch between the faculty map and the curriculum map, keeping the chosen theme (and staying inside an embed)
export default function SiteSwitch({ current, theme, embed }) {
  const query = (params) => {
    const q = new URLSearchParams(params)
    if (theme) q.set('theme', theme)
    if (embed) q.set('embed', '1')
    const s = q.toString()
    return s ? `?${s}` : ''
  }
  const links = [
    { key: 'faculty', label: 'Faculty', href: `../${query({})}` },
    { key: 'courses', label: 'Courses & majors', href: `curriculum/${query({ view: 'courses' })}` },
  ]
  return (
    <nav className="site-switch" aria-label="Sustainability maps">
      {links.map((l) => (l.key === current
        ? <span key={l.key} aria-current="page">{l.label}</span>
        : <a key={l.key} href={l.href} title={theme ? `${l.label} on ${theme}` : undefined}>{l.label}</a>))}
    </nav>
  )
}
