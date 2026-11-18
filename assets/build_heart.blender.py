"""Modela o coração 3D + anel no Blender, exporta GLB otimizado,
renderiza um pôster WebP e converte as fotos para WebP."""
import bpy, bmesh, math, os, sys
from mathutils import Vector

OUT = r"."
ASSETS = os.path.join(OUT, "assets")
os.makedirs(ASSETS, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- coração implícito ----------
# (x² + 9/4·y² + z² − 1)³ − x²·z³ − 9/80·y²·z³ = 0   (z para cima, y = profundidade)
DEPTH = 1.25  # >1 deixa o coração mais "fofinho" na profundidade

def f(p):
    x, y, z = p.x, p.y / DEPTH, p.z
    a = x * x + 2.25 * y * y + z * z - 1.0
    return a * a * a - x * x * z ** 3 - 0.1125 * y * y * z ** 3

CENTER = Vector((0.0, 0.0, 0.05))

def surface_point(d):
    # marcha para fora e acha a última transição dentro -> fora
    steps, rmax = 160, 2.2
    last_inside = 0.0
    for i in range(1, steps + 1):
        r = rmax * i / steps
        if f(CENTER + d * r) <= 0:
            last_inside = r
    lo, hi = last_inside, last_inside + rmax / steps
    for _ in range(30):
        mid = (lo + hi) / 2
        if f(CENTER + d * mid) <= 0:
            lo = mid
        else:
            hi = mid
    return CENTER + d * lo

# esfera com os polos no eixo da profundidade (y) para não cair nas pontas do coração
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=104, v_segments=60, radius=1.0)
for v in bm.verts:
    # gira a esfera: polo z -> y
    x, y, z = v.co
    d = Vector((x, z, y)).normalized()
    v.co = surface_point(d)
mesh = bpy.data.meshes.new("Coracao")
bm.to_mesh(mesh)
bm.free()
heart = bpy.data.objects.new("Coracao", mesh)
scene.collection.objects.link(heart)

# suaviza levemente sem perder a ponta
bpy.context.view_layer.objects.active = heart
heart.select_set(True)
# voxel remesh elimina as dobras da malha na reentrância de cima
rm = heart.modifiers.new("Remesh", "REMESH")
rm.mode = "VOXEL"
rm.voxel_size = 0.018
bpy.ops.object.modifier_apply(modifier=rm.name)
sm = heart.modifiers.new("Suave", "SMOOTH")
sm.factor = 0.6
sm.iterations = 6
bpy.ops.object.modifier_apply(modifier=sm.name)
dc = heart.modifiers.new("Decimar", "DECIMATE")
dc.ratio = min(1.0, 9000 / max(1, 2 * len(heart.data.polygons)))
bpy.ops.object.modifier_apply(modifier=dc.name)
bpy.ops.object.shade_smooth()
mesh = heart.data
print("HEART faces", len(mesh.polygons))

# centraliza e normaliza a altura para 2.0
bbox = [heart.matrix_world @ Vector(c) for c in heart.bound_box]
mn = Vector((min(b.x for b in bbox), min(b.y for b in bbox), min(b.z for b in bbox)))
mx = Vector((max(b.x for b in bbox), max(b.y for b in bbox), max(b.z for b in bbox)))
mid = (mn + mx) / 2
for v in mesh.vertices:
    v.co -= mid
s = 2.0 / (mx.z - mn.z)
for v in mesh.vertices:
    v.co *= s
mesh.update()
print("HEART dims", tuple(round(d, 3) for d in heart.dimensions), "verts", len(mesh.vertices))

