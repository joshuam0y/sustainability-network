import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CATEGORY_COLORS } from '../colors.js'

// A small virtual lounge, seen from its middle. Everything on the walls is drawn from the site's own data,
// so the numbers stay as current as the maps they come from.

export const NU_RED = '#C8102E'
const W = 10 // room is W x W, centered on the viewer
const H = 3.4
const EYE = 1.6

// Where each thing to explore sits; markers float just in front of it
export const SPOTS = {
  people: new THREE.Vector3(0, 0.82, -4.6),
  stars: new THREE.Vector3(3.55, 1.25, -4.85),
  courses: new THREE.Vector3(4.6, 1.45, 0),
  campus: new THREE.Vector3(0, 2.05, 4.8),
  involved: new THREE.Vector3(-4.8, 2.75, 1.25),
  trends: new THREE.Vector3(-4.5, 1.02, -0.45),
  biosphere: new THREE.Vector3(-4.2, 1.75, -4.2),
  waste: new THREE.Vector3(-4.45, 0.95, 3.85),
  food: new THREE.Vector3(0.25, 0.62, 3.1),
}

function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function canvasTexture(width, height, draw, repeat) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d'), width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(...repeat)
  }
  return texture
}

function noise(g, w, h, count, colors, size = 2, seed = 1) {
  const rand = seeded(seed)
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[Math.floor(rand() * colors.length)]
    g.fillRect(rand() * w, rand() * h, size, size)
  }
}

function wrap(g, text, maxWidth) {
  const lines = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (g.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

// ---------- Surfaces ----------

function woodFloor() {
  return canvasTexture(2048, 2048, (g, w, h) => {
    const rand = seeded(11)
    const rowH = 128
    for (let y = 0; y < h; y += rowH) {
      for (let x = -rand() * 600; x < w; ) {
        const len = 520 + rand() * 600
        const tone = 128 + rand() * 34
        g.fillStyle = `rgb(${tone}, ${tone * 0.7}, ${tone * 0.45})`
        g.fillRect(x, y, len, rowH - 3)
        // Grain: thin wavy lines along the plank
        for (let k = 0; k < 26; k++) {
          const gy = y + rand() * (rowH - 6)
          g.strokeStyle = `rgba(${rand() > 0.5 ? '70, 40, 20' : '210, 170, 120'}, ${0.08 + rand() * 0.12})`
          g.lineWidth = 1 + rand() * 2
          g.beginPath()
          g.moveTo(x, gy)
          for (let sx = 0; sx <= len; sx += 40) g.lineTo(x + sx, gy + Math.sin(sx / 90 + k) * 2.5)
          g.stroke()
        }
        if (rand() < 0.25) {
          g.fillStyle = 'rgba(70, 40, 20, 0.35)'
          g.beginPath()
          g.ellipse(x + rand() * len, y + rowH / 2, 14, 6, 0, 0, Math.PI * 2)
          g.fill()
        }
        g.fillStyle = 'rgba(40, 25, 15, 0.7)'
        g.fillRect(x + len - 2, y, 3, rowH - 3)
        x += len + 1
      }
      g.fillStyle = 'rgba(40, 25, 15, 0.8)'
      g.fillRect(0, y + rowH - 3, w, 3)
    }
  }, [2.2, 2.2])
}

function plaster() {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    noise(g, w, h, 30000, ['rgba(0,0,0,0.025)', 'rgba(0,0,0,0.04)', 'rgba(255,255,255,0.5)'], 2, 4)
  }, [5, 2])
}

function fabric(base) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < w; i += 3) {
      g.fillStyle = 'rgba(255,255,255,0.05)'
      g.fillRect(i, 0, 1, h)
      g.fillStyle = 'rgba(0,0,0,0.07)'
      g.fillRect(0, i, w, 1)
    }
    noise(g, w, h, 4000, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.06)'], 1, 8)
  }, [3, 3])
}

function rugTexture() {
  return canvasTexture(1200, 900, (g, w, h) => {
    g.fillStyle = '#2E3033'
    g.fillRect(0, 0, w, h)
    noise(g, w, h, 60000, ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.15)'], 2, 21)
    g.strokeStyle = '#8E1A2A'
    g.lineWidth = 18
    g.strokeRect(70, 70, w - 140, h - 140)
    g.strokeStyle = '#D8D1C4'
    g.lineWidth = 4
    g.strokeRect(100, 100, w - 200, h - 200)
  })
}

// ---------- Pictures drawn on things ----------

function peopleScreen(themes, people) {
  return canvasTexture(1600, 900, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#16191C')
    bg.addColorStop(1, '#0C0E10')
    g.fillStyle = bg
    g.fillRect(0, 0, w, h)
    g.fillStyle = 'white'
    g.font = '900 68px Lato, sans-serif'
    g.fillText('Who works on sustainability?', 70, 110)
    g.fillStyle = '#A8B0B5'
    g.font = '400 38px Lato, sans-serif'
    g.fillText(`${people} people across ${themes.length} themes`, 72, 168)
    const max = Math.max(...themes.map((t) => t.facultyCount))
    const centers = { Values: 300, Content: 800, Skills: 1300 }
    for (const [category, cx] of Object.entries(centers)) {
      const placed = []
      for (const t of themes.filter((x) => x.category === category).sort((a, b) => b.facultyCount - a.facultyCount)) {
        const r = 16 + 84 * Math.sqrt(t.facultyCount / max)
        // Walk out along a spiral until the circle fits
        for (let step = 0; step < 2000; step++) {
          const a = step * 0.45
          const x = cx + Math.cos(a) * step * 1.1
          const y = 520 + Math.sin(a) * step * 0.9
          if (placed.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + r + 8)) {
            placed.push({ x, y, r, t })
            break
          }
        }
      }
      g.textAlign = 'center'
      for (const { x, y, r, t } of placed) {
        g.beginPath()
        g.arc(x, y, r, 0, Math.PI * 2)
        g.fillStyle = CATEGORY_COLORS[category]
        g.fill()
        if (r > 40) {
          g.fillStyle = 'white'
          g.font = '700 30px Lato, sans-serif'
          g.fillText(String(t.facultyCount), x, y + 11)
        }
      }
      g.fillStyle = CATEGORY_COLORS[category]
      g.font = '900 40px Lato, sans-serif'
      g.fillText(category, cx, 860)
      g.textAlign = 'left'
    }
  })
}

