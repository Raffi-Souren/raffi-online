#!/usr/bin/env python3
"""Author natural, individually fitted MPFB adults with Blender; export raw GLBs.

Run with the pinned Blender bpy runtime prepared by the source-download tool.
All MPFB caches, source packs and intermediate .blend files stay outside public/.
The following optimization stage retargets animations and creates measured LODs.
"""
import argparse
import hashlib
import json
import math
import os
import pathlib
import sys
import traceback

REPO = pathlib.Path(__file__).resolve().parents[3]


def setup(args):
    os.environ["BLENDER_USER_RESOURCES"] = str(args.user_data / "blender")
    import bpy
    sys.path.insert(0, str(args.mpfb_source / "src"))
    bpy.utils.extension_path_user = lambda package, path="", create=False: str(args.user_data / path)
    addon = bpy.context.preferences.addons.new()
    addon.module = "mpfb"
    import mpfb
    mpfb.register()
    return bpy


def asset(root, name, subdir):
    matches = sorted((root / "data" / subdir).rglob(name))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one licensed {name} in {subdir}; found {len(matches)}")
    return matches[0]


def linear(color):
    channels = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in channels) + (1,)


def dress_materials(bpy, human, equipped, spec):
    """Original woven-fabric colors replace source logos and glossy body detail."""
    height = human['fitted_body_top']
    def fabric(name, color, roughness=.84):
        material = bpy.data.materials.new(spec['id'] + '_' + name)
        material.use_nodes = True
        tree = material.node_tree; shader = tree.nodes.get('Principled BSDF')
        shader.inputs['Roughness'].default_value = roughness
        noise = tree.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 145
        ramp = tree.nodes.new('ShaderNodeValToRGB')
        rgba = linear(color)
        ramp.color_ramp.elements[0].color = tuple(v * .86 for v in rgba[:3]) + (1,)
        ramp.color_ramp.elements[1].color = rgba
        tree.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
        tree.links.new(ramp.outputs['Color'], shader.inputs['Base Color'])
        return material
    top = fabric('fabric_top', spec['colors'][0]); bottom = fabric('fabric_bottom', spec['colors'][1])
    shoes = fabric('footwear', spec['colors'][2], .69)
    for item in equipped:
        if item['kind'] in ('Hair', 'Eyebrows'):
            for material in item['object'].data.materials:
                if not material or not material.use_nodes: continue
                tree = material.node_tree
                shader = next((node for node in tree.nodes if node.type == 'BSDF_PRINCIPLED'), None)
                if shader and shader.inputs['Base Color'].links:
                    source = shader.inputs['Base Color'].links[0].from_socket
                    image_node = source.node
                    if image_node.type == 'TEX_IMAGE' and image_node.image:
                        import numpy as np
                        original = image_node.image
                        if not original.packed_file and not pathlib.Path(bpy.path.abspath(original.filepath)).exists(): raise RuntimeError('Missing licensed hair image: ' + original.filepath)
                        values = np.empty(len(original.pixels), dtype=np.float32); original.pixels.foreach_get(values); values = values.reshape((-1, 4))
                        low_color, high_color = ('#696569', '#b6b1ab') if spec['hair'] == 'short-grey' else ('#959294', '#e7e0d8') if spec['hair'] == 'silver-pixie' else ('#151211', '#48362b')
                        low = np.array(linear(low_color)[:3]); high = np.array(linear(high_color)[:3])
                        luminance = np.clip(values[:, :3].mean(axis=1) * 2.5, 0, 1)
                        values[:, :3] = low + luminance[:, None] * (high - low)
                        recolored = bpy.data.images.new(spec['id'] + '_' + item['kind'] + '_color', width=original.size[0], height=original.size[1], alpha=True)
                        recolored.pixels.foreach_set(values.ravel()); recolored.pack(); image_node.image = recolored
        if item['kind'] != 'Clothes': continue
        obj = item['object']; name = item['source'].stem
        if name.startswith('shoes'):
            # Original CC0 footwear maps contain stitched panels, eyelets and
            # rubber soles. Preserve those details in the shared opaque bake.
            continue
        obj.data.materials.clear()
        obj.data.materials.append(top); obj.data.materials.append(bottom); obj.data.materials.append(shoes)
        dress = 'dress' in name; skirt = 'skirt' in name
        # Garments are separate topology islands in the source kits. Color the
        # entire jacket/shirt rather than painting a horizontal band through it.
        adjacency = [[] for _ in obj.data.vertices]
        for edge in obj.data.edges:
            a, b = edge.vertices; adjacency[a].append(b); adjacency[b].append(a)
        component = {}; component_top = {}; component_bottom = {}
        for vertex in obj.data.vertices:
            if vertex.index in component: continue
            island = vertex.index; pending = [island]; members = []
            component[island] = island
            while pending:
                index = pending.pop(); members.append(index)
                for adjacent in adjacency[index]:
                    if adjacent not in component: component[adjacent] = island; pending.append(adjacent)
            component_top[island] = max(obj.data.vertices[index].co.z for index in members) > height * .7
            component_bottom[island] = min(obj.data.vertices[index].co.z for index in members)
        for polygon in obj.data.polygons:
            upper = component_top[component[polygon.vertices[0]]]
            if upper and component_bottom[component[polygon.vertices[0]]] < height * .2:
                upper = sum(obj.data.vertices[index].co.z for index in polygon.vertices) / len(polygon.vertices) > height * .535
            polygon.material_index = 2 if name.startswith('shoes') else 0 if dress else 1 if skirt or not upper else 0
            polygon.use_smooth = True
        # Mae's fitted trousers remain as matching leggings under the skirt.
        # The continuous waistband prevents a masked-body gap beneath the tee.
        if spec['id'] == 'noah' and name == 'male_casualsuit04':
            trousers = {index for polygon in obj.data.polygons if polygon.material_index == 1 for index in polygon.vertices}
            for vertex in obj.data.vertices:
                z = vertex.co.z / height
                if vertex.index in trousers and .43 < z < .60 and abs(vertex.co.x) < height * .12 and vertex.co.y < -height * .062:
                    taper = min(1, (z - .43) / .035, (.60 - z) / .035)
                    vertex.co.y += (-height * .062 - vertex.co.y) * taper
            obj.data.update()


