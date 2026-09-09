/** Stable visual identities, independent of gameplay role and relationship state. */
let catalogPromise = null
const assignments = new Map()
const templates = new Map()
const sharedTextures = new Map()

/** Immutable cache entry: callers clone skeletons and own mutable materials/mixers. */
export async function loadPopulationTemplate(identityId, lod = 'near') {
  const catalog = await loadPopulation()
  if (!catalog.identities.some(identity => identity.id === identityId) && catalog.player?.id !== identityId) throw new Error(`Unknown population identity: ${identityId}`)
  if (!['near', 'far'].includes(lod)) throw new Error(`Unknown population detail: ${lod}`)
  const url = new URL(`../assets/population/${identityId}-${lod}.glb`, import.meta.url).href
  if (!templates.has(url)) {
    templates.set(url, Promise.all([
      import('../vendor/loaders/GLTFLoader.js'), import('../vendor/utils/meshopt_decoder.module.js'),
    ]).then(([{ GLTFLoader }, { MeshoptDecoder }]) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url))
      .then(template => {
        template.scene.traverse(object => {
          if (!object.isMesh) return
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            const texture = material.map
            if (!texture?.name?.startsWith('population-tex-')) continue
            const existing = sharedTextures.get(texture.name)
            if (existing && existing !== texture) { material.map = existing; texture.dispose() }
            else sharedTextures.set(texture.name, texture)
          }
        })
        return template
      })
      .catch(error => { templates.delete(url); throw error }))
  }
  return templates.get(url)
}

export function loadPopulation() {
  if (!catalogPromise) catalogPromise = fetch(new URL('../data/population.json', import.meta.url)).then(response => {
    if (!response.ok) throw new Error('Could not load the curated population')
    return response.json()
  }).catch(error => { catalogPromise = null; throw error })
  return catalogPromise
}

function hash(text) {
  let value = 2166136261
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619)
  return value >>> 0
}

export function getPopulationIdentity(worldSeed, npcId, catalog) {
  if (!catalog?.identities?.length) throw new Error('A curated population catalog is required')
  const explicit = catalog.namedAssignments?.[npcId]
  if (explicit) return catalog.identities.find(identity => identity.id === explicit)
  const key = `${worldSeed}:${catalog.identities.map(identity => identity.id).join(',')}`
  if (!assignments.has(key)) {
    const order = [...catalog.identities]
    let random = hash(String(worldSeed) + ':population') || 1
    for (let i = order.length - 1; i > 0; i--) {
      random ^= random << 13; random ^= random >>> 17; random ^= random << 5
      const j = (random >>> 0) % (i + 1)
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    assignments.set(key, order)
  }
  const order = assignments.get(key), numeric = /^npc-(\d+)$/.exec(npcId || '')
  const index = numeric ? Number(numeric[1]) : hash(String(npcId || 'unassigned'))
  return order[index % order.length]
}

export function appearanceForActor(source, worldSeed, catalog) {
  const explicit = source.userData.appearanceId
  if (explicit) {
    const identity = catalog.identities.find(identity => identity.id === explicit)
    if (identity) return identity
  }
  const id = source.userData.npcId || source.userData.appearanceSeed || source.name
  // Important recurring hosts keep their faces throughout the neighborhood.
  const reserved = new Set(catalog.reservedConversationIdentities || [])
  const pool = /^npc-\d+$/.test(id || '') && reserved.size
    ? { ...catalog, identities: catalog.identities.filter(identity => !reserved.has(identity.id)) } : catalog
  return getPopulationIdentity(worldSeed, id, pool)
}