function starsPlaque(score) {
  return canvasTexture(600, 760, (g, w, h) => {
    g.fillStyle = '#F7F2E7'
    g.fillRect(0, 0, w, h)
    noise(g, w, h, 6000, ['rgba(0,0,0,0.03)'], 2, 2)
    g.strokeStyle = '#C9A227'
    g.lineWidth = 6
    g.strokeRect(34, 34, w - 68, h - 68)
    g.textAlign = 'center'
    g.beginPath()
    g.arc(w / 2, 250, 130, 0, Math.PI * 2)
    const gold = g.createRadialGradient(w / 2 - 40, 210, 20, w / 2, 250, 140)
    gold.addColorStop(0, '#F6DF86')
    gold.addColorStop(1, '#A9821A')
    g.fillStyle = gold
    g.fill()
    g.fillStyle = '#3B2A1E'
    g.font = '900 64px Lato, sans-serif'
    g.fillText('GOLD', w / 2, 272)
    g.fillStyle = '#111'
    g.font = '900 84px Lato, sans-serif'
    g.fillText('STARS', w / 2, 500)
    g.fillStyle = NU_RED
    g.fillRect(w / 2 - 70, 528, 140, 8)
    g.fillStyle = '#333'
    g.font = '700 44px Lato, sans-serif'
    g.fillText(`${score} points`, w / 2, 600)
    g.font = '400 34px Lato, sans-serif'
    g.fillText('AASHE · 2026', w / 2, 660)
  })
}

function coursesSign(count) {
  return canvasTexture(1400, 240, (g, w) => {
    g.fillStyle = '#111'
    g.fillRect(0, 0, w, 240)
    g.fillStyle = 'white'
    g.font = '900 96px Lato, sans-serif'
    g.textAlign = 'center'
    g.fillText(`${count} sustainability courses`, w / 2, 140)
    g.fillStyle = NU_RED
    g.fillRect(w / 2 - 120, 182, 240, 12)
  })
}

function campusView() {
  return canvasTexture(1800, 1050, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.7)
    sky.addColorStop(0, '#6FAEDB')
    sky.addColorStop(1, '#E4F1F8')
    g.fillStyle = sky
    g.fillRect(0, 0, w, h)
    const rand = seeded(7)
    // Soft clouds
    for (let i = 0; i < 7; i++) {
      const cx = rand() * w
      const cy = 80 + rand() * 220
      for (let k = 0; k < 6; k++) {
        g.fillStyle = 'rgba(255,255,255,0.55)'
        g.beginPath()
        g.ellipse(cx + (k - 3) * 40, cy + Math.sin(k) * 12, 70, 34, 0, 0, Math.PI * 2)
        g.fill()
      }
    }
    // Far buildings, hazy; then nearer brick buildings
    for (const [base, haze, scale] of [[650, 0.55, 0.7], [740, 0, 1]]) {
      for (let x = -40; x < w; ) {
        const bw = (150 + rand() * 200) * scale
        const bh = (220 + rand() * 320) * scale
        const top = base - bh
        g.fillStyle = ['#9C4A3A', '#8A4033', '#A85A45', '#7D3B30', '#B2B6B8'][Math.floor(rand() * 5)]
        g.fillRect(x, top, bw, bh + 60)
        g.fillStyle = 'rgba(30, 40, 50, 0.35)'
        g.fillRect(x + bw - 12 * scale, top, 12 * scale, bh + 60)
        g.fillStyle = 'rgba(225, 235, 242, 0.8)'
        for (let wy = top + 22 * scale; wy < base - 30; wy += 44 * scale) {
          for (let wx = x + 16 * scale; wx < x + bw - 28 * scale; wx += 32 * scale) g.fillRect(wx, wy, 15 * scale, 23 * scale)
        }
        if (haze) {
          g.fillStyle = `rgba(220, 235, 245, ${haze})`
          g.fillRect(x, top, bw, bh + 60)
        }
        x += bw + 8 + rand() * 30
      }
    }
    g.fillStyle = '#6E9E4C'
    g.fillRect(0, 760, w, h - 760)
    noise(g, w, h - 760, 20000, ['rgba(40,80,30,0.25)', 'rgba(160,200,110,0.25)'], 3, 5)
    g.fillStyle = '#D9D3C6'
    g.beginPath()
    g.moveTo(w / 2 - 90, h)
    g.lineTo(w / 2 + 90, h)
    g.lineTo(w / 2 + 16, 760)
    g.lineTo(w / 2 - 16, 760)
    g.fill()
    for (let i = 0; i < 10; i++) {
      const tx = 60 + i * 180 + rand() * 50
      const ty = 700 + rand() * 80
      g.fillStyle = '#5B4030'
      g.fillRect(tx - 8, ty, 16, 110)
      for (let k = 0; k < 7; k++) {
        g.beginPath()
        g.arc(tx + (rand() - 0.5) * 90, ty - 30 + (rand() - 0.5) * 80, 50 + rand() * 26, 0, Math.PI * 2)
        g.fillStyle = ['#3E7A33', '#4F8A3C', '#5E9A45', '#355F2A'][k % 4]
        g.fill()
      }
    }
  })
}