def apply_face(human, spec, targets):
    from mpfb.services.targetservice import TargetService
    variations = {
        "soft-oval": [("head/head-oval", .32), ("chin/chin-width-decr", .12)],
        "long-narrow": [("head/head-scale-vert-incr", .22), ("head/head-scale-horiz-decr", .17)],
        "round-cheeks": [("head/head-fat-incr", .25), ("chin/chin-width-incr", .18)],
        "broad-nose": [("nose/nose-scale-horiz-incr", .30), ("nose/nose-volume-incr", .12)],
        "angular-mature": [("head/head-age-incr", .3), ("chin/chin-bones-incr", .25)],
        "high-cheekbones": [("cheek/l-cheek-bones-incr", .25), ("cheek/r-cheek-bones-incr", .25)],
        "long-oval": [("head/head-oval", .2), ("head/head-scale-vert-incr", .18)],
        "broad-mature": [("head/head-age-incr", .35), ("head/head-scale-horiz-incr", .2)],
        "rounded-jaw": [("chin/chin-width-incr", .2), ("head/head-fat-incr", .1)],
        "square-jaw": [("head/head-rectangular", .23), ("chin/chin-bones-incr", .22)],
        "wide-cheekbones": [("head/head-scale-horiz-incr", .15), ("cheek/l-cheek-bones-incr", .2), ("cheek/r-cheek-bones-incr", .2)],
        "heart-shaped": [("head/head-triangular", .23), ("chin/chin-width-decr", .2)],
    }
    for name, weight in variations[spec["face"]]:
        path = targets / (name + ".target.gz")
        if not path.exists():
            raise RuntimeError(f"Missing inspected MPFB face target {name}")
        TargetService.load_target(human, str(path), weight=weight)


