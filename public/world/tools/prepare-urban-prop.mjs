#!/usr/bin/env node
/** Reproducibly select/close/optimise the CC0 Poly Haven street bin.
 * First run prepare-urban-assets.py --download. Toolchain:
 * npm ci --prefix scripts/world-asset-tools
 * Override the toolchain/cache with RAFFI_ASSET_TOOLCHAIN / RAFFI_ASSET_CACHE.
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
const toolchain = process.env.RAFFI_ASSET_TOOLCHAIN || fileURLToPath(new URL('../../../scripts/world-asset-tools/node_modules/', import.meta.url))
const moduleAt = async (name, file) => import(pathToFileURL(path.join(toolchain, name, file)).href)
const { NodeIO } = await moduleAt('@gltf-transform/core', 'dist/index.js')
const { prune, dedup, weld, unweld, tangents, simplify, join, getBounds } = await moduleAt('@gltf-transform/functions', 'dist/index.js')
const { MeshoptSimplifier } = await moduleAt('meshoptimizer', 'index.js')
const { default: sharp } = await moduleAt('sharp', 'dist/index.cjs')
const { generateTangents } = await moduleAt('mikktspace', 'dist/main/mikktspace_main.js')
await MeshoptSimplifier.ready
const cache = process.env.RAFFI_ASSET_CACHE || path.join(os.tmpdir(), 'raffi-material-source')
const assets = new URL('../assets/', import.meta.url)
const destination = new URL('props/', assets)
await fs.mkdir(destination, { recursive: true })
const io = new NodeIO()
const outputs = []
for (const lod of [0, 1]) {
  const document = await io.read(path.join(cache, 'metal_trash_can/source.gltf'))
  for (const node of document.getRoot().listNodes()) {
    if (node.getName().includes('rust')) { node.dispose(); continue }
    const position = node.getTranslation()
    node.setTranslation([position[0] - 0.5, position[1], position[2]])
    if (node.getName() === 'metal_trash_can_lid') {
      node.setTranslation([0, 0.905, 0])
      node.setRotation([0, 0, 0, 1])
    }
  }
  await document.transform(prune(), dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: lod ? 0.23 : 0.58, error: lod ? 0.004 : 0.0015 }), join(), prune())
  await document.transform(unweld(), tangents({ generateTangents }), weld())
  for (const material of document.getRoot().listMaterials()) material.setDoubleSided(false)
  for (const texture of document.getRoot().listTextures()) {
    // JPEG is universally decoded by glTF; no runtime decoder dependency.
    const bytes = await sharp(texture.getImage()).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: texture.getName().includes('nor') ? 95 : 88 }).toBuffer()
    texture.setImage(bytes).setMimeType('image/jpeg')
  }
  const bytes = await io.writeBinary(document)
  const name = `metal-trash-can-lod${lod}.glb`
  await fs.writeFile(new URL(name, destination), bytes)
  let triangles = 0
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) triangles += (primitive.getIndices()?.getCount() || primitive.getAttribute('POSITION').getCount()) / 3
  outputs.push({ path: 'props/' + name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), triangles, bounds: getBounds(document.getRoot().listScenes()[0]), lod, distance: lod ? 16 : 0 })
}
const manifestPath = new URL('manifests/polyhaven-urban.json', assets)
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
manifest.propSource.status = 'integrated runtime GLB, one closed-lid galvanized variant'
manifest.propSource.modifications = ['Rust variant removed.', 'Lid closed over the galvanized body; pivot centered at ground.', 'Four component nodes joined with authored UVs/normals retained.', 'Weld and bounded-error mesh simplification for two LODs.', 'MikkTSpace tangents generated for portable normal mapping.', 'Textures resized to512px, JPEG embedded; no decoder or runtime hotlink required.']
manifest.propSource.outputs = outputs
manifest.propSource.preparation = 'node public/world/tools/prepare-urban-prop.mjs'
manifest.propSource.toolVersions = {}
for (const name of ['@gltf-transform/core','@gltf-transform/functions','sharp','meshoptimizer','mikktspace']) manifest.propSource.toolVersions[name] = JSON.parse(await fs.readFile(path.join(toolchain,name,'package.json'),'utf8')).version
await fs.writeFile(manifestPath, JSON.stringify(manifest,null,2)+'\n')
process.stdout.write(JSON.stringify(outputs,null,2)+'\n')
