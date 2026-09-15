"""GYMS.LIFE generic adult from CC0 graphics; no MakeHuman program code.
Requires numpy and Pillow. No paid service or user data. Art choices are not measurements.
"""
from pathlib import Path
import argparse, hashlib, io, json, struct
import numpy as np
from PIL import Image

REVISION = 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482'
VERSION = 'gyms-human-cc0-1'
SOURCES = {}

def read(path):
    data = Path(path).read_bytes()
    label = str(path).split('/makehuman/data/')[-1]
    if label == str(path):
        label = next((key + str(path).split('/' + key)[-1] for key in ('skins/', 'hair/') if '/' + key in str(path)), Path(path).name)
    SOURCES[label] = hashlib.sha256(data).hexdigest()
    return data

def obj(path):
    v, uv, groups = [], [], {}
    g = 'body'
    for line in read(path).decode().splitlines():
        a = line.split()
        if not a: continue
        if a[0] == 'v': v.append(list(map(float, a[1:4])))
        elif a[0] == 'vt': uv.append(list(map(float, a[1:3])))
        elif a[0] == 'g': g = a[1]
        elif a[0] == 'f':
            f = [(int(x.split('/')[0])-1, int(x.split('/')[1])-1) for x in a[1:]]
            groups.setdefault(g, []).append(f)
    return np.array(v, dtype=float), np.array(uv, dtype=float), groups

def target(vertices, path, weight):
    for line in read(path).decode().splitlines():
        a = line.split()
        if len(a) == 4 and not a[0].startswith('#'):
            vertices[int(a[0])] += weight * np.array(list(map(float, a[1:])))

def fitted_part(path, body):
    # MHCLO stores explicit barycentric attachments to the reference surface.
    verts = []; active = False; scale = np.ones(3)
    for line in read(path).decode().splitlines():
        a=line.split()
        if not a or a[0].startswith('#'): continue
        if a[0] in ('x_scale', 'y_scale', 'z_scale'):
            axis='xyz'.index(a[0][0]); scale[axis] = abs(body[int(a[1]),axis] - body[int(a[2]),axis]) / float(a[3])
        if a[0] == 'verts': active=True; continue
        if active:
            if not a[0].isdigit(): break
            if len(a)==1: verts.append(body[int(a[0])].copy())
            elif len(a)>=9:
                p = np.array(list(map(int,a[:3]))); w=np.array(list(map(float,a[3:6])))
                offset=np.array(list(map(float,a[6:9])))
                verts.append((body[p] * w[:,None]).sum(0) + offset*scale)
    return np.array(verts)

def subdivide(vertices, faces, smooth=True):
    """One Catmull-Clark pass, also usable on face-varying UV topology."""
    edges={}; adjacent=[[] for _ in vertices]; facepoints=np.array([vertices[f].mean(0) for f in faces])
    for fi,f in enumerate(faces):
        for i, a in enumerate(f):
            b=f[(i+1)%len(f)]; key=tuple(sorted((a,b)))
            if key not in edges: edges[key]=[len(edges),[]]
            edges[key][1].append(fi); adjacent[a].append(fi)
    edgepoints=np.zeros((len(edges), vertices.shape[1])); neighboring=[[] for _ in vertices]; boundary=[[] for _ in vertices]
    for (a,b),(index, flist) in edges.items():
        neighboring[a].append(b); neighboring[b].append(a)
        if len(flist)==2:
            edgepoints[index]=(vertices[a]+vertices[b]+facepoints[flist].sum(0))/4
        else:
            edgepoints[index]=(vertices[a]+vertices[b])/2
            boundary[a].append(b); boundary[b].append(a)
    newv=vertices.copy()
    for i, neigh in enumerate(neighboring):
        if not neigh: continue
        if len(boundary[i])==2: newv[i]=(6*vertices[i]+vertices[boundary[i]].sum(0))/8
        elif smooth:
            n=len(neigh); F=facepoints[adjacent[i]].mean(0); R=(vertices[neigh].mean(0)+vertices[i])/2
            newv[i]=(F+2*R+(n-3)*vertices[i])/n
    outv=np.concatenate([newv,edgepoints,facepoints]); outfaces=[]
    for fi, face in enumerate(faces):
        center=len(vertices)+len(edges)+fi
        for i,a in enumerate(face):
            nxt=face[(i+1)%len(face)]; prev=face[i-1]
            outfaces.append([a, len(vertices)+edges[tuple(sorted((a,nxt)))][0],center,len(vertices)+edges[tuple(sorted((prev,a)))][0]])
    return outv,np.array(outfaces,dtype=int)

def compact(v,uv,faces):
    fp=np.array([[p[0] for p in f] for f in faces]); fu=np.array([[p[1] for p in f] for f in faces])
    vp,invp=np.unique(fp,return_inverse=True); vu,invu=np.unique(fu,return_inverse=True)
    return v[vp], uv[vu], invp.reshape(fp.shape), invu.reshape(fu.shape)

def triangles(f):
    return np.array([[row[0],row[j],row[j+1]] for row in f for j in range(1,len(row)-1)],dtype=int)

