/** World-space retargeting between T-pose rigs with different bone axes/proportions. */
import * as THREE from 'three'

export const POPULATION_CLIPS = new Map([
  ['Idle_Loop', 'idle'], ['Idle_Talking_Loop', 'talk'], ['Walk_Loop', 'walk'],
  ['Walk_Formal_Loop', 'purposeful'], ['Jog_Fwd_Loop', 'run'], ['Sprint_Loop', 'sprint'],
  ['Interact', 'interact'], ['Driving_Loop', 'drive'], ['Sitting_Enter', 'enter'],
  ['Sitting_Exit', 'exit'], ['Sitting_Idle_Loop', 'sit'], ['Dance_Loop', 'dance'], ['Punch_Jab', 'jab'],
])

function depth(node) { let n = 0; for (let p = node.getParentNode(); p; p = p.getParentNode()) n++; return n }
function sample(sampler, time, quaternion) {
  const times = sampler.getInput().getArray(), output = sampler.getOutput(), values = output.getArray(), width = output.getElementSize()
  let left = 0
  while (left < times.length - 2 && times[left + 1] <= time) left++
  const right = Math.min(left + 1, times.length - 1), alpha = sampler.getInterpolation() === 'STEP' ? 0 : THREE.MathUtils.clamp((time - times[left]) / Math.max(1e-8, times[right] - times[left]), 0, 1)
  if (sampler.getInterpolation() === 'CUBICSPLINE') throw new Error('Re-review cubic animation source before retargeting')
  if (quaternion) return new THREE.Quaternion().fromArray(values, left * width).slerp(new THREE.Quaternion().fromArray(values, right * width), alpha)
  return new THREE.Vector3().fromArray(values, left * width).lerp(new THREE.Vector3().fromArray(values, right * width), alpha)
}