def principled(name, color, metallic, rough, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = coat
    return m

heart.data.materials.append(principled("Rubi", (0.55, 0.02, 0.09), 0.1, 0.18, 1.0))

# ---------- anel de ouro rosé com diamante ----------
bpy.ops.mesh.primitive_torus_add(major_radius=0.62, minor_radius=0.055,
                                 major_segments=72, minor_segments=14, location=(0, 0, 0))
ring = bpy.context.active_object
ring.name = "Anel"
bpy.ops.object.shade_smooth()
ring.data.materials.append(principled("OuroRose", (0.93, 0.62, 0.48), 1.0, 0.22))

# diamante lapidado simples: coroa + pavilhão
bm = bmesh.new()
N, R, top, crown, pav = 16, 0.13, 0.07, 0.0, -0.16
TABLE = R * 0.6
ring_top = [bm.verts.new((TABLE * math.cos(2 * math.pi * i / N), TABLE * math.sin(2 * math.pi * i / N), top)) for i in range(N)]
girdle = [bm.verts.new((R * math.cos(2 * math.pi * (i + .5) / N), R * math.sin(2 * math.pi * (i + .5) / N), crown)) for i in range(N)]
tip = bm.verts.new((0, 0, pav))
bm.faces.new(ring_top)
for i in range(N):
    j = (i + 1) % N
    bm.faces.new((ring_top[i], girdle[i], ring_top[j]))
    bm.faces.new((ring_top[j], girdle[i], girdle[j]))
    bm.faces.new((girdle[i], tip, girdle[j]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
gm = bpy.data.meshes.new("Diamante")
bm.to_mesh(gm)
bm.free()
gem = bpy.data.objects.new("Diamante", gm)
scene.collection.objects.link(gem)
gem.location = (0, 0.62 + 0.13 + 0.03, 0)  # em cima do aro (anel deitado no plano XY)
gem.rotation_euler = (-math.pi / 2, 0, 0)
gem.parent = ring
gem.data.materials.append(principled("Diamante", (0.92, 0.96, 1.0), 0.0, 0.02))
# engaste
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.07, depth=0.08, location=(0, 0.62 + 0.06, 0),
                                    rotation=(-math.pi / 2, 0, 0))
prong = bpy.context.active_object
prong.name = "Engaste"
prong.parent = ring
prong.data.materials.append(ring.data.materials[0])

# ---------- exporta GLB ----------
for o in bpy.data.objects:
    o.select_set(True)
glb = os.path.join(OUT, "coracao.glb")
bpy.ops.export_scene.gltf(
    filepath=glb, export_format="GLB", use_selection=True,
    export_texcoords=False, export_meshopt_compression_enable=True, export_normals=True, export_tangents=False,
    export_animations=False, export_apply=True, export_yup=True,
    export_extras=False, export_cameras=False, export_lights=False,
)
print("GLB", os.path.getsize(glb))

# ---------- pôster (render EEVEE, fundo transparente) ----------
try:
    ring.hide_render = True
    gem.hide_render = True
    prong.hide_render = True
    heart.rotation_euler = (0, 0, math.radians(-18))
    scene.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = scene.render.resolution_y = 640
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.quality = 82
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 85
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (0, -9.2, 0.15)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.25, 0.12, 0.16, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    def light(name, kind, loc, energy, color, size=2.0):
        ld = bpy.data.lights.new(name, kind)
        ld.energy = energy
        ld.color = color
        if hasattr(ld, "size"):
            ld.size = size
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        scene.collection.objects.link(lo)
        lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    light("Key", "AREA", (-3.5, -4, 4), 900, (1.0, 0.86, 0.78), 3)
    light("Rim", "AREA", (4, 3, 2), 700, (1.0, 0.55, 0.65), 2)
    light("Fill", "AREA", (3, -4, -2), 200, (0.9, 0.75, 1.0), 4)
    scene.render.filepath = os.path.join(ASSETS, "coracao-poster.webp")
    bpy.ops.render.render(write_still=True)
    print("POSTER ok", os.path.getsize(scene.render.filepath))
except Exception as e:
    print("POSTER FAIL", e)

# ---------- fotos -> WebP ----------
for name in ("foto-1", "foto-2", "foto-3"):
    img = bpy.data.images.load(os.path.join(OUT, name + ".jpg"))
    s = scene.render.image_settings
    s.file_format = "WEBP"
    s.color_mode = "RGB"
    s.quality = 78
    out = os.path.join(ASSETS, name + ".webp")
    img.save_render(out, scene=scene)
    print("PHOTO", name, img.size[:], os.path.getsize(out))