def normals(v,tri):
    n=np.zeros_like(v); cross=np.cross(v[tri[:,1]]-v[tri[:,0]],v[tri[:,2]]-v[tri[:,0]])
    for j in range(3): np.add.at(n,tri[:,j],cross)
    n/=np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-20)
    return n

class GLB:
    def __init__(self):
        self.bin=bytearray(); self.doc={'asset':{'version':'2.0','generator':'GYMS.LIFE CC0 authoring recipe 1'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],'textures':[],'images':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],'accessors':[],'bufferViews':[],'buffers':[{'byteLength':0}]}; self.stats=[]
    def view(self,data):
        self.bin.extend(b'\0'*((-len(self.bin))%4)); i=len(self.doc['bufferViews'])
        self.doc['bufferViews'].append({'buffer':0,'byteOffset':len(self.bin),'byteLength':len(data)}); self.bin.extend(data); return i
    def attr(self, arr, kind, index=False):
        arr=np.asarray(arr,dtype='<u4' if index else '<f4'); entry={'bufferView':self.view(arr.tobytes()),'componentType':5125 if index else 5126,'count':len(arr),'type':kind}
        if kind=='VEC3': entry.update(min=arr.min(0).tolist(),max=arr.max(0).tolist())
        self.doc['accessors'].append(entry); return len(self.doc['accessors'])-1
    def texture(self,image, size=2048, alpha=False):
        image=image.copy(); image.thumbnail((size,size),Image.Resampling.LANCZOS)
        output=io.BytesIO(); image=image.convert('RGBA' if alpha else 'RGB'); image.save(output,format='PNG' if alpha else 'JPEG',quality=92,optimize=True)
        mime='image/png' if alpha else 'image/jpeg'; self.doc['images'].append({'bufferView':self.view(output.getvalue()),'mimeType':mime})
        self.doc['textures'].append({'sampler':0,'source':len(self.doc['images'])-1}); return len(self.doc['textures'])-1
    def material(self,name,color,tex=None,roughness=.68,normal=None,alpha=False):
        m={'name':name,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':0,'roughnessFactor':roughness},'doubleSided':alpha}
        if tex is not None:m['pbrMetallicRoughness']['baseColorTexture']={'index':tex}
        if normal is not None:m['normalTexture']={'index':normal,'scale':.15}
        if alpha:m.update(alphaMode='MASK',alphaCutoff=.45)
        self.doc['materials'].append(m);return len(self.doc['materials'])-1
    def mesh(self,name,v,uv,fp,fu,n,material,region=None):
        ptri=triangles(fp); utri=triangles(fu)
        pairs,ind=np.unique(np.stack([ptri.ravel(),utri.ravel()],axis=1),axis=0,return_inverse=True)
        pos=v[pairs[:,0]]; tex=uv[pairs[:,1]].copy(); tex[:,1]=1-tex[:,1]; ns=n[pairs[:,0]]
        attrs={'POSITION':self.attr(pos,'VEC3'),'NORMAL':self.attr(ns,'VEC3'),'TEXCOORD_0':self.attr(tex,'VEC2')}
        primitive={'attributes':attrs,'indices':self.attr(ind,'SCALAR',True),'material':material,'mode':4}
        self.doc['meshes'].append({'name':name,'primitives':[primitive]})
        node={'name':name,'mesh':len(self.doc['meshes'])-1,'extras':{'assetIdentity':VERSION,'twinRegion':region,'genericNotPersonal':True}}
        self.doc['nodes'].append(node);self.doc['scenes'][0]['nodes'].append(len(self.doc['nodes'])-1)
        self.stats.append({'name':name,'triangles':len(ptri),'vertices':len(pos),'region':region})
    def save(self,path):
        self.bin.extend(b'\0'*((-len(self.bin))%4));self.doc['buffers'][0]['byteLength']=len(self.bin)
        js=json.dumps(self.doc,separators=(',',':'),allow_nan=False).encode();js+=b' '*((-len(js))%4)
        data=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(self.bin))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(self.bin),0x004E4942)+self.bin
        path.write_bytes(data);return data

def image(path):return Image.open(io.BytesIO(read(path)))

