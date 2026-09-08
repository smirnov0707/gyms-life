"""BVH broad phase and segment/triangle tests for nonincident atlas faces.

Adjacent faces are covered by the indexed topology audit. Coplanar candidates
are reported separately so a parallel-plane case cannot silently pass.
"""
import sys,json,hashlib
from pathlib import Path
import numpy as np
out=Path(sys.argv[1]);d=np.load(out/'atlas-audit-data.npz')
p,t=d['positions'],d['triangles'];v=p[t];lo=v.min(1);hi=v.max(1);center=(lo+hi)/2
def build(ids):
    lower,upper=lo[ids].min(0),hi[ids].max(0)
    if len(ids)<=12:return (lower,upper,ids,None)
    axis=np.argmax(np.ptp(center[ids],axis=0));ids=ids[np.argsort(center[ids,axis])];mid=len(ids)//2
    return (lower,upper,None,(build(ids[:mid]),build(ids[mid:])))
tree=build(np.arange(len(t)));pairs=[]
def visit(a,b,same=False):
    if np.any(a[1]<b[0]-1e-9) or np.any(b[1]<a[0]-1e-9):return
    if same:
        if a[3]:
            left,right=a[3];visit(left,left,True);visit(right,right,True);visit(left,right)
        else:
            ids=a[2]
            for i,u in enumerate(ids):
                for w in ids[i+1:]:pairs.append((u,w))
    elif a[3]:
        for child in a[3]:visit(child,b)
    elif b[3]:
        for child in b[3]:visit(a,child)
    else:
        pairs.extend((u,w) for u in a[2] for w in b[2])
visit(tree,tree,True)
pairs=np.asarray(pairs,dtype=np.int32)
a,b=pairs.T
keep=(lo[a]<=hi[b]+1e-9).all(1)&(lo[b]<=hi[a]+1e-9).all(1)&~(t[a,:,None]==t[b,None,:]).any(axis=(1,2))
pairs=pairs[keep];a,b=v[pairs[:,0]],v[pairs[:,1]]
def segment_triangle(start,end,tri):
    direction=end-start;e1=tri[:,1]-tri[:,0];e2=tri[:,2]-tri[:,0]
    h=np.cross(direction,e2);det=np.einsum('ij,ij->i',e1,h)
    valid=abs(det)>1e-12;inv=np.divide(1.,det,out=np.zeros_like(det),where=valid)
    s=start-tri[:,0];u=inv*np.einsum('ij,ij->i',s,h);q=np.cross(s,e1)
    w=inv*np.einsum('ij,ij->i',direction,q);along=inv*np.einsum('ij,ij->i',e2,q)
    return valid&(u>=-1e-7)&(w>=-1e-7)&(u+w<=1+1e-7)&(along>=-1e-7)&(along<=1+1e-7)
hit=np.zeros(len(pairs),bool)
for i in range(3):
    hit|=segment_triangle(a[:,i],a[:,(i+1)%3],b)
    hit|=segment_triangle(b[:,i],b[:,(i+1)%3],a)
na=np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0]);nb=np.cross(b[:,1]-b[:,0],b[:,2]-b[:,0])
na/=np.linalg.norm(na,axis=1)[:,None];nb/=np.linalg.norm(nb,axis=1)[:,None]
coplanar=(np.linalg.norm(np.cross(na,nb),axis=1)<1e-7)&(abs(np.einsum('ij,ij->i',b[:,0]-a[:,0],na))<1e-8)
report={'assetSha256':hashlib.sha256((out/'twin-anatomy-muscular-candidate.glb').read_bytes()).hexdigest(),
        'nonincidentBroadPhasePairs':len(pairs),'intersectingPairs':int(hit.sum()),'coplanarPairsRequiringReview':int(coplanar.sum()),
        'intersectionExamples':pairs[hit][:100].tolist(),'coplanarExamples':pairs[coplanar][:100].tolist(),
        'passed':not hit.any() and not coplanar.any(),'method':'AABB BVH, nonincident pairs, six segment-triangle tests, coplanar ambiguity fails gate',
        'toleranceMetres':1e-8,'scope':'No clinical or anatomical correctness claim; incident faces audited separately for winding and topology'}
(out/'intersections.audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if not report['passed']:sys.exit(2)
