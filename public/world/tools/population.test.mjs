import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { getPopulationIdentity, appearanceForActor } from '../engine/population.js'
const catalog = JSON.parse(fs.readFileSync(new URL('../data/population.json', import.meta.url)))

test('the first twelve adults receive twelve unique stable identities across reload and roles', () => {
  const assigned = Array.from({ length: 12 }, (_, i) => getPopulationIdentity('FIXED', 'npc-' + i, catalog).id)
  assert.equal(new Set(assigned).size, 12)
  assert.deepEqual(assigned, Array.from({ length: 12 }, (_, i) => getPopulationIdentity('FIXED', 'npc-' + i, JSON.parse(JSON.stringify(catalog))).id))
  const source = { name: 'ped:commuter', userData: { npcId: 'npc-3', activityRole: 'delivery' } }
  const before = appearanceForActor(source, 'FIXED', catalog).id
  source.userData.activityRole = 'jogger'; source.name = 'ped:jogger'
  assert.equal(appearanceForActor(source, 'FIXED', catalog).id, before)
  assert.notDeepEqual(assigned, Array.from({ length: 12 }, (_, i) => getPopulationIdentity('OTHER', 'npc-' + i, catalog).id))
})

test('named characters and explicit appearance choices remain stable independently of world seeds', () => {
  assert.equal(getPopulationIdentity('A', 'story:last-crate-owner', catalog).id, getPopulationIdentity('B', 'story:last-crate-owner', catalog).id)
  assert.equal(appearanceForActor({ userData: { npcId: 'npc-2', appearanceId: 'inez' } }, 'A', catalog).id, 'inez')
  assert.ok(catalog.identities.every(identity => identity.age >= 18 && identity.height >= 1.5 && identity.height <= 2))
  assert.ok(new Set(catalog.identities.map(identity => identity.garment)).size >= 8)
})


test('ambient citizens never duplicate the recurring conversation hosts', () => {
  const reserved=new Set(catalog.reservedConversationIdentities)
  for(const seed of ['FIXED','OTHER'])for(let i=0;i<64;i++){
    const source={userData:{npcId:'npc-'+i}}
    const identity=appearanceForActor(source,seed,catalog)
    assert.ok(!reserved.has(identity.id))
    assert.equal(appearanceForActor(source,seed,catalog).id,identity.id)
  }
})