def player_polo(bpy, rig, spec, height):
    """Original folded collar, open placket and buttons, fitted to the tee shell."""
    if spec['id'] != 'player': return None
    bpy.ops.object.select_all(action='DESELECT')
    h = height / 1.77
    vertices, faces = [], []
    def panel(points):
        start = len(vertices); vertices.extend([(x*h,y*h,z*h) for x,y,z in points]); faces.append(tuple(range(start, len(vertices))))
    # Blender -Y faces forward. Collar points fold over the upper chest.
    for side in [-1, 1]:
        panel([(side*.012,-.086,1.49),(side*.061,-.049,1.51),(side*.105,-.081,1.47),(side*.063,-.126,1.419)])
        panel([(side*.061,-.049,1.51),(side*.057,.039,1.515),(side*.083,.058,1.477),(side*.105,-.081,1.47)])
    panel([(-.057,.039,1.515),(.057,.039,1.515),(.083,.058,1.477),(-.083,.058,1.477)])
    panel([(-.013,-.104,1.47),(.013,-.104,1.47),(.013,-.131,1.365),(-.013,-.131,1.365)])
    mesh=bpy.data.meshes.new('player_folded_polo_collar');mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(mesh.name,mesh);bpy.context.collection.objects.link(obj);obj.parent=rig
    obj.vertex_groups.new(name='spine_05').add(list(range(len(vertices))),1,'REPLACE')
    if 'spine_05' not in rig.data.bones:
        obj.vertex_groups[0].name='spine_03'
    arm=obj.modifiers.new('Collar follows shoulders','ARMATURE');arm.object=rig
    solid=obj.modifiers.new('Folded fabric thickness','SOLIDIFY');solid.thickness=.002*h
    bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.modifier_apply(modifier=solid.name)
    material=bpy.data.materials.new('polo_collar_pique');material.use_nodes=True
    shader=material.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=linear('#356555');shader.inputs['Roughness'].default_value=.89;mesh.materials.append(material)
    for z in [1.432,1.395]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=.0037*h,location=(0,-.126*h,z*h))
        button=bpy.context.object;button.name='polo_button';button.parent=rig
        button.vertex_groups.new(name=obj.vertex_groups[0].name).add(list(range(len(button.data.vertices))),1,'REPLACE')
        modifier=button.modifiers.new('Button skin','ARMATURE');modifier.object=rig
        button.data.materials.append(material)
        # Join before the opaque atlas bake; buttons add no draw calls.
        obj.select_set(True);button.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.join()
    return obj


def player_glasses(bpy, rig, spec, equipped):
    """Original rounded acetate spectacles, fitted from the actual eye geometry."""
    if spec['id'] != 'player': return None
    from mathutils import Vector
    eyes=next(item['object'] for item in equipped if item['kind']=='Eyes')
    points=[v.co for v in eyes.data.vertices]
    center_z=(min(v.z for v in points)+max(v.z for v in points))/2
    front=min(v.y for v in points)-.013
    center_x=max(v.x for v in points)*.68
    vertices,faces=[],[]
    def tube(path,radius=.0036,closed=False):
        start=len(vertices);n=len(path);sides=6
        for i,p in enumerate(path):
            tangent=Vector(path[(i+1)%n])-Vector(path[(i-1)%n]) if closed else Vector(path[min(n-1,i+1)])-Vector(path[max(0,i-1)])
            tangent.normalize();u=tangent.cross(Vector((0,0,1)))
            if u.length<.01:u=tangent.cross(Vector((0,1,0)))
            u.normalize();v=tangent.cross(u).normalized()
            for k in range(sides): vertices.append(tuple(Vector(p)+radius*(math.cos(k*math.tau/sides)*u+math.sin(k*math.tau/sides)*v)))
        for i in range(n if closed else n-1):
            for k in range(sides): faces.append((start+i*sides+k,start+i*sides+(k+1)%sides,start+((i+1)%n)*sides+(k+1)%sides,start+((i+1)%n)*sides+k))
    for side in [-1,1]:
        tube([(side*center_x+.0275*math.cos(t),front+.005*abs(math.cos(t)),center_z+.0225*math.sin(t)) for t in [i*math.tau/24 for i in range(24)]],closed=True)
        x=side*(center_x+.029)
        tube([(x,front+.003,center_z+.008),(x+side*.005,front+.022,center_z+.009),(x+side*.006,.008,center_z+.005),(x+side*.002,.032,center_z-.009)],.0042)
    tube([(-center_x+.026,front,center_z+.006),(0,front-.004,center_z+.010),(center_x-.026,front,center_z+.006)],.003)
    mesh=bpy.data.meshes.new('player_rounded_acetate_spectacles');mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(mesh.name,mesh);bpy.context.collection.objects.link(obj);obj.parent=rig
    obj.vertex_groups.new(name='head').add(list(range(len(vertices))),1,'REPLACE')
    modifier=obj.modifiers.new('Spectacles follow head','ARMATURE');modifier.object=rig
    material=bpy.data.materials.new('dark_tortoise_acetate');material.use_nodes=True
    shader=material.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=linear('#211a13');shader.inputs['Roughness'].default_value=.28;mesh.materials.append(material)
    for face in mesh.polygons:face.use_smooth=True
    return obj


