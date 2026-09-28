import bpy, math, os, json, re
import xml.etree.ElementTree as ET
from mathutils import Vector

# -----------------------------
# NOVA canonical laptop model
# -----------------------------
# Unit: meters

OUT_DIR = os.path.abspath("assets/3d")
RENDER_DIR = os.path.abspath("assets/3d/renders")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(RENDER_DIR, exist_ok=True)

# Clean scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
    pass

# ---------- helpers ----------

def mat(name, color, metallic=0.0, roughness=0.45, emission=None, emission_strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return m

GRAPHITE = mat("NOVA Graphite", (0.055, 0.06, 0.068), metallic=0.88, roughness=0.26)
GRAPHITE_DARK = mat("NOVA Dark Edge", (0.022, 0.025, 0.03), metallic=0.65, roughness=0.28)
BLACK = mat("Key Black", (0.0015,0.0020,0.0030), metallic=0.0, roughness=0.68)
TRACK = mat("Trackpad Glass", (0.006,0.008,0.011), metallic=0.10, roughness=0.22)
TRACK_EDGE = mat("Trackpad Edge", (0.016,0.019,0.024), metallic=0.34, roughness=0.38)
GLASS = mat("Screen Glass", (0.003,0.005,0.009), metallic=0.15, roughness=0.08, emission=(0.015,0.03,0.055), emission_strength=0.18)
SCREEN = bpy.data.materials.new("Screen Art")
SCREEN.use_nodes = True
nodes = SCREEN.node_tree.nodes
links = SCREEN.node_tree.links
for n in list(nodes):
    nodes.remove(n)
out = nodes.new("ShaderNodeOutputMaterial")
bs = nodes.new("ShaderNodeBsdfPrincipled")
tex = nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(os.path.abspath("assets/3d/textures/nova_screen.png"), check_existing=True)
bs.inputs["Roughness"].default_value = 0.18
bs.inputs["Metallic"].default_value = 0.0
bs.inputs["Emission Strength"].default_value = 0.35
links.new(tex.outputs["Color"], bs.inputs["Base Color"])
links.new(tex.outputs["Color"], bs.inputs["Emission Color"])
links.new(bs.outputs["BSDF"], out.inputs["Surface"])
COPPER = mat("Copper", (0.20,0.055,0.015), metallic=0.92, roughness=0.24)
RUBBER = mat("Rubber", (0.006,0.007,0.009), metallic=0.0, roughness=0.76)
BOARD = mat("Motherboard PCB", (0.0015,0.0045,0.0042), metallic=0.12, roughness=0.54)
RAM_PCB = mat("RAM PCB", (0.0015,0.0035,0.0042), metallic=0.06, roughness=0.56)
CHIP = mat("Silicon Package", (0.006,0.008,0.011), metallic=0.12, roughness=0.46)
DIE = mat("Silicon Die", (0.035,0.048,0.066), metallic=0.72, roughness=0.20)
GOLD = mat("Contact Gold", (0.32,0.16,0.030), metallic=0.92, roughness=0.24)
BATTERY_MAT = mat("Battery Black", (0.0035,0.0045,0.0060), metallic=0.02, roughness=0.72)
FAN_MAT = mat("Fan Dark", (0.0025,0.0035,0.0050), metallic=0.08, roughness=0.58)
KEY_GLOW = mat("Keyboard Per-Key Glow", (0.0020,0.0025,0.0038), metallic=0.0, roughness=0.72, emission=(0.66,0.76,0.96), emission_strength=0.82)
KEY_LEGEND = mat("Keyboard Legend Glow", (0.018,0.022,0.030), metallic=0.0, roughness=0.46, emission=(0.78,0.84,1.0), emission_strength=0.92)
PORT_INNER = mat("Port Inner", (0.0008,0.0010,0.0015), metallic=0.0, roughness=0.82)
PORT_METAL = mat("Port Metal", (0.055,0.065,0.078), metallic=0.78, roughness=0.34)
PORT_TONGUE = mat("USB Port Tongue", (0.015,0.055,0.11), metallic=0.05, roughness=0.54)
THERMAL_PAD = mat("Thermal Pad", (0.012,0.022,0.027), metallic=0.0, roughness=0.82)
SILVER = mat("Machined Silver", (0.11,0.12,0.14), metallic=0.82, roughness=0.32)
PCB_SILK = mat("PCB Silkscreen", (0.10,0.12,0.12), metallic=0.0, roughness=0.88)
INDUCTOR = mat("VRM Inductor", (0.008,0.010,0.013), metallic=0.18, roughness=0.48)
RAM_LABEL = mat("RAM Neutral Label", (0.055,0.060,0.068), metallic=0.0, roughness=0.82)
SMD_TAN = mat("SMD Ceramic", (0.12,0.095,0.060), metallic=0.0, roughness=0.72)
LOGO_METAL = mat("NOVA Lid Emblem Metal", (0.035,0.050,0.072), metallic=0.98, roughness=0.16)
LOGO_GLOW = mat("NOVA Lid Emblem Glow", (0.16,0.032,0.008), metallic=0.12, roughness=0.24, emission=(1.0,0.15,0.025), emission_strength=1.25)

# Keep matte engineering plastics/PCBs dark under the bright product studio.
# Principled's default dielectric specular can otherwise make nearly-black
# materials read silver in broad softboxes.
for dark_material in (BLACK, BOARD, RAM_PCB, CHIP, BATTERY_MAT, FAN_MAT, KEY_GLOW, THERMAL_PAD, INDUCTOR):
    dark_bsdf = dark_material.node_tree.nodes.get("Principled BSDF")
    if dark_bsdf and "Specular IOR Level" in dark_bsdf.inputs:
        dark_bsdf.inputs["Specular IOR Level"].default_value = 0.16


def rounded_box(name, dims, loc=(0,0,0), radius=0.004, material=None, bevel_segments=5):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if radius > 0:
        bev = o.modifiers.new("Edge radius", "BEVEL")
        bev.width = radius
        bev.segments = bevel_segments
        bev.limit_method = 'ANGLE'
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=bev.name)
    if material:
        o.data.materials.append(material)
    return o


def rounded_prism_xy(
    name,
    dims,
    loc=(0, 0, 0),
    corner_radius=0.006,
    edge_bevel=0.00065,
    material=None,
    corner_segments=10,
    bevel_segments=3,
):
    """Rounded XY footprint with a mostly planar vertical sidewall.

    A normal beveled cube rounds the full Z profile when the requested XY
    corner radius approaches half the chassis height. That makes one unibody
    shell read like two stacked horizontal bands in side views. This mesh
    builds the plan-view corner radius explicitly, then bevels only the
    90-degree top/bottom rim edges; the small angles between rounded-corner
    segments stay untouched and preserve a single continuous sidewall.
    """
    width, depth, height = dims
    radius = min(
        max(0.0, corner_radius),
        max(0.0, width / 2 - 1e-6),
        max(0.0, depth / 2 - 1e-6),
    )
    steps = max(2, int(corner_segments))
    perimeter = []
    corners = (
        (width / 2 - radius, depth / 2 - radius, 0.0, 90.0),
        (-width / 2 + radius, depth / 2 - radius, 90.0, 180.0),
        (-width / 2 + radius, -depth / 2 + radius, 180.0, 270.0),
        (width / 2 - radius, -depth / 2 + radius, 270.0, 360.0),
    )

    for cx, cy, start_deg, end_deg in corners:
        for index in range(steps + 1):
            # Skip duplicated arc endpoints; the straight span between corners
            # is represented by the edge from the prior corner to this one.
            if perimeter and index == 0:
                continue
            angle = math.radians(
                start_deg + (end_deg - start_deg) * index / steps
            )
            perimeter.append((
                cx + math.cos(angle) * radius,
                cy + math.sin(angle) * radius,
            ))

    half_h = height / 2
    verts = [
        (x + loc[0], y + loc[1], -half_h + loc[2])
        for x, y in perimeter
    ] + [
        (x + loc[0], y + loc[1], half_h + loc[2])
        for x, y in perimeter
    ]

    count = len(perimeter)
    faces = [list(reversed(range(count))), list(range(count, count * 2))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))

    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    # Smooth only the vertical perimeter so rounded XY corners read cleanly;
    # top and bottom remain planar.
    for polygon in mesh.polygons[2:]:
        polygon.use_smooth = True

    if edge_bevel > 0:
        bevel = obj.modifiers.new("Top/bottom rim", "BEVEL")
        bevel.width = edge_bevel
        bevel.segments = bevel_segments
        bevel.limit_method = 'ANGLE'
        bevel.angle_limit = math.radians(40.0)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=bevel.name)

    if material:
        obj.data.materials.append(material)
    return obj


def thin_panel(name, dims_yz, x, y, z, material):
    # panel on X constant; dims_yz = (depth in Y, height in Z)
    return rounded_box(name, (0.0012, dims_yz[0], dims_yz[1]), (x,y,z), radius=0.0005, material=material, bevel_segments=2)


def add_area(name, loc, energy, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.shape = 'RECTANGLE'
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    return obj


def point_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def set_camera(name, loc, target=(0,0.01,0.07), lens=58):
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam_data.sensor_width = 36
    cam = bpy.data.objects.new(name, cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = loc
    point_at(cam, target)
    return cam


def parent_keep(obj, parent):
    obj.parent = parent


def polygon_prism_xz(name, points_xz, y_center, depth, material, bevel=0.000055):
    """Create a shallow prism from one SVG polygon in the lid-local X/Z plane."""
    count = len(points_xz)
    y0 = y_center - depth / 2
    y1 = y_center + depth / 2
    verts = [(x, y0, z) for x, z in points_xz] + [(x, y1, z) for x, z in points_xz]
    faces = [list(reversed(range(count))), list(range(count, count * 2))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))

    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if material:
        obj.data.materials.append(material)

    if bevel > 0:
        bev = obj.modifiers.new("Micro bevel", "BEVEL")
        bev.width = bevel
        bev.segments = 2
        bev.limit_method = 'ANGLE'
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=bev.name)

    return obj


