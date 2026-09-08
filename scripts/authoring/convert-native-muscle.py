"""Create an isolated, continuous CC0 presentation atlas from the native posed proxy.

Regions are deliberately generic presentation masks, not medical segmentation.
Coordinates are evaluated in the fitted rest rig before posing; all material
boundaries retain identical positions and normals and fade to neutral skin.
"""
import sys, json, hashlib, struct, heapq
from pathlib import Path
from collections import defaultdict, Counter
import numpy as np

out = Path(sys.argv[1]).resolve()
if 'public' in out.parts: raise ValueError('Candidate output required')
d = np.load(out/'posed-correspondence.npz')
rig = json.loads((out/'rig-landmarks.json').read_text())
rest, p = d['rest'].astype(float), d['posed'].astype(float)*.1
p[:,1] -= p[:,1].min()
quads = d['quads']
t = np.array([[a,b,c] for a,b,c,e in quads]+[[a,c,e] for a,b,c,e in quads], dtype=np.int32)
x,y,z = rest.T; ax = abs(x)
names = d['boneNames'].tolist()
def weight(prefixes):
    return d['weights'][:,[i for i,n in enumerate(names) if any(n.startswith(prefix) for prefix in prefixes)]].sum(axis=1)
def head(b): return np.array(rig[b]['head'])
def tail(b): return np.array(rig[b]['tail'])
hip, shoulder = head('upperleg01.L'),head('upperarm01.L')
rib = head('spine02')[1]
pec = tail('breast.L')
waist = head('spine04')[1]
labels = ['neutral','chest','back','shoulders','arms','legs','glutes','core','abs']
scores = np.zeros((len(p),len(labels)))
scores[:,0] = .12
arm = weight(['upperarm','lowerarm'])
leg = weight(['upperleg','lowerleg'])
torso = (ax<shoulder[0]*1.08)&(arm<.35)&(leg<.4)&(y<head('neck01')[1]-.5)
# Smooth ellipsoidal chest lobes follow this fitted rig's breast and shoulder.
chest = 1-((ax-pec[0])/(shoulder[0]*.72))**2-((y-(pec[1]+.28))/.99)**2
scores[:,1] = np.maximum(chest,0)*(z>.48)*torso
scores[:,2] = .8*torso*(z<-.12)*(y>waist+.05)*(y<shoulder[1]+.5)
upper = head('upperarm01.L'); elbow = head('lowerarm01.L')
side_rest = rest.copy();side_rest[:,0]=ax
v = elbow-upper
u = ((side_rest-upper)@v)/(v@v)
scores[:,3] = .95*(arm>.15)*(u>-.2)*(u<.43)
scores[:,4] = .65*(arm>.55)*(u>=.3)*(weight(['wrist','finger','metacarpal'])<.2)
scores[:,5] = .7*(leg>.58)*(y>head('foot.L')[1]+.45)
scores[:,6] = .85*(z<-.08)*(y<waist+.15)*(y>hip[1]-1.55)*(ax> .12)*(ax<hip[0]+.75)
scores[:,7] = .6*torso*(z>.05)*(y>waist-.15)*(y<rib+.85)*(ax>.68)
scores[:,8] = .75*torso*(z>.5)*(y>waist-.12)*(y<rib+.85)*(ax<.78)
face_labels = scores[t].mean(axis=1).argmax(axis=1)
edges = defaultdict(list); graph = [set() for _ in p]; memberships = [set() for _ in p]
for fi,tri in enumerate(t.tolist()):
    for u,v in zip(tri,tri[1:]+tri[:1]):
        edges[tuple(sorted((u,v)))].append((u,v))
        graph[u].add(v); graph[v].add(u)
    for u in tri: memberships[u].add(int(face_labels[fi]))
boundary = sum(len(v)==1 for v in edges.values())
nonmanifold = sum(len(v)!=2 for v in edges.values())
orientation = sum(len(v)==2 and v[0]==v[1] for v in edges.values())
todo=set(range(len(p))); components=[]
while todo:
    stack=[todo.pop()];count=0
    while stack:
        u=stack.pop();count+=1; unseen=graph[u]&todo;todo-=unseen;stack.extend(unseen)
    components.append(count)
cross = np.cross(p[t[:,1]]-p[t[:,0]],p[t[:,2]]-p[t[:,0]])
areas = np.linalg.norm(cross,axis=1)
volume = float(np.einsum('ij,ij->',p[t[:,0]],np.cross(p[t[:,1]],p[t[:,2]]))/6)
if boundary or nonmanifold or orientation or len(components)!=1 or min(areas)<1e-12 or volume<=0:
    raise ValueError('Topology gate failed')
