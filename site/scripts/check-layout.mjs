// Fails the build if any two people's dots would overlap in a theme view, for every possible group size
import { DOT, dotPosition, ringPlacement } from '../src/ringLayout.js'

const MAX_PEOPLE = 1500
let worst = { gap: Infinity, count: 0 }
for (let count = 2; count <= MAX_PEOPLE; count++) {
  const dots = Array.from({ length: count }, (_, i) => dotPosition(i, count))
  // Only nearby dots can touch, so compare each dot with the next few, wrapping around where the circle closes
  const reach = Math.min(count - 1, 3 * ringPlacement(count).rings)
  for (let i = 0; i < count; i++) {
    for (let k = 1; k <= reach; k++) {
      const j = (i + k) % count
      const gap = Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y) - 2 * DOT
      if (gap < worst.gap) worst = { gap, count }
    }
  }
}
if (worst.gap < 1) {
  console.error(`Theme view dots overlap: only ${worst.gap.toFixed(2)}px apart with ${worst.count} people`)
  process.exit(1)
}
console.log(`Theme view dots never overlap (closest: ${worst.gap.toFixed(2)}px apart, with ${worst.count} people)`)