def build_svg_lid_emblem(svg_path, parent, surface_y, center_z, target_size=0.064):
    """Read polygon geometry from the reusable NOVA SVG and mount it on the lid.

    The SVG stays the source of truth. Each polygon is converted into a very
    shallow physical prism so the emblem catches real product lighting and is
    exported into the canonical GLB instead of being baked into a lid texture.
    """
    tree = ET.parse(svg_path)
    root = tree.getroot()
    view_box = [float(value) for value in root.attrib.get("viewBox", "0 0 512 512").replace(",", " ").split()]
    min_x, min_y, box_w, box_h = view_box
    cx = min_x + box_w / 2
    cy = min_y + box_h / 2
    scale = target_size / max(box_w, box_h)

    namespace = "{http://www.w3.org/2000/svg}"
    polygons = root.findall(f".//{namespace}polygon")
    if not polygons:
        polygons = root.findall(".//polygon")

    created = []
    for index, node in enumerate(polygons, start=1):
        raw = node.attrib.get("points", "")
        numbers = [float(value) for value in re.findall(r"[-+]?(?:\d*\.\d+|\d+\.?\d*)", raw)]
        if len(numbers) < 6 or len(numbers) % 2:
            continue

        points = []
        for coord_index in range(0, len(numbers), 2):
            svg_x = numbers[coord_index]
            svg_y = numbers[coord_index + 1]
            x = (svg_x - cx) * scale
            z = (cy - svg_y) * scale + center_z
            points.append((x, z))

        material_key = node.attrib.get("data-material", "metal").lower()
        if material_key == "glow":
            material = LOGO_GLOW
            depth = 0.00018
            gap = 0.000035
            prefix = "Glow"
        else:
            material = LOGO_METAL
            depth = 0.00032
            gap = 0.000075
            prefix = "Metal"

        obj = polygon_prism_xz(
            f"Lid_Emblem_{prefix}_{index:02d}",
            points,
            surface_y + gap + depth / 2,
            depth,
            material,
        )
        obj["source_svg"] = os.path.relpath(svg_path, os.path.abspath("."))
        obj["emblem_layer"] = material_key
        parent_keep(obj, parent)
        created.append(obj)

    return created


# ---------- dimensions ----------
W = 0.335
D = 0.225
# Physical stack targets a true 14.8 mm closed profile: 10.0 mm chassis +
# 4.8 mm lid. All exterior assemblies derive from the same centered envelope.
BASE_H = 0.0100
CORNER = 0.007
# The exterior base is a single unibody shell. The top-deck object remains
# as an authoring/explode subassembly, but is inset 6 mm so it never creates a
# second visible sidewall band in the assembled product.
TOP_INSET = 0.0060
TOP_DECK_T = 0.00055
LID_INSET = 0.0020
LID_T = 0.0048

# Closed-state geometry is authoritative:
# - the lid rear edge terminates at the hinge pivot;
# - the lid footprint is symmetrically inset 2 mm from the base on all sides;
# - the lid underside lands exactly on the 10 mm chassis top plane.
HINGE_Y = D / 2 - LID_INSET
HINGE_Z = BASE_H + LID_T / 2
LID_W = W - LID_INSET * 2
LID_H = D - LID_INSET * 2
LEAN = math.radians(-15.0)  # backward from vertical

# Shared rear hardware envelope. These constants prevent the hinge barrels,
# exhaust banks and center torque tube from occupying overlapping X ranges.
HINGE_OUTER_X = 0.1205
HINGE_BARREL_W = 0.0330
HINGE_CENTER_W = 0.0520
EXHAUST_BANK_X = 0.0710
EXHAUST_BANK_W = 0.0640
EXHAUST_Y = D / 2 - 0.0050
EXHAUST_DEPTH = 0.0080

# Exterior unibody shell. This one object defines the entire visible 10 mm
# chassis sidewall from underside to keyboard deck; there is no horizontal
# split line halfway up the side anymore.
base_bottom = rounded_prism_xy(
    "NOVA_Base_Bottom",
    (W, D, BASE_H),
    (0, 0, BASE_H / 2),
    corner_radius=CORNER,
    edge_bevel=0.00072,
    material=GRAPHITE,
    corner_segments=12,
    bevel_segments=3,
)

# The top-deck object is retained for the exploded/service animation, but it is
# a thin inset structural skin embedded at the top surface. Its outer edge sits
# 6 mm inside the unibody perimeter, so side/profile shots cannot read it as a
# second chassis layer.
base_top = rounded_box(
    "NOVA_TopDeck",
    (W - TOP_INSET * 2, D - TOP_INSET * 2, TOP_DECK_T),
    (0, 0, BASE_H - TOP_DECK_T / 2 - 0.00005),
    max(0.0025, CORNER * 0.62),
    GRAPHITE,
    4
)

# subtle front thumb scoop
scoop = rounded_box("Front_Thumb_Scoop", (0.045, 0.0022, 0.0020), (0,-D/2-0.0001,BASE_H*0.48), 0.001, GRAPHITE_DARK)

# The keyboard sits directly in the graphite top deck. There is deliberately
# no rectangular keyboard well/backlight slab; illumination is generated per
# key below, so the deck stays visually continuous around the keyboard.

# Proper laptop keyboard layout. Rows share one consistent left/right frame and
# use ANSI-like key widths so the board no longer looks like independently
# centered strips. Letter rows naturally stagger because Tab/Caps/Shift have
# different widths, matching a real notebook keyboard.
KEY_U = 0.0152
KEY_GAP = 0.0022
KEY_D = 0.0127
ROW_PITCH = 0.0154
ROW_Y0 = 0.0640
# Rows are centered as complete units; their widths differ by only a few
# millimeters, so the keyboard keeps a clean rectangular silhouette.

# Collect every key's glow footprint into one low-cost mesh. Each island is an
# independent chamfered rectangle, so the visual result is still true per-key
# lighting without dozens of extra scene objects/draw calls.
key_light_verts = []
key_light_faces = []

def add_key_light_pad(x, y, width, depth):
    pad_w = width + 0.00120
    pad_d = depth + 0.00120
    hw = pad_w * 0.5
    hd = pad_d * 0.5
    r = min(0.00105, hw * 0.22, hd * 0.22)
    z = BASE_H + 0.00168
    base = len(key_light_verts)
    key_light_verts.extend([
        (x - hw + r, y - hd, z),
        (x + hw - r, y - hd, z),
        (x + hw, y - hd + r, z),
        (x + hw, y + hd - r, z),
        (x + hw - r, y + hd, z),
        (x - hw + r, y + hd, z),
        (x - hw, y + hd - r, z),
        (x - hw, y - hd + r, z),
    ])
    key_light_faces.append(tuple(base + i for i in range(8)))

def add_key_legend(name, label, x, y, z, width):
    if not label:
        return
    # Text is converted to mesh before export so legends survive the GLB and
    # merge into the top-deck assembly. Keep every label centered on its cap.
    bpy.ops.object.text_add(location=(x, y, z))
    txt = bpy.context.object
    txt.name = name
    txt.data.body = label
    txt.data.align_x = 'CENTER'
    txt.data.align_y = 'CENTER'
    txt.data.extrude = 0.000035
    txt.data.bevel_depth = 0.000012
    txt.data.bevel_resolution = 1
    # Single-character legends are intentionally larger. Special keys shrink
    # automatically so ESC/ENTER/SHIFT never spill outside their caps.
    if len(label) == 1:
        font_size = 0.0048
    elif len(label) <= 2:
        font_size = 0.00365
    elif len(label) <= 4:
        font_size = 0.00275
    else:
        font_size = 0.00235
    txt.data.size = min(font_size, max(0.0021, width * 0.26))
    txt.data.materials.append(KEY_LEGEND)
    bpy.context.view_layer.objects.active = txt
    txt.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return txt

def add_keyboard_key(row_index, key_index, label, x, y, units=1.0, legend_label=None):
    width = KEY_U * units

    # Add this key's isolated light footprint to the shared per-key mesh.
    add_key_light_pad(x, y, width, KEY_D)

    key = rounded_box(
        f"Key_{row_index:02d}_{key_index:02d}_{label or 'Space'}",
        (width, KEY_D, 0.00138),
        (x, y, BASE_H + 0.00236),
        0.00120,
        BLACK,
        3
    )
    shown = label if legend_label is None else legend_label
    add_key_legend(
        f"KeyLegend_{row_index:02d}_{key_index:02d}_{label or 'Space'}",
        shown,
        x,
        y,
        BASE_H + 0.00310,
        width,
    )
    return key

