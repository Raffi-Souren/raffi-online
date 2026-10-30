/**
 * RAFFI WORLD — Lab storefronts. A lit sign on the sidewalk for each Lab
 * room; walk up and press E to open that room in the desktop's Lab window.
 * The rooms themselves live on the desktop, so the street only points at them.
 */

import * as THREE from 'three'
import { state, data } from '../engine/state.js'

const RADIUS = 2.6
let fronts = []

const labFronts = () => data.world.labFronts || []

export function initLabFronts({ scene, collision }) {
  fronts = labFronts()
  const group = new THREE.Group()
  group.name = 'lab-fronts'
  const post = new THREE.MeshBasicMaterial({ color: 0x1d2633, fog: true })
  const back = new THREE.MeshBasicMaterial({ color: 0x24324a, fog: true })
  for (const front of fronts) {
    const sign = new THREE.Group()
    sign.name = 'lab-front:' + front.slug
    sign.position.set(front.x, 0, front.z)
    sign.rotation.y = front.ry || 0
    for (const x of [-0.7, 0.7]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.1), post)
      leg.position.set(x, 1.25, 0)
      sign.add(leg)
    }
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.56, 1.04, 0.08), back)
    board.position.set(0, 1.86, 0)
    sign.add(board)
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.98), new THREE.MeshBasicMaterial({ map: signTexture(front), fog: true }))
    face.position.set(0, 1.86, 0.045)
    sign.add(face)
    group.add(sign)
    collision?.add({ type: 'box', x: front.x, z: front.z, hx: 0.8, hz: 0.12, ry: front.ry || 0, tag: 'lab-front' })
  }
  scene.add(group)
}

function signTexture(front) {
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 252
  const ctx = canvas.getContext('2d')
  const sky = ctx.createLinearGradient(0, 0, 0, 64)
  sky.addColorStop(0, '#3d86f5')
  sky.addColorStop(1, '#1a55c9')
  ctx.fillStyle = '#ece9d8'
  ctx.fillRect(0, 0, 384, 252)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 384, 64)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 30px Tahoma, Verdana, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText('THE LAB', 22, 34)
  ctx.fillStyle = '#10213d'
  ctx.font = 'bold 34px Tahoma, Verdana, sans-serif'
  ctx.fillText(fit(ctx, front.name, 340), 22, 112)
  ctx.fillStyle = '#4d5565'
  ctx.font = '22px Tahoma, Verdana, sans-serif'
  ctx.fillText(fit(ctx, front.note || '', 340), 22, 156)
  ctx.fillStyle = '#f2bd45'
  ctx.fillRect(22, 190, 340, 42)
  ctx.fillStyle = '#10213d'
  ctx.font = 'bold 22px Tahoma, Verdana, sans-serif'
  ctx.fillText('E · Open in Lab →', 38, 212)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function fit(ctx, text, width) {
  let value = text
  while (value.length > 1 && ctx.measureText(value).width > width) value = value.slice(0, -2) + '…'
  return value
}

/** The context action when standing at a Lab sign on foot. */
export function labFrontContext() {
  if (state.mode !== 'foot' || state.interior) return null
  let best = null, bestDistance = RADIUS
  for (const front of fronts) {
    const distance = Math.hypot(front.x - state.player.x, front.z - state.player.z)
    if (distance <= bestDistance) { best = front; bestDistance = distance }
  }
  return best && { x: best.x, z: best.z, radius: RADIUS, kind: 'lab-door', key: 'E', label: 'OPEN', prompt: 'OPEN IN LAB → ' + best.name.toUpperCase(), target: best.slug }
}

export const labFrontsSnapshot = () => fronts.map(({ slug, name, x, z }) => ({ slug, name, x, z }))
