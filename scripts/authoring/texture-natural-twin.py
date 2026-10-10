"""Transfer native CC0 skin UVs to the reviewed natural geometry, preserving every triangle.

Input correspondence is from pose-native-muscle.py at the documented MakeHuman revision.
UV seams duplicate vertices; they never interpolate across the atlas seam. This is a
texture/normal authoring step, not a personal scan or new anatomical segmentation.
"""
import hashlib, io, json, struct, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

correspondence, skin, eyes_path, eye_skin = map(Path, sys.argv[1:5])
source = Path('public/models/twin-natural-v1.glb')
assert hashlib.sha256(source.read_bytes()).hexdigest() == '6dba27f71bf62e61eccf3e115ea9e183e37f0c00d6846a13f5a02705d5012c1d'
assert hashlib.sha256(skin.read_bytes()).hexdigest() == '862a26e335e958b70534cb5f0d7c47ef30ab148a56c42b3e9da969cf76f12963'
assert hashlib.sha256(eye_skin.read_bytes()).hexdigest() == '4659691c7295ad6206c78b003e5fd0e5f91dcd53032fa914a229bb48cabe424b'
d = np.load(correspondence)
p = d['posed'].astype(float) * .1
p[:, 1] -= p[:, 1].min()
q, fuv = d['quads'], d['faceUv']
tri = np.concatenate([q[:, [0,1,2]], q[:, [0,2,3]]])
triuv = np.concatenate([fuv[:, [0,1,2]], fuv[:, [0,2,3]]])
points = list(p); supports = [{i: 1.0} for i in range(len(p))]
edges = set()
faces_by_vertex = [set() for _ in p]
for fi, ids in enumerate(tri):
    for i in ids: faces_by_vertex[i].add(fi)
    for a,b in [(0,1),(1,2),(2,0)]: edges.add(tuple(sorted([int(ids[a]),int(ids[b])])))
for a,b in sorted(edges):
    points.append((p[a]+p[b])/2); supports.append({a:.5,b:.5})