# (legend, width in key units). Symbols are intentionally generic and
# brand-free, while the alphanumeric layout is a familiar notebook QWERTY.
keyboard_rows = [
    [
        ("ESC", 1.25), ("F1", 1.0), ("F2", 1.0), ("F3", 1.0),
        ("F4", 1.0), ("F5", 1.0), ("F6", 1.0), ("F7", 1.0),
        ("F8", 1.0), ("F9", 1.0), ("F10", 1.0), ("F11", 1.0),
        ("F12", 1.0), ("DEL", 1.25),
    ],
    [
        ("~", 1.0), ("1", 1.0), ("2", 1.0), ("3", 1.0),
        ("4", 1.0), ("5", 1.0), ("6", 1.0), ("7", 1.0),
        ("8", 1.0), ("9", 1.0), ("0", 1.0), ("-", 1.0),
        ("=", 1.0), ("BKSP", 2.0),
    ],
    [
        ("TAB", 1.5), ("Q", 1.0), ("W", 1.0), ("E", 1.0),
        ("R", 1.0), ("T", 1.0), ("Y", 1.0), ("U", 1.0),
        ("I", 1.0), ("O", 1.0), ("P", 1.0), ("[", 1.0),
        ("]", 1.0), ("\\", 1.5),
    ],
    [
        ("CAPS", 1.75), ("A", 1.0), ("S", 1.0), ("D", 1.0),
        ("F", 1.0), ("G", 1.0), ("H", 1.0), ("J", 1.0),
        ("K", 1.0), ("L", 1.0), (";", 1.0), ("'", 1.0),
        ("ENTER", 2.25),
    ],
    [
        ("SHIFT", 2.25), ("Z", 1.0), ("X", 1.0), ("C", 1.0),
        ("V", 1.0), ("B", 1.0), ("N", 1.0), ("M", 1.0),
        (",", 1.0), (".", 1.0), ("/", 1.0), ("SHIFT", 2.75),
    ],
    [
        ("CTRL", 1.25), ("FN", 1.0), ("OS", 1.0), ("ALT", 1.25),
        ("", 5.75), ("ALT", 1.25), ("MENU", 1.25),
        ("<", 1.0), ("v", 1.0), (">", 1.0),
    ],
]

for row_index, row in enumerate(keyboard_rows):
    y = ROW_Y0 - row_index * ROW_PITCH
    row_width = sum(KEY_U * units for _, units in row) + KEY_GAP * (len(row) - 1)
    cursor = -row_width / 2
    for key_index, (label, units) in enumerate(row):
        width = KEY_U * units
        x = cursor + width / 2
        add_keyboard_key(row_index, key_index, label, x, y, units=units)
        cursor += width + KEY_GAP

key_light_mesh = bpy.data.meshes.new("Keyboard_PerKey_LightMesh")
key_light_mesh.from_pydata(key_light_verts, [], key_light_faces)
key_light_mesh.update()
key_light_object = bpy.data.objects.new("Key_PerKey_LightMesh", key_light_mesh)
bpy.context.collection.objects.link(key_light_object)
key_light_object.data.materials.append(KEY_GLOW)

# Premium buttonless trackpad: large glass-like surface, hairline metallic rim,
# and a shallow haptic plate below it for exploded/technical views.
track_rim = rounded_box(
    "Trackpad_Rim",
    (0.146, 0.084, 0.00030),
    (0, -0.066, BASE_H + 0.00072),
    0.0056,
    TRACK_EDGE,
    3
)
track = rounded_box(
    "Trackpad",
    (0.142, 0.080, 0.00048),
    (0, -0.066, BASE_H + 0.00092),
    0.0053,
    TRACK,
    4
)
track_haptic = rounded_box(
    "Trackpad_Haptic",
    (0.098, 0.041, 0.00095),
    (0, -0.066, BASE_H + 0.00005),
    0.0034,
    GRAPHITE_DARK,
    2
)

# Speaker grilles: 3 columns x 18 dots each side
for side in (-1,1):
    x0 = side*0.145
    for rr in range(18):
        y = 0.066 - rr*0.0051
        for cc in range(3):
            x = x0 + side*(cc-1)*0.0030
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=0.00075, location=(x,y,BASE_H+0.0030))
            dot = bpy.context.object
            dot.name = f"Speaker_{'L' if side<0 else 'R'}_{rr}_{cc}"
            dot.scale.z = 0.32
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            dot.data.materials.append(BLACK)

# Multi-part hinge. The lid uses a central torque tube plus two larger
# barrel/knuckle sections, while compact base brackets remain on the deck.
# This keeps the silhouette clean but avoids the "single floating cylinder"
# look of the earlier model.
hinge_lid_parts = []
hinge_base_parts = []

def hinge_cylinder(name, radius, depth, x, z, material, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=(x, HINGE_Y, z),
        rotation=(0, math.pi/2, 0)
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return obj

hinge = hinge_cylinder(
    "Integrated_Hinge_Bar",
    0.00215,
    HINGE_CENTER_W,
    0,
    HINGE_Z,
    GRAPHITE_DARK,
    56
)
hinge_lid_parts.append(hinge)

for side, x in (("L", -HINGE_OUTER_X), ("R", HINGE_OUTER_X)):
    barrel = hinge_cylinder(
        f"Hinge_Barrel_{side}",
        0.00335,
        HINGE_BARREL_W,
        x,
        HINGE_Z,
        GRAPHITE_DARK,
        48
    )
    hinge_lid_parts.append(barrel)

    # Only a small machined pivot cap is exposed; the pin itself is not a
    # bright full-width cylinder.
    outer_x = x + (-HINGE_BARREL_W * 0.56 if side == "L" else HINGE_BARREL_W * 0.56)
    pin = hinge_cylinder(
        f"Hinge_Pin_{side}",
        0.00130,
        0.0042,
        outer_x,
        HINGE_Z,
        SILVER,
        32
    )
    hinge_lid_parts.append(pin)

    bracket = rounded_box(
        f"Hinge_Base_{side}",
        (0.031, 0.0105, 0.0028),
        (x, HINGE_Y - 0.0055, HINGE_Z - 0.00165),
        0.0016,
        GRAPHITE_DARK,
        3
    )
    hinge_base_parts.append(bracket)

    anchor = rounded_box(
        f"Hinge_Anchor_{side}",
        (0.018, 0.014, 0.0022),
        (x, HINGE_Y - 0.0105, HINGE_Z - 0.00255),
        0.0015,
        GRAPHITE_DARK,
        2
    )
    hinge_base_parts.append(anchor)

    pivot_cap = rounded_box(
        f"Hinge_PivotCap_{side}",
        (0.0085, 0.0072, 0.0038),
        (x, HINGE_Y - 0.0003, HINGE_Z),
        0.0018,
        GRAPHITE,
        3
    )
    hinge_base_parts.append(pivot_cap)

# Side I/O uses actual boolean apertures through the single unibody exterior
# wall. Each connector gets port-specific interior geometry so macro views read
# as real I/O instead of a row of anonymous black rectangles.
def side_port(name, side, y, depth, height, radius=0.0012, z=None):
    wall_x = side * (W / 2)
    zc = BASE_H * 0.44 if z is None else z
    cutter = rounded_box(
        name + "_BooleanCutter",
        (0.0070, depth, height),
        (wall_x, y, zc),
        radius,
        None,
        3
    )

    bpy.context.view_layer.objects.active = base_bottom
    base_bottom.select_set(True)
    mod = base_bottom.modifiers.new(name + "_Cut", 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    base_bottom.select_set(False)
    bpy.data.objects.remove(cutter, do_unlink=True)

    liner = rounded_box(
        name + "_Liner",
        (0.00028, depth + 0.00065, height + 0.00065),
        (side * (W / 2 + 0.00003), y, zc),
        max(0.00038, radius * 0.72),
        PORT_METAL,
        2
    )
    cavity = rounded_box(
        name,
        (0.00022, depth - 0.00045, max(0.0014, height - 0.00045)),
        (side * (W / 2 + 0.00010), y, zc),
        max(0.00034, radius * 0.62),
        PORT_INNER,
        2
    )
    return liner, cavity


def usb_side_port(name, side, y, kind="A"):
    zc = BASE_H * 0.44
    if kind.upper() == "C":
        side_port(name, side, y, 0.0120, 0.00325, 0.00145, zc)
        tongue = rounded_box(
            name + "_Tongue",
            (0.00034, 0.0068, 0.00062),
            (side * (W / 2 + 0.00030), y, zc),
            0.00028,
            PORT_TONGUE,
            2
        )
    else:
        side_port(name, side, y, 0.0158, 0.0049, 0.00092, zc)
        tongue = rounded_box(
            name + "_Tongue",
            (0.00034, 0.0108, 0.00105),
            (side * (W / 2 + 0.00030), y, zc - 0.00085),
            0.00025,
            PORT_TONGUE,
            2
        )
    return tongue


def round_side_port(name, side, y, radius, center_pin=False, z=None):
    wall_x = side * (W / 2)
    zc = BASE_H * 0.44 if z is None else z

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=40,
        radius=radius,
        depth=0.0070,
        location=(wall_x, y, zc),
        rotation=(0, math.pi / 2, 0)
    )
    cutter = bpy.context.object
    cutter.name = name + "_BooleanCutter"

    bpy.context.view_layer.objects.active = base_bottom
    base_bottom.select_set(True)
    mod = base_bottom.modifiers.new(name + "_Cut", 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    base_bottom.select_set(False)
    bpy.data.objects.remove(cutter, do_unlink=True)

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=40,
        radius=radius + 0.00042,
        depth=0.00028,
        location=(side * (W / 2 + 0.00003), y, zc),
        rotation=(0, math.pi / 2, 0)
    )
    liner = bpy.context.object
    liner.name = name + "_Liner"
    liner.data.materials.append(PORT_METAL)

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=40,
        radius=max(0.0009, radius - 0.00025),
        depth=0.00022,
        location=(side * (W / 2 + 0.00012), y, zc),
        rotation=(0, math.pi / 2, 0)
    )
    cavity = bpy.context.object
    cavity.name = name
    cavity.data.materials.append(PORT_INNER)

    if center_pin:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=24,
            radius=0.00055,
            depth=0.00042,
            location=(side * (W / 2 + 0.00028), y, zc),
            rotation=(0, math.pi / 2, 0)
        )
        pin = bpy.context.object
        pin.name = name + "_CenterPin"
        pin.data.materials.append(PORT_METAL)

    return liner, cavity


