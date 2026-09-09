/** Authored metre-scale brownstones and street furniture for the opening block. */
import { makeRng } from '../engine/state.js'
import { emitSurfaceTiles } from './roads.js'
import { emitProp } from './props.js'
import { emitBranch, emitLeafCluster } from './foliage.js'

// A square-section rail between arbitrary endpoints, including the sloped
// handrails and fire-escape stringers. True geometry casts a thin clean shadow.
function beam(builder, a, b, thickness, color, rect) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
  const len = Math.hypot(dx, dy, dz)
  if (len < 0.001) return
  const nx = dx / len, ny = dy / len, nz = dz / len
  const horizontal = Math.hypot(nx, nz)
  const ux = horizontal > 0.001 ? nz / horizontal : 1
  const uz = horizontal > 0.001 ? -nx / horizontal : 0
  const vx = ny * uz, vy = nz * ux - nx * uz, vz = -ny * ux
  const r = thickness / 2
  const ring = (p) => [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v]) => ({
    x: p.x + r * (ux * u + vx * v), y: p.y + r * vy * v, z: p.z + r * (uz * u + vz * v),
  }))
  const aa = ring(a), bb = ring(b)
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; builder.quad([aa[i], aa[j], bb[j], bb[i]], color, rect) }
}

/** Shallow, enclosed rooms give the shop glazing actual display parallax.
 * Everything sits inside the existing solid building footprint. */
