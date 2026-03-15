import { cp, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const nestedCesiumDir = resolve(root, 'dist', 'kings_wood', 'cesium')
const outputCesiumDir = resolve(root, 'dist', 'cesium')
const nestedBaseDir = resolve(root, 'dist', 'kings_wood')

if (!existsSync(nestedCesiumDir)) {
  process.exit(0)
}

await mkdir(resolve(root, 'dist'), { recursive: true })

if (existsSync(outputCesiumDir)) {
  await rm(outputCesiumDir, { force: true, recursive: true })
}

await cp(nestedCesiumDir, outputCesiumDir, { recursive: true })
await rm(nestedBaseDir, { force: true, recursive: true })

console.log('Moved Cesium static assets to dist/cesium for GitHub Pages compatibility.')
