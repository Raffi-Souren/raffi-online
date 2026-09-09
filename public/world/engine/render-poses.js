/** Presentation-only interpolation. Restore every transform before the next simulation/input step. */
export function createRenderPoses() {
  const poses = new Map()
  const eligible = object => !object.userData.actorBatch && (object.userData.rig || object.userData.archetype || object.name === 'player' || object.name === 'player-locator')
  return {
    capture(scene) {
      const alive = new Set()
      for (const object of scene.children) {
        if (!eligible(object)) continue
        alive.add(object)
        let pose = poses.get(object)
        if (!pose) {
          pose = { previousPosition: object.position.clone(), previousRotation: object.quaternion.clone(), currentPosition: object.position.clone(), currentRotation: object.quaternion.clone(), applied: false }
          poses.set(object, pose)
        }
        pose.previousPosition.copy(object.position)
        pose.previousRotation.copy(object.quaternion)
      }
      for (const object of poses.keys()) if (!alive.has(object)) poses.delete(object)
    },
    apply(alpha) {
      for (const [object, pose] of poses) {
        pose.currentPosition.copy(object.position)
        pose.currentRotation.copy(object.quaternion)
        if (pose.previousPosition.distanceToSquared(object.position) > 256) continue
        object.position.lerpVectors(pose.previousPosition, pose.currentPosition, alpha)
        object.quaternion.slerpQuaternions(pose.previousRotation, pose.currentRotation, alpha)
        pose.applied = true
      }
    },
    restore() {
      for (const [object, pose] of poses) if (pose.applied) {
        object.position.copy(pose.currentPosition)
        object.quaternion.copy(pose.currentRotation)
        object.updateMatrixWorld(true)
        pose.applied = false
      }
    },
    reset() { poses.clear() },
  }
}
