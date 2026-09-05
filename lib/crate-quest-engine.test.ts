import assert from "node:assert/strict"
import test from "node:test"
import {
  canWalkCrateQuest,
  createCrateQuest,
  CRATE_QUEST_SPEED,
  interactCrateQuest,
  nearbyQuestEntity,
  QUEST_ENTITIES,
  QUEST_RECORDS,
  startCrateQuest,
  tickCrateQuest,
  type CrateQuestState,
} from "./crate-quest-engine"

function visit(state: CrateQuestState, id: string) {
  const entity = QUEST_ENTITIES.find((entry) => entry.id === id)!
  const start = { x: Math.floor(state.player.x), y: Math.floor(state.player.y), path: [] as { x: number; y: number }[] }
  const queue = [start]
  const visited = new Set([start.x + "," + start.y])
  let route: typeof start.path | undefined
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i]
    if (Math.hypot(point.x + 0.5 - entity.x, point.y + 0.5 - entity.y) <= 1.05) {
      route = point.path
      break
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = point.x + dx,
        y = point.y + dy,
        key = x + "," + y
      if (visited.has(key) || !canWalkCrateQuest(x + 0.5, y + 0.5)) continue
      visited.add(key)
      queue.push({ x, y, path: [...point.path, { x: x + 0.5, y: y + 0.5 }] })
    }
  }
  assert.ok(route, id + " must be reachable through normal doors and paths")
  for (const target of route) {
    let frames = 0
    while (Math.hypot(state.player.x - target.x, state.player.y - target.y) > 0.001) {
      const dx = target.x - state.player.x,
        dy = target.y - state.player.y
      tickCrateQuest(
        state,
        Math.min(0.05, Math.hypot(dx, dy) / CRATE_QUEST_SPEED),
        dx / Math.hypot(dx, dy),
        dy / Math.hypot(dx, dy),
      )
      assert.ok(++frames < 100, "the actual movement loop must follow the open route to " + id)
    }
  }
  assert.equal(nearbyQuestEntity(state)?.id, id)
  interactCrateQuest(state)
}
const closeDialogue = (state: CrateQuestState) => {
  if (state.phase === "dialogue") interactCrateQuest(state)
}

test("the complete three-record set is winnable through ordinary movement, NPC dialogue and store doors", () => {
  const state = createCrateQuest()
  startCrateQuest(state)
  visit(state, "mara")
  assert.equal(state.phase, "dialogue")
  closeDialogue(state)
  visit(state, "warmup-bin")
  closeDialogue(state)
  visit(state, "peak-bin")
  closeDialogue(state)
  visit(state, "milo")
  closeDialogue(state)
  assert.equal(state.courtyardTip, true)
  visit(state, "yard-bin")
  closeDialogue(state)
  assert.equal(state.phase, "playing", "collecting the last record must not automatically complete or exit")
  assert.deepEqual(new Set(state.records), new Set(QUEST_RECORDS.map((record) => record.id)))
  visit(state, "mara")
  assert.equal(state.phase, "complete")
  assert.ok(state.elapsed > 0)
  const completed = JSON.stringify(state)
  tickCrateQuest(state, 0.05, 1, 0)
  interactCrateQuest(state)
  assert.equal(JSON.stringify(state), completed)
})

test("reserved and already collected crates cannot grant records or early completion", () => {
  const state = createCrateQuest()
  startCrateQuest(state)
  visit(state, "yard-bin")
  assert.equal(state.records.length, 0)
  assert.match(state.dialogue!.text, /Ask him/)
  closeDialogue(state)
  visit(state, "warmup-bin")
  closeDialogue(state)
  interactCrateQuest(state)
  assert.deepEqual(state.records, ["warmup"])
  assert.match(state.dialogue!.text, /already packed/)
  closeDialogue(state)
  visit(state, "mara")
  assert.equal(state.phase, "dialogue")
  assert.equal(state.records.length, 1)
})

test("on-foot movement blocks solid NPCs, walls, shelves, crates and the water", () => {
  assert.equal(canWalkCrateQuest(0.5, 5.5), false)
  assert.equal(canWalkCrateQuest(3.5, 4.5), false)
  assert.equal(canWalkCrateQuest(14.5, 18.5), false)
  assert.equal(canWalkCrateQuest(14.5, 12.5), false)
  for (const entity of QUEST_ENTITIES) assert.equal(canWalkCrateQuest(entity.x, entity.y), false)
  const state = createCrateQuest()
  startCrateQuest(state)
  for (let i = 0; i < 200; i++) tickCrateQuest(state, 0.05, 0, -1)
  assert.ok(state.player.y >= 14.06, "held movement cannot pass through Mara")
  assert.ok(state.player.y < 14.2, "the player should reach the NPC body")
})

test("dialogue and completion freeze movement, diagonal speed is normalized, and restart is fresh", () => {
  const straight = createCrateQuest(),
    diagonal = createCrateQuest()
  startCrateQuest(straight)
  startCrateQuest(diagonal)
  tickCrateQuest(straight, 0.05, 1, 0)
  tickCrateQuest(diagonal, 0.05, 1, -1)
  assert.ok(
    Math.abs(Math.hypot(diagonal.player.x - 14.5, diagonal.player.y - 16.5) - (straight.player.x - 14.5)) < 0.0001,
  )
  visit(straight, "mara")
  const before = JSON.stringify(straight)
  tickCrateQuest(straight, 10, 1, 1)
  assert.equal(JSON.stringify(straight), before)
  const fresh = createCrateQuest()
  assert.equal(fresh.phase, "intro")
  assert.deepEqual(fresh.records, [])
  assert.equal(fresh.courtyardTip, false)
})
