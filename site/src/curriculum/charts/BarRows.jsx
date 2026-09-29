import { useState } from 'react'
import { useTooltip } from './Tooltip.jsx'

// Horizontal stacked bars, one row per item. `series` is [{key, label, color}] from strongest to weakest;
// each row's segments are shares of `row.total`. Rows are buttons when `onSelect` is given.
// `scale` (0-1) stretches small shares: with scale 0.2 a full bar means 20%, and the scale is labeled under the chart.
export default function BarRows({ rows, series, label, valueLabel, onSelect, activeKey, caption, scale = 1 }) {
  const { show, hide, node } = useTooltip()
  const [asTable, setAsTable] = useState(false)
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)

  return (
    <div className="chart">
      <div className="chart-header">
        <ul className="chart-key" aria-label="Key">
          {series.map((s) => <li key={s.key}><span className="key-swatch" style={{ background: s.color }} />{s.label}</li>)}
        </ul>
        <button type="button" className="text-button table-toggle" onClick={() => setAsTable(!asTable)} aria-pressed={asTable}>
          {asTable ? 'Show as chart' : 'Show as table'}
        </button>
      </div>

      {asTable ? (
        <table className="data-table">
          <caption className="visually-hidden">{caption}</caption>
          <thead><tr><th scope="col">{label}</th>{series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}<th scope="col">{valueLabel}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                {series.map((s) => <td key={s.key}>{r[s.key]} ({pct(r[s.key], r.total)}%)</td>)}
                <td>{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ol className="bar-rows chart-frame" onMouseLeave={hide}>
          {rows.map((r) => {
            const share = series.reduce((n, s) => n + r[s.key], 0)
            const Row = onSelect ? 'button' : 'div'
            return (
              <li key={r.key}>
                <Row className={`bar-row${activeKey === r.key ? ' active' : ''}`} type={onSelect ? 'button' : undefined}
                  aria-pressed={onSelect ? activeKey === r.key : undefined}
                  aria-label={`${r.label}: ${series.map((s) => `${r[s.key]} ${s.label.toLowerCase()}`).join(', ')}, out of ${r.total}.`}
                  onClick={onSelect ? () => onSelect(r.key) : undefined}>
                  <span className="bar-label">{r.label}</span>
                  <span className="bar-track">
                    {series.map((s) => r[s.key] > 0 && (
                      <span key={s.key} className="bar-segment" style={{ width: `${(r[s.key] / r.total / scale) * 100}%`, background: s.color }}
                        onMouseMove={(e) => show(e, <><strong>{r.label}</strong><br />{s.label}: {r[s.key]} of {r.total} ({pct(r[s.key], r.total)}%)</>)} />
                    ))}
                  </span>
                  <span className="bar-value">{pct(share, r.total)}%</span>
                </Row>
              </li>
            )
          })}
          {node}
          {scale < 1 && (
            <li className="bar-scale" aria-hidden="true">
              <span /><span className="bar-scale-axis"><span>0%</span><span>{Math.round(scale * 100)}% of {valueLabel.toLowerCase()}</span></span><span />
            </li>
          )}
        </ol>
      )}
    </div>
  )
}