def build(core, materials, output):
    core=core/'makehuman/data'
    v,uv,groups=obj(core/'3dobjs/base.obj')
    weights={'caucasian-male-young.target':1.0,'universal-male-young-averagemuscle-averageweight.target':.65,'universal-male-young-maxmuscle-averageweight.target':.35}
    for name,weight in weights.items():target(v, core/'targets/macrodetails'/name,weight)
    body_ids=np.unique([a for f in groups['body'] for a,b in f]); bottom=v[body_ids,1].min(); scale=1.80/(v[body_ids,1].max()-bottom)
    def transform(pos):
        pos=pos.copy();pos[:,1]-=bottom;pos*=scale;return pos
    bv,bu,bf,buf=compact(transform(v),uv,groups['body'])
    centers=bv[bf].mean(1); covered=(centers[:,1]>.705)&(centers[:,1]<1.07)&(abs(centers[:,0])<.30)
    garment_faces=bf[covered]; garment_uv=buf[covered]
    cloth=bv.copy(); sn=normals(bv,triangles(bf));cloth += sn*.009
    cloth[:,2]+=.0015*np.sin(cloth[:,1]*105+cloth[:,0]*42)
    fullv, fullf=subdivide(bv,bf); fulluv, fulluf=subdivide(bu,buf)
    keep=np.repeat(~covered,4); fv=fullv; ff=fullf[keep]; fuv=fulluv; fuf=fulluf[keep]
    fn=normals(fv,triangles(fullf))
    cv,cf=subdivide(cloth,garment_faces); cu,cuf=subdivide(bu,garment_uv)
    cn=normals(cv,triangles(cf))
    glb=GLB();skintex=glb.texture(image(materials/'skins/young_caucasian_male/young_lightskinned_male_diffuse.png'))
    rng=np.random.default_rng(613); h=rng.normal(0,1,(512,512));dx=np.roll(h,1,1)-h;dy=np.roll(h,1,0)-h
    normal=np.dstack([128+dx*1.7,128+dy*1.7,np.full_like(h,255)]).clip(0,255).astype('uint8')
    normaltex=glb.texture(Image.fromarray(normal),512,True)
    skinmat=glb.material('Natural skin - CC0 albedo, authored microdetail',[1,1,1,1],skintex,.70,normaltex)
    c=fv[ff].mean(1); ids=[]
    for x,y,z in c:
        if y>1.58: region=None
        elif abs(x)>.245: region='arms'
        elif y>1.405 and abs(x)>.145: region='shoulders'
        elif y<.90: region='legs'
        elif y<1.09 and z<.035: region='glutes'
        elif z<.025 and y>1.12: region='back'
        elif y>1.285 and z>=.025: region='chest'
        elif abs(x)<.105 and z>=.025: region='abs'
        else:region='core'
        ids.append(region)
    for region in [None,'chest','back','shoulders','arms','legs','glutes','core','abs']:
        mask=np.array([x==region for x in ids])
        if mask.any():glb.mesh('human-'+(region or 'neutral'),fv,fuv,ff[mask],fuf[mask],fn,skinmat,region)
    xx,yy=np.meshgrid(np.arange(256),np.arange(256)); weave=3*np.sin(xx*np.pi/2)*np.cos(yy*np.pi/2)
    fabric=np.stack([np.full((256,256),v)+weave for v in (36,40,46)],2).clip(0,255).astype('uint8')
    clothtex=glb.texture(Image.fromarray(fabric),256)
    clothmat=glb.material('GYMS authored graphite training shorts',[1,1,1,1],clothtex,.92)
    cc=cv[cf].mean(1);cloth_regions=np.where(cc[:,1]<.89,'legs',np.where(cc[:,2]<.025,'glutes','core'))
    for region in ['legs','glutes','core']:
        mask=cloth_regions==region
        if mask.any():glb.mesh('shorts-'+region,cv,cu,cf[mask],cuf[mask],cn,clothmat,region)
    for stem, objpath, clopath, diffuse, rough, alpha, size in [
        ('eyes',core/'eyes/high-poly/high-poly.obj',core/'eyes/high-poly/high-poly.mhclo',core/'eyes/materials/brown_eye.png',.20,False,1024),
        ('hair',materials/'hair/short01/short01.obj',materials/'hair/short01/short01.mhclo',materials/'hair/short01/short01_diffuse.png',.85,True,1024),
    ]:
        ov,ou,og=obj(objpath);ov=fitted_part(clopath,v)
        raw=[f for group in og.values() for f in group]
        vv,vu,pf,uf=compact(transform(ov),ou,raw)
        tex=glb.texture(image(diffuse),size,alpha);mat=glb.material(stem,[1,1,1,1],tex,rough,alpha=alpha)
        glb.mesh(stem,vv,vu,pf,uf,normals(vv,triangles(pf)),mat)
    output.mkdir(parents=True,exist_ok=True);data=glb.save(output/'gyms-human-cc0-v1.glb')
    report={'version':VERSION,'sourceCommit':REVISION,'license':'CC0-1.0 (MakeHuman core graphics); GYMS authored alterations/shorts','upstreamLicenseUrl':'https://static.makehumancommunity.org/about/license.html','genericNotPersonal':True,'authoredChanges':['adult template proportions','natural PBR setup','graphite training shorts and fabric','canonical region segmentation','UV-preserving surface smoothing'],'sourceHashes':SOURCES,'morphWeights':weights,'bytes':len(data),'triangles':sum(s['triangles'] for s in glb.stats),'meshes':glb.stats,'visualAccepted':False,'productionApproved':False,'deviceFps':None}
    (output/'asset-manifest.json').write_text(json.dumps(report,indent=2)+'\n'); (output/'MAKEHUMAN-CC0.txt').write_bytes(read(core.parents[1]/'LICENSE.ASSETS.md'))
    print(json.dumps({k:report[k] for k in ['version','bytes','triangles']},indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--core',type=Path,required=True);p.add_argument('--materials',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();build(a.core,a.materials,a.output)
