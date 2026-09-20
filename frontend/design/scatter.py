"""Rubble scatter for the landing site, previewed in Blender.

Reads the shared layout in ../src/features/home/scene/siteLayout.json and lays out every tier with
the same seeded generator the browser uses, so a Blender render shows the composition the page will
draw. Coordinates in the layout are the web scene's (x east, z south, y up); Blender is x, -z, up.

Run from Blender:  exec(open(r"...\scatter.py").read())
"""
import json
import math
import os

import bpy
import numpy as np

HERE = os.path.dirname(bpy.data.filepath) or os.getcwd()
LAYOUT = os.path.normpath(os.path.join(HERE, "..", "src", "features", "home", "scene", "siteLayout.json"))
MASK = 0xFFFFFFFF


def mulberry32(seed):
    """The browser's PRNG, bit for bit, so both ends draw the same scatter."""
    state = seed & MASK

    def next_float():
        nonlocal state
        state = (state + 0x6D2B79F5) & MASK
        t = ((state ^ (state >> 15)) * (1 | state)) & MASK
        t = ((t + (((t ^ (t >> 7)) * (61 | t)) & MASK)) ^ t) & MASK
        return ((t ^ (t >> 14)) & MASK) / 4294967296.0

    return next_float


def height_lookup(mesh, size, cells):
    """Highest point per cell, read bilinearly: over rubble a single cell value lifts stones clear
    of the ground, and at 0.5 m cells the maximum is the surface anyway."""
    n = len(mesh.vertices)
    co = np.empty(n * 3, dtype=np.float32)
    mesh.vertices.foreach_get("co", co)
    co = co.reshape(n, 3)
    x, z, y = co[:, 0], -co[:, 1], co[:, 2]
    keep = np.maximum(np.abs(x), np.abs(z)) <= size / 2
    x, z, y = x[keep], z[keep], y[keep]
    ix = np.clip(((x / size + 0.5) * cells).astype(np.int64), 0, cells - 1)
    iz = np.clip(((z / size + 0.5) * cells).astype(np.int64), 0, cells - 1)
    grid = np.full(cells * cells, -np.inf)
    np.maximum.at(grid, iz * cells + ix, y)
    grid = grid.reshape(cells, cells)
    filled = np.isfinite(grid)
    grid = np.where(filled, grid, 0.0)

    def at(px, pz):
        u = np.clip((px / size + 0.5) * cells - 0.5, 0, cells - 1)
        v = np.clip((pz / size + 0.5) * cells - 0.5, 0, cells - 1)
        i0, j0 = np.floor(u).astype(np.int64), np.floor(v).astype(np.int64)
        i1, j1 = np.minimum(i0 + 1, cells - 1), np.minimum(j0 + 1, cells - 1)
        fu, fv = u - i0, v - j0
        top = grid[j0, i0] * (1 - fu) + grid[j0, i1] * fu
        bot = grid[j1, i0] * (1 - fu) + grid[j1, i1] * fu
        return top * (1 - fv) + bot * fv

    return at


def scatter(layout, tier, rnd):
    """Every random draw for a tier, in one place, so props.ts can mirror it line for line."""
    vp, ahead, left = layout["viewpoint"], layout["ahead"], layout["left"]
    gouge, clear = layout["gouge"], layout["clearing"]
    reach = layout["fieldReach"]
    near, far, power, forward = tier["near"], tier["far"], tier["power"], tier["forward"]
    from_view = tier["origin"] == "view"
    lo, hi = tier["size"]

    def sample():
        distance = near + (far - near) * rnd() ** power
        if from_view and rnd() < forward:
            # spreadScale tightens a tier toward the view axis; the default fans it wide, which
            # throws a small tier (the boulders) mostly outside the 28 degree frame.
            spread = (rnd() - 0.5) * (12.0 + distance * 0.95) * tier.get("spreadScale", 1.0)
            return (vp["x"] + ahead["x"] * distance + left["x"] * spread,
                    vp["z"] + ahead["z"] * distance + left["z"] * spread)
        angle = rnd() * math.tau
        ox, oz = (vp["x"], vp["z"]) if from_view else (0.0, 0.0)
        return ox + math.sin(angle) * distance, oz + math.cos(angle) * distance

    def is_clear(x, z):
        if math.hypot(x, z) < clear["block"]:
            return False
        if math.hypot(x - vp["x"], z - vp["z"]) < clear["camera"]:
            return False
        if math.hypot(x, z) > reach:
            return False
        along = x * gouge["x"] + z * gouge["z"]
        across = abs(-x * gouge["z"] + z * gouge["x"])
        return not (0 < along < gouge["length"] and across < gouge["width"])

    # Stones lie flat and tumble; crystals stand up and barely lean. Defaults are the stone case.
    tilt = tier.get("tilt", 0.5)
    sy0, sy1 = tier.get("scaleY", [0.45, 0.80])

    # Rubble gathers in banks with open ground between; an even sprinkle reads as noise.
    fields = []
    for _ in range(tier["clusters"]):
        fx, fz = sample()
        fields.append((fx, fz, tier["spread"][0] + (tier["spread"][1] - tier["spread"][0]) * rnd()))

    out = []
    guard = tier["count"] * 60
    while len(out) < tier["count"] and guard > 0:
        guard -= 1
        if not fields or rnd() < tier["loose"]:
            x, z = sample()
        else:
            fx, fz, spread = fields[min(int(rnd() * len(fields)), len(fields) - 1)]
            x = fx + (rnd() + rnd() + rnd() - 1.5) * spread
            z = fz + (rnd() + rnd() + rnd() - 1.5) * spread
        if not is_clear(x, z):
            continue
        size = (lo + (hi - lo) * rnd() ** tier["sizePower"]) * (1.0 + math.hypot(x, z) * tier["grow"])
        out.append(dict(x=x, z=z, size=size, yaw=rnd() * math.tau,
                        tiltX=(rnd() - 0.5) * tilt, tiltZ=(rnd() - 0.5) * tilt,
                        scaleY=sy0 + (sy1 - sy0) * rnd(), scaleZ=0.82 + rnd() * 0.36, tint=rnd()))
    return out