function displayBay({box, panel, cylinder, glass, atlas}, opening, front, identity, house) {
  const o = opening, back = front - 1.38
  const bottom = o.y - o.h / 2
  const kind = identity || ['deli', 'coffee', 'hardware', 'laundry', 'pizza'][house % 5]
  const wallColor = kind === 'records' ? '#38493e' : kind === 'club' ? '#292932' : '#6d6d5b'
  const sleeveRect = (index) => {
    const rect=atlas.uv('album-sleeve'), du=(rect.u1-rect.u0)/2, dv=(rect.v1-rect.v0)/2
    const column=index%2, row=Math.floor(index%4/2)
    return {...rect,u0:rect.u0+column*du+0.002,u1:rect.u0+(column+1)*du-0.002,v0:rect.v0+row*dv+0.002,v1:rect.v0+(row+1)*dv-0.002}
  }
  panel({x:o.x,y:o.y,z:back,w:o.w,h:o.h,color:wallColor})
  box({x:o.x,y:bottom+0.025,z:front-0.76,w:o.w,h:0.05,d:1.24,color:'#665946'})
  box({x:o.x,y:o.y+o.h/2-0.03,z:front-0.76,w:o.w,h:0.06,d:1.24,color:'#55564d'})
  for (const side of [-1,1]) box({x:o.x+side*(o.w/2-0.025),y:o.y,z:front-0.76,w:0.05,h:o.h,d:1.24,color:wallColor})
  if (kind === 'records') {
    for (const height of [bottom+0.55,bottom+1.25]) {
      box({x:o.x,y:height,z:back+0.24,w:o.w-0.2,h:0.055,d:0.38,color:'#917a58'})
      const sleeves = Math.floor((o.w-0.35)/0.39)
      for (let i=0;i<sleeves;i++) panel({x:o.x+(i-(sleeves-1)/2)*0.39,y:height+0.195,z:back+0.14+(i%2)*0.09,w:0.33,h:0.33,color:'#e4ddc8',rect:sleeveRect(i+(height>bottom+1?1:0))})
    }
    box({x:o.x,y:bottom+0.24,z:front-0.5,w:o.w*0.65,h:0.48,d:0.48,color:'#514536'})
    for (let i=0;i<5;i++) panel({x:o.x+(i-2)*0.39,y:bottom+0.64,z:front-0.56,w:0.34,h:0.34,color:'#e2d7bb',rect:sleeveRect(i+2)})
  } else if (kind === 'club') {
    for (const side of [-1,1]) box({x:o.x+side*o.w*0.28,y:bottom+0.62,z:back+0.28,w:0.5,h:1.24,d:0.28,color:'#202329'})
    panel({x:o.x,y:o.y+0.25,z:back+0.06,w:0.66,h:0.92,color:'#c2a1aa',rect:atlas.uv('music-flyer')})
  } else if (kind === 'laundry') {
    box({x:o.x,y:bottom+0.5,z:back+0.25,w:o.w-0.4,h:0.12,d:0.48,color:'#ad9b7a'})
    for (let i=0;i<3;i++) box({x:o.x+(i-1)*0.55,y:bottom+0.66,z:back+0.26,w:0.43,h:0.19,d:0.3,color:['#b7ac8d','#a3a99c','#aaa0a6'][i]})
    panel({x:o.x,y:o.y+o.h*0.24,z:front-0.25,w:o.w-0.18,h:o.h*0.4,color:'#a59e83'})
  } else {
    box({x:o.x,y:bottom+0.43,z:front-0.57,w:o.w-0.2,h:0.86,d:0.57,color:kind==='coffee'?'#665240':'#7a7260'})
    box({x:o.x,y:bottom+0.885,z:front-0.56,w:o.w-0.13,h:0.055,d:0.64,color:'#aaa18c'})
    if (kind === 'coffee') {
      box({x:o.x-0.65,y:bottom+1.1,z:back+0.35,w:0.7,h:0.4,d:0.36,color:'#4c5553'})
      for (let i=0;i<3;i++) cylinder({x:o.x+0.2+i*0.25,y:bottom+0.98,z:front-0.54,r:0.068,h:0.13,seg:10,color:'#c0bba7'})
    } else if (kind === 'hardware') {
      for (let i=0;i<6;i++) {
        box({x:o.x+(i-2.5)*0.34,y:bottom+1.43,z:back+0.08,w:0.08,h:0.52,d:0.055,color:'#9b865f'})
        box({x:o.x+(i-2.5)*0.34,y:bottom+1.7,z:back+0.1,w:0.2,h:0.1,d:0.065,color:'#858c88'})
      }
    } else if (kind === 'pizza') {
      for (const side of [-1,1]) cylinder({x:o.x+side*0.54,y:bottom+0.94,z:front-0.54,r:0.29,h:0.025,seg:14,color:'#bda16a'})
    } else {
      for (let shelf=0;shelf<2;shelf++) {
        box({x:o.x,y:bottom+1.1+shelf*0.48,z:back+0.16,w:o.w-0.23,h:0.055,d:0.28,color:'#8b7c5f'})
        for (let i=0;i<7;i++) box({x:o.x+(i-3)*0.36,y:bottom+1.26+shelf*0.48,z:back+0.16,w:0.17,h:0.26,d:0.15,color:['#a39c70','#967f5e','#5d7767'][i%3]})
      }
    }
  }
  glass({x:o.x,y:o.y,z:front-0.175,w:o.w-0.14,h:o.h-0.14,color:'#ffffff',rect:atlas.uv('shop-glass')})
}