def facial_hair(bpy, human, rig, spec, source):
    """Fit an original short beard/moustache surface to each baked natural face."""
    if not spec.get('facialHair'): return None
    from mathutils import Vector
    height = max(v.co.z for v in human.data.vertices[:13380]) - min(v.co.z for v in human.data.vertices[:13380])
    top = max(v.co.z for v in human.data.vertices[:13380])
    face_front = min(v.co.y for v in human.data.vertices[:13380] if v.co.z > top - height * .14)
    # Helper cube indices are not stable after MPFB's rest-pose bake. Fit the
    # patch to the actual head surface in body units, below the nose/eye line.
    mouth = Vector((0, face_front + height * .015, top - height * .095))
    vertices, faces, weights, mapping = [], [], [], {}
    human.data.update()
    for polygon in human.data.polygons:
        if any(index >= 13380 for index in polygon.vertices): continue
        center = sum((human.data.vertices[index].co for index in polygon.vertices), Vector()) / len(polygon.vertices)
        dx, dy, dz = center.x - mouth.x, center.y - mouth.y, center.z - mouth.z
        upper_lip = spec['facialHair'] == 'moustache'
        inside = abs(dx) < height * (.026 if upper_lip else .050) and dy < height * .014 and (height * .001 < dz < height * .012 if upper_lip else -height * .031 < dz < -height * .005)
        if not inside or polygon.normal.y > -.2: continue
        face = []
        for index in polygon.vertices:
            if index not in mapping:
                vertex = human.data.vertices[index]; mapping[index] = len(vertices)
                vertices.append(tuple(vertex.co + vertex.normal * (.0012 if upper_lip else .002)))
                weights.append([(human.vertex_groups[group.group].name, group.weight) for group in vertex.groups if group.weight > 0])
            face.append(mapping[index])
        faces.append(face)
    if not faces: raise RuntimeError('Original facial-hair fit selected no face polygons: ' + spec['id'])
    mesh = bpy.data.meshes.new(spec['id'] + '_facial_hair'); mesh.from_pydata(vertices, [], faces); mesh.update()
    obj = bpy.data.objects.new(mesh.name, mesh); bpy.context.collection.objects.link(obj); obj.parent = rig
    for index, influences in enumerate(weights):
        for name, weight in influences:
            group = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name); group.add([index], weight, 'REPLACE')
    modifier = obj.modifiers.new('Fitted face skeleton', 'ARMATURE'); modifier.object = rig
    material = bpy.data.materials.new(spec['id'] + '_short_facial_hair'); material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF'); shader.inputs['Base Color'].default_value = linear('#8d7d73' if 'grey' in spec['facialHair'] else '#6e5848'); shader.inputs['Roughness'].default_value = .96
    mesh.materials.append(material)
    for polygon in mesh.polygons: polygon.use_smooth = True
    return obj


def skirt_waistband(bpy, rig, spec, equipped, height):
    if spec['id'] != 'mae': return None
    skirt = next(item['object'] for item in equipped if 'tiered_skirt' in item['source'].stem)
    top = max(vertex.co.z for vertex in skirt.data.vertices)
    waist = [vertex.co for vertex in skirt.data.vertices if vertex.co.z > top - height * .025]
    xmin, xmax = min(v.x for v in waist), max(v.x for v in waist)
    ymin, ymax = min(v.y for v in waist), max(v.y for v in waist)
    cx, cy = (xmin + xmax) / 2, (ymin + ymax) / 2
    rx, ry = (xmax - xmin) / 2 + .012, (ymax - ymin) / 2 + .014
    vertices, faces = [], []
    for z, flare in [(top - height * .055, 1.08), (top + height * .024, 1)]:
        for index in range(32):
            angle = index * math.tau / 32
            vertices.append((cx + math.cos(angle) * rx * flare, cy + math.sin(angle) * ry * flare, z))
    for index in range(32):
        nxt = (index + 1) % 32; faces.append((index, nxt, nxt + 32, index + 32))
    mesh = bpy.data.meshes.new('mae_fitted_skirt_waistband'); mesh.from_pydata(vertices, [], faces); mesh.update()
    obj = bpy.data.objects.new(mesh.name, mesh); bpy.context.collection.objects.link(obj); obj.parent = rig
    obj.vertex_groups.new(name='pelvis').add(list(range(len(vertices))), 1, 'REPLACE')
    modifier = obj.modifiers.new('Waist skeleton', 'ARMATURE'); modifier.object = rig
    material = bpy.data.materials.new('mae_skirt_waistband'); material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF'); shader.inputs['Base Color'].default_value = linear(spec['colors'][1]); shader.inputs['Roughness'].default_value = .87
    mesh.materials.append(material)
    for polygon in mesh.polygons: polygon.use_smooth = True
    return obj


