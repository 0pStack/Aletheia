import { BufferGeometry, Group, Mesh, Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import { findGeometry, patchShader } from './sceneShared'

describe('findGeometry', () => {
  it('returns the geometry of the named mesh', () => {
    const geometry = new BufferGeometry()
    const root = new Group()
    root.add(Object.assign(new Mesh(geometry), { name: 'Rock' }))

    expect(findGeometry(root, 'Rock', 'site.glb')).toBe(geometry)
  })

  it('names the file and mesh when the mesh is missing', () => {
    expect(() => findGeometry(new Group(), 'Rock', 'site.glb')).toThrow(
      'site.glb is missing the Rock mesh',
    )
  })

  it('rejects a node of that name that is not a mesh', () => {
    const root = new Group()
    root.add(Object.assign(new Object3D(), { name: 'Rock' }))

    expect(() => findGeometry(root, 'Rock', 'site.glb')).toThrow(/missing the Rock mesh/)
  })
})

describe('patchShader', () => {
  it('applies every edit in order', () => {
    const patched = patchShader('void main() { a; b; }', [
      ['a;', 'x;'],
      ['x; b;', 'y;'],
    ])

    expect(patched).toBe('void main() { y; }')
  })

  it('fails loudly when a target is not in the source', () => {
    expect(() => patchShader('void main() {}', [['#include <fog>', '']])).toThrow(
      'Shader patch target not found: #include <fog>',
    )
  })
})