/** Every opening is a hole in the wall, with 32cm deep glass and real reveals. */
export function buildBrownstoneRow(set, atlas, row, tag = 'brownstone') {
  const colliders = []
  const white = atlas.uv('white')
  const iron = '#293735'
  const detail = set.detail || set.opaque
  const yaw = row.yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw)
  const width = row.bayWidth || 6.8
  const depth = row.depth || 18
  const count = row.count || 4
  const colors = row.facades || ['brick-brown', 'brick-red', 'brick-brown', 'brick-grey']
  for (let house = 0; house < count; house++) {
    const along = (house - (count - 1) / 2) * width
    const origin = { x: row.x + along * c, z: row.z + along * s }
    const point = (x, y, z) => ({ x: origin.x + x * c - z * s, y, z: origin.z + x * s + z * c })
    // Narrow frames, cornice brackets and display hardware are retained
    // verbatim nearby; structural walls/stoops/massing stay in the base mesh.
    const box = (o) => (o.w * o.h * o.d < 0.025 ? detail : set.opaque).box({ ...o, ...point(o.x || 0, o.y || 0, o.z || 0), ry: yaw, rect: o.rect || white })
    const panel = (o, builder = set.opaque) => builder.billboard({ ...o, ...point(o.x || 0, o.y || 0, o.z || 0), ry: yaw, rect: o.rect || white })
    const cylinder = (o) => set.opaque.cylinder({ ...o, ...point(o.x || 0, o.y || 0, o.z || 0), ry: yaw, rect: o.rect || white })
    const rail = (a, b, size = 0.045) => beam(detail, point(...a), point(...b), size, iron, white)
    const floors = row.floors || 4, floorHeight = 3.05
    const h = floors * floorHeight + 0.9 + (house % 3) * 0.24
    const f = depth / 2
    const brick = atlas.uv('flat/' + colors[house % colors.length])
    const identity = row.identity || null
    const facadeStyle = house % 4
    const stone = identity === 'records' ? '#345047' : identity === 'club' ? '#34323c' : ['#99826a', '#ad9679', '#968470', '#baab91'][house % 4]
    const trim = house % 2 ? '#c0b097' : '#ae9a7e'
    const retail = !!row.retail
    const doorX = identity ? 0 : width * 0.29
    const openings = []
    if (identity === 'records') {
      for (const side of [-1, 1]) openings.push({ x: side * 4.02, y: 1.62, w: 4.18, h: 2.28, shop: true, records: true })
      openings.push({ x: 0, y: 1.48, w: 1.32, h: 2.42, door: true })
    } else if (identity === 'club') {
      for (const side of [-1, 1]) openings.push({ x: side * 4.5, y: 1.82, w: 2.65, h: 1.76, shop: true, club: true })
      openings.push({ x: 0, y: 1.54, w: 1.88, h: 2.54, door: true })
    } else if (retail) {
      openings.push({ x: -0.8, y: 1.52, w: 3.55, h: 2.48, shop: true })
      openings.push({ x: doorX, y: 1.44, w: 1.12, h: 2.34, door: true })
    } else {
      openings.push({ x: -1.13, y: 2.58, w: 1.48, h: 2.02 })
      openings.push({ x: doorX, y: 2.52, w: 1.12, h: 2.64, door: true })
    }
    for (let floor = 1; floor < floors; floor++) {
      for (const x of (identity ? [-0.35,-0.12,0.12,0.35] : [-0.27,0.27]).map((t) => t * width)) openings.push({ x, y: 2.55 + floor * floorHeight, w: !row.retail && facadeStyle === 2 ? 1.05 : 1.18, h: !row.retail && facadeStyle === 1 ? 1.80 : 1.95, floor })
    }

    box({ y: h / 2, w: width, h, d: depth, color: '#ffffff', rect: brick, faces: ['north', 'east', 'west'] })
    // Horizontal bands avoid overlapping coplanar faces around the holes.
    const levels = [...new Set([0.22, h, ...openings.flatMap((o) => [o.y - o.h / 2, o.y + o.h / 2])])].sort((a,b) => a-b)
    for (let level = 0; level < levels.length - 1; level++) {
      const y0 = levels[level], y1 = levels[level + 1], mid = (y0 + y1) / 2
      const holes = openings.filter((o) => mid > o.y - o.h / 2 && mid < o.y + o.h / 2).sort((a,b) => a.x-b.x)
      let left = -width / 2
      for (const hole of [...holes, { x: width / 2, w: 0 }]) {
        const right = hole.x - hole.w / 2
        if (right > left + 0.001) box({ x: (left + right) / 2, y: mid, z: f - 0.23, w: right-left, h: y1-y0, d: 0.46, color: mid < 4.05 ? stone : '#ffffff', rect: mid < 4.05 ? white : brick })
        left = hole.x + hole.w / 2
      }
    }

    for (const [index, o] of openings.entries()) {
      const glassZ = f - (o.shop ? 0.18 : 0.38)
      const frame = o.door ? iron : '#c5c0af'
      const doorColor = ['#29443a','#493c35','#39464c','#533e3c'][house%4]
      if (o.shop) displayBay({box,panel,cylinder,glass:(p)=>panel(p,set.alpha),atlas},o,f,identity,house)
      else panel({ x: o.x, y: o.y, z: glassZ, w: o.w, h: o.h, color: o.door ? doorColor : '#788d8e', rect: o.door ? white : atlas.uv('window-reflection') })
      const inhabited = (house*7+index*3)%11
      if (!o.door && !o.shop && inhabited === 2) {
        panel({x:o.x,y:o.y+o.h*0.2,z:glassZ+0.016,w:o.w*0.9,h:o.h*0.5,color:'#aaa18a'})
        for (let slat=0;slat<6;slat++) panel({x:o.x,y:o.y+o.h*0.43-slat*0.13,z:glassZ+0.019,w:o.w*0.88,h:0.014,color:'#858471'})
      } else if (!o.door && !o.shop && inhabited === 4) {
        for (const side of [-1,1]) {
          panel({x:o.x+side*o.w*0.32,y:o.y,z:glassZ+0.016,w:o.w*0.23,h:o.h*0.92,color:'#b6ad97'})
          for (let fold=0;fold<3;fold++) panel({x:o.x+side*o.w*0.32+(fold-1)*0.055,y:o.y,z:glassZ+0.02,w:0.018,h:o.h*0.91,color:'#9e9680'})
        }
      }
      for (const side of [-1, 1]) box({ x: o.x + side * (o.w / 2 - 0.04), y: o.y, z: glassZ + 0.03, w: 0.08, h: o.h, d: 0.1, color: frame })
      for (const side of [-1, 1]) box({ x: o.x, y: o.y + side * (o.h / 2 - 0.04), z: glassZ + 0.03, w: o.w, h: 0.08, d: 0.1, color: frame })
      if (o.door) {
        for (const panelY of [o.y - 0.58, o.y + 0.12]) box({ x: o.x, y: panelY, z: glassZ + 0.05, w: o.w * 0.7, h: 0.5, d: 0.06, color: doorColor })
        box({ x: o.x - 0.3, y: o.y - 0.18, z: glassZ + 0.13, w: 0.035, h: 0.26, d: 0.06, color: '#b6a577' })
        panel({ x: o.x, y: o.y + o.h / 2 - 0.28, z: glassZ + 0.02, w: o.w - 0.19, h: 0.37, color: '#718782', rect: atlas.uv('glasspane') })
        box({x:o.x+o.w/2+0.13,y:o.y-0.47,z:f+0.015,w:0.085,h:0.18,d:0.035,color:'#928c72'})
        if (!retail) box({x:o.x,y:o.y-0.84,z:glassZ+0.105,w:0.35,h:0.065,d:0.055,color:'#9c8b64'})
      } else {
        box({ x: o.x, y: o.y, z: glassZ + 0.065, w: o.w, h: 0.065, d: 0.08, color: frame })
        if (o.shop) box({ x: o.x, y: o.y, z: glassZ + 0.065, w: 0.07, h: o.h, d: 0.08, color: frame })
      }
      box({ x: o.x, y: o.y - o.h / 2 - 0.07, z: f + 0.08, w: o.w + 0.34, h: 0.17, d: 0.53, color: trim })
      box({ x: o.x, y: o.y + o.h / 2 + 0.13, z: f + 0.035, w: o.w + 0.3, h: 0.24, d: 0.37, color: trim })
      if (o.floor) box({ x: o.x, y: o.y + o.h / 2 + 0.26, z: f + 0.10, w: 0.18, h: 0.29, d: 0.41, color: trim })
      if (!retail && o.floor && facadeStyle === 2) {
        const y = o.y + o.h / 2 + .35
        for (const side of [-1,1]) beam(set.opaque, point(o.x+side*(o.w/2+.18),y,f+.20), point(o.x,y+.34,f+.20), .14, trim, white)
      }
      if (o.floor && o.floor <= 2 && (house+o.floor)%3 === 0 && index%2 === 0) {
        const acY = o.y-o.h/2+0.14
        box({x:o.x,y:acY,z:f+0.14,w:0.64,h:0.38,d:0.48,color:'#8b928b'})
        panel({x:o.x,y:acY,z:f+0.387,w:0.54,h:0.3,color:'#434e4b'})
        for (let slat=0;slat<5;slat++) panel({x:o.x,y:acY-0.12+slat*0.06,z:f+0.393,w:0.52,h:0.025,color:'#a0a599'})
        for (const side of [-1,1]) box({x:o.x+side*0.23,y:acY-0.25,z:f+0.07,w:0.035,h:0.2,d:0.3,color:iron})
      }
    }
    // Stone rustication and a slender belt above the raised ground floor.
    for (let y = 0.7; !identity && y < 4; y += 0.44) {
      const occupied = openings.filter((o) => y > o.y-o.h/2 && y < o.y+o.h/2).sort((a,b)=>a.x-b.x)
      let left = -width / 2
      for (const o of [...occupied, { x: width / 2, w: 0 }]) {
        const right = o.x-o.w/2
        if (right > left) box({ x: (left+right)/2, y, z: f+0.008, w: right-left, h: 0.016, d: 0.018, color: '#74624e', faces: ['south'] })
        left = o.x+o.w/2
      }
    }
    box({ y: 4.06, z: f+0.08, w: width, h: 0.2, d: 0.38, color: trim })
    for (const [y, out, height] of [[h-0.25, 0.22, 0.22], [h+0.02, 0.36, 0.16], [h+0.17, 0.48, 0.14]]) {
      box({ y, z: f+out/2, w: width+0.08, h: height, d: out+0.3, color: trim })
    }
    for (let x = -width/2+0.25; x < width/2; x += facadeStyle === 1 ? 1.08 : 0.47) box({ x, y: h-0.42, z: f+0.15, w: facadeStyle === 0 ? .18 : .12, h: facadeStyle === 0 ? .38 : .22, d: .3, color: trim })
    if (!retail && facadeStyle === 3) {
      // A modest stepped parapet differentiates the roofline without changing
      // any house, stoop or sidewalk footprint.
      for (const [w, rise] of [[3.6,.3],[2.4,.54],[1.2,.78]]) box({y:h+rise/2+.26,z:f-.12,w,h:rise,d:.36,color:stone})
      box({y:h+1.07,z:f-.1,w:1.32,h:.13,d:.46,color:trim})
    }
    emitSurfaceTiles(set.opaque, { ...point(0, h, 0), w: width-0.25, d: depth-0.25, ry: yaw, color: '#ffffff', rect: atlas.uv('roof-tar') })
    for (const side of [-1,1]) box({ x: side*(width/2-0.09), y: h+0.16, w: 0.18, h: 0.45, d: depth, color: stone })
    box({ y: h+0.16, z: -f+0.09, w: width, h: 0.45, d: 0.18, color: stone })
    box({ x: -width*0.26, y: h+0.6, z: -f+2, w: 0.7, h: 1.2, d: 0.9, color: '#ffffff', rect: brick })
    box({ x: -width*0.26, y: h+1.22, z: -f+2, w: 0.9, h: 0.12, d: 1.1, color: trim })

    if (!retail) {
      const top = 1.18, run = 2.4, stepCount = 6
      for (let step = 0; step < stepCount; step++) {
        const stepH = 0.22 + (top-0.22)*(1-step/stepCount)
        box({ x: doorX, y: stepH/2, z: f+(step+0.5)*run/stepCount, w: 1.78, h: stepH, d: run/stepCount+0.015, color: stone })
      }
      for (const side of [-1,1]) {
        const x = doorX+side*0.82
        rail([x,top+0.94,f+0.15],[x,1.13,f+run-0.08],0.065)
        for (let i=0;i<6;i++) { const t=i/5; const z=f+0.15+t*(run-0.23); const y=top+(0.25-top)*t; rail([x,y,z],[x,y+0.92,z],0.035) }
      }
      // Basement area railings stop before the door; sidewalks retain a clear
      // walking strip and only the house/stoop footprints are solid.
      for (let x=-width/2+0.18; x<doorX-1.05; x+=0.23) rail([x,0.24,f+1.08],[x,1.18,f+1.08],0.028)
      rail([-width/2+0.12,1.12,f+1.08],[doorX-1.08,1.12,f+1.08],0.052)
      const stoopPoint = point(doorX,0,f+run/2)
      colliders.push({ type: 'box', x: stoopPoint.x, z: stoopPoint.z, hx: 0.88, hz: run/2, ry: yaw, height: top, tag: 'stoop' })
    } else {
      const awningColor = identity === 'records' ? '#28483c' : identity === 'club' ? '#3d2d40' : ['#294e43','#354b5b','#6e3430','#4e5440'][house%4]
      box({ y: 3.03, z: f+0.36, w: width-0.22, h: 0.38, d: 0.8, color: awningColor })
      // Canvas canopy has a sloping top, fabric valance and narrow supports.
      const p = (x,y,z) => point(x,y,z)
      const half = width/2-0.15
      const canopy = [p(-half,2.93,f+1.2),p(half,2.93,f+1.2),p(half,3.24,f+0.1),p(-half,3.24,f+0.1)]
      set.opaque.quad(canopy, awningColor, white)
      set.opaque.quad([...canopy].reverse(), awningColor, white)
      panel({ y: 2.78, z: f+1.2, w: width-0.3, h: 0.3, color: awningColor })
      const signTile = row.signTile || 'shop-'+[0,3,5,1,4][house%5]
      const signPoint = identity ? point(0,3.52,f+0.307) : point(0,2.78,f+1.217)
      atlas.signSources?.push({ ...signPoint, text: atlas.signLabels?.[signTile] || 'RECORDS', w: identity ? Math.min(width-1.1,8.5) : Math.min(width-0.5,4), h: identity ? 0.65 : 0.23, yaw, color: awningColor })
      if (identity) {
        box({ y: 3.52, z: f+0.13, w: width-0.6, h: 0.82, d: 0.32, color: awningColor })
        panel({ x: 1.2, y: 1.62, z: f+0.018, w: 0.62, h: 0.85, color: '#ffffff', rect: atlas.uv('music-flyer') })
        const lightPoint = point(0,2.63,f+0.9)
        set.emissive.box({ ...lightPoint, w: width-1, h: 0.035, d: 0.07, ry: yaw, color: identity === 'records' ? '#d2ae71' : '#9f629f', rect: white, emissive: true })
        atlas.lightSources?.push({ ...lightPoint, color: identity === 'records' ? '#edbe78' : '#b565af', power: 38, distance: 9, type: 'shop' })
      }
      if (house%2===1) {
        // Stacked fire-escape landings use narrow steel deck bars rather than
        // opaque slabs. All dimensions share the 3.05m storey spacing.
        for (let floor=1;floor<floors;floor++) {
          const y = 1.5+floor*floorHeight
          for (let z=f+0.15;z<f+1.05;z+=0.11) box({ x: 0, y, z, w: 2.75, h: 0.05, d: 0.045, color: iron })
          for (const side of [-1,1]) { rail([side*1.38,y,f],[side*1.38,y,f+1.1],0.08); rail([side*1.38,y+0.92,f],[side*1.38,y+0.92,f+1.1]); }
          rail([-1.4,y+0.92,f+1.1],[1.4,y+0.92,f+1.1])
          for (let x=-1.35;x<1.4;x+=0.23) rail([x,y,f+1.1],[x,y+0.92,f+1.1],0.027)
          if (floor<floors-1) {
            for (const side of [-1,1]) rail([-1.15,y,f+0.42+side*0.22],[1.12,y+floorHeight,f+0.42+side*0.22],0.055)
            for (let step=0;step<12;step++) { const t=step/11; rail([-1.15+2.27*t,y+floorHeight*t,f+0.2],[-1.15+2.27*t,y+floorHeight*t,f+0.64],0.045) }
          }
        }
      }
    }
    // Back windows remain visible from the surrounding road, with sills and
    // darker glass. There is no open rear or invisible missing roof.
    for (let floor=0;floor<floors;floor++) for (const x of [-1.65,1.65]) {
      set.opaque.billboard({ ...point(x,2.4+floor*floorHeight,-f-0.025), ry: yaw+Math.PI, w: 1.15, h: 1.75, color: '#84918a', rect: atlas.uv('window-reflection') })
      box({ x, y: 1.47+floor*floorHeight, z: -f-0.12, w: 1.36, h: 0.16, d: 0.32, color: trim })
    }
    colliders.push({ type: 'box', x: origin.x, z: origin.z, hx: width/2, hz: depth/2, ry: yaw, height: h, tag })
  }
  return colliders
}