function corkboard(items) {
  return canvasTexture(1600, 950, (g, w, h) => {
    g.fillStyle = '#B98B5E'
    g.fillRect(0, 0, w, h)
    noise(g, w, h, 16000, ['rgba(90,55,25,0.2)', 'rgba(255,235,200,0.18)'], 3, 3)
    const rand = seeded(13)
    g.fillStyle = '#111'
    g.fillRect(60, 50, 560, 96)
    g.fillStyle = 'white'
    g.font = '900 60px Lato, sans-serif'
    g.fillText('Get involved', 90, 120)
    items.forEach((item, i) => {
      const row = Math.floor(i / 3)
      const cw = 440
      const ch = 300
      const x = 90 + (i % 3) * 490 + (row === 1 ? 245 : 0)
      const y = 200 + row * 360
      g.save()
      g.translate(x + cw / 2, y + ch / 2)
      g.rotate((rand() - 0.5) * 0.08)
      g.fillStyle = 'rgba(0,0,0,0.28)'
      g.fillRect(-cw / 2 + 8, -ch / 2 + 10, cw, ch)
      g.fillStyle = i % 2 ? '#FFF6CC' : '#FFFFFF'
      g.fillRect(-cw / 2, -ch / 2, cw, ch)
      g.fillStyle = NU_RED
      g.beginPath()
      g.arc(0, -ch / 2 + 22, 14, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#111'
      g.font = '900 44px Lato, sans-serif'
      wrap(g, item.title, cw - 60).slice(0, 3).forEach((line, k) => g.fillText(line, -cw / 2 + 30, -ch / 2 + 100 + k * 52))
      g.restore()
    })
  })
}

// Share of course seats in sustainability courses, by year, as bars on the laptop
function trendsScreen(trends) {
  return canvasTexture(900, 580, (g, w) => {
    g.fillStyle = '#FFFFFF'
    g.fillRect(0, 0, w, 580)
    g.fillStyle = NU_RED
    g.fillRect(0, 0, w, 10)
    g.fillStyle = '#111'
    g.font = '900 44px Lato, sans-serif'
    g.fillText('Seats in sustainability courses', 40, 80)
    g.fillStyle = '#666'
    g.font = '400 28px Lato, sans-serif'
    g.fillText('Share of all course seats, by year', 40, 122)
    const max = Math.max(...trends.map((t) => t.share))
    const bw = (w - 120) / trends.length
    g.textAlign = 'center'
    trends.forEach((t, i) => {
      const bh = (t.share / max) * 300
      const x = 60 + i * bw + 14
      g.fillStyle = i === trends.length - 1 ? NU_RED : '#2A2A2A'
      g.fillRect(x, 500 - bh, bw - 28, bh)
      g.fillStyle = '#111'
      g.font = '700 26px Lato, sans-serif'
      g.fillText(`${(t.share * 100).toFixed(1)}%`, x + (bw - 28) / 2, 488 - bh)
      g.fillStyle = '#555'
      g.font = '400 24px Lato, sans-serif'
      g.fillText(t.year, x + (bw - 28) / 2, 540)
    })
  })
}

function binLabel(text) {
  return canvasTexture(256, 320, (g, w) => {
    g.fillStyle = '#FFFFFF'
    g.fillRect(0, 0, w, 320)
    g.fillStyle = '#111'
    g.font = '900 52px Lato, sans-serif'
    g.textAlign = 'center'
    g.fillText(text, w / 2, 180, w - 24)
  })
}

// ---------- Building blocks ----------

// Materials are shared by look, so identical surfaces can be merged into one draw call below
const materials = new Map()
function mat(color, options = {}) {
  const key = JSON.stringify([String(color), Object.entries(options).map(([k, v]) => [k, v?.uuid ?? String(v)])])
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...options }))
  return materials.get(key)
}

// Everything in the room stands still, so meshes that share a material (and a hotspot) are baked into one.
// This takes the room from a few hundred draw calls to a few dozen.
function mergeStatic(scene) {
  scene.updateMatrixWorld(true)
  const groups = new Map()
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.material.transparent || o.material.isMeshBasicMaterial) return
    const g = o.geometry
    const key = [o.material.uuid, o.userData.hotspot ?? '', o.castShadow, o.receiveShadow, g.index ? 1 : 0, Object.keys(g.attributes).sort().join()].join('|')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(o)
  })
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue
    const merged = mergeGeometries(meshes.map((m) => m.geometry.clone().applyMatrix4(m.matrixWorld)))
    if (!merged) continue
    const out = new THREE.Mesh(merged, meshes[0].material)
    out.castShadow = meshes[0].castShadow
    out.receiveShadow = meshes[0].receiveShadow
    out.userData.hotspot = meshes[0].userData.hotspot
    for (const m of meshes) m.removeFromParent()
    scene.add(out)
  }
}

// Soft dark patches where things meet the floor or the walls meet each other: cheap stand-ins for ambient occlusion
let blobTexture
function contactShadow(width, depth, position, strength = 0.55) {
  blobTexture ??= canvasTexture(256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    r.addColorStop(0, 'rgba(0,0,0,1)')
    r.addColorStop(0.55, 'rgba(0,0,0,0.55)')
    r.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = r
    g.fillRect(0, 0, w, h)
  })
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, opacity: strength, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }))
  m.rotation.x = -Math.PI / 2
  m.position.copy(position)
  return m
}
let edgeTexture
function edgeShade(width, height, position, rotY, flip) {
  edgeTexture ??= canvasTexture(8, 256, (g, w, h) => {
    const r = g.createLinearGradient(0, h, 0, 0)
    r.addColorStop(0, 'rgba(0,0,0,0.5)')
    r.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = r
    g.fillRect(0, 0, w, h)
  })
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: edgeTexture, transparent: true, opacity: 0.3, depthWrite: false }))
  m.position.copy(position)
  m.rotation.y = rotY
  if (flip) m.scale.y = -1
  return m
}

