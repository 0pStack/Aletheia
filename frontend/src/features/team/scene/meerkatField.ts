// The meerkat as a signed distance field: a 64³ grid, x fastest, then y (up), then z (towards
// the viewer). The file holds distance only, one byte a voxel encoded as distance / 4 + 0.5 in
// grid widths, negative inside. The direction away from the surface is rebuilt here instead of
// shipped: baked, those three channels are noise to a compressor and grew the file from 31 kB
// gzipped to 900 kB, while rebuilding them costs a few milliseconds once.
export const FIELD_SIZE = 64

const VOXELS = FIELD_SIZE * FIELD_SIZE * FIELD_SIZE

const encode = (unit: number) => Math.round((unit * 0.5 + 0.5) * 255)

/** Distance bytes in, RGBA bytes out: rgb = unit gradient * 0.5 + 0.5, a = the distance byte. */
export function buildField(distance: Uint8Array): Uint8Array {
  if (distance.length !== VOXELS) {
    throw new Error(`Meerkat field: expected ${VOXELS} bytes, got ${distance.length}`)
  }
  const n = FIELD_SIZE
  const field = new Uint8Array(VOXELS * 4)
  const at = (x: number, y: number, z: number) => distance[(z * n + y) * n + x] ?? 0
  const lo = (c: number) => Math.max(c - 1, 0)
  const hi = (c: number) => Math.min(c + 1, n - 1)

  for (let z = 0; z < n; z++) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        // Central differences inside, one-sided at the border, so edge voxels still get a direction.
        const gx = at(hi(x), y, z) - at(lo(x), y, z)
        const gy = at(x, hi(y), z) - at(x, lo(y), z)
        const gz = at(x, y, hi(z)) - at(x, y, lo(z))
        const length = Math.hypot(gx, gy, gz)
        const i = ((z * n + y) * n + x) * 4
        // A flat patch (deep inside or far out) has no direction; point it up rather than nowhere.
        field[i] = encode(length ? gx / length : 0)
        field[i + 1] = encode(length ? gy / length : 1)
        field[i + 2] = encode(length ? gz / length : 0)
        field[i + 3] = at(x, y, z)
      }
    }
  }
  return field
}

// Fetched and rebuilt once per page, like the ice block: every visit to the landing reuses it.
let cached: Promise<Uint8Array> | null = null

export function loadMeerkatField(assetBase: string): Promise<Uint8Array> {
  if (cached) return cached
  cached = fetch(`${assetBase}team/meerkat_64.sdf`)
    .then((response) => {
      if (!response.ok) throw new Error(`Meerkat field: HTTP ${response.status}`)
      return response.arrayBuffer()
    })
    .then((buffer) => buildField(new Uint8Array(buffer)))
    .catch((error: unknown) => {
      // A failed load must not stick: the next visit to the landing tries again.
      cached = null
      throw error
    })
  return cached
}