function streetTree(set, atlas, tree) {
  const white = atlas.uv('white'), rng = makeRng(`brooklyn-tree:${tree.x}:${tree.z}`)
  const b=set.opaque, x=tree.x, z=tree.z
  b.box({ x,y:0.225,z,w:1.32,h:0.06,d:1.5,color:'#6c695c',rect:white })
  b.plane({ x,y:0.259,z,w:1.13,d:1.3,color:'#3c3c2b',rect:atlas.uv('dirt') })
  for(let along=-0.6;along<=0.6;along+=0.15) {
    b.box({x:x+along,y:0.27,z,w:0.035,h:0.028,d:1.43,color:'#39463d',rect:white})
  }
  b.cylinder({x,y:1.95,z,r:0.17,rTop:0.105,h:3.4,seg:9,color:'#60523d',rect:white})
  for(let i=0;i<7;i++) {
    const angle=i*2.39996, rad=i===0?0:rng.range(0.6,1.45)
    const cx=x+Math.cos(angle)*rad, cz=z+Math.sin(angle)*rad, cy=4.25+rng.range(-0.35,1.1)
    emitBranch(b,atlas,{x,y:2.8,z},{x:cx,y:cy-0.2,z:cz},0.078)
    emitBranch(b,atlas,{x:cx,y:cy-0.7,z:cz},{x:cx+Math.sin(angle)*0.45,y:cy+0.4,z:cz+Math.cos(angle)*0.45},0.033)
    emitLeafCluster(atlas,{x:cx,y:cy,z:cz,r:rng.range(0.9,1.25),color:rng.pick(['#4e7040','#648248','#3b6038','#547840']),seed:'brooklyn'})
  }
  return {type:'circle',x,z,r:0.3,height:5.5,tag:'street-tree'}
}

