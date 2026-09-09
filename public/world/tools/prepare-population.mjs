#!/usr/bin/env node
/** Optimize the Blender-authored cast and retarget the licensed locomotion set. */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { retargetHumanoid } from './retarget-humanoid.mjs'

const requireTools = createRequire(fileURLToPath(new URL('../../../scripts/world-asset-tools/package.json', import.meta.url)))
const { NodeIO } = requireTools('@gltf-transform/core')
const { ALL_EXTENSIONS, EXTTextureWebP } = requireTools('@gltf-transform/extensions')
const { prune, dedup, unpartition, resample, weld, simplify, cloneDocument, textureCompress, meshopt } = requireTools('@gltf-transform/functions')
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = requireTools('meshoptimizer')
const sharp = requireTools('sharp'), validator = requireTools('gltf-validator')
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready])
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
const raw = path.resolve(process.argv[2] || '/tmp/raffi-population-raw')
const output = path.resolve(process.argv[3] || fileURLToPath(new URL('../assets/population/', import.meta.url)))
const selected = process.argv[4]?.split(',')
const sourceAnimation = path.resolve(process.env.RAFFI_ANIMATION_SOURCE || '/tmp/raffi-character-source-verify/UAL1_Standard.glb')
const animationDocument = await io.read(sourceAnimation)
const catalog = JSON.parse(await fs.readFile(new URL('../data/population.json', import.meta.url), 'utf8'))
const countTriangles = doc => doc.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().reduce((total, primitive) => total + (primitive.getIndices()?.getCount() || primitive.getAttribute('POSITION').getCount()) / 3, 0), 0)
function geometryHash(document) {
  const hash = createHash('sha256')
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) for (const accessor of [primitive.getAttribute('POSITION'), primitive.getIndices()]) {
    const array = accessor.getArray(); hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength))
  }
  return hash.digest('hex')
}
await fs.mkdir(output, { recursive: true })
const results = []
for (const spec of [...catalog.identities, ...(catalog.player ? [catalog.player] : [])].filter(spec => !selected || selected.includes(spec.id))) {
  const document = await io.read(path.join(raw, spec.id + '.glb'))
  // Blender preserves transparent cards; these are opaque cutouts in the game,
  // preventing alpha sorting and eliminating unrelated normal/specular textures.
  for (const material of document.getRoot().listMaterials()) {
    material.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null)
    material.setMetallicFactor(0).setRoughnessFactor(.83)
    if (material.getAlphaMode() !== 'OPAQUE') material.setAlphaMode('MASK').setAlphaCutoff(.38).setDoubleSided(true)
  }
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) primitive.setAttribute('TANGENT', null)
  const clips = retargetHumanoid(document, animationDocument)
  // glTF skins use joint world transforms and ignore mesh-node TRS. Keep mesh
  // nodes at scene root with identity TRS; the fitted rig retains body scale.
  for (const node of document.getRoot().listNodes().filter(node => node.getSkin())) {
    const parent = node.getParentNode()
    if (parent) { parent.removeChild(node); document.getRoot().listScenes()[0].addChild(node) }
    node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1])
  }
  document.getRoot().listScenes()[0].setExtras({ identity: spec, authoring: 'Blender 4.5.13 LTS + MPFB; individually fitted body, head, wardrobe and hair' })
  await document.transform(prune(), dedup(), unpartition(), resample(), weld())
  const originalTriangles = countTriangles(document)
  for (const [lod, target, resolution] of spec.id === 'player' ? [['near', 12000, 1024], ['far', 5800, 512]] : [['near', 5800, 1024], ['far', 1450, 256]]) {
    const copy = cloneDocument(document)
    if (lod === 'far' && spec.id !== 'player') for (const animation of copy.getRoot().listAnimations()) {
      if (!['idle', 'walk', 'purposeful', 'run', 'sprint', 'talk', 'sit'].includes(animation.getName())) {
        for (const channel of animation.listChannels()) channel.dispose()
        for (const sampler of animation.listSamplers()) sampler.dispose()
        animation.dispose()
      }
    }
    await copy.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, target / originalTriangles), error: lod === 'near' ? .012 : .05, lockBorder: false }), prune(), weld())
    if (lod === 'near' && spec.id !== 'player' && countTriangles(copy) > 6500) await copy.transform(simplify({ simplifier: MeshoptSimplifier, ratio: 5800 / countTriangles(copy), error: .04, lockBorder: false }), prune())
    if (lod === 'far' && spec.id !== 'player' && countTriangles(copy) > 1550) await copy.transform(simplify({ simplifier: MeshoptSimplifier, ratio: 1450 / countTriangles(copy), error: .12, lockBorder: false }), prune())
    if (lod === 'far' && spec.id !== 'player' && countTriangles(copy) > 1600) await copy.transform(simplify({ simplifier: MeshoptSimplifier, ratio: 1450 / countTriangles(copy), error: 1, lockBorder: false }), prune())
    for (const texture of copy.getRoot().listTextures()) {
      const inspection = await sharp(texture.getImage()).resize(128, 128, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      let placeholder = 0
      for (let i = 0; i < inspection.data.length; i += inspection.info.channels) if (inspection.data[i] > 225 && inspection.data[i + 1] < 25 && inspection.data[i + 2] > 225) placeholder++
      if (placeholder > inspection.info.width * inspection.info.height * .002) throw new Error(`Unexpected missing-image magenta in ${spec.id}: ${texture.getName()}`)
      const limit = /eyebrow/i.test(texture.getName()) ? 128 : /hair|bob|short|afro|ponytail|braid|long01|bun|cortu/i.test(texture.getName()) ? Math.min(resolution, 512) : resolution
      texture.setImage(await sharp(texture.getImage()).resize({ width: limit, height: limit, fit: 'inside', withoutEnlargement: true }).webp({ quality: lod === 'near' ? 86 : 75 }).toBuffer()).setMimeType('image/webp')
      texture.setName('population-tex-' + createHash('sha256').update(texture.getImage()).digest('hex'))
    }
    copy.createExtension(EXTTextureWebP).setRequired(true)
    await copy.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
    const triangles = countTriangles(copy), filename = spec.id + '-' + lod + '.glb'
    // Rosa's independent braid cards retain a small topology floor. Keep that
    // single measured exception; all other distant people remain below 1.6k.
    const triangleBudget = lod === 'near' ? 6500 : spec.id === 'rosa' ? 1750 : 1600
    if (spec.id !== 'player' && triangles > triangleBudget) throw new Error(`Population geometry budget exceeded: ${filename}: ${triangles}`)
    const bytes = await io.writeBinary(copy)
    const validation = await validator.validateBytes(bytes, { uri: filename, maxIssues: 100 })
    if (validation.issues.numErrors) throw new Error(`Invalid ${filename}: ${JSON.stringify(validation.issues)}`)
    await fs.writeFile(path.join(output, filename), bytes)
    const textures = await Promise.all(copy.getRoot().listTextures().map(async texture => { const meta = await sharp(texture.getImage()).metadata(); return { width: meta.width, height: meta.height, bytes: texture.getImage().length } }))
    const record = { id: spec.id, lod, file: filename, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), geometrySha256: geometryHash(copy), triangles, triangleBudget: spec.id === 'player' ? (lod === 'near' ? 12500 : 6500) : triangleBudget, originalTriangles,
      geometryCount: copy.getRoot().listMeshes().length, draws: copy.getRoot().listMeshes().reduce((total, mesh) => total + mesh.listPrimitives().length, 0), skeletonJoints: copy.getRoot().listSkins()[0].listJoints().length,
      clips: copy.getRoot().listAnimations().map(clip => clip.getName()), textures, decodedTextureRGBA8WithMipsBytes: Math.ceil(textures.reduce((total, texture) => total + texture.width * texture.height * 4 * 4 / 3, 0)), validation: validation.issues }
    results.push(record)
    process.stdout.write(JSON.stringify(record) + '\n')
  }
}
await fs.writeFile(path.join(output, selected ? 'population-build-' + selected.join('-') + '.json' : 'population-build.json'), JSON.stringify({ toolchain: { blender: '4.5.13 LTS', gltfTransform: '4.5.0', meshoptimizer: '1.2.0', sharp: '0.35.4' }, results }, null, 2) + '\n')
if (!selected) {
  const sourceManifest = JSON.parse(await fs.readFile(process.env.RAFFI_POPULATION_SOURCES || '/tmp/raffi-mpfb-packs/population-source-manifest.json', 'utf8'))
  const authoring = JSON.parse(await fs.readFile(path.join(raw, 'authoring.json'), 'utf8'))
  const animationSources = JSON.parse(await fs.readFile(path.join(path.dirname(sourceAnimation), 'download-index.json'), 'utf8')).filter(file => file.pack === 'animation')
  await fs.copyFile(process.env.RAFFI_MPFB_LICENSE || '/tmp/raffi-mpfb-source/LICENSE.ASSETS.md', path.join(output, 'MPFB-ASSETS-LICENSE.txt'))
  await fs.copyFile(path.join(path.dirname(sourceAnimation), 'License.txt'), path.join(output, 'QUATERNIUS-ANIMATION-LICENSE.txt'))
  const manifest = {
    id: 'nyc-natural-population-v1', license: 'CC0-1.0', author: 'MakeHuman Community and listed source asset authors; original fitted cast, cloth colors, relaxed idle and facial-hair surfaces by Raffi World',
    sources: [{ id: 'mpfb', source: 'https://github.com/makehumancommunity/mpfb2', revision: sourceManifest.mpfbRevision, licenseFile: 'population/MPFB-ASSETS-LICENSE.txt' }, { id: 'quaternius-animation', source: 'https://quaternius.com/packs/universalanimationlibrary.html', licenseFile: 'population/QUATERNIUS-ANIMATION-LICENSE.txt', sourceFiles: animationSources }],
    sourceFiles: sourceManifest.files, authoring, blender: { version: '4.5.13 LTS', execution: 'Official Blender bpy module; body/head fitting, rigging, wardrobe fitting, UV atlas bake and GLB export run in Blender.', mpfbRevision: sourceManifest.mpfbRevision },
    identities: catalog.identities, player: catalog.player, units: 'metres; +Y up; +Z forward',
    geometry: { uniqueNearNpcGeometry: new Set(results.filter(result => result.lod === 'near' && result.id !== 'player').map(result => result.geometrySha256)).size, verification: 'SHA256 of vertex positions and indices; excludes names, colors and metadata.' },
    runtime: { nearMaximum: { low: 0, medium: 4, high: 6 }, farMixerHz: 12, farShadows: false, independentSkeletons: true, immutableTexturesAndGeometryShared: true, firstPlayPolicy: 'Load twelve small far templates and the player, then stream only nearby identity detail.' },
    modifications: ['Individually fitted twelve adults and one separate player with natural gender/age/build/height/head targets, fitted source wardrobe and hair.', 'Replaced source clothing logos and body normal detail with original woven colors; preserved licensed footwear panels/soles/laces; baked opaque skin/clothes/eyes to one map and cutout hair/brows separately.', 'Removed hidden body geometry, baked T-pose as rest, authored relaxed standing, retargeted locomotion/talk/sit and sports clips by world-space rest rotations.', 'Generated distinct near/far geometry, pruned distant animation sets, compressed Meshopt/WebP, hashed shared textures, and validated GLB payloads.'],
    limitations: 'Animation blends preserve source gait and independent phase; terrain grounding is a cached visual offset, not full foot IK. Carrying uses small original hand-held props. Source mannequins, source packs and Blender files are not shipped to players.',
    lods: results.map(result => ({ ...result, file: 'population/' + result.file })),
    reproduce: ['npm ci --prefix scripts/world-asset-tools', 'python3 public/world/tools/download-population-source.py --work /tmp/raffi --setup --python python3.11', 'python3 public/world/tools/download-character-source.py /tmp/raffi-character-source --pack animation', '/tmp/raffi-blender-runtime/bin/python public/world/tools/author-population.py --plan public/world/tools/population-authoring.json --save-blend', 'RAFFI_ANIMATION_SOURCE=/tmp/raffi-character-source/UAL1_Standard.glb node public/world/tools/prepare-population.mjs'],
  }
  await fs.mkdir(path.join(output, '..', 'manifests'), { recursive: true })
  await fs.writeFile(path.join(output, '..', 'manifests', 'nyc-population.json'), JSON.stringify(manifest, null, 2) + '\n')
}
