"""Fit and pose the native CC0 human, retaining rest coordinates and rig evidence."""
import sys, runpy, json
from pathlib import Path
import numpy as np

source, output = map(Path, sys.argv[1:3])
out = output.resolve()
sys.argv = [__file__, str(source), str(out)]
ctx = runpy.run_path(str(Path(__file__).with_name('build-native-muscle.py')), run_name='__main__')
h, proxy = ctx['h'], ctx['p']
skel = h.human.getBaseSkeleton()
bones = skel.getBones()
rest = h.human.getProxyMesh().coord.copy()
weights = proxy.getVertexWeights(h.human.getVertexWeights()).data
bone_info = {b.name: {'head': b.headPos.tolist(), 'tail': b.tailPos.tolist(), 'matrix': b.matRestGlobal.tolist()} for b in bones}
(out/'rig-landmarks.json').write_text(json.dumps(bone_info, indent=2))
names = list(weights)
dense = np.zeros((len(rest), len(names)), dtype=np.float32)
for i, name in enumerate(names):
    idx, weight = weights[name]
    dense[idx, i] = weight
import animation
pose = np.tile(np.eye(4, dtype=np.float32), (len(bones), 1, 1))
rotations = {}
for side, sign in [('L', -1), ('R', 1)]:
    bone = skel.getBone('upperarm01.'+side)
    angle = sign*np.deg2rad(24)
    c,s = np.cos(angle), np.sin(angle)
    world = np.array([[c,-s,0],[s,c,0],[0,0,1]])
    pose[bone.index,:3,:3] = world
    rotations[bone.name] = float(np.rad2deg(angle))
    # Straighten the source proxy's forward elbow bend in the rest rig.
    forearm = skel.getBone('lowerarm01.'+side)
    a = np.deg2rad(48)
    c,s = np.cos(a),np.sin(a)
    world_x = np.array([[1,0,0],[0,c,-s],[0,s,c]])
    pose[forearm.index,:3,:3] = world_x
    rotations[forearm.name] = {'worldXDegrees':48}
    leg = skel.getBone('upperleg01.'+side)
    a = -sign*np.deg2rad(3.5)
    c,s = np.cos(a),np.sin(a)
    world_z = np.array([[c,-s,0],[s,c,0],[0,0,1]])
    pose[leg.index,:3,:3] = world_z
    rotations[leg.name] = {'worldZDegrees':float(np.rad2deg(a))}
track = animation.Pose('gyms-reference-rest', pose)
h.human.addAnimation(track)
h.human.setActiveAnimation(track.name)
h.human.setToFrame(0, update=False)
h.human.setPosed(True)
ctx['assets'].adapt_all_proxies(h.human, fit_to_posed=True)
posed = h.human.getProxyMesh().coord.copy()
np.savez_compressed(out/'posed-correspondence.npz', rest=rest, posed=posed,
    quads=h.human.getProxyMesh().fvert, weights=dense, boneNames=np.array(names),
    uv=h.human.getProxyMesh().texco, faceUv=h.human.getProxyMesh().fuvs)
h.export(str(out/'muscular-posed.obj'))
(out/'pose-recipe.json').write_text(json.dumps({'boneRotations':rotations,'method':'Native animation.Pose and proxy skinning', 'coordinateUnit':'decimetres'},indent=2))
print('POSE EXPORTED', out)
