import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import { mapPlaces, mapViewAngle, visibleMapPlaces } from "../game/minimap-details.js"

const world = JSON.parse(fs.readFileSync(new URL("../data/world.json", import.meta.url), "utf8"))
const view = { x: 0, z: 0, scale: 1, radius: 100 }

test("explicit map pins keep ownership until a new objective or clear replaces them", async () => {
  globalThis.location = { search: "" }
  globalThis.matchMedia = () => ({ matches: false })
  globalThis.window = { devicePixelRatio: 1 }
  globalThis.screen = { width: 1280, height: 800 }
  const { setWaypoint, getWaypoint } = await import("../game/hud.js")
  const { state } = await import("../engine/state.js")
  const park = mapPlaces(world).find(place => place.kind === "sports")
  assert.ok(park, "park must be reachable through the authored map")
  setWaypoint(park, park.label, "map")
  assert.equal(getWaypoint().source, "map")
  assert.deepEqual(state.navigation.waypoint, getWaypoint())
  const observed = getWaypoint(); observed.source = "changed"
  assert.equal(getWaypoint().source, "map", "observation must not mutate the pin")
  setWaypoint({ x: 12, z: 24 }, "RETURN THE CRATE")
  assert.equal(getWaypoint().source, undefined, "a newly accepted objective owns its own route")
  setWaypoint(null)
  assert.equal(getWaypoint(), null)
  assert.equal(state.navigation.waypoint, null)
})

test("map destinations follow authored garage, subway and repaint locations", () => {
  const places = mapPlaces(world)
  const hub = world.landmarks.find((landmark) => landmark.type === "mobility-hub")
  assert.deepEqual(
    places.find((place) => place.kind === "transit"),
    {
      ...hub.transit.at,
      kind: "transit",
      label: hub.transit.name,
    },
  )
  assert.equal(places.filter((place) => place.kind === "paint").length, world.repaintShops.length)
  assert.equal(mapPlaces({ landmarks: [{ type: "club", at: { x: NaN, z: 0 } }] }).length, 0)
})

test("camera sector follows the actual view, independently of player heading", () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 2.4]) {
    const angle = mapViewAngle(yaw)
    assert.ok(Math.abs(Math.cos(angle) + Math.sin(yaw)) < 1e-9)
    assert.ok(Math.abs(Math.sin(angle) + Math.cos(yaw)) < 1e-9)
  }
})

test("map symbols leave room for player, mission target, map edge and each other", () => {
  const points = [
    [0, 0],
    [2, 1],
    [45, 0],
    [46, 5],
    [0, 50],
    [98, 0],
    [500, 0],
  ].map(([x, z]) => ({ x, z, kind: "garage" }))
  const visible = visibleMapPlaces(points, { ...view, waypoint: { x: 0, z: 50 } })
  assert.deepEqual(
    visible.map(({ mx, my }) => [mx, my]),
    [[45, 0]],
  )
  const translated = visibleMapPlaces([{ x: 100, z: -50 }], { ...view, x: 40, z: -70, scale: 0.5 })
  assert.deepEqual(
    translated.map(({ mx, my }) => [mx, my]),
    [[30, 10]],
  )
})
