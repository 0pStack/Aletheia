import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildField, FIELD_SIZE } from './meerkatField'

// A sphere of radius 0.25 in the middle of the grid, encoded the way the bake writes distance.
function sphereDistance(): Uint8Array {
  const n = FIELD_SIZE
  const bytes = new Uint8Array(n * n * n)
  for (let z = 0; z < n; z++) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const p = [x, y, z].map((c) => (c + 0.5) / n - 0.5)
        const distance = Math.hypot(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0) - 0.25
        bytes[(z * n + y) * n + x] = Math.round((distance / 4 + 0.5) * 255)
      }
    }
  }
  return bytes
}

function texel(field: Uint8Array, x: number, y: number, z: number) {
  const i = ((z * FIELD_SIZE + y) * FIELD_SIZE + x) * 4
  const decode = (byte: number | undefined) => ((byte ?? 0) / 255) * 2 - 1
  return {
    gradient: [decode(field[i]), decode(field[i + 1]), decode(field[i + 2])],
    distanceByte: field[i + 3],
  }
}

describe('buildField', () => {
  it('rejects a file that is not a full distance grid', () => {
    expect(() => buildField(new Uint8Array(10))).toThrow(/expected 262144 bytes/)
  })

  it('keeps the distance in alpha, byte for byte', () => {
    const distance = sphereDistance()
    const field = buildField(distance)

    expect(field).toHaveLength(distance.length * 4)
    expect(texel(field, 5, 40, 12).distanceByte).toBe(
      distance[(12 * FIELD_SIZE + 40) * FIELD_SIZE + 5],
    )
  })

  it('points the gradient away from the surface on every side', () => {
    const field = buildField(sphereDistance())
    const mid = FIELD_SIZE / 2
    const cases = [
      { at: [mid + 20, mid, mid], axis: 0, sign: 1 },
      { at: [mid - 20, mid, mid], axis: 0, sign: -1 },
      { at: [mid, mid + 20, mid], axis: 1, sign: 1 },
      { at: [mid, mid, mid - 20], axis: 2, sign: -1 },
    ] as const

    for (const { at, axis, sign } of cases) {
      const { gradient } = texel(field, at[0], at[1], at[2])
      expect(Math.sign(gradient[axis] ?? 0)).toBe(sign)
      expect(Math.abs(gradient[axis] ?? 0)).toBeGreaterThan(0.9)
    }
  })

  it('keeps the gradient finite at the grid border', () => {
    const field = buildField(sphereDistance())
    const { gradient } = texel(field, 0, 0, 0)
    const length = Math.hypot(gradient[0] ?? 0, gradient[1] ?? 0, gradient[2] ?? 0)

    expect(length).toBeGreaterThan(0.9)
    expect(length).toBeLessThan(1.1)
  })
})

describe('loadMeerkatField', () => {
  // The field is cached per page, so each case gets a fresh module.
  async function freshLoader() {
    vi.resetModules()
    const { loadMeerkatField } = await import('./meerkatField')
    return loadMeerkatField
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches the field from the asset base and builds it once', async () => {
    const fetchField = vi.fn(() =>
      Promise.resolve(new Response(new Uint8Array(FIELD_SIZE ** 3).buffer)),
    )
    vi.stubGlobal('fetch', fetchField)
    const load = await freshLoader()

    const first = await load('/assets/')
    const second = await load('/assets/')

    expect(fetchField).toHaveBeenCalledTimes(1)
    expect(fetchField).toHaveBeenCalledWith('/assets/team/meerkat_64.sdf')
    expect(first).toHaveLength(FIELD_SIZE ** 3 * 4)
    expect(second).toBe(first)
  })

  it('reports a failed response and tries again on the next call', async () => {
    const fetchField = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(new Uint8Array(FIELD_SIZE ** 3).buffer))
    vi.stubGlobal('fetch', fetchField)
    const load = await freshLoader()

    await expect(load('/')).rejects.toThrow('Meerkat field: HTTP 404')
    await expect(load('/')).resolves.toHaveLength(FIELD_SIZE ** 3 * 4)
    expect(fetchField).toHaveBeenCalledTimes(2)
  })
})