function mesh(geometry, material, position, hotspot) {
  const m = new THREE.Mesh(geometry, material)
  if (position) m.position.copy(position)
  m.castShadow = true
  m.receiveShadow = true
  if (hotspot) m.userData.hotspot = hotspot
  return m
}

const v3 = (x, y, z) => new THREE.Vector3(x, y, z)
const rbox = (w, h, d, material, position, hotspot, radius = 0.015) =>
  mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2, h / 2, d / 2)), material, position, hotspot)

function picture(width, height, map, position, rotY, hotspot, basic) {
  const material = basic ? new THREE.MeshBasicMaterial({ map, toneMapped: false }) : mat('#ffffff', { map, roughness: 0.6 })
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
  m.position.copy(position)
  m.rotation.y = rotY
  m.receiveShadow = !basic
  if (hotspot) m.userData.hotspot = hotspot
  return m
}

// ---------- The room ----------

export function createRoom(canvas, { themes, people, courseCount, score, involved, trends }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  let pixelRatio = Math.min(window.devicePixelRatio, 1.5)
  renderer.setPixelRatio(pixelRatio)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  // Nothing moves, so shadows are worked out once instead of every frame
  renderer.shadowMap.autoUpdate = false
  RectAreaLightUniformsLib.init()

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#202020')
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.45

  const camera = new THREE.PerspectiveCamera(68, 1, 0.05, 50)
  camera.position.set(0, EYE, 0)
  camera.rotation.order = 'YXZ'

  // ---- Light: sun through the window, sky light from it, warm lamps inside ----
  scene.add(new THREE.HemisphereLight('#fdfbf5', '#6b5a48', 0.55))
  const sun = new THREE.DirectionalLight('#FFF1D6', 3.2)
  sun.position.set(-2.5, 5.2, 11)
  sun.target.position.set(0.5, 0, 1)
  sun.castShadow = true
  sun.shadow.mapSize.set(4096, 4096)
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  scene.add(sun, sun.target)
  const skyLight = new THREE.RectAreaLight('#D8ECFF', 3.5, 3.6, 2.2)
  skyLight.position.set(0, 2.05, W / 2 - 0.05)
  skyLight.lookAt(0, 1.6, 0)
  scene.add(skyLight)
  for (const [x, z] of [[-2, -1.6], [2, 1.2]]) {
    const lamp = new THREE.PointLight('#FFD9A8', 5, 9, 1.6)
    lamp.position.set(x, H - 0.75, z)
    scene.add(lamp)
  }

  // ---- Shell: floor, ceiling, walls with white trim; the screen wall is Northeastern red ----
  const floor = mesh(new THREE.PlaneGeometry(W, W), mat('#ffffff', { map: woodFloor(), roughness: 0.42 }))
  floor.rotation.x = -Math.PI / 2
  floor.castShadow = false
  scene.add(floor)
  const ceiling = mesh(new THREE.PlaneGeometry(W, W), mat('#FBFAF7', { roughness: 0.95, emissive: '#3a3833' }))
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = H
  scene.add(ceiling)
  const wallMap = plaster()
  const walls = [[0, -W / 2, 0, '#A8152C'], [0, W / 2, Math.PI, '#EFEAE2'], [W / 2, 0, -Math.PI / 2, '#EFEAE2'], [-W / 2, 0, Math.PI / 2, '#E9E4DB']]
  const trim = mat('#F7F6F2', { roughness: 0.5 })
  for (const [x, z, r, color] of walls) {
    const wall = mesh(new THREE.PlaneGeometry(W, H), mat(color, { map: wallMap, roughness: 0.92 }), v3(x, H / 2, z))
    wall.rotation.y = r
    wall.castShadow = false
    scene.add(wall)
    // Baseboard and crown molding
    for (const [y, hh] of [[0.07, 0.14], [H - 0.05, 0.1]]) {
      const strip = mesh(new THREE.BoxGeometry(W, hh, 0.03), trim, v3(x * 0.997, y, z * 0.997))
      strip.rotation.y = r
      strip.castShadow = false
      scene.add(strip)
    }
  }

  // Pendant lamps
  const black = mat('#1B1B1B', { roughness: 0.4, metalness: 0.6 })
  for (const [x, z] of [[-2, -1.6], [2, 1.2]]) {
    scene.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.55), black, v3(x, H - 0.28, z)))
    const shade = mesh(new THREE.CylinderGeometry(0.12, 0.32, 0.3, 32, 1, true), mat('#1B1B1B', { roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide }), v3(x, H - 0.7, z))
    shade.castShadow = false
    scene.add(shade)
    scene.add(mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: '#FFF3DC' }), v3(x, H - 0.78, z)))
  }

  // ---- North: the people screen on a walnut console, and the STARS plaque ----
  const walnut = mat('#5B3B26', { roughness: 0.45 })
  scene.add(rbox(3.7, 2.12, 0.06, mat('#0A0A0A', { roughness: 0.25, metalness: 0.3 }), v3(0, 2.05, -W / 2 + 0.06), 'people'))
  scene.add(picture(3.56, 2.0, peopleScreen(themes, people), v3(0, 2.05, -W / 2 + 0.095), 0, 'people', true))
  scene.add(rbox(3.2, 0.5, 0.48, walnut, v3(0, 0.39, -W / 2 + 0.3), null, 0.02))
  for (const lx of [-1.5, 1.5]) for (const lz of [-W / 2 + 0.12, -W / 2 + 0.48]) {
    scene.add(mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.14), black, v3(lx, 0.07, lz)))
  }
  // Things on the console: a stack of books and a vase
  ;[['#C8102E', 0.04], ['#1F1F1F', 0.035], ['#E8E2D6', 0.03]].reduce((y, [c, t]) => {
    scene.add(rbox(0.32, t, 0.22, mat(c, { roughness: 0.8 }), v3(-1.1, y + t / 2, -W / 2 + 0.3), null, 0.004))
    return y + t
  }, 0.64)
  scene.add(mesh(new THREE.LatheGeometry([0.0, 0.06, 0.075, 0.06, 0.035, 0.04].map((r, i) => new THREE.Vector2(r, i * 0.06)), 32),
    mat('#F2EFEA', { roughness: 0.3 }), v3(1.15, 0.64, -W / 2 + 0.3)))
  scene.add(rbox(0.98, 1.22, 0.05, walnut, v3(3.55, 2.0, -W / 2 + 0.03), 'stars', 0.01))
  scene.add(picture(0.84, 1.07, starsPlaque(score), v3(3.55, 2.0, -W / 2 + 0.058), 0, 'stars'))

  // ---- North-west corner: a potted plant ----
  scene.add(mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.55, 40), mat('#EDEAE4', { roughness: 0.35 }), v3(-4.2, 0.275, -4.2), 'biosphere'))
  scene.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 32), mat('#3A2A1E'), v3(-4.2, 0.54, -4.2), 'biosphere'))
  const leafRand = seeded(9)
  const leafGeometry = new THREE.SphereGeometry(1, 10, 8)
  const leafMats = ['#2F6B2A', '#3E7A33', '#4F8A3C', '#5C9A44'].map((c) => mat(c, { roughness: 0.55, side: THREE.DoubleSide }))
  const stemMat = mat('#4A6B2E')
  for (let i = 0; i < 70; i++) {
    const up = 0.55 + leafRand() * 0.45
    const a = leafRand() * Math.PI * 2
    const dir = v3(Math.cos(a) * (1 - up), up, Math.sin(a) * (1 - up)).normalize()
    const base = v3(-4.2 + (leafRand() - 0.5) * 0.12, 0.6 + leafRand() * 1.0, -4.2 + (leafRand() - 0.5) * 0.12)
    const leaf = mesh(leafGeometry, leafMats[i % 4], base.clone().addScaledVector(dir, 0.22), 'biosphere')
    leaf.scale.set(0.075, 0.012, 0.24)
    leaf.lookAt(base.clone().addScaledVector(dir, 2))
    scene.add(leaf)
    scene.add(mesh(new THREE.CylinderGeometry(0.006, 0.008, base.y - 0.55), stemMat, v3(base.x, (base.y + 0.55) / 2, base.z), 'biosphere'))
  }

  // ---- North-east corner: a floor lamp ----
  scene.add(mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 32), black, v3(4.25, 0.015, -4.25)))
  scene.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.6), black, v3(4.25, 0.8, -4.25)))
  scene.add(mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.32, 32, 1, true),
    mat('#F1E9DA', { roughness: 0.9, side: THREE.DoubleSide, emissive: '#5a4630' }), v3(4.25, 1.72, -4.25)))

  // ---- East: a bookshelf full of courses ----
  const shelf = new THREE.Group()
  const depth = 0.38
  const sw = 3.4
  const sh = 2.45
  const oak = mat('#6B4E36', { roughness: 0.5 })
  shelf.add(rbox(sw, sh, 0.03, mat('#3E2E21'), v3(0, sh / 2, -depth / 2), 'courses', 0.005))
  for (const sx of [-sw / 2, sw / 2]) shelf.add(rbox(0.05, sh, depth, oak, v3(sx, sh / 2, 0), 'courses', 0.008))
  shelf.add(rbox(sw + 0.05, 0.05, depth + 0.02, oak, v3(0, sh, 0), 'courses', 0.008))
  const rows = 5
  const rand = seeded(5)
  const books = []
  for (let i = 0; i < rows; i++) {
    const y = 0.06 + (i * (sh - 0.1)) / rows
    shelf.add(rbox(sw, 0.035, depth, oak, v3(0, y, 0), 'courses', 0.006))
    for (let x = -sw / 2 + 0.05; x < sw / 2 - 0.12; ) {
      const bw = 0.03 + rand() * 0.045
      const bh = 0.22 + rand() * 0.17
      if (rand() < 0.05) { x += 0.14; continue }
      const lean = rand() < 0.04 ? 0.18 : 0
      books.push({ x: x + bw / 2, y: y + 0.018 + bh / 2, bw, bh, bd: depth * (0.7 + rand() * 0.2), lean })
      x += bw + 0.003 + (lean ? 0.05 : 0)
    }
  }
  const palette = [NU_RED, '#161616', CATEGORY_COLORS.Content, CATEGORY_COLORS.Values, CATEGORY_COLORS.Skills, '#4A4A4A', '#E8E2D6', '#1C4E78', '#6B2B2B']
  const bookMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.04), mat('#ffffff', { roughness: 0.65 }), books.length)
  const m4 = new THREE.Matrix4()
  books.forEach((b, i) => {
    m4.compose(v3(b.x, b.y, -depth / 2 + b.bd / 2 + 0.02), new THREE.Quaternion().setFromAxisAngle(v3(0, 0, 1), b.lean), v3(b.bw, b.bh, b.bd))
    bookMesh.setMatrixAt(i, m4)
    bookMesh.setColorAt(i, new THREE.Color(palette[Math.floor(rand() * palette.length)]))
  })
  bookMesh.castShadow = true
  bookMesh.receiveShadow = true
  bookMesh.userData.hotspot = 'courses'
  shelf.add(bookMesh)
  // A small globe on top
  shelf.add(mesh(new THREE.SphereGeometry(0.13, 32, 24), mat('#3C7FB8', { roughness: 0.35 }), v3(1.2, sh + 0.2, 0), 'courses'))
  shelf.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.06), black, v3(1.2, sh + 0.05, 0)))
  shelf.rotation.y = -Math.PI / 2
  shelf.position.set(W / 2 - depth / 2 - 0.02, 0, 0)
  scene.add(shelf)
  scene.add(picture(2.6, 0.45, coursesSign(courseCount), v3(W / 2 - 0.02, 3.0, 0), -Math.PI / 2, 'courses', true))

  // ---- South: a window onto campus, with curtains and a sofa below ----
  scene.add(picture(3.6, 2.1, campusView(), v3(0, 2.05, W / 2 - 0.08), Math.PI, 'campus', true))
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.1),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.08 }))
  glass.position.set(0, 2.05, W / 2 - 0.1)
  glass.rotation.y = Math.PI
  scene.add(glass)
  const white = mat('#F5F5F2', { roughness: 0.4 })
  for (const [x, y, w, h] of [[0, 3.12, 3.8, 0.08], [0, 0.98, 3.9, 0.06], [-1.84, 2.05, 0.08, 2.22], [1.84, 2.05, 0.08, 2.22], [0, 2.05, 0.05, 2.1], [0, 2.05, 3.6, 0.05]]) {
    scene.add(rbox(w, h, 0.14, white, v3(x, y, W / 2 - 0.07), 'campus', 0.01))
  }
  scene.add(rbox(4.0, 0.04, 0.26, white, v3(0, 0.95, W / 2 - 0.13), 'campus', 0.01))
  // Curtains: gently folded panels on a rod
  scene.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 5.2), black, v3(0, 3.22, W / 2 - 0.2)).rotateZ(Math.PI / 2))
  const curtainMat = mat('#ffffff', { map: fabric('#E5DED2'), roughness: 0.95, side: THREE.DoubleSide })
  for (const cx of [-2.35, 2.35]) {
    const g = new THREE.PlaneGeometry(0.85, 3.1, 48, 1)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 26) * 0.035)
    g.computeVertexNormals()
    const curtain = mesh(g, curtainMat, v3(cx, 1.66, W / 2 - 0.22))
    curtain.rotation.y = Math.PI
    scene.add(curtain)
  }
  const sofaFabric = mat('#ffffff', { map: fabric('#3D4146'), roughness: 0.95 })
  const sz = W / 2 - 0.62
  scene.add(rbox(2.5, 0.28, 0.88, sofaFabric, v3(0, 0.26, sz), null, 0.05))
  for (const sx of [-0.82, 0, 0.82]) scene.add(rbox(0.8, 0.16, 0.72, sofaFabric, v3(sx, 0.48, sz - 0.06), null, 0.06))
  scene.add(rbox(2.5, 0.46, 0.2, sofaFabric, v3(0, 0.66, sz + 0.34), null, 0.07))
  for (const sx of [-1.33, 1.33]) scene.add(rbox(0.18, 0.56, 0.88, sofaFabric, v3(sx, 0.36, sz), null, 0.07))
  for (const sx of [-1.25, 1.25]) for (const dz of [-0.36, 0.36]) scene.add(mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.12), black, v3(sx, 0.06, sz + dz)))
  const pillow = rbox(0.42, 0.38, 0.12, mat(NU_RED, { roughness: 0.95 }), v3(-0.9, 0.72, sz + 0.18), null, 0.06)
  pillow.rotation.set(-0.25, 0.15, 0.08)
  scene.add(pillow)

  // Coffee table with a bowl of fruit, a mug and a book
  const tz = 3.1
  scene.add(rbox(1.4, 0.05, 0.7, oak, v3(0, 0.42, tz), 'food', 0.012))
  for (const lx of [-0.62, 0.62]) for (const lz of [-0.28, 0.28]) scene.add(mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.4), black, v3(lx, 0.2, tz + lz)))
  scene.add(mesh(new THREE.LatheGeometry([[0, 0], [0.06, 0.005], [0.13, 0.04], [0.17, 0.1], [0.165, 0.105]].map(([x, y]) => new THREE.Vector2(x, y)), 40),
    mat('#F4F1EB', { roughness: 0.25, side: THREE.DoubleSide }), v3(0.25, 0.445, tz), 'food'))
  const fruitRand = seeded(17)
  for (let i = 0; i < 7; i++) {
    const kind = i % 3
    const r = [0.048, 0.05, 0.04][kind]
    const a = (i / 7) * Math.PI * 2 + fruitRand()
    const spread = 0.075 * (i % 2 ? 1 : 0.4)
    const fruit = mesh(new THREE.SphereGeometry(r, 24, 18), mat(['#B3261E', '#E8892B', '#8DB33A'][kind], { roughness: 0.35 }),
      v3(0.25 + Math.cos(a) * spread, 0.5 + (i > 4 ? 0.05 : 0), tz + Math.sin(a) * spread), 'food')
    fruit.scale.y = kind === 0 ? 0.92 : 1
    scene.add(fruit)
  }
  scene.add(mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.1, 24), mat('#FFFFFF', { roughness: 0.2 }), v3(-0.35, 0.495, tz + 0.12)))
  scene.add(rbox(0.3, 0.035, 0.22, mat('#1C4E78', { roughness: 0.8 }), v3(-0.3, 0.462, tz - 0.12), null, 0.004).rotateY(0.3))

  // Rug
  const rug = mesh(new RoundedBoxGeometry(3.6, 0.012, 2.6, 2, 0.005), mat('#ffffff', { map: rugTexture(), roughness: 1 }), v3(0, 0.006, 2.4))
  rug.castShadow = false
  scene.add(rug)

  // ---- West: corkboard over a desk with a laptop, and recycling bins ----
  scene.add(rbox(0.06, 1.95, 3.3, mat('#2B2B2B', { roughness: 0.5 }), v3(-W / 2 + 0.03, 2.0, 0), 'involved', 0.01))
  scene.add(picture(3.16, 1.82, corkboard(involved), v3(-W / 2 + 0.065, 2.0, 0), Math.PI / 2, 'involved'))
  const dx = -W / 2 + 0.4
  scene.add(rbox(0.7, 0.04, 2.0, oak, v3(dx, 0.76, 0), 'trends', 0.01))
  for (const lz of [-0.95, 0.95]) {
    scene.add(rbox(0.6, 0.03, 0.03, black, v3(dx, 0.03, lz), null, 0.005))
    scene.add(rbox(0.03, 0.72, 0.03, black, v3(dx, 0.38, lz), null, 0.005))
  }
  // Laptop, built facing +z then turned to face the room
  const laptop = new THREE.Group()
  const aluminum = mat('#B9BCC1', { roughness: 0.3, metalness: 0.8 })
  laptop.add(rbox(0.36, 0.014, 0.25, aluminum, v3(0, 0.007, 0), 'trends', 0.006))
  const lid = new THREE.Group()
  lid.position.set(0, 0.014, -0.125)
  lid.rotation.x = -0.32
  lid.add(rbox(0.36, 0.24, 0.008, aluminum, v3(0, 0.12, 0), 'trends', 0.004))
  lid.add(picture(0.33, 0.212, trendsScreen(trends), v3(0, 0.122, 0.0045), 0, 'trends', true))
  laptop.add(lid)
  laptop.position.set(dx + 0.05, 0.78, -0.45)
  laptop.rotation.y = Math.PI / 2
  scene.add(laptop)
  // Desk lamp
  scene.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 24), black, v3(dx - 0.1, 0.79, 0.75)))
  scene.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42), black, v3(dx - 0.1, 1.0, 0.75)))
  scene.add(mesh(new THREE.ConeGeometry(0.08, 0.12, 24, 1, true), mat(NU_RED, { roughness: 0.4, side: THREE.DoubleSide }), v3(dx - 0.02, 1.2, 0.75)).rotateZ(-0.9))
  // Desk chair, pulled out and turned a little
  const chair = new THREE.Group()
  const seatMat = mat('#ffffff', { map: fabric('#26282B'), roughness: 0.9 })
  chair.add(rbox(0.48, 0.07, 0.46, seatMat, v3(0, 0.47, 0), null, 0.03))
  chair.add(rbox(0.46, 0.5, 0.06, seatMat, v3(0, 0.8, 0.22), null, 0.03))
  chair.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36), black, v3(0, 0.27, 0)))
  for (let k = 0; k < 5; k++) {
    const a = (k * 2 * Math.PI) / 5
    const leg = rbox(0.3, 0.025, 0.04, black, v3(Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15), null, 0.01)
    leg.rotation.y = -a
    chair.add(leg)
  }
  chair.position.set(dx + 0.75, 0, 0.55)
  chair.rotation.y = -Math.PI / 2 - 0.5
  scene.add(chair)
  // Recycling, compost and landfill bins
  ;[['#1F5FA8', 'RECYCLE'], ['#2E7D32', 'COMPOST'], ['#2B2B2B', 'LANDFILL']].forEach(([color, label], i) => {
    const z = 3.35 + i * 0.5
    scene.add(rbox(0.42, 0.72, 0.44, mat(color, { roughness: 0.45 }), v3(-W / 2 + 0.3, 0.36, z), 'waste', 0.04))
    scene.add(rbox(0.44, 0.05, 0.46, mat(new THREE.Color(color).offsetHSL(0, 0, 0.08), { roughness: 0.4 }), v3(-W / 2 + 0.3, 0.745, z), 'waste', 0.02))
    scene.add(picture(0.2, 0.25, binLabel(label), v3(-W / 2 + 0.512, 0.45, z), Math.PI / 2, 'waste'))
  })

  // Shading where things meet: under furniture, and along the floor and ceiling edges of every wall
  for (const [w, d, x, z, k] of [
    [3.6, 0.9, 0, -W / 2 + 0.32, 0.6], [3.1, 1.4, 0, W / 2 - 0.6, 0.7], [1.8, 1.0, 0, 3.1, 0.45], [1.0, 2.4, -W / 2 + 0.45, 0, 0.45],
    [0.9, 0.9, -4.2, -4.2, 0.6], [0.6, 0.6, 4.25, -4.25, 0.5], [0.9, 1.8, -W / 2 + 0.32, 3.85, 0.6], [0.8, 3.7, W / 2 - 0.25, 0, 0.6],
    [0.8, 0.8, -W / 2 + 1.15, 0.55, 0.45],
  ]) scene.add(contactShadow(w, d, v3(x, z > 1.5 && Math.abs(x) < 2 ? 0.014 : 0.003, z), k))
  for (const [x, z, r] of walls) {
    scene.add(edgeShade(W, 0.5, v3(x * 0.99, 0.25, z * 0.99), r))
    scene.add(edgeShade(W, 0.35, v3(x * 0.99, H - 0.175, z * 0.99), r, true))
  }

  mergeStatic(scene)
  renderer.shadowMap.needsUpdate = true

  // ---------- Looking around ----------
  let yaw = 0
  let pitch = -0.05
  let target = null
  let idle = true
  const markers = new Map()
  const raycaster = new THREE.Raycaster()
  let onPick = () => {}
  let onHover = () => {}
  let hovered = null
  let pointer = null

  const size = { w: 1, h: 1 }
  let dirty = true
  const resize = () => {
    size.w = canvas.parentElement.clientWidth
    size.h = canvas.parentElement.clientHeight
    renderer.setSize(size.w, size.h, false)
    camera.aspect = size.w / size.h
    camera.updateProjectionMatrix()
    dirty = true
  }
  const observer = new ResizeObserver(resize)
  observer.observe(canvas.parentElement)
  resize()

  function hit(e) {
    const rect = canvas.getBoundingClientRect()
    raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera)
    const first = raycaster.intersectObjects(scene.children, true).find((h) => !h.object.material?.transparent)
    let o = first?.object
    while (o && !o.userData.hotspot) o = o.parent
    return o?.userData.hotspot ?? null
  }
  let drag = null
  const down = (e) => {
    drag = { x: e.clientX, y: e.clientY, moved: 0 }
    idle = false
    target = null
    canvas.setPointerCapture(e.pointerId)
  }
  const move = (e) => {
    if (!drag) {
      pointer = e
      return
    }
    const k = 0.0042 * (camera.fov / 68)
    yaw += (e.clientX - drag.x) * k
    pitch = Math.max(-1.1, Math.min(1.1, pitch + (e.clientY - drag.y) * k))
    drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y)
    drag.x = e.clientX
    drag.y = e.clientY
    canvas.style.cursor = 'grabbing'
  }
  const up = (e) => {
    if (drag && drag.moved < 6) {
      const id = hit(e)
      if (id) onPick(id)
    }
    drag = null
  }
  const wheel = (e) => {
    e.preventDefault()
    camera.fov = Math.max(38, Math.min(80, camera.fov + e.deltaY * 0.03))
    camera.updateProjectionMatrix()
    dirty = true
  }
  const key = (e) => {
    const step = { ArrowLeft: [0.08, 0], ArrowRight: [-0.08, 0], ArrowUp: [0, 0.06], ArrowDown: [0, -0.06] }[e.key]
    if (!step || e.target.closest?.('input, textarea, select')) return
    idle = false
    target = null
    yaw += step[0]
    pitch = Math.max(-1.1, Math.min(1.1, pitch + step[1]))
  }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('wheel', wheel, { passive: false })
  window.addEventListener('keydown', key)

  const v = new THREE.Vector3()
  let frame
  let last = ''
  let lastTime = 0
  let slowFrames = 0
  let timedFrames = 0
  const loop = (now) => {
    frame = requestAnimationFrame(loop)
    // Hover checks at most once a frame, not on every mouse event
    if (pointer) {
      const id = hit(pointer)
      canvas.style.cursor = id ? 'pointer' : 'grab'
      if (id !== hovered) onHover((hovered = id))
      pointer = null
    }
    if (idle) yaw += 0.0007
    if (target) {
      // Ease toward the chosen spot, the short way round
      let dy = target.yaw - yaw
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      yaw += dy * 0.12
      pitch += (target.pitch - pitch) * 0.12
      camera.fov += (target.fov - camera.fov) * 0.12
      camera.updateProjectionMatrix()
      if (Math.abs(dy) < 0.002 && Math.abs(target.pitch - pitch) < 0.002) target = null
    }
    // Only draw when the view has changed; a still room costs nothing
    const state = `${yaw.toFixed(5)} ${pitch.toFixed(5)} ${camera.fov.toFixed(3)}`
    if (state === last && !dirty) {
      lastTime = 0
      return
    }
    last = state
    dirty = false
    camera.rotation.set(pitch, yaw, 0)
    renderer.render(scene, camera)
    canvas.dataset.drawCalls = renderer.info.render.calls
    // On a slow computer, draw fewer pixels
    if (lastTime && timedFrames < 120) {
      timedFrames++
      if (now - lastTime > 26) slowFrames++
      if (timedFrames === 120 && slowFrames > 40 && pixelRatio > 1) {
        pixelRatio = 1
        renderer.setPixelRatio(1)
        resize()
      }
    }
    lastTime = now
    const { w, h } = size
    for (const [id, el] of markers) {
      v.copy(SPOTS[id]).project(camera)
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
      el.style.opacity = visible ? '1' : '0'
      el.style.pointerEvents = visible ? 'auto' : 'none'
      el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`
    }
  }
  frame = requestAnimationFrame(loop)

  return {
    setMarker(id, el) {
      if (el) markers.set(id, el)
      else markers.delete(id)
      dirty = true
    },
    onPick(fn) { onPick = fn },
    onHover(fn) { onHover = fn },
    // shift: how far left of center (as a share of half the screen) the spot should end up, to clear a side panel
    // lift: the same upward, to clear a sheet along the bottom on phones
    lookAt(id, { fov = 60, shift = 0, lift = 0 } = {}) {
      const d = SPOTS[id].clone().sub(camera.position)
      const half = Math.tan(THREE.MathUtils.degToRad(fov) / 2)
      idle = false
      target = {
        yaw: Math.atan2(-d.x, -d.z) - Math.atan(shift * half * camera.aspect),
        pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) * 0.7 - Math.atan(lift * half),
        fov,
      }
    },
    dispose() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('keydown', key)
      pmrem.dispose()
      renderer.dispose()
    },
  }
}