def bake_opaque_atlas(bpy, objects, output, identity, resolution=1024):
    """Bake game-engine source materials to one opaque bitmap and one draw group."""
    from mathutils import Vector
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        # Pin every source bitmap to its original UVs before making an atlas UV.
        if obj.data.uv_layers.active:
            obj.data.uv_layers.active.name = "OriginalUV"
        for material in obj.data.materials:
            if not material or not material.use_nodes:
                continue
            nodes = material.node_tree.nodes
            principled = next((node for node in nodes if node.type == 'BSDF_PRINCIPLED'), None)
            if principled:
                # The albedo bake deliberately excludes normal/specular source
                # detail. Every bitmap actually feeding base color must exist.
                pending = [link.from_node for link in principled.inputs['Base Color'].links]
                visited = set()
                while pending:
                    node = pending.pop()
                    if node in visited: continue
                    visited.add(node)
                    if node.type == 'TEX_IMAGE' and node.image and not node.image.packed_file:
                        image_path = pathlib.Path(bpy.path.abspath(node.image.filepath))
                        if not image_path.exists(): raise RuntimeError('Missing licensed albedo image: ' + str(image_path))
                    pending.extend(link.from_node for socket in node.inputs for link in socket.links)
            uv = nodes.new("ShaderNodeUVMap"); uv.uv_map = "OriginalUV"
            for node in list(nodes):
                if node.type == "TEX_IMAGE" and not node.inputs["Vector"].is_linked:
                    material.node_tree.links.new(uv.outputs["UV"], node.inputs["Vector"])
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = identity + "_body_clothing"
    uv = obj.data.uv_layers.new(name="RaffiAtlas")
    obj.data.uv_layers.active = uv
    uv.active_render = True
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.008)
    bpy.ops.object.mode_set(mode="OBJECT")
    image = bpy.data.images.new(identity + "_albedo", width=resolution, height=resolution, alpha=False)
    image.colorspace_settings.name = "sRGB"
    for material in obj.data.materials:
        material.use_nodes = True
        node = material.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        material.node_tree.nodes.active = node
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 1
    scene.render.threads_mode = "FIXED"; scene.render.threads = 4
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    scene.render.bake.margin = 5
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"})
    image.filepath_raw = str(output / (identity + "-albedo.png"))
    image.file_format = "PNG"; image.save()
    material = bpy.data.materials.new(identity + " · baked skin and clothes")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    principled = nodes.get("Principled BSDF")
    principled.inputs["Roughness"].default_value = .79
    texture = nodes.new("ShaderNodeTexImage"); texture.image = image
    uv_node = nodes.new("ShaderNodeUVMap"); uv_node.uv_map = "RaffiAtlas"
    material.node_tree.links.new(uv_node.outputs["UV"], texture.inputs["Vector"])
    material.node_tree.links.new(texture.outputs["Color"], principled.inputs["Base Color"])
    obj.data.materials.clear(); obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0; polygon.use_smooth = True
    # Export only the atlas coordinates. Source UVs/textures remain in the source packs.
    for layer in list(obj.data.uv_layers):
        if layer.name != "RaffiAtlas": obj.data.uv_layers.remove(layer)
    return obj