# Base rock albedo, linear: the browser's rockMaterial colour. Per-instance tint multiplies it.
ROCK = np.array([0.395, 0.258, 0.158])


def rubble_material():
    mat = bpy.data.materials.get("Rubble")
    if mat:
        return mat
    mat = bpy.data.materials.new("Rubble")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 0.9
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "Col"
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def build(tier, places, ground):
    """One merged mesh per tier: the same triangles the browser instances, cheap to render here."""
    sources = []
    for name in tier["meshes"]:
        src = bpy.data.objects[name].data
        vn = len(src.vertices)
        co = np.empty(vn * 3, dtype=np.float64)
        src.vertices.foreach_get("co", co)
        # loop_triangles, not polygons: authored meshes (the crystals) carry quads and n-gons
        if hasattr(src, "calc_loop_triangles"):
            src.calc_loop_triangles()
        loops = np.empty(len(src.loop_triangles) * 3, dtype=np.int32)
        src.loop_triangles.foreach_get("vertices", loops)
        sources.append((co.reshape(vn, 3), loops.reshape(-1, 3)))

    verts, faces, colors, offset = [], [], [], 0
    warm = np.array(LAYOUT_DATA["tint"]["warm"])
    cool = np.array(LAYOUT_DATA["tint"]["cool"])
    for i, p in enumerate(places):
        co, tris = sources[i % len(sources)]
        s = p["size"]
        scale = np.array([s, s * p["scaleZ"], s * p["scaleY"]])       # web y-up -> blender z-up
        cy, sy = math.cos(p["yaw"]), math.sin(p["yaw"])
        cx, sx = math.cos(p["tiltX"]), math.sin(p["tiltX"])
        rot = np.array([[cy, -sy, 0.0], [sy, cy, 0.0], [0.0, 0.0, 1.0]]) @ \
              np.array([[1.0, 0.0, 0.0], [0.0, cx, -sx], [0.0, sx, cx]])
        # sink is a fraction of the stone's own height, not of size: source meshes differ in
        # flatness, so a size-relative sink buries flat ones and floats tall ones.
        h = float(co[:, 2].max() - co[:, 2].min()) * scale[2]
        at = np.array([p["x"], -p["z"], ground(p["x"], p["z"]) - h * tier["sink"]])
        verts.append((co * scale) @ rot.T + at)
        faces.append(tris + offset)
        offset += len(co)
        colors.append(np.repeat(((ROCK * (cool + (warm - cool) * p["tint"]))[None, :]), len(co), 0))

    mat = bpy.data.materials.get(tier.get("material", "")) or rubble_material()
    me = bpy.data.meshes.new(f"Rub_{tier['name']}")
    me.from_pydata(np.concatenate(verts).tolist(), [], np.concatenate(faces).tolist())
    me.update()
    me.materials.append(mat)
    ca = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
    rgba = np.ones((offset, 4), dtype=np.float32)
    rgba[:, :3] = np.clip(np.concatenate(colors), 0.0, 1.0)
    ca.data.foreach_set("color", rgba.ravel())
    name = f"Rub_{tier['name']}"
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return len(places), offset, len(me.polygons)


def run():
    global LAYOUT_DATA
    with open(LAYOUT, encoding="utf-8") as fh:
        LAYOUT_DATA = json.load(fh)
    for ob in [o for o in bpy.context.scene.objects if o.name.startswith("Scat_")]:
        bpy.data.objects.remove(ob, do_unlink=True)

    site = height_lookup(bpy.data.objects["Terrain"].data, LAYOUT_DATA["siteSize"], 320)
    field = height_lookup(bpy.data.objects["Backdrop"].data, 960, 120)
    half = LAYOUT_DATA["siteSize"] / 2

    def ground(x, z):
        return float(site(x, z) if max(abs(x), abs(z)) < half else field(x, z))

    rnd = mulberry32(LAYOUT_DATA["seed"])
    report = []
    for tier in LAYOUT_DATA["tiers"]:
        if tier["count"] <= 0:                      # tier switched off: drop its mesh, keep its config
            gone = bpy.data.objects.get(f"Rub_{tier['name']}")
            if gone:
                bpy.data.objects.remove(gone, do_unlink=True)
            report.append((tier["name"], 0, 0, 0))
            continue
        places = scatter(LAYOUT_DATA, tier, rnd)
        report.append((tier["name"],) + build(tier, places, ground))
    return report


if __name__ != "never":
    for row in run():
        print("tier %-9s placed=%-5d verts=%-7d tris=%d" % row)