def ethernet_side_port(name, side, y):
    zc = BASE_H * 0.49
    side_port(name, side, y, 0.0174, 0.0062, 0.00078, zc)

    # A small latch recess plus copper contact fingers make the taller opening
    # unmistakably RJ45 in side-profile/macro views.
    rounded_box(
        name + "_LatchRecess",
        (0.00034, 0.0060, 0.00115),
        (side * (W / 2 + 0.00030), y, zc - 0.00155),
        0.00022,
        PORT_INNER,
        2
    )
    contact_span = 0.0105
    for index in range(8):
        contact_y = y - contact_span / 2 + index * (contact_span / 7)
        rounded_box(
            f"{name}_Contact_{index+1:02d}",
            (0.00030, 0.00052, 0.00048),
            (side * (W / 2 + 0.00032), contact_y, zc + 0.00175),
            0.00012,
            COPPER,
            1
        )


# Left side, rear -> front: Ethernet, dedicated charging, USB-C, two USB-A,
# then a 3.5 mm headset jack. The cluster is intentionally tight but keeps
# enough shell between apertures to read as manufacturable.
ethernet_side_port("Port_RJ45_L", -1, 0.068)
round_side_port("Port_Charge_L", -1, 0.047, 0.0033, center_pin=True)
usb_side_port("Port_USBC_L", -1, 0.029, "C")
usb_side_port("Port_USBA_L1", -1, 0.007, "A")
usb_side_port("Port_USBA_L2", -1, -0.014, "A")
round_side_port("Port_Audio_L", -1, -0.032, 0.0022)

# Right side: exactly two full-size USB-A ports, grouped closely as requested.
usb_side_port("Port_USBA_R1", 1, 0.018, "A")
usb_side_port("Port_USBA_R2", 1, -0.004, "A")

# Rear exhaust assembly. Two concealed fin banks sit directly ahead of the
# hinge line and read clearly in macro/rear shots without turning the exterior
# into a gaming-style vent. A dark plenum behind the fins gives the outlet
# believable depth.
rear_duct = rounded_box(
    "Rear_Exhaust_Duct",
    (EXHAUST_BANK_X * 2 + EXHAUST_BANK_W, EXHAUST_DEPTH + 0.0015, 0.0028),
    (0, EXHAUST_Y, BASE_H * 0.68),
    0.0010,
    PORT_INNER,
    2
)

# Two identical rear fin banks occupy the clear span between the short center
# torque tube and the outer hinge barrels. Their depth stays inside the rear
# chassis plane, so no fins protrude past one side or overlap a hinge segment.
for bank, bank_x in (("L", -EXHAUST_BANK_X), ("R", EXHAUST_BANK_X)):
    bank_floor = rounded_box(
        f"Rear_Exhaust_Shroud_{bank}",
        (EXHAUST_BANK_W, EXHAUST_DEPTH + 0.0010, 0.00075),
        (bank_x, EXHAUST_Y, BASE_H * 0.615),
        0.0009,
        GRAPHITE_DARK,
        2
    )

    fin_count = 15
    usable_width = EXHAUST_BANK_W - 0.006
    fin_step = usable_width / (fin_count - 1)
    fin_start = bank_x - usable_width / 2
    for fin_index in range(fin_count):
        fx = fin_start + fin_index * fin_step
        fin = rounded_box(
            f"Rear_Exhaust_Fin_{bank}_{fin_index:02d}",
            (0.00105, EXHAUST_DEPTH, 0.0032),
            (fx, EXHAUST_Y, BASE_H * 0.79),
            0.00016,
            PORT_METAL,
            1
        )

# Bottom feet
for x in (-0.135,0.135):
    for y in (-0.082,0.082):
        rounded_box("Foot", (0.038,0.007,0.0016), (x,y,-0.0002), 0.002, RUBBER)

# Lid hinge parent
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0,HINGE_Y,HINGE_Z))
lid_parent = bpy.context.object
lid_parent.name = "Lid_Hinge"
lid_parent.rotation_euler.x = LEAN

# Thin lid-side hinge straps disappear into the display shell rather than
# ending in oversized blocks. This reads closer to a real premium laptop hinge.
for side, x in (("L", -HINGE_OUTER_X), ("R", HINGE_OUTER_X)):
    strap = rounded_box(
        f"Hinge_LidStrap_{side}",
        (0.020, 0.0032, 0.028),
        (x, 0.0008, 0.014),
        0.0018,
        GRAPHITE_DARK,
        3
    )
    parent_keep(strap, lid_parent)

# Lid panel: local center above hinge
lid = rounded_box("NOVA_Lid", (LID_W,LID_T,LID_H), (0,0,LID_H/2), 0.0075, GRAPHITE, 6)
parent_keep(lid, lid_parent)

# Reusable NOVA brand emblem on the outside/back of the display lid.
# The SVG is the design source; the generator turns its polygon layers into
# shallow physical metal/glow prisms that export with the canonical laptop.
LID_EMBLEM_SVG = os.path.abspath("assets/brand/nova-emblem.svg")
lid_emblem_parts = build_svg_lid_emblem(
    LID_EMBLEM_SVG,
    lid_parent,
    surface_y=LID_T / 2,
    center_z=LID_H * 0.56,
    target_size=0.064,
)

# Inner bezel
bezel = rounded_box("Display_Bezel", (LID_W-0.012,0.0018,LID_H-0.012), (0,-LID_T/2-0.0011,LID_H/2), 0.006, BLACK, 5)
parent_keep(bezel, lid_parent)

# Screen active area — dedicated UV plane so web textures fill the display correctly.
bpy.ops.mesh.primitive_plane_add(
    size=2,
    location=(0, -LID_T/2-0.0042, LID_H/2-0.001),
    rotation=(math.pi/2, 0, 0)
)
screen = bpy.context.object
screen.name = "Display_Active"
screen.scale = ((LID_W-0.019)/2, (LID_H-0.022)/2, 1)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
screen.data.materials.append(SCREEN)
parent_keep(screen, lid_parent)

# glass layer
glass = rounded_box("Display_Glass", (LID_W-0.016,0.00055,LID_H-0.019), (0,-LID_T/2-0.0027,LID_H/2), 0.005, GLASS, 4)
parent_keep(glass, lid_parent)

# camera notch
notch = rounded_box("Camera_Notch", (0.026,0.0008,0.0075), (0,-LID_T/2-0.0048,LID_H-0.0105), 0.002, BLACK, 3)
parent_keep(notch, lid_parent)

# tiny camera dot
bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.0011, location=(0,-LID_T/2-0.0052,LID_H-0.0105))
camdot = bpy.context.object
camdot.name = "Camera_Dot"
camdot.scale.y = 0.35
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
camdot.data.materials.append(GLASS)
parent_keep(camdot, lid_parent)

# ---------- animatable product hierarchy ----------
def empty(name, loc=(0,0,0)):
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=loc)
    o = bpy.context.object
    o.name = name
    return o

nova_root = empty("NOVA_ROOT")
lid_group = empty("LID_GROUP")
top_group = empty("TOP_DECK_GROUP")
internal_group = empty("INTERNAL_GROUP")
lower_group = empty("LOWER_CHASSIS_GROUP")

for group in (lid_group, top_group, internal_group, lower_group):
    parent_keep(group, nova_root)

# The lid hinge hierarchy becomes the moving lid assembly while the mounting
# brackets stay with the top deck.
parent_keep(lid_parent, lid_group)
for hinge_part in hinge_lid_parts:
    parent_keep(hinge_part, lid_group)
for hinge_part in hinge_base_parts:
    parent_keep(hinge_part, top_group)

# Invisible exported focus markers let the web product-film camera lock onto
# real modeled hardware instead of guessing fixed world-space targets. Empties
# add effectively no render cost and follow their owning assembly naturally.
focus_keyboard = empty("Focus_Keyboard", (0, 0.025, BASE_H + 0.0030))
parent_keep(focus_keyboard, top_group)
focus_touchpad = empty("Focus_Touchpad", (0, -0.066, BASE_H + 0.0010))
parent_keep(focus_touchpad, top_group)
focus_speaker_l = empty("Focus_Speaker_L", (-0.145, 0.020, BASE_H + 0.0030))
parent_keep(focus_speaker_l, top_group)
focus_speaker_r = empty("Focus_Speaker_R", (0.145, 0.020, BASE_H + 0.0030))
parent_keep(focus_speaker_r, top_group)
focus_hinge = empty("Focus_Hinge", (0, HINGE_Y, HINGE_Z))
parent_keep(focus_hinge, top_group)
focus_edge = empty("Focus_Edge", (W/2, -0.030, BASE_H * 0.48))
parent_keep(focus_edge, lower_group)
focus_ports_r = empty("Focus_Ports_Right", (W/2, 0.007, BASE_H * 0.44))
parent_keep(focus_ports_r, lower_group)
focus_ports_l = empty("Focus_Ports_Left", (-W/2, 0.018, BASE_H * 0.44))
parent_keep(focus_ports_l, lower_group)
focus_exhaust = empty("Focus_Exhaust", (0, EXHAUST_Y, BASE_H * 0.79))
parent_keep(focus_exhaust, lower_group)