tree = cKDTree(points)
raw = source.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
g = json.loads(raw[20:20+size]); old = raw[28+size:]
components = {5126:'<f4', 5125:'<u4', 5123:'<u2'}; widths = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
def read(ai):
    a=g['accessors'][ai]; v=g['bufferViews'][a['bufferView']]
    dtype=np.dtype(components[a['componentType']]); width=widths[a['type']]
    return np.ndarray((a['count'],width),dtype=dtype,buffer=old,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',width*dtype.itemsize),dtype.itemsize)).copy()
primitives=[]
for mesh in g['meshes']:
    for prim in mesh['primitives']:
        attrs={name:read(ai) for name,ai in prim['attributes'].items()}
        faces=read(prim['indices']).reshape(-1,3)
        dist,matches=tree.query(attrs['_TWIN_SCULPT_POSITION'])
        assert dist.max()<1e-6, float(dist.max())
        remap={}; ids=[]; uvs=[]; indices=[]
        for face in faces:
            sup=[supports[matches[i]] for i in face]
            native_ids=set().union(*(s.keys() for s in sup))
            candidates=set.intersection(*(faces_by_vertex[i] for i in native_ids))
            assert len(candidates)==1, (native_ids,candidates)
            parent=next(iter(candidates)); lookup=dict(zip(tri[parent], d['uv'][triuv[parent]]))
            for old_id,s in zip(face,sup):
                uv=sum(lookup[i]*w for i,w in s.items())
                key=(int(old_id),*map(float,uv))
                if key not in remap:
                    remap[key]=len(ids);ids.append(old_id);uvs.append(uv)
                indices.append(remap[key])
        attrs={name:values[ids] for name,values in attrs.items()}
        attrs['TEXCOORD_0']=np.array(uvs,dtype='<f4')
        attrs['TEXCOORD_0'][:,1] = 1 - attrs['TEXCOORD_0'][:,1] # OBJ bottom-left to glTF top-left
        primitives.append((prim,attrs,np.array(indices,dtype='<u4').reshape(-1,1)))
# Smooth only shading across welded region/UV seams. Positions and picking are unchanged.
keys={}; positions=[]; ns=[]; refs=[]; neighbors=[]
for prim,attrs,idx in primitives:
    local=[]
    for pos,n in zip(attrs['POSITION'],attrs['NORMAL']):
        key=tuple(pos)
        if key not in keys:
            keys[key]=len(positions); positions.append(pos);ns.append(n);neighbors.append(set())
        local.append(keys[key])
    refs.append(local)
    for face in idx.reshape(-1,3):
        a,b,c=[local[i] for i in face]
        neighbors[a].update([b,c]);neighbors[b].update([a,c]);neighbors[c].update([a,b])
ns=np.array(ns); base=ns.copy(); positions=np.array(positions)
for _ in range(3):
    nxt=ns.copy()
    for i,(x,y,z) in enumerate(positions):
        if not (.78<y<1.57) or (abs(x)>.25 and y<1.07): continue
        compatible=[j for j in neighbors[i] if np.dot(base[i],base[j])>.55]
        if compatible:
            n=.65*ns[i]+.35*np.mean(ns[compatible],axis=0)
            nxt[i]=n/np.linalg.norm(n)
    ns=nxt
for (_,attrs,_),local in zip(primitives,refs): attrs['NORMAL']=ns[local].astype('<f4')
# Keep one sRGB texture in the GLB; no external URL, extra request, or missing texture state.
jpeg=io.BytesIO();Image.open(skin).convert('RGB').resize((2048,2048),Image.Resampling.LANCZOS).save(jpeg,'JPEG',quality=88,optimize=True)
binary=bytearray(); views=[]; accessors=[]
def view(data, target=None):
    binary.extend(b'\0'*((-len(binary))%4)); v={'buffer':0,'byteOffset':len(binary),'byteLength':len(data)}
    if target:v['target']=target
    views.append(v);binary.extend(data);return len(views)-1
def add(values,kind):
    integer=values.dtype.kind=='u';values=np.ascontiguousarray(values,dtype='<u4' if integer else '<f4')
    a={'bufferView':view(values.tobytes(),34963 if integer else 34962),'componentType':5125 if integer else 5126,'count':len(values),'type':kind}
    if kind=='VEC3': a.update(min=values.min(axis=0).tolist(),max=values.max(axis=0).tolist())
    accessors.append(a);return len(accessors)-1
for prim,attrs,idx in primitives:
    prim['attributes']={name:add(values,{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[values.shape[1]]) for name,values in attrs.items()}
    prim['indices']=add(idx,'SCALAR')
for material in g['materials']:
    material['pbrMetallicRoughness']={'baseColorFactor':[1,1,1,1],'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':.76}
# Native fitted eyeballs fill the proxy's empty eye sockets, with their own UVs.
eye=np.load(eyes_path); eye_ids=[];eye_uv=[];eye_indices=[];eye_remap={}
for face,uvface in zip(eye['quads'],eye['faceUv']):
    for corners in [(0,1,2),(0,2,3)]:
        for corner in corners:
            key=(int(face[corner]),int(uvface[corner]))
            if key not in eye_remap:
                eye_remap[key]=len(eye_ids);eye_ids.append(key[0]);eye_uv.append(eye['uv'][key[1]])
            eye_indices.append(eye_remap[key])
eye_uv=np.array(eye_uv,dtype='<f4');eye_uv[:,1]=1-eye_uv[:,1]
eye_attrs={'POSITION':add(eye['positions'][eye_ids],'VEC3'),'NORMAL':add(eye['normals'][eye_ids],'VEC3'),'TEXCOORD_0':add(eye_uv,'VEC2')}
eye_material=len(g['materials']);g['materials'].append({'name':'Eyes','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'baseColorTexture':{'index':1},'metallicFactor':0,'roughnessFactor':.32}})
eye_mesh=len(g['meshes']);g['meshes'].append({'name':'Eyes','primitives':[{'attributes':eye_attrs,'indices':add(np.array(eye_indices,dtype='<u4').reshape(-1,1),'SCALAR'),'material':eye_material}]})
eye_node=len(g['nodes']);g['nodes'].append({'name':'Eyes','mesh':eye_mesh});g['scenes'][g.get('scene',0)]['nodes'].append(eye_node)
eye_jpeg=io.BytesIO();Image.open(eye_skin).convert('RGB').resize((512,512),Image.Resampling.LANCZOS).save(eye_jpeg,'JPEG',quality=92,optimize=True)
g['images']=[{'bufferView':view(jpeg.getvalue()),'mimeType':'image/jpeg','name':'MakeHuman CC0 young male diffuse'}, {'bufferView':view(eye_jpeg.getvalue()),'mimeType':'image/jpeg','name':'MakeHuman CC0 brown eye'}]
g['textures']=[{'source':0,'sampler':0},{'source':1,'sampler':0}];g['samplers']=[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}]
g['bufferViews']=views;g['accessors']=accessors;g['buffers']=[{'byteLength':len(binary)}]
g['asset']['generator']='GYMS.LIFE native UV skin transfer; unchanged natural-v1 positions'
g['asset']['copyright']='MakeHuman assets CC0-1.0; Data Collection AB, Joel Palmius, Jonas Hauquier'
g['extras']['skinSource']='MakeHuman young_caucasian_male; generic presentation, not athlete identity'
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary.extend(b'\0'*((-len(binary))%4))
result=struct.pack('<III',0x46546c67,2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
out=Path('public/models/twin-natural-skin-v1.glb');out.write_bytes(result)
print(json.dumps({'output':str(out),'sha256':hashlib.sha256(result).hexdigest(),'bytes':len(result),'textureBytes':len(jpeg.getvalue()),'triangles':sum(len(idx)//3 for _,_,idx in primitives)}))