/** MPFB must bake its supplied T-pose as rest before this stage. */
export function retargetHumanoid(targetDocument, sourceDocument, { clips = POPULATION_CLIPS, fps = 30 } = {}) {
  const targetRoot = targetDocument.getRoot(), buffer = targetRoot.listBuffers()[0]
  const sourceNodes = sourceDocument.getRoot().listNodes().slice().sort((a, b) => depth(a) - depth(b))
  const targetNodes = targetRoot.listNodes().slice().sort((a, b) => depth(a) - depth(b))
  const sourceByName = new Map(sourceNodes.map(node => [node.getName().toLowerCase(), node]))
  const joints = new Set(targetRoot.listSkins().flatMap(skin => skin.listJoints()))
  const rest = node => {
    const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix()), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3()
    matrix.decompose(position, quaternion, scale)
    return { matrix, position, quaternion, scale }
  }
  const sourceRest = new Map(sourceNodes.map(node => [node, rest(node)])), targetRest = new Map(targetNodes.map(node => [node, rest(node)]))
  const targetByName = new Map(targetNodes.map(node => [node.getName().toLowerCase(), node]))
  const sourceHead = sourceByName.get('head'), targetHead = targetByName.get('head')
  const heightRatio = targetRest.get(targetHead).position.y / sourceRest.get(sourceHead).position.y
  const result = []
  for (const original of sourceDocument.getRoot().listAnimations()) {
    const name = clips.get(original.getName())
    if (!name) continue
    const channels = new Map(), tracks = new Map(), targetPositions = []
    let duration = 0
    for (const channel of original.listChannels()) {
      const times = channel.getSampler().getInput().getArray()
      duration = Math.max(duration, times[times.length - 1])
      if (!channels.has(channel.getTargetNode())) channels.set(channel.getTargetNode(), new Map())
      channels.get(channel.getTargetNode()).set(channel.getTargetPath(), channel.getSampler())
    }
    const frameCount = Math.max(2, Math.ceil(duration * fps) + 1), times = new Float32Array(frameCount)
    for (const node of joints) if (sourceByName.has(node.getName().toLowerCase())) tracks.set(node, [])
    for (let frame = 0; frame < frameCount; frame++) {
      const time = duration * frame / (frameCount - 1); times[frame] = time
      const sourcePose = new Map(), targetPose = new Map(), targetWorldRotations = new Map()
      for (const node of sourceNodes) {
        const data = channels.get(node), position = data?.has('translation') ? sample(data.get('translation'), time, false) : new THREE.Vector3().fromArray(node.getTranslation())
        const quaternion = data?.has('rotation') ? sample(data.get('rotation'), time, true) : new THREE.Quaternion().fromArray(node.getRotation())
        const scale = data?.has('scale') ? sample(data.get('scale'), time, false) : new THREE.Vector3().fromArray(node.getScale())
        const matrix = new THREE.Matrix4().compose(position, quaternion, scale)
        const parent = node.getParentNode(); if (parent) matrix.premultiply(sourcePose.get(parent).matrix)
        const worldPosition = new THREE.Vector3(), worldQuaternion = new THREE.Quaternion(), worldScale = new THREE.Vector3()
        matrix.decompose(worldPosition, worldQuaternion, worldScale)
        sourcePose.set(node, { matrix, position: worldPosition, quaternion: worldQuaternion })
      }
      for (const node of targetNodes) {
        const source = sourceByName.get(node.getName().toLowerCase()), parent = node.getParentNode()
        const parentMatrix = parent ? targetPose.get(parent) : new THREE.Matrix4()
        const parentQuaternion = parent ? targetWorldRotations.get(parent) : new THREE.Quaternion()
        const position = new THREE.Vector3().fromArray(node.getTranslation()), quaternion = new THREE.Quaternion().fromArray(node.getRotation())
        if (joints.has(node) && source) {
          if (name === 'idle') {
            // An authored relaxed stand replaces the source's bent-knee combat
            // stance. Body proportions and planted feet stay in fitted rest;
            // arms hang naturally with a small breathing cycle.
            if (/^upperarm_[lr]$/.test(node.getName())) {
              const side = node.getName().endsWith('_l') ? 1 : -1
              const elbow = targetByName.get('lowerarm_' + (side === 1 ? 'l' : 'r'))
              const axis = targetRest.get(elbow).position.clone().sub(targetRest.get(node).position).normalize()
              const direction = new THREE.Vector3(side * .10, -.994, .04).normalize()
              const desired = new THREE.Quaternion().setFromUnitVectors(axis, direction).multiply(targetRest.get(node).quaternion)
              quaternion.copy(parentQuaternion).invert().multiply(desired).normalize()
            }
            if (node.getName().toLowerCase() === 'pelvis') position.y += .0015 * Math.sin(time / duration * Math.PI * 2)
          } else {
          const desired = sourcePose.get(source).quaternion.clone().multiply(sourceRest.get(source).quaternion.clone().invert()).multiply(targetRest.get(node).quaternion)
          quaternion.copy(parentQuaternion).invert().multiply(desired).normalize()
          // Keep hands relaxed through locomotion instead of importing a fist.
          if (['idle', 'walk', 'purposeful', 'talk'].includes(name) && /^(index|middle|ring|pinky|thumb)_/.test(node.getName())) quaternion.slerp(new THREE.Quaternion().fromArray(node.getRotation()), .85)
          if (node.getName().toLowerCase() === 'pelvis') {
            const world = sourcePose.get(source).position.clone().sub(sourceRest.get(source).position).multiplyScalar(heightRatio).add(targetRest.get(node).position)
            position.copy(world).applyMatrix4(parentMatrix.clone().invert())
          }
          }
          tracks.get(node).push(...quaternion.toArray())
        }
        const matrix = new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3().fromArray(node.getScale())).premultiply(parentMatrix)
        targetPose.set(node, matrix)
        targetWorldRotations.set(node, parentQuaternion.clone().multiply(quaternion))
        if (node.getName().toLowerCase() === 'pelvis') targetPositions.push(...position.toArray())
      }
    }
    const animation = targetDocument.createAnimation(name)
    const input = targetDocument.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer)
    for (const [node, values] of tracks) {
      const output = targetDocument.createAccessor().setType('VEC4').setArray(new Float32Array(values)).setBuffer(buffer)
      const sampler = targetDocument.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR')
      animation.addSampler(sampler).addChannel(targetDocument.createAnimationChannel().setTargetNode(node).setTargetPath('rotation').setSampler(sampler))
    }
    const pelvis = targetByName.get('pelvis'), output = targetDocument.createAccessor().setType('VEC3').setArray(new Float32Array(targetPositions)).setBuffer(buffer)
    const sampler = targetDocument.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR')
    animation.addSampler(sampler).addChannel(targetDocument.createAnimationChannel().setTargetNode(pelvis).setTargetPath('translation').setSampler(sampler))
    result.push({ name, duration, tracks: tracks.size, frames: frameCount })
  }
  return result
}