export function buildBrooklynBlock(set, atlas, propsData, landmark) {
  const colliders=[]
  for (const row of landmark.rows || []) colliders.push(...buildBrownstoneRow(set,atlas,row,'brooklyn-row'))
  // Wall-mounted café menu at the purposeful NPC stop; no pavement footprint.
  set.opaque.box({x:-430.2,y:1.32,z:-138.545,w:.66,h:.92,d:.08,color:'#88704f',rect:atlas.uv('white')})
  set.opaque.billboard({x:-430.2,y:1.32,z:-138.589,w:.59,h:.84,ry:Math.PI,color:'#ffffff',rect:atlas.uv('cafe-menu')})
  // Paving is laid at the curb elevation, in separate rectangles that leave
  // the garage driveway open. The road graph supplies the connecting asphalt.
  for (const patch of landmark.paving || []) emitSurfaceTiles(set.opaque,{x:patch.x,y:0.221,z:patch.z,w:patch.w,d:patch.d,color:'#ffffff',rect:atlas.uv('sidewalk')},8)
  for (const tree of landmark.trees || []) colliders.push(streetTree(set,atlas,tree))
  const rng=makeRng('brooklyn-lamps')
  for (const lamp of landmark.lamps || []) { const collider=emitProp(set,atlas,propsData,'streetlight-heritage',lamp.x,0,lamp.z,0,rng); if(collider)colliders.push(collider) }
  // Manholes and drains provide street-scale cues without a separate material.
  for(const cover of landmark.manholes || []) {
    set.opaque.cylinder({x:cover.x,y:0.031,z:cover.z,r:0.34,h:0.016,seg:16,color:'#555852',rect:atlas.uv('white')})
    for(let i=-2;i<=2;i++)set.opaque.box({x:cover.x+i*0.1,y:0.042,z:cover.z,w:0.026,h:0.007,d:0.47,color:'#292e2b',rect:atlas.uv('white')})
  }
  return colliders
}