normals=np.zeros_like(p)
for k in range(3): np.add.at(normals,t[:,k],cross)
normals/=np.linalg.norm(normals,axis=1)[:,None]
# Shared vertices at region boundaries receive exactly zero data tint. Distances
# are computed on the actual surface rather than blurred across nearby fingers.
dist=np.full(len(p),np.inf);queue=[]
for i,m in enumerate(memberships):
    if len(m)>1: dist[i]=0;heapq.heappush(queue,(0,i))
while queue:
    dv,u=heapq.heappop(queue)
    if dv!=dist[u] or dv>.035: continue
    for v in graph[u]:
        nd=dv+np.linalg.norm(p[u]-p[v])
        if nd<dist[v]:dist[v]=nd;heapq.heappush(queue,(nd,v))
mask=np.clip(dist/.013,0,1); mask=mask*mask*(3-2*mask)
binary=bytearray();views=[];accessors=[]
def accessor(data,kind,target=34962):
    data=np.ascontiguousarray(data)
    while len(binary)%4:binary.append(0)
    offset=len(binary);binary.extend(data.tobytes())
    views.append({'buffer':0,'byteOffset':offset,'byteLength':data.nbytes,'target':target})
    a={'bufferView':len(views)-1,'componentType':5126 if data.dtype.kind=='f' else 5125,'count':len(data),'type':kind}
    if kind=='VEC3':a.update(min=data.min(axis=0).tolist(),max=data.max(axis=0).tolist())
    accessors.append(a);return len(accessors)-1
nodes=[];meshes=[];materials=[]
for li,label in enumerate(labels):
    faces=t[face_labels==li]
    if not len(faces):raise ValueError('Missing region '+label)
    ids,inverse=np.unique(faces,return_inverse=True)
    uv=np.column_stack([rest[ids,0],rest[ids,1]*.18])
    if label=='chest': uv[:,1]=(rest[ids,1]+.22*(abs(rest[ids,0])-pec[0])**2)*.32
    elif label in ['legs','arms','shoulders']:uv[:,1]=abs(rest[ids,0])*.35+rest[ids,2]*.2
    attrs={'POSITION':accessor(p[ids].astype('<f4'),'VEC3'), 'NORMAL':accessor(normals[ids].astype('<f4'),'VEC3'),
           'TEXCOORD_0':accessor(uv.astype('<f4'),'VEC2'), '_TWIN_MASK':accessor(mask[ids].astype('<f4'),'SCALAR')}
    idx=accessor(inverse.reshape(-1).astype('<u4'),'SCALAR',34963)
    extras={'twinFiberUV':label!='neutral','twinRegionMask':True,'candidateOnly':True}
    nodes.append({'name':'twin-region:'+label,'mesh':li,'extras':extras})
    meshes.append({'name':'twin-region:'+label,'primitives':[{'attributes':attrs,'indices':idx,'material':li}], 'extras':extras})
    materials.append({'name':'twin-region:'+label,'pbrMetallicRoughness':{'baseColorFactor':[.055,.085,.12,1],'roughnessFactor':.6,'metallicFactor':.12}})
while len(binary)%4:binary.append(0)
gltf={'asset':{'version':'2.0','generator':'GYMS.LIFE native CC0 presentation atlas','copyright':'CC0 MakeHuman graphical assets'},
      'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,'materials':materials,
      'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':accessors,
      'extras':{'candidateOnly':True,'visualGatePassed':False,'sourceProxy':'male_muscle_13290','regionMeaning':'Generic presentation masks; not medical segmentation','garmentMeshes':0}}
j=json.dumps(gltf,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
glb=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
(out/'twin-anatomy-muscular-candidate.glb').write_bytes(glb)
np.savez_compressed(out/'atlas-audit-data.npz',positions=p,triangles=t,faceLabels=face_labels,mask=mask,normals=normals)
audit={'assetSha256':hashlib.sha256(glb).hexdigest(),'bytes':len(glb),'vertices':len(p),'triangles':len(t),'components':components,
       'boundaryEdges':boundary,'nonManifoldEdges':nonmanifold,'inconsistentWinding':orientation,'degenerateTriangles':int((areas<1e-12).sum()),
       'eulerCharacteristic':len(p)-len(edges)+len(t),'signedVolumeMetres3':volume,'garmentMeshes':0,'overlaidSurfaces':0,
       'regions':dict(zip(labels,np.bincount(face_labels).tolist())),'maskFeatherMetres':.013,'sharedPositionsAndNormals':True,
       'visualGatePassed':False,'productionIntegration':False,'limitations':['Generic authored regions, not medical segmentation','Topology does not prove absence of nonadjacent intersections','GPU visual review required']}
(out/'atlas.audit.json').write_text(json.dumps(audit,indent=2)+'\n')
print(json.dumps(audit,indent=2))