# The display-edge marker lives in lid-local coordinates, so it follows the
# physical lid close/open motion around Lid_Hinge.
focus_screen_edge = empty("Focus_Screen_Edge", (LID_W/2, 0, LID_H * 0.52))
parent_keep(focus_screen_edge, lid_parent)

# Exterior top-deck assembly.
for obj in list(bpy.context.scene.objects):
    if obj.name in {"NOVA_TopDeck", "Keyboard_Well", "Keyboard_Backlight", "Trackpad", "Trackpad_Rim", "Trackpad_Haptic"} or obj.name.startswith("Key_") or obj.name.startswith("KeyLegend_") or obj.name.startswith("Speaker_"):
        if obj.parent is None:
            parent_keep(obj, top_group)

# Lower chassis and its visible edge details.
for obj in list(bpy.context.scene.objects):
    if obj.name == "NOVA_Base_Bottom" or obj.name == "Front_Thumb_Scoop" or obj.name.startswith("Port_") or obj.name.startswith("Foot") or obj.name.startswith("Rear_Exhaust_"):
        if obj.parent is None:
            parent_keep(obj, lower_group)

# ---------- internal component system ----------
# The internals are deliberately separated into recognizable engineering
# subassemblies so the web scroll story can create a true exploded view.

# Motherboard: asymmetric board plus daughter wing for a less generic silhouette.
motherboard = rounded_box("Motherboard", (0.224, 0.078, 0.0016), (0.000, 0.027, BASE_H*0.56), 0.004, BOARD, 3)
parent_keep(motherboard, internal_group)
board_wing = rounded_box(
    "BoardDetail_Wing",
    (0.066, 0.034, 0.0015),
    (-0.096, 0.000, BASE_H*0.575),
    0.003,
    BOARD,
    3
)
parent_keep(board_wing, internal_group)

# Asymmetric tongues/daughter areas keep the board from reading as one generic
# rectangle and echo the stepped outlines common in real laptop mainboards.
board_tongue_r = rounded_box(
    "BoardDetail_Tongue_R",
    (0.034, 0.046, 0.00145),
    (0.112, 0.018, BASE_H*0.575),
    0.0025,
    BOARD,
    3
)
parent_keep(board_tongue_r, internal_group)

board_tongue_front = rounded_box(
    "BoardDetail_Tongue_Front",
    (0.058, 0.022, 0.00145),
    (0.072, -0.015, BASE_H*0.575),
    0.0023,
    BOARD,
    3
)
parent_keep(board_tongue_front, internal_group)

# Sparse visible copper/gold pads and ribbon sockets add believable service
# detail without turning the board into unreadable CAD noise.
for idx, (px, py, sx, sy) in enumerate([
    (-0.108, 0.055, 0.024, 0.0032),
    (-0.020, 0.061, 0.018, 0.0030),
    ( 0.080, 0.059, 0.022, 0.0030),
    ( 0.111, 0.010, 0.0040, 0.022),
    ( 0.058,-0.017, 0.026, 0.0030),
]):
    pad = rounded_box(
        f"BoardDetail_GoldPad_{idx+1}",
        (sx, sy, 0.00042),
        (px, py, BASE_H*0.675),
        0.00035,
        GOLD,
        1
    )
    parent_keep(pad, internal_group)

for idx, (sx, sy, px, py) in enumerate([
    (0.023, 0.006, -0.108, 0.030),
    (0.020, 0.006,  0.108, 0.034),
    (0.026, 0.005,  0.070,-0.006),
]):
    socket = rounded_box(
        f"BoardDetail_RibbonSocket_{idx+1}",
        (sx, sy, 0.0017),
        (px, py, BASE_H*0.76),
        0.00065,
        PORT_METAL,
        1
    )
    parent_keep(socket, internal_group)

for idx, (sx, sy) in enumerate([
    (-0.102, 0.056),
    ( 0.100, 0.056),
    (-0.105,-0.002),
    ( 0.103,-0.008),
]):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24,
        radius=0.0032,
        depth=0.0010,
        location=(sx, sy, BASE_H*0.70)
    )
    mount = bpy.context.object
    mount.name = f"BoardDetail_Mount_{idx+1}"
    mount.data.materials.append(SILVER)
    parent_keep(mount, internal_group)

# Restrained silkscreen bars and VRM chokes give the board recognizable service
# zones without copying a real vendor layout.
for idx, (px, py, sx, sy) in enumerate([
    (-0.070, 0.060, 0.050, 0.0008),
    ( 0.070, 0.060, 0.050, 0.0008),
    (-0.100, 0.018, 0.0008, 0.024),
    ( 0.100, 0.018, 0.0008, 0.024),
    ( 0.000,-0.010, 0.075, 0.0008),
]):
    silk = rounded_box(
        f"BoardDetail_Silkscreen_{idx+1}",
        (sx, sy, 0.00020),
        (px, py, BASE_H*0.692),
        0.00015,
        PCB_SILK,
        1
    )
    parent_keep(silk, internal_group)

for idx, (px, py) in enumerate([
    (-0.042, 0.036), (-0.030, 0.036), (-0.018, 0.036),
    ( 0.065, 0.036), ( 0.077, 0.036), ( 0.089, 0.036),
]):
    choke = rounded_box(
        f"BoardDetail_VRMChoke_{idx+1}",
        (0.0085, 0.0085, 0.0023),
        (px, py, BASE_H*0.79),
        0.0010,
        INDUCTOR,
        2
    )
    parent_keep(choke, internal_group)

# Small SMD populations create realistic zoning without expensive micro-CAD.
# The placements are fictional and deliberately generic.
for idx, (px, py, sx, sy, use_tan) in enumerate([
    (-0.091, 0.044, 0.0040, 0.0021, True),
    (-0.084, 0.044, 0.0032, 0.0018, False),
    (-0.076, 0.044, 0.0042, 0.0020, True),
    (-0.091, 0.035, 0.0030, 0.0018, False),
    (-0.084, 0.035, 0.0044, 0.0020, True),
    (-0.076, 0.035, 0.0032, 0.0018, False),
    ( 0.079, 0.010, 0.0040, 0.0020, True),
    ( 0.087, 0.010, 0.0032, 0.0018, False),
    ( 0.095, 0.010, 0.0042, 0.0020, True),
    ( 0.079, 0.001, 0.0032, 0.0018, False),
    ( 0.087, 0.001, 0.0044, 0.0020, True),
    ( 0.095, 0.001, 0.0032, 0.0018, False),
    (-0.016,-0.012, 0.0040, 0.0018, True),
    (-0.008,-0.012, 0.0032, 0.0018, False),
    ( 0.000,-0.012, 0.0040, 0.0018, True),
    ( 0.008,-0.012, 0.0032, 0.0018, False),
]):
    smd = rounded_box(
        f"BoardDetail_SMD_{idx+1:02d}",
        (sx, sy, 0.00085),
        (px, py, BASE_H*0.765),
        0.00030,
        SMD_TAN if use_tan else CHIP,
        1
    )
    parent_keep(smd, internal_group)

# Laptop compute assembly: separate low-profile CPU and GPU BGA-style
# packages with exposed die caps and surrounding VRAM. The editor still targets
# the parent name CPU_GPU_Package so existing timelines remain compatible.
compute_group = empty("CPU_GPU_Package")
parent_keep(compute_group, internal_group)

cpu_substrate = rounded_box(
    "Compute_CPU_Substrate",
    (0.030, 0.027, 0.00155),
    (-0.008, 0.025, BASE_H*0.755),
    0.0020,
    CHIP,
    3
)
parent_keep(cpu_substrate, compute_group)
cpu_die = rounded_box(
    "Compute_CPU_Die",
    (0.018, 0.015, 0.00100),
    (-0.008, 0.025, BASE_H*0.895),
    0.0012,
    DIE,
    2
)
parent_keep(cpu_die, compute_group)

gpu_substrate = rounded_box(
    "Compute_GPU_Substrate",
    (0.034, 0.031, 0.00165),
    (0.035, 0.025, BASE_H*0.755),
    0.0022,
    CHIP,
    3
)
parent_keep(gpu_substrate, compute_group)
gpu_die = rounded_box(
    "Compute_GPU_Die",
    (0.020, 0.017, 0.00105),
    (0.035, 0.025, BASE_H*0.900),
    0.0013,
    DIE,
    2
)
parent_keep(gpu_die, compute_group)

# Subtle component identification is converted to mesh so it survives GLB
# export and reads in extreme close-up shots. It is intentionally small and
# technical rather than a giant decorative badge.
def internal_mark(name, body, x, y, z, size):
    bpy.ops.object.text_add(location=(x, y, z))
    txt = bpy.context.object
    txt.name = name
    txt.data.body = body
    txt.data.align_x = 'CENTER'
    txt.data.align_y = 'CENTER'
    txt.data.size = size
    txt.data.extrude = 0.000018
    txt.data.bevel_depth = 0.000006
    txt.data.bevel_resolution = 1
    txt.data.materials.append(PCB_SILK)
    bpy.context.view_layer.objects.active = txt
    txt.select_set(True)
    bpy.ops.object.convert(target='MESH')
    parent_keep(txt, compute_group)
    return txt

internal_mark(
    "Compute_CPU_Mark",
    "CORE ULTRA 9",
    -0.008, 0.025, BASE_H * 1.020,
    0.00225
)
internal_mark(
    "Compute_GPU_Mark",
    "NVIDIA RTX 5070",
    0.035, 0.025, BASE_H * 1.022,
    0.00205
)

