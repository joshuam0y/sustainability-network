import { useState } from 'react'

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="copy-field">
      <label>
        <span className="field-label">{label}</span>
        <textarea readOnly value={value} rows={value.length > 160 ? 5 : 2} onFocus={(e) => e.target.select()} />
      </label>
      <button type="button" className="button" onClick={() => {
        navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
      }}>{copied ? 'Copied' : 'Copy'}</button>
    </div>
  )
}

// Link and embed code for exactly what's on screen, filters included
export default function SharePanel({ query, embedQuery, onClose, title = 'Sustainability Faculty Network' }) {
  const base = window.location.origin + window.location.pathname
  const link = base + query
  const iframe = `<iframe src="${base + embedQuery}" title="${title}" width="100%" height="720" style="border:0" loading="lazy"></iframe>`

  return (
    <div className="share" role="dialog" aria-label="Share or embed this view">
      <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
      <h2>Share this view</h2>
      <p>The link keeps your current theme and filters.</p>
      <CopyField label="Link" value={link} />
      <h2 className="share-embed">Put it on another website</h2>
      <p>Paste this code into any web page (for example a Northeastern department site) to show this view there.</p>
      <CopyField label="Embed code" value={iframe} />
    </div>
  )
}