/** Music stops use the same masonry/window kit at their existing mission
 * locations; all display furniture stays behind the open approach line. */
export function buildMusicVenue(set, atlas, propsData, landmark) {
  const spec = landmark.frontage
  const colliders = []
  for (const row of spec.rows) colliders.push(...buildBrownstoneRow(set, atlas, row, landmark.type))
  for (const patch of spec.paving || []) emitSurfaceTiles(set.opaque, {
    x: patch.x, y: 0.222, z: patch.z, w: patch.w, d: patch.d, color: '#ffffff', rect: atlas.uv('sidewalk'),
  }, 8)
  const rng = makeRng('music-venue:' + landmark.id)
  for (const planter of spec.planters || []) {
    const collider = emitProp(set, atlas, propsData, 'planter-tree', planter.x, 0, planter.z, 0, rng)
    if (collider) colliders.push(collider)
  }
  for (const lamp of spec.lamps || []) {
    const collider = emitProp(set, atlas, propsData, lamp.type || 'streetlight-heritage', lamp.x, 0, lamp.z, 0, rng)
    if (collider) colliders.push(collider)
  }
  const white = atlas.uv('white')
  for (const crate of spec.crates || []) {
    const b = set.opaque, x = crate.x, z = crate.z
    b.box({x,y:0.47,z,w:1.12,h:0.52,d:0.72,color:'#574330',rect:white})
    for(const side of [-1,1])b.box({x:x+side*0.54,y:0.83,z,w:0.08,h:0.34,d:0.74,color:'#776349',rect:white})
    b.box({x,y:0.71,z,w:1.16,h:0.1,d:0.8,color:'#a08a62',rect:white})
    for(let i=0;i<7;i++) {
      b.box({x,y:0.86,z:z-0.24+i*0.075,w:0.97,h:0.3,d:0.035,color:rng.pick(['#876e4e','#ab8261','#647469','#c0b083','#775b51']),rect:white})
    }
    atlas.signSources?.push({x,y:0.88,z:z-0.413,w:0.75,h:0.16,yaw:Math.PI,text:'USED LPs · $5',color:'#574330'})
    b.cylinder({x:x+0.25,y:1.029,z:z+0.12,r:0.17,h:0.014,seg:16,color:'#202a28',rect:white})
    b.cylinder({x:x+0.25,y:1.039,z:z+0.12,r:0.045,h:0.008,seg:12,color:'#c39c58',rect:white})
    colliders.push({type:'box',x,z,hx:0.58,hz:0.4,height:1.05,tag:'record-display'})
  }
  return colliders
}