# Four low-profile VRAM packages around the GPU package.
for idx, (vx, vy) in enumerate([
    (0.035, 0.047),
    (0.035, 0.003),
    (0.059, 0.025),
    (0.011, 0.025),
]):
    vram = rounded_box(
        f"Compute_VRAM_{idx+1}",
        (0.0135, 0.0095, 0.00135),
        (vx, vy, BASE_H*0.80),
        0.0010,
        CHIP,
        2
    )
    parent_keep(vram, compute_group)

# Narrow cold-plate clamp rails keep the exposed dies visible in exploded
# views while still communicating how the copper thermal system contacts them.
for rail_index, (name_prefix, cx, cy, half_w, half_h) in enumerate([
    ("CPU", -0.008, 0.025, 0.0145, 0.0125),
    ("GPU",  0.035, 0.025, 0.0165, 0.0145),
]):
    for edge_index, (rx, ry, sx, sy) in enumerate([
        (cx, cy-half_h, half_w*2, 0.0032),
        (cx, cy+half_h, half_w*2, 0.0032),
    ]):
        plate = rounded_box(
            f"Compute_{name_prefix}_ColdPlate_{edge_index+1}",
            (sx, sy, 0.00058),
            (rx, ry, BASE_H*0.970),
            0.0010,
            COPPER,
            2
        )
        parent_keep(plate, compute_group)

# Raised silicon / VRM package details around the compute package.
for idx, (x, y, sx, sy) in enumerate([
    (-0.032, 0.046, 0.022, 0.010),
    ( 0.046, 0.047, 0.019, 0.011),
    ( 0.066, 0.018, 0.014, 0.013),
    (-0.044, 0.014, 0.016, 0.013),
    (-0.006,-0.001, 0.012, 0.010),
]):
    chip = rounded_box(f"BoardDetail_Chip_{idx:02d}", (sx, sy, 0.0018), (x, y, BASE_H*0.77), 0.0012, CHIP, 2)
    parent_keep(chip, internal_group)

# Small metallic power stages / capacitors.
for idx, (x, y) in enumerate([
    (-0.064, 0.052), (-0.052, 0.052), (0.052, 0.052), (0.064, 0.052),
    (-0.064, 0.035), (0.064, 0.035), (-0.018, 0.054), (0.032, 0.054)
]):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.0033, depth=0.0028, location=(x, y, BASE_H*0.79))
    cap = bpy.context.object
    cap.name = f"BoardDetail_Cap_{idx:02d}"
    cap.data.materials.append(COPPER if idx % 3 == 0 else CHIP)
    parent_keep(cap, internal_group)

# Two compact SO-DIMM-style memory modules: dark PCB, visible DRAM ICs,
# split gold contact fingers, retention clips, and a center notch. They are
# simplified for readability at web scale rather than being JEDEC-precise.
for module_index, module_y in enumerate((0.004, 0.038), start=1):
    module_x = -0.066
    ram_board = rounded_box(
        f"RAM{module_index}_PCB",
        (0.067, 0.0215, 0.00115),
        (module_x, module_y, BASE_H*0.765),
        0.0012,
        RAM_PCB,
        2
    )
    parent_keep(ram_board, internal_group)

    # Four DRAM packages per module.
    for chip_index, chip_x in enumerate((-0.024, -0.008, 0.008, 0.024), start=1):
        dram = rounded_box(
            f"RAM{module_index}_DRAM_{chip_index}",
            (0.0115, 0.0105, 0.00120),
            (module_x + chip_x, module_y + 0.0015, BASE_H*0.865),
            0.0009,
            CHIP,
            2
        )
        parent_keep(dram, internal_group)

    # Fine gold fingers read more like a real SO-DIMM than a single gold bar.
    finger_xs = [-0.029 + i*0.00445 for i in range(14) if i not in (6, 7)]
    for finger_index, finger_x in enumerate(finger_xs, start=1):
        contacts = rounded_box(
            f"RAM{module_index}_Contact_{finger_index:02d}",
            (0.00245, 0.00155, 0.00042),
            (module_x + finger_x, module_y - 0.0102, BASE_H*0.810),
            0.00018,
            GOLD,
            1
        )
        parent_keep(contacts, internal_group)

    # Neutral service label: no vendor branding, just a subtle sticker/marking
    # zone that helps the memory modules read immediately in an exploded shot.
    label = rounded_box(
        f"RAM{module_index}_Label",
        (0.027, 0.0082, 0.00030),
        (module_x, module_y + 0.0010, BASE_H*0.946),
        0.00065,
        RAM_LABEL,
        1
    )
    parent_keep(label, internal_group)
    for mark_index, mark_x in enumerate((-0.008, 0.000, 0.008), start=1):
        mark = rounded_box(
            f"RAM{module_index}_LabelMark_{mark_index}",
            (0.0048, 0.0007, 0.00016),
            (module_x + mark_x, module_y + 0.0010, BASE_H*0.970),
            0.00015,
            PCB_SILK,
            1
        )
        parent_keep(mark, internal_group)

    for clip_side, clip_x in ((-1, -0.0365), (1, 0.0365)):
        clip = rounded_box(
            f"RAM{module_index}_Clip_{'L' if clip_side < 0 else 'R'}",
            (0.0035, 0.0060, 0.00125),
            (module_x + clip_x, module_y, BASE_H*0.820),
            0.00050,
            PORT_METAL,
            1
        )
        parent_keep(clip, internal_group)

wireless = rounded_box(
    "BoardDetail_Wireless",
    (0.028, 0.023, 0.0018),
    (0.090, -0.002, BASE_H*0.76),
    0.002,
    SILVER,
    2
)
parent_keep(wireless, internal_group)

for idx, (x, y, sx, sy) in enumerate([
    (-0.034, 0.045, 0.016, 0.007),
    (-0.034, 0.016, 0.016, 0.007),
    ( 0.035, 0.049, 0.012, 0.006),
    ( 0.035, 0.001, 0.012, 0.006),
    ( 0.062, 0.025, 0.008, 0.012),
]):
    pad = rounded_box(
        f"BoardDetail_ThermalPad_{idx+1}",
        (sx, sy, 0.00048),
        (x, y, BASE_H*0.905),
        0.0008,
        THERMAL_PAD,
        2
    )
    parent_keep(pad, internal_group)

for idx, (x, y, sx) in enumerate([
    (-0.112, 0.026, 0.025),
    ( 0.112, 0.026, 0.025),
    (-0.105,-0.008, 0.020),
    ( 0.105,-0.008, 0.020),
]):
    conn = rounded_box(
        f"BoardDetail_Connector_{idx+1}",
        (sx, 0.0048, 0.0023),
        (x, y, BASE_H*0.78),
        0.0008,
        PORT_METAL,
        1
    )
    parent_keep(conn, internal_group)

ssd = rounded_box("SSD_Module", (0.050, 0.020, 0.0018), (-0.083, 0.014, BASE_H*0.73), 0.002, RAM_PCB, 2)
parent_keep(ssd, internal_group)

# Controller, NAND packages and a tiny service label make the M.2 module
# recognizable in isolation.
for sidx, (sx, sy, sw, sh) in enumerate([
    (-0.099, 0.014, 0.010, 0.011),
    (-0.083, 0.014, 0.012, 0.012),
    (-0.066, 0.014, 0.012, 0.012),
], start=1):
    ssd_chip = rounded_box(
        f"SSD_Chip_{sidx}",
        (sw, sh, 0.0012),
        (sx, sy, BASE_H*0.86),
        0.0009,
        CHIP,
        2
    )
    parent_keep(ssd_chip, internal_group)

for idx, chip_x in enumerate((-0.096, -0.080, -0.064), start=1):
    nand = rounded_box(
        f"SSD_NAND_{idx}",
        (0.0115, 0.0125, 0.00115),
        (chip_x, 0.014, BASE_H*0.845),
        0.0009,
        CHIP,
        2
    )
    parent_keep(nand, internal_group)

ssd_controller = rounded_box(
    "SSD_Controller",
    (0.0095, 0.0105, 0.00120),
    (-0.106, 0.014, BASE_H*0.845),
    0.0008,
    CHIP,
    2
)
parent_keep(ssd_controller, internal_group)

ssd_contacts = rounded_box(
    "SSD_Contacts",
    (0.0030, 0.0150, 0.00050),
    (-0.0585, 0.014, BASE_H*0.79),
    0.0003,
    GOLD,
    1
)
parent_keep(ssd_contacts, internal_group)

ssd_label = rounded_box(
    "SSD_Label",
    (0.024, 0.010, 0.00032),
    (-0.081, 0.014, BASE_H*0.920),
    0.0008,
    GRAPHITE_DARK,
    1
)
parent_keep(ssd_label, internal_group)

# Battery cells across the front half of the chassis.
battery_cells = []
for idx, x in enumerate((-0.111, -0.037, 0.037, 0.111)):
    cell = rounded_box(f"Battery_Cell_{idx+1}", (0.066, 0.072, 0.0030), (x, -0.058, BASE_H*0.43), 0.006, BATTERY_MAT, 4)
    parent_keep(cell, internal_group)
    seam = rounded_box(f"BatteryDetail_Seam_{idx+1}", (0.052, 0.0020, 0.0006), (x, -0.058, BASE_H*0.61), 0.0005, GRAPHITE, 1)
    parent_keep(seam, internal_group)

