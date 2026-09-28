import { CATEGORY_COLORS, profileLink } from './data.js'
import { THEME_DESCRIPTIONS } from './themeInfo.js'

function sourceText(sources) {
  const names = {
    'Faculty Insight': 'Faculty Insight profiles',
    'Teaching Staff': 'courses they teach',
    'Staff Websites': 'their Northeastern web page',
    DRS: 'research records',
    'Published research': 'published research',
  }
  const list = sources.map((s) => names[s] ?? s)
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0]
}

export default function DetailPanel({ item, visibleFaculty, themes, onSelect, onOpenTheme, onClose }) {
  if (!item) return null
  const themeCategory = new Map(themes.map((t) => [t.name, t.category]))

  if (item.kind === 'theme') {
    const people = visibleFaculty.filter((p) => p.themes.includes(item.name))
      .sort((a, b) => a.name.split(' ').at(-1).localeCompare(b.name.split(' ').at(-1)))
    return (
      <aside className="detail" aria-label={`${item.name} details`}>
        <button type="button" className="close" onClick={onClose} aria-label="Close details">×</button>
        <p className="detail-category" style={{ '--swatch': CATEGORY_COLORS[item.category] }}>{item.category}</p>
        <h2>{item.name}</h2>
        <p className="detail-lede">{THEME_DESCRIPTIONS[item.name]}</p>
        <h3>{people.length} {people.length === 1 ? 'person' : 'people'}</h3>
        <ul className="people">
          {people.map((p) => (
            <li key={p.id}>
              <button type="button" className="person-link" onClick={() => onSelect(p.id)}>
                <span>{p.name}</span>
                {p.college && <span className="person-college">{p.college}</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    )
  }

  return (
    <aside className="detail" aria-label={`${item.name} details`}>
      <button type="button" className="close" onClick={onClose} aria-label="Close details">×</button>
      <h2 className="person-name">{item.name}</h2>
      {item.addedFromResearch
        ? <p className="detail-lede">Northeastern researcher, added from their published research.</p>
        : <p className="detail-lede">{[item.position, item.college].filter(Boolean).join(', ')}</p>}
      <dl className="facts">
        {item.location && (<><dt>Campus</dt><dd>{item.location}</dd></>)}
        {item.newHire && (<><dt>Joined</dt><dd>In the last 3 years</dd></>)}
        {item.email && (<><dt>Email</dt><dd><a href={`mailto:${item.email}`}>{item.email}</a></dd></>)}
      </dl>
      <p className="profile-link"><a href={profileLink(item)} target="_blank" rel="noreferrer">
        {item.profileUrl ? 'See their research profile' : `Search the web for ${item.name}`}
      </a></p>

      <h3>Themes</h3>
      <ul className="theme-list">
        {item.themes.map((t) => (
          <li key={t} style={{ '--swatch': CATEGORY_COLORS[themeCategory.get(t)] }}>
            <button type="button" className="text-button" onClick={() => onOpenTheme(t)}>{t}</button>
          </li>
        ))}
      </ul>

      {item.papers?.length > 0 && (
        <>
          <h3>Recent sustainability research</h3>
          <ul className="papers">
            {item.papers.map((p) => (
              <li key={p.url}>
                <a href={p.url} target="_blank" rel="noreferrer">{p.title}</a>
                <span className="paper-year">{p.year}</span>
              </li>
            ))}
          </ul>
          {item.paperCount > item.papers.length && (
            <p className="more-papers">Plus {item.paperCount - item.papers.length} more in the last 5 years.</p>
          )}
        </>
      )}

      {item.topics?.length > 0 && (
        <>
          <h3>Topics</h3>
          <p className="topics">{item.topics.join(', ')}</p>
        </>
      )}
      <p className="sources">Found through {sourceText(item.sources)}.</p>
    </aside>
  )
}
