// How the people around a theme are spread over rings. Kept separate so scripts/check-layout.mjs
// can confirm no two people's dots ever overlap, whatever the number of people.
export const DOT = 4.6
export const DOT_SPACING = 13
export const RING_GAP = 15
export const INNER = 150

// Positions are rounded up to a multiple of the ring count, so the first and last person never land
// next to each other on the same ring where the circle closes
export function ringPlacement(count) {
  const rings = Math.max(1, Math.ceil((count * DOT_SPACING) / (Math.PI * 2 * (INNER + RING_GAP))))
  return { rings, positions: Math.ceil(count / rings) * rings }
}

export function dotPosition(i, count, offset = 0) {
  const { rings, positions } = ringPlacement(count)
  const angle = -Math.PI / 2 + offset + (i / positions) * Math.PI * 2
  const r = INNER + (i % rings) * RING_GAP
  return { angle, x: Math.cos(angle) * r, y: Math.sin(angle) * r }
}