# Dual blower fans. A thin dark scroll housing sits below the impeller field,
# which makes each unit read like a real laptop centrifugal blower instead of a
# bare decorative ring.
for side, x in (("L", -0.105), ("R", 0.105)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=48,
        radius=0.0305,
        depth=0.00125,
        location=(x, 0.061, BASE_H*0.625)
    )
    shroud = bpy.context.object
    shroud.name = f"Fan_{side}_Shroud"
    shroud.data.materials.append(FAN_MAT)
    parent_keep(shroud, internal_group)

    exhaust = rounded_box(
        f"Fan_{side}_ExhaustDuct",
        (0.050, 0.018, 0.00135),
        (x, 0.087, BASE_H*0.635),
        0.0025,
        FAN_MAT,
        3
    )
    parent_keep(exhaust, internal_group)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.0265, minor_radius=0.0020, major_segments=48, minor_segments=10, location=(x, 0.061, BASE_H*0.67))
    fan = bpy.context.object
    fan.name = f"Fan_{side}"
    fan.data.materials.append(FAN_MAT)
    parent_keep(fan, internal_group)

    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.0070, depth=0.0032, location=(x, 0.061, BASE_H*0.72))
    hub = bpy.context.object
    hub.name = f"Fan_{side}_Hub"
    hub.data.materials.append(FAN_MAT)
    parent_keep(hub, internal_group)

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=40,
        radius=0.0038,
        depth=0.00355,
        location=(x, 0.061, BASE_H*0.735)
    )
    cap = bpy.context.object
    cap.name = f"Fan_{side}_MotorCap"
    cap.data.materials.append(SILVER)
    parent_keep(cap, internal_group)

    # Dark intake ring and dense tangential blade field. Real notebook
    # blowers visually read as many thin curved vanes, not bright radial spokes.
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.0115,
        minor_radius=0.0009,
        major_segments=40,
        minor_segments=8,
        location=(x, 0.061, BASE_H*0.735)
    )
    inner_ring = bpy.context.object
    inner_ring.name = f"Fan_{side}_InnerRing"
    inner_ring.data.materials.append(FAN_MAT)
    parent_keep(inner_ring, internal_group)

    for blade in range(22):
        ang = blade * (math.tau / 22.0)
        bx = x + math.cos(ang) * 0.0177
        by = 0.061 + math.sin(ang) * 0.0177
        b = rounded_box(
            f"Fan_{side}_Blade_{blade:02d}",
            (0.0128, 0.0023, 0.00082),
            (bx, by, BASE_H*0.735),
            0.00070,
            FAN_MAT,
            2
        )
        b.rotation_euler.z = ang + math.radians(63)
        parent_keep(b, internal_group)

    # Structural spokes remain dark so only the tiny motor cap catches metal.
    for spoke in range(4):
        ang = spoke * math.pi / 2 + math.radians(45)
        s = rounded_box(
            f"Fan_{side}_Spoke_{spoke:02d}",
            (0.040, 0.0012, 0.0008),
            (x, 0.061, BASE_H*0.748),
            0.00038,
            FAN_MAT,
            1
        )
        s.rotation_euler.z = ang
        parent_keep(s, internal_group)

# Curved copper heat pipes connecting the compute package to both thermal zones.
def thermal_pipe(name, points, radius=0.0026):
    curve_data = bpy.data.curves.new(name + "_Curve", type='CURVE')
    curve_data.dimensions = '3D'
    curve_data.resolution_u = 2
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 3
    spline = curve_data.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for bp, co in zip(spline.bezier_points, points):
        bp.co = co
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(COPPER)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    parent_keep(obj, internal_group)
    return obj

zpipe = BASE_H * 0.53
thermal_pipe("HeatPipe_1", [
    (-0.108, 0.080, zpipe),
    (-0.075, 0.052, zpipe),
    (-0.018, 0.030, zpipe),
    ( 0.018, 0.025, zpipe),
    ( 0.070, 0.047, zpipe),
    ( 0.108, 0.082, zpipe),
], 0.0028)
thermal_pipe("HeatPipe_2", [
    (-0.108, 0.090, zpipe + 0.0010),
    (-0.060, 0.070, zpipe + 0.0010),
    ( 0.010, 0.043, zpipe + 0.0010),
    ( 0.075, 0.064, zpipe + 0.0010),
    ( 0.108, 0.092, zpipe + 0.0010),
], 0.0024)

# Rear heatsink fin arrays.
for side, x in (("L", -0.105), ("R", 0.105)):
    sink = rounded_box(f"Heatsink_{side}", (0.061, 0.012, 0.0034), (x, 0.101, BASE_H*0.50), 0.0012, GRAPHITE_DARK, 2)
    parent_keep(sink, internal_group)
    for fin in range(15):
        fx = x - 0.027 + fin * 0.00385
        f = rounded_box(f"Heatsink_{side}_Fin_{fin:02d}", (0.0010, 0.018, 0.0052), (fx, 0.101, BASE_H*0.55), 0.00025, COPPER, 1)
        parent_keep(f, internal_group)

# Internal structural carrier plate. Smaller than the old full-size slab so the
# actual thermals remain visible when exploded.
midplate = rounded_box("Internal_Midplate", (0.265, 0.145, 0.0011), (0, -0.002, BASE_H*0.28), 0.008, GRAPHITE_DARK, 4)
parent_keep(midplate, internal_group)

# World
world = bpy.context.scene.world or bpy.data.worlds.new("World")
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (0.008,0.012,0.018,1)
bg.inputs["Strength"].default_value = 0.08

# Floor shadow catcher-like plane
floor_mat = mat("Floor", (0.018,0.021,0.026), metallic=0.0, roughness=0.34)
rounded_box("Studio_Floor", (1.8,1.8,0.008), (0,0,-0.020), 0.015, floor_mat, 3)

# Lighting: broad, restrained product-studio sources. Keeping energy lower
# than the earlier setup preserves black PCB/plastic values instead of washing
# the internals into silver while still giving the graphite shell clean edges.
key = add_area("Key_Light", (0.48,-0.55,0.55), 110, 0.55, (0.62,0.74,0.92))
point_at(key, (0,0,0.07))
fill = add_area("Fill_Light", (-0.48,-0.20,0.30), 30, 0.45, (0.30,0.42,0.62))
point_at(fill, (0,0,0.07))
rim = add_area("Rim_Light", (0.25,0.42,0.42), 165, 0.32, (0.95,0.52,0.24))
point_at(rim, (0,0.05,0.08))
soft = add_area("Top_Softbox", (0.0,0.0,0.68), 60, 0.65, (0.68,0.78,0.94))
point_at(soft, (0,0,0))

# Cameras
cams = {
    "front": set_camera("Cam_Front_3Q", (0.56,-0.48,0.148), target=(0,-0.010,0.060), lens=67),
    "rear": set_camera("Cam_Rear_3Q", (0.56,0.50,0.17), target=(0,0.025,0.058), lens=68),
    "side": set_camera("Cam_Right_Side", (0.63,-0.08,0.135), target=(0.0,0.0,0.06), lens=74),
    "top": set_camera("Cam_Top", (0.30,-0.42,0.42), target=(0.0,0.0,0.04), lens=60),
}

closed_cams = {
    "closed_3q": set_camera(
        "Cam_Closed_3Q",
        (0.50, -0.48, 0.245),
        target=(0.0, 0.0, 0.008),
        lens=82
    ),
    "closed_side": set_camera(
        "Cam_Closed_Right_Side",
        (0.62, -0.015, 0.036),
        target=(0.0, 0.0, 0.008),
        lens=96
    ),
    "closed_rear": set_camera(
        "Cam_Closed_Rear",
        (0.0, 0.52, 0.032),
        target=(0.0, D / 2 - 0.010, 0.009),
        lens=108
    ),
}

# render settings
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1200
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = False
scene.render.image_settings.color_depth = '8'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = -1.0

# render studio views
for name, cam in cams.items():
    scene.camera = cam
    scene.render.filepath = os.path.join(RENDER_DIR, f"nova_{name}.png")
    bpy.ops.render.render(write_still=True)

# Closed-state alignment diagnostics. These are intentionally generated from
# the same exact 90-degree hinge pose used by the web runtime, so lid/base
# footprint, side seams and rear exhaust symmetry can be visually regressed.
lid_parent.rotation_euler.x = math.pi / 2
for name, cam in closed_cams.items():
    scene.camera = cam
    scene.render.filepath = os.path.join(RENDER_DIR, f"nova_{name}.png")
    bpy.ops.render.render(write_still=True)
lid_parent.rotation_euler.x = LEAN

# Exploded technical render for regression. The internal module shifts
# toward the viewer only for these diagnostics so CPU/GPU/RAM/fans stay
# readable instead of being hidden directly under the keyboard deck.
lid_group.location.z = 0.115
top_group.location.z = 0.062
internal_group.location.z = 0.025
internal_group.location.y = -0.105
lower_group.location.z = -0.070
scene.camera = cams["front"]
scene.render.filepath = os.path.join(RENDER_DIR, "nova_exploded.png")
bpy.ops.render.render(write_still=True)

scene.camera = cams["top"]
scene.render.filepath = os.path.join(RENDER_DIR, "nova_exploded_top.png")
bpy.ops.render.render(write_still=True)

# Internals-only diagnostic returns the module to its authored XY position
# before hiding the exterior.
internal_group.location.y = 0.0

# Internals-only diagnostic: recursively hide exterior descendants so the
# board topology and serviceable components can be reviewed directly.
def set_tree_render_hidden(root, hidden):
    root.hide_render = hidden
    stack = list(root.children)
    while stack:
        obj = stack.pop()
        obj.hide_render = hidden
        stack.extend(list(obj.children))

