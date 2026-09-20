import { BufferGeometry, Mesh, type Object3D } from 'three'

// The gouge the block cut on its way in, as a direction on the ground plane. The rock scatter
// keeps clear of it and the ice shards lie along it, so both must read the same line.
export const GOUGE = { x: -0.62, z: -0.78 } as const

export function findGeometry(root: Object3D, name: string, file: string): BufferGeometry {
  const node = root.getObjectByName(name)
  if (!(node instanceof Mesh) || !(node.geometry instanceof BufferGeometry)) {
    throw new Error(`${file} is missing the ${name} mesh`)
  }
  return node.geometry
}

// three's shaders are patched by replacing pieces of their source. A three release that renames
// a piece would otherwise leave the patch silently unapplied and the scene subtly wrong.
export type ShaderEdit = readonly [target: string, replacement: string]

export function patchShader(source: string, edits: readonly ShaderEdit[]): string {
  return edits.reduce((patched, [target, replacement]) => {
    if (!patched.includes(target)) throw new Error(`Shader patch target not found: ${target}`)
    return patched.replace(target, replacement)
  }, source)
}