def author(bpy, args, spec, plan):
    from mpfb.services.humanservice import HumanService
    from mpfb.services.targetservice import TargetService
    from mpfb.services.rigservice import RigService
    from mpfb.services.exportservice import ExportService
    from mpfb.services.objectservice import ObjectService
    from mpfb.entities.objectproperties import HumanObjectProperties
    bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete(use_global=False)
    for material in list(bpy.data.materials): bpy.data.materials.remove(material, do_unlink=True)
    for image in list(bpy.data.images):
        if image.type != 'RENDER_RESULT': bpy.data.images.remove(image, do_unlink=True)
    human = HumanService.create_human()
    build = {"slim": .28, "lean": .32, "average": .48, "full": .7, "stocky": .75, "strong-average": .57, "broad-average": .60}[spec["build"]]
    female = spec["presentation"] == "woman"
    age = .5 + (spec["age"] - 25) / (100 if spec["age"] <= 50 else 110)
    macros = {"gender": 0 if female else .5 if spec["presentation"] == "androgynous" else 1,
              "age": max(.43, min(.92, age)), "muscle": .28, "weight": build,
              "height": max(.25, min(.8, (spec["height"] - 1.45) / .6))}
    macros.update(plan.get("macro", {}))
    for key, value in macros.items(): HumanObjectProperties.set_value(key, value, entity_reference=human)
    TargetService.reapply_macro_details(human)
    apply_face(human, spec, args.mpfb_source / "src/mpfb/data/targets")
    bpy.context.view_layer.update()
    evaluated = human.evaluated_get(bpy.context.evaluated_depsgraph_get())
    human['fitted_body_top'] = max(vertex.co.z for vertex in evaluated.data.vertices)
    skin_path = asset(args.user_data, plan["skin"], "skins")
    diffuse = next((line.split(None, 1)[1].strip() for line in skin_path.read_text().splitlines() if line.startswith('diffuseTexture ')), None)
    if not diffuse or not (skin_path.parent / diffuse).exists(): raise RuntimeError('Missing licensed skin diffuse: ' + str(skin_path.parent / (diffuse or '<unspecified>')))
    HumanService.set_character_skin(str(skin_path), human, skin_type="GAMEENGINE")
    if spec['id'] == 'player':
        # Tint the actual skin albedo, retaining pores/lips/eye sockets. Catalog
        # swatches alone do not change the exported MakeHuman skin texture.
        for material in human.data.materials:
            if not material or not material.use_nodes: continue
            tree=material.node_tree; shader=next((n for n in tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
            if shader and shader.inputs['Base Color'].links:
                source=shader.inputs['Base Color'].links[0].from_socket
                tint=tree.nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1;tint.inputs[2].default_value=(.67,.57,.48,1)
                tree.links.new(source,tint.inputs[1]);tree.links.new(tint.outputs[0],shader.inputs['Base Color'])
    rig = HumanService.add_builtin_rig(human, "game_engine")
    equipped = []
    for subdir, filename, kind in [("eyes", "low-poly.mhclo", "Eyes"), ("eyebrows", plan.get("brows", "eyebrow001.mhclo"), "Eyebrows")] + plan["assets"]:
        source = asset(args.user_data, filename, subdir)
        obj = HumanService.add_mhclo_asset(str(source), human, asset_type=kind, material_type="GAMEENGINE", subdiv_levels=0)
        equipped.append({"object": obj, "source": source, "kind": kind})
    if not any(item["kind"] == "Clothes" for item in equipped): raise RuntimeError("Every exported character must be dressed")
    dress_materials(bpy, human, equipped, spec)
    # MPFB's T-pose correctly refits every equipped garment before animation transfer.
    ObjectService.activate_blender_object(rig)
    bpy.ops.object.mode_set(mode="POSE")
    pose = json.loads((args.mpfb_source / "src/mpfb/data/poses/game_engine_fk/t-pose.json").read_text())
    RigService.set_pose_from_dict(rig, pose)
    bpy.ops.object.mode_set(mode="OBJECT")
    RigService.apply_pose_as_rest_pose(rig)
    if spec['id'] == 'player':
        hair=next(item['object'] for item in equipped if item['kind']=='Hair')
        # Keep the full frontal hairline. Extra length lies behind the ears and
        # down toward the nape; broad waves follow the supplied portrait.
        for vertex in hair.data.vertices:
            x,y,z=vertex.co
            back=max(0,min(1,(y+.005)/.09))
            lower=max(0,min(1,(1.73-z)/.10))
            vertex.co.y+=.012*back*lower
            vertex.co.z-=.018*back*lower
            vertex.co.x+=.0025*math.sin(y*92+z*45)*max(0,min(1,(z-1.59)/.1))
        hair.data.update()
    beard = facial_hair(bpy, human, rig, spec, args.mpfb_source)
    body_group = human.vertex_groups.get('body').index
    body_z = [vertex.co.z for vertex in human.data.vertices if any(group.group == body_group for group in vertex.groups)]
    authored_body_height = max(body_z) - min(body_z)
    waistband = skirt_waistband(bpy, rig, spec, equipped, authored_body_height)
    polo = player_polo(bpy, rig, spec, authored_body_height)
    glasses = player_glasses(bpy, rig, spec, equipped)
    ExportService.bake_modifiers_remove_helpers(human, bake_masks=True, bake_subdiv=False, remove_helpers=True, also_proxy=True)
    # Preserve fitted body proportions; this last units correction sets authored height.
    bpy.context.view_layer.update()
    scale = spec["height"] / max(.1, authored_body_height)
    rig.scale *= scale
    opaque = [human] + ([beard] if beard else []) + ([waistband] if waistband else []) + ([polo] if polo else []) + ([glasses] if glasses else []) + [item["object"] for item in equipped if item["kind"] not in ("Hair", "Eyebrows", "Eyelashes")]
    atlas = bake_opaque_atlas(bpy, opaque, args.output, spec["id"], resolution=1024)
    bpy.ops.object.select_all(action="DESELECT"); rig.select_set(True)
    for child in ObjectService.get_list_of_children(rig): child.select_set(True)
    bpy.context.view_layer.objects.active = rig
    raw = args.output / (spec["id"] + ".glb")
    bpy.ops.export_scene.gltf(filepath=str(raw), export_format="GLB", use_selection=True, export_animations=False, export_apply=False)
    if args.save_blend: bpy.ops.wm.save_as_mainfile(filepath=str(args.output / (spec["id"] + ".blend")), relative_remap=False)
    return {"id": spec["id"], "appearance": spec, "macro": macros, "blender": bpy.app.version_string, "rig": "game_engine; T-pose baked as rest",
            "sourceAssets": [str(skin_path.relative_to(args.user_data / "data"))] + [str(item["source"].relative_to(args.user_data / "data")) for item in equipped],
            "rawFile": raw.name, "rawBytes": raw.stat().st_size, "rawSha256": hashlib.sha256(raw.read_bytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mpfb-source", type=pathlib.Path, default=pathlib.Path("/tmp/raffi-mpfb-source"))
    parser.add_argument("--user-data", type=pathlib.Path, default=pathlib.Path("/tmp/raffi-mpfb-user"))
    parser.add_argument("--output", type=pathlib.Path, default=pathlib.Path("/tmp/raffi-population-raw"))
    parser.add_argument("--plan", type=pathlib.Path, required=True)
    parser.add_argument("--identities", default="all")
    parser.add_argument("--save-blend", action="store_true")
    args = parser.parse_args(); args.output.mkdir(parents=True, exist_ok=True)
    catalog = json.loads((REPO / "public/world/data/population.json").read_text())
    plans = json.loads(args.plan.read_text())
    identities = catalog['identities'] + ([catalog['player']] if catalog.get('player') else [])
    selected = identities if args.identities == "all" else [identity for identity in identities if identity["id"] in args.identities.split(",")]
    if not selected: raise RuntimeError("No curated identities selected")
    bpy = setup(args)
    manifest_path = args.output / 'authoring.json'
    records = json.loads(manifest_path.read_text()) if manifest_path.exists() else []
    for spec in selected:
        record = author(bpy, args, spec, plans[spec["id"]])
        records = [previous for previous in records if previous['id'] != spec['id']] + [record]
        manifest_path.write_text(json.dumps(records, indent=2) + "\n")
        print("RAFFI_AUTHORED", spec["id"], flush=True)


if __name__ == "__main__":
    try:
        main()
    except BaseException:
        traceback.print_exc(); sys.stdout.flush(); sys.stderr.flush(); os._exit(1)
    # Official bpy4.5.13 on this macOS host faults during module finalization.
    # Only exit after all authoring/export calls have succeeded; failures above exit1.
    sys.stdout.flush(); sys.stderr.flush(); os._exit(0)