for exterior_group in (lid_group, top_group, lower_group):
    set_tree_render_hidden(exterior_group, True)

internal_group.location.z = 0.0
scene.camera = cams["top"]
scene.render.filepath = os.path.join(RENDER_DIR, "nova_internal_top.png")
bpy.ops.render.render(write_still=True)

for exterior_group in (lid_group, top_group, lower_group):
    set_tree_render_hidden(exterior_group, False)

internal_group.location.z = 0.025

lid_group.location.z = 0
top_group.location.z = 0
internal_group.location.z = 0
internal_group.location.y = 0
lower_group.location.z = 0

# transparent regression views (no floor/background)
studio_floor = bpy.data.objects.get("Studio_Floor")
if studio_floor:
    studio_floor.hide_render = True
scene.render.film_transparent = True
for name in ("front", "rear"):
    scene.camera = cams[name]
    scene.render.filepath = os.path.join(RENDER_DIR, f"nova_{name}_alpha.png")
    bpy.ops.render.render(write_still=True)
scene.render.film_transparent = False
if studio_floor:
    studio_floor.hide_render = False

# Save blend
blend_path = os.path.join(OUT_DIR, "NOVA_Canonical_Laptop.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

# Optimize the web export only. The editable .blend above keeps the full
# per-object construction, while the GLB merges meshes that always animate
# together. This reduces WebGL node count and GLTF parsing cost substantially.
def join_export_meshes(objects, name):
    meshes = [o for o in objects if o and o.type == 'MESH']
    if not meshes:
        return None
    if len(meshes) == 1:
        meshes[0].name = name
        return meshes[0]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.select_set(True)
    active = meshes[0]
    bpy.context.view_layer.objects.active = active
    bpy.ops.object.join()
    active.name = name
    return active

# Exterior assemblies that only move as their parent group.
join_export_meshes(
    [o for o in list(bpy.context.scene.objects) if o.parent == top_group and o.type == 'MESH'],
    "TopDeck_Assembly"
)
join_export_meshes(
    [o for o in list(bpy.context.scene.objects) if o.parent == lower_group and o.type == 'MESH'],
    "LowerChassis_Assembly"
)

# Internal subassemblies preserve the object names used by the web animation.
for side in ("L", "R"):
    join_export_meshes(
        [o for o in list(bpy.context.scene.objects) if o.parent == internal_group and o.name.startswith(f"Fan_{side}")],
        f"Fan_{side}"
    )
    join_export_meshes(
        [o for o in list(bpy.context.scene.objects) if o.parent == internal_group and o.name.startswith(f"Heatsink_{side}")],
        f"Heatsink_{side}"
    )

# Motherboard is one editor-facing assembly: board substrate plus memory,
# VRM, thermal-pad and connector details. CPU/GPU and SSD stay independent.
join_export_meshes(
    [
        o for o in list(bpy.context.scene.objects)
        if o.parent == internal_group
        and (o.name == "Motherboard" or o.name.startswith("BoardDetail_"))
    ],
    "Motherboard"
)

# Compute children stay under the CPU_GPU_Package empty so the editor can move
# the full compute assembly, while CPU and GPU remain independently editable.
join_export_meshes(
    [
        o for o in list(bpy.context.scene.objects)
        if o.parent == compute_group
        and o.type == 'MESH'
        and o.name.startswith("Compute_CPU_")
    ],
    "CPU_Package"
)
join_export_meshes(
    [
        o for o in list(bpy.context.scene.objects)
        if o.parent == compute_group
        and o.type == 'MESH'
        and (
            o.name.startswith("Compute_GPU_")
            or o.name.startswith("Compute_VRAM_")
        )
    ],
    "GPU_Package"
)

# SO-DIMM modules remain separate editor-facing assemblies.
for idx in (1, 2):
    join_export_meshes(
        [
            o for o in list(bpy.context.scene.objects)
            if o.parent == internal_group
            and o.type == 'MESH'
            and o.name.startswith(f"RAM{idx}_")
        ],
        f"RAM_SODIMM_{idx}"
    )

# SSD controller/NAND/contact/label details should follow the SSD when the
# editor moves or hides it.
join_export_meshes(
    [
        o for o in list(bpy.context.scene.objects)
        if o.parent == internal_group
        and o.type == 'MESH'
        and o.name.startswith("SSD_")
    ],
    "SSD_Module"
)

for idx in range(1, 5):
    join_export_meshes(
        [
            bpy.data.objects.get(f"Battery_Cell_{idx}"),
            bpy.data.objects.get(f"BatteryDetail_Seam_{idx}")
        ],
        f"Battery_Cell_{idx}"
    )

# Export-only polygon reduction. These assemblies are viewed at product scale,
# so tiny bevel/speaker tessellation is more expensive than visually useful.
def decimate_export_object(name, ratio):
    obj = bpy.data.objects.get(name)
    if not obj or obj.type != 'MESH' or len(obj.data.polygons) < 120:
        return
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("Web_Decimate", 'DECIMATE')
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)

decimate_export_object("TopDeck_Assembly", 0.52)
decimate_export_object("LowerChassis_Assembly", 0.70)
decimate_export_object("Fan_L", 0.68)
decimate_export_object("Fan_R", 0.68)
decimate_export_object("Heatsink_L", 0.76)
decimate_export_object("Heatsink_R", 0.76)
decimate_export_object("Motherboard", 0.80)
decimate_export_object("CPU_Package", 0.94)
decimate_export_object("GPU_Package", 0.92)

# Export GLB (hide studio objects/lights/cameras from export by selection)
for o in bpy.context.scene.objects:
    o.select_set(False)
export_objs = []
for o in bpy.context.scene.objects:
    if o.type in {'MESH', 'EMPTY'} and o.name != 'Studio_Floor':
        o.select_set(True)
        export_objs.append(o)
bpy.context.view_layer.objects.active = nova_root

glb_path = os.path.join(OUT_DIR, "NOVA_Canonical_Laptop.glb")
bpy.ops.export_scene.gltf(
    filepath=glb_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_materials='EXPORT',
    export_meshopt_compression_enable=True,
    export_meshopt_extension='EXT_meshopt_compression'
)

# Manifest
manifest = {
    "model": "NOVA Canonical Laptop",
    "units": "meters",
    "dimensions": {"width": W, "depth": D, "base_height": BASE_H, "lid_width": LID_W, "lid_height": LID_H, "lid_thickness": LID_T},
    "lid_lean_degrees": math.degrees(LEAN),
    "canonical_reference": "assets/hero/hero-laptop.png",
    "visible_right_cutouts": 2,
    "ports": {
        "right": ["USB-A", "USB-A"],
        "left": ["RJ45-Ethernet", "barrel-charging", "USB-C", "USB-A", "USB-A", "3.5mm-audio"]
    },
    "animatable_groups": ["LID_GROUP", "TOP_DECK_GROUP", "INTERNAL_GROUP", "LOWER_CHASSIS_GROUP"],
    "internal_components": ["Motherboard", "CPU_GPU_Package", "CPU_Package", "GPU_Package", "RAM_SODIMM_1", "RAM_SODIMM_2", "SSD_Module", "Fan_L", "Fan_R", "HeatPipe_1", "HeatPipe_2", "Heatsink_L", "Heatsink_R", "Battery_Cell_1", "Battery_Cell_2", "Battery_Cell_3", "Battery_Cell_4", "Internal_Midplate"],
    "editor_components": ["Motherboard", "CPU_GPU_Package", "CPU_Package", "GPU_Package", "RAM_SODIMM_1", "RAM_SODIMM_2", "SSD_Module", "Fan_L", "Fan_R", "HeatPipe_1", "HeatPipe_2", "Heatsink_L", "Heatsink_R", "Battery_Cell_1", "Battery_Cell_2", "Battery_Cell_3", "Battery_Cell_4", "Internal_Midplate"],
    "reference_basis": [
        "Framework laptop mainboard photography: dark asymmetric PCB, serviceable memory/storage zones, compact blower and heatpipe packaging",
        "Crucial DDR5 SO-DIMM photography: dark memory PCB, discrete DRAM packages, gold contact edge and retention hardware",
        "Premium notebook keyboard/trackpad references: black chiclet keys with restrained white backlight and a large buttonless glass trackpad",
        "Modern compact notebook hinges: paired barrel/torque sections with small base brackets and lid-side straps"
    ],
    "features": [
        "soft white per-key legend backlight",
        "large glass-like buttonless trackpad with haptic plate",
        "multi-part torque-barrel hinge with base brackets",
        "dark asymmetric motherboard with pads, sockets and mounting points",
        "separate low-profile CPU and GPU packages with VRAM and cold plates",
        "dual SO-DIMM-style RAM modules with DRAM ICs and gold contacts",
        "dense dual blower fans with motor caps",
        "curved copper heatpipes",
        "heatsink fin arrays",
        "segmented battery cells",
        "recessed side-port cavities"
    ],
    "notes": [
        "Physical geometry is reconstructed from available 2D NOVA references; unseen surfaces and port types are fictionalized NOVA-consistent geometry and cannot be guaranteed exact without CAD or orthographic source views.",
        "No third-party branding is included.",
        "The exported GLB preserves editor-facing hardware assemblies while merging detail meshes for web efficiency."
    ]
}
with open(os.path.join(OUT_DIR, "NOVA_Canonical_Laptop.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)

print("BLEND", blend_path)
print("GLB", glb_path)
print("RENDERS", RENDER_DIR)
