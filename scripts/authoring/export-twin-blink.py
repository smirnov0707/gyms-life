"""Transfer the native CC0 closed-lid pose onto the exact registered skin mesh."""
import hashlib, json, runpy, struct, sys
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree

source, output = map(Path, sys.argv[1:3])
sys.argv = [__file__, str(source), str(output)]
ctx = runpy.run_path(str(Path(__file__).with_name('pose-native-muscle.py')), run_name='__main__')
h = ctx['h'].human
opened = h.getProxyMesh().coord.copy()
unit, face_indices = ctx['ctx']['assets']._face_pose_units(h)
import animation
closed = unit.getBlendedPose(['LeftUpperLidClosed', 'RightUpperLidClosed'], [1, 1])
pose = animation.mixPoses(h.getActiveAnimation(), closed, face_indices)
pose.name = 'gyms-blink'
h.addAnimation(pose)
h.setActiveAnimation(pose.name)
h.setPosed(True)
h.refreshPose()
ctx['ctx']['assets'].adapt_all_proxies(h, fit_to_posed=True)
delta = (h.getProxyMesh().coord - opened).astype(float) * .1
p = opened.astype(float) * .1
p[:, 1] -= p[:, 1].min()
q = h.getProxyMesh().fvert
tri = np.concatenate([q[:, [0, 1, 2]], q[:, [0, 2, 3]]])
edges = {tuple(sorted((int(f[a]), int(f[b])))) for f in tri for a, b in [(0,1),(1,2),(2,0)]}
points, offsets = list(p), list(delta)
for a, b in sorted(edges):
    points.append((p[a] + p[b]) / 2)
    offsets.append((delta[a] + delta[b]) / 2)
tree, offsets = cKDTree(points), np.array(offsets)
raw = Path('public/models/twin-natural-skin-v1.glb').read_bytes()
assert hashlib.sha256(raw).hexdigest() == 'b21543c3c2113a8f95ff6843d4c6ce226352b0b61179144a663353fee2bebe70'
size = struct.unpack_from('<I', raw, 12)[0]
g, binary = json.loads(raw[20:20+size]), raw[28+size:]
def read(index):
    a = g['accessors'][index]; v = g['bufferViews'][a['bufferView']]
    return np.frombuffer(binary, dtype='<f4', count=a['count']*3, offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,3)
entries = []
for mesh in g['meshes']:
    for prim in mesh['primitives']:
        if g['materials'][prim['material']]['name'] != 'twin-region:neutral': continue
        distance, ids = tree.query(read(prim['attributes']['_TWIN_SCULPT_POSITION']))
        assert distance.max() < 1e-6
        for i, value in enumerate(offsets[ids]):
            if np.linalg.norm(value) > 1e-7:
                entries.append([i, *np.round(value, 7).tolist()])
Path('src/components/twin/twin-blink-data.json').write_text(json.dumps(entries, separators=(',', ':'))+'\n')
print(json.dumps({'vertices':len(entries), 'maximumDisplacement':float(np.linalg.norm(delta,axis=1).max())}))
