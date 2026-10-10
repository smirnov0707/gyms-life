"""Fit the source's CC0 eyes to the same generic head, using native HM08 attachment."""
import runpy,sys
from pathlib import Path
import numpy as np
source, output, correspondence = map(Path,sys.argv[1:4])
sys.argv=[__file__,str(source),str(output)]
ctx=runpy.run_path(str(Path(__file__).with_name('build-native-muscle.py')),run_name='__main__')
h=ctx['h'].human
ctx['assets'].equip_eyes(h,str(source/'data/eyes/low-poly/low-poly.mhclo'))
mesh=h.eyesProxy.object.getSeedMesh()
mesh.calcNormals()
p=mesh.coord.astype(float)*.1
p[:,1]-=np.load(correspondence)['posed'][:,1].astype(float).min()*.1
np.savez_compressed(output/'eyes.npz',positions=p,normals=mesh.vnorm,quads=mesh.fvert,uv=mesh.texco,faceUv=mesh.fuvs)
print('EYES',len(p),len(mesh.fvert))
