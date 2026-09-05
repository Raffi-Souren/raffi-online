import assert from "node:assert/strict"
import test from "node:test"
import { canonicalJson, RAF_CANONICAL } from "./raf-os-canonical"

test("the named RAF JSON profile has independently specified canonical bytes", () => {
  assert.equal(RAF_CANONICAL, "raf-json-v1")
  assert.equal(
    canonicalJson({ z: [3, null, true], a: { y: "quote", b: 1 } }),
    '{"a":{"b":1,"y":"quote"},"z":[3,null,true]}',
  )
  assert.equal(canonicalJson({ "10": "ten", "2": "two", "1": "one" }), '{"1":"one","10":"ten","2":"two"}')
  assert.equal(canonicalJson({}), "{}")
  assert.equal(canonicalJson([]), "[]")
  assert.equal(canonicalJson(null), "null")
})

test("object key insertion order has no effect, including inside ordered arrays", () => {
  const first = { z: [{ b: 2, a: 1 }], a: { z: 4, b: 3 } }
  const second = { a: { b: 3, z: 4 }, z: [{ a: 1, b: 2 }] }
  assert.equal(canonicalJson(first), canonicalJson(second))
  assert.notEqual(canonicalJson([1, 2, 3]), canonicalJson([3, 2, 1]))
  assert.equal(canonicalJson([3, 2, 1]), "[3,2,1]")
  assert.deepEqual(Object.keys(first), ["z", "a"], "serialization does not mutate insertion order")
})

test("source strings preserve whitespace, case, Unicode and escaping rather than normalize evidence", () => {
  assert.equal(canonicalJson({ quote: '  Café\n"YES"\t\\  ' }), '{"quote":"  Café\\n\\"YES\\"\\t\\\\  "}')
  assert.notEqual(canonicalJson("Two paid"), canonicalJson("two paid"))
  assert.notEqual(canonicalJson("Two  paid"), canonicalJson("Two paid"))
  assert.notEqual(canonicalJson("é"), canonicalJson("e\u0301"))
  assert.equal(canonicalJson("\ud800"), '"\\ud800"')
})

test("finite JSON numbers preserve values and normalize negative zero only", () => {
  assert.equal(canonicalJson([-0, 0, 1.25, -12, 1e21]), "[0,0,1.25,-12,1e+21]")
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => canonicalJson(value), /finite/)
    assert.throws(() => canonicalJson({ nested: [value] }), /finite/)
  }
})

test("undefined, bigint, functions and symbols cannot silently disappear", () => {
  for (const value of [undefined, BigInt(1), () => 1, Symbol("value")]) {
    assert.throws(() => canonicalJson(value), TypeError)
    assert.throws(() => canonicalJson({ value }), TypeError)
    assert.throws(() => canonicalJson([value]), TypeError)
  }
  assert.throws(() => canonicalJson({ [Symbol("key")]: 1 }), /symbol/)
})

test("array holes and extra properties are rejected instead of being omitted or changed to null", () => {
  assert.throws(() => canonicalJson(new Array(2)), /holes/)
  const sparse: number[] = [1, 2]
  delete sparse[0]
  assert.throws(() => canonicalJson(sparse), /holes/)
  assert.throws(() => canonicalJson(Object.assign([1], { detail: true })), /extra properties/)
  assert.equal(canonicalJson([null]), "[null]")
})

test("classes and accessors cannot run custom serialization code", () => {
  let called = false
  class Custom {
    toJSON() {
      called = true
      return "changed"
    }
  }
  for (const value of [new Custom(), new Date(0), new Map(), new Set(), new Number(1)]) {
    assert.throws(() => canonicalJson(value), /plain objects/)
  }
  const accessor = Object.defineProperty({}, "value", {
    enumerable: true,
    get() {
      called = true
      return 1
    },
  })
  assert.throws(() => canonicalJson(accessor), /accessors/)
  assert.equal(called, false)
  assert.throws(() => canonicalJson(Object.defineProperty({}, "hidden", { value: 1 })), /hidden/)
})

test("cycles reject but repeated acyclic references and null-prototype dictionaries serialize", () => {
  const cycle: Record<string, unknown> = {}
  cycle.self = cycle
  assert.throws(() => canonicalJson(cycle), /cycles/)
  const arrayCycle: unknown[] = []
  arrayCycle.push(arrayCycle)
  assert.throws(() => canonicalJson(arrayCycle), /cycles/)
  const shared = { count: 2 }
  assert.equal(canonicalJson([shared, shared]), '[{"count":2},{"count":2}]')
  const dictionary = Object.create(null) as Record<string, unknown>
  dictionary["__proto__"] = { safe: true }
  dictionary.a = 1
  assert.equal(canonicalJson(dictionary), '{"__proto__":{"safe":true},"a":1}')
})
