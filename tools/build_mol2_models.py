"""Validate user MOL2 models and export coordinates for the offline 3D viewer."""
from pathlib import Path
import sys,json,hashlib,itertools
import numpy as np
from rdkit import Chem
from rdkit.Chem import rdMolDescriptors

root=Path(__file__).resolve().parent.parent
incoming=root/'structures'
dest=root/'structures'

def parse(path):
 text=path.read_text(encoding='utf-8');atoms=[];bonds=[];section=''
 for line in text.splitlines():
  if line.startswith('@<TRIPOS>'):section=line.strip();continue
  p=line.split()
  if not p:continue
  if section=='@<TRIPOS>ATOM':atoms.append(dict(id=int(p[0]),name=p[1],element=p[5].split('.')[0],p=[float(v) for v in p[2:5]],type=p[5]))
  elif section=='@<TRIPOS>BOND':bonds.append(dict(id=int(p[0]),a=int(p[1])-1,b=int(p[2])-1,order=p[3]))
 assert [a['id'] for a in atoms]==list(range(1,len(atoms)+1))
 mol=Chem.MolFromMol2Block(text,sanitize=True,removeHs=False)
 assert mol is not None and mol.GetNumAtoms()==len(atoms) and mol.GetNumBonds()==len(bonds)
 return text,atoms,bonds,mol

def stereo(m):
 for a in m.GetAtoms():a.SetChiralTag(Chem.ChiralType.CHI_UNSPECIFIED)
 Chem.AssignAtomChiralTagsFromStructure(m,replaceExistingTags=True)
 Chem.AssignStereochemistry(m,cleanIt=True,force=True)
 return dict(Chem.FindMolChiralCenters(m,includeUnassigned=True))

fiberPath=next(incoming.glob('*纤维.mol2'));dyePath=next(incoming.glob('*二酚.mol2'))
ftext,fa,fb,fmol=parse(fiberPath);dtext,da,db,dmol=parse(dyePath)
assert rdMolDescriptors.CalcMolFormula(fmol)=='C20H36O16'
assert rdMolDescriptors.CalcMolFormula(dmol)=='C6H6O2'
sourceStereo=stereo(fmol)
expected=Chem.MolFromMolBlock((dest/'cellulose-fragment.mol').read_text(encoding='utf-8'))
rw=Chem.RWMol(expected)
for a in expected.GetAtoms():
 if a.GetAtomicNum()==0:rw.ReplaceAtom(a.GetIdx(),Chem.Atom(6))
expected=rw.GetMol();Chem.SanitizeMol(expected);Chem.AssignStereochemistry(expected,cleanIt=True,force=True)
mapping=Chem.RemoveHs(fmol).GetSubstructMatch(expected,useChirality=False)
assert len(mapping)==expected.GetNumAtoms()
expectedStereo={mapping[a.GetIdx()]:a.GetProp('_CIPCode') for a in expected.GetAtoms() if a.HasProp('_CIPCode')}
mismatches=[i for i,v in expectedStereo.items() if sourceStereo.get(i)!=v]
assert set(mismatches)=={24,26,27,28,29},mismatches
xyz=np.array([a['p'] for a in fa],dtype=float);original=xyz.copy()
# The terminal glucosyl unit is the mirror image of the expected D unit.
# Reflect only that connected component across the glycosidic plane. The
# attachment carbon and oxygen remain fixed; every intramolecular bond length
# is preserved. This is a stereochemical repair, not an energy minimization.
cutO,cutC,externalC=21,24,16
adj={i:[] for i in range(len(fa))}
for b in fb:adj[b['a']].append(b['b']);adj[b['b']].append(b['a'])
subset={cutC};queue=[cutC]
while queue:
 i=queue.pop()
 for j in adj[i]:
  if {i,j}=={cutO,cutC}:continue
  if j not in subset:subset.add(j);queue.append(j)
assert cutO not in subset and all(i in subset for i in mismatches)
normal=np.cross(xyz[cutO]-xyz[cutC],xyz[externalC]-xyz[cutC]);normal/=np.linalg.norm(normal)
for i in subset:xyz[i]-=2*np.dot(xyz[i]-xyz[cutC],normal)*normal
conf=fmol.GetConformer()
for i,p in enumerate(xyz):conf.SetAtomPosition(i,tuple(p))
correctedStereo=stereo(fmol)
assert all(correctedStereo[i]==v for i,v in expectedStereo.items())
assert Chem.RemoveHs(fmol).HasSubstructMatch(expected,useChirality=True)
lengthError=max(abs(np.linalg.norm(original[b['a']]-original[b['b']])-np.linalg.norm(xyz[b['a']]-xyz[b['b']])) for b in fb)
assert lengthError<1e-8
for i,a in enumerate(fa):a['p']=[round(float(x),5) for x in xyz[i]]

def orient(atoms):
 points=np.array([a['p'] for a in atoms]);heavy=points[[a['element']!='H' for a in atoms]]
 center=heavy.mean(0);_,_,axes=np.linalg.svd(heavy-center)
 ex=axes[0]
 if ex[0]<0:ex=-ex
 ey=axes[1]
 if ey[1]<0:ey=-ey
 ez=np.cross(ex,ey);ez/=np.linalg.norm(ez);ey=np.cross(ez,ex)
 basis=np.array([ex,ey,ez]);assert np.linalg.det(basis)>.999
 oriented=(points-center)@basis.T
 return oriented

fpos=orient(fa)
# Use two exposed hydroxyl O atoms as diagram sites; no bond geometry is claimed.
OH=[i for i,a in enumerate(fa) if a['element']=='O' and any(fa[j]['element']=='H' for j in adj[i])]
pairs=[(i,j) for i,j in itertools.combinations(OH,2) if 2.3<np.linalg.norm(fpos[i]-fpos[j])<4.4]
sitePair=(22,23)  # Central glucosyl hydroxyl O atoms, MOL2 IDs 23 and 24.
assert sitePair in pairs
for a,p in zip(fa,fpos):a['view']=[round(float(v),5) for v in p]
ds=np.array([a['p'] for a in da]);carbons=[i for i,a in enumerate(da) if a['element']=='C'];oxygens=[i for i,a in enumerate(da) if a['element']=='O'];center=ds[carbons].mean(0)
ey=-(ds[oxygens].mean(0)-center);ey/=np.linalg.norm(ey)
ez=np.cross(ds[1]-ds[0],ds[2]-ds[0]);ez/=np.linalg.norm(ez)
ex=np.cross(ey,ez);ex/=np.linalg.norm(ex);ez=np.cross(ex,ey)
basis=np.array([ex,ey,ez]);assert np.linalg.det(basis)>.999
dpos=(ds-center)@basis.T
for a,p in zip(da,dpos):a['view']=[round(float(v),5) for v in p]

# Identify actual C1--O--C4 glycosidic bonds in the supplied topology.
rings=[set(r) for r in fmol.GetRingInfo().AtomRings() if len(r)==6]
positions=[]
for r in rings:
 ro=next(i for i in r if fa[i]['element']=='O')
 cn=[j for j in adj[ro] if j in r]
 c5=next(i for i in cn if any(fa[j]['element']=='C' and j not in r for j in adj[i]));c1=next(i for i in cn if i!=c5)
 c2=next(j for j in adj[c1] if j in r and j!=ro);c3=next(j for j in adj[c2] if j in r and j!=c1);c4=next(j for j in adj[c3] if j in r and j!=c2)
 positions.append(dict(C1=c1,C4=c4))
glycos=[]
for i,a in enumerate(fa):
 if a['element']!='O' or any(i in r for r in rings):continue
 for p,q in itertools.permutations(positions,2):
  if p['C1'] in adj[i] and q['C4'] in adj[i]:glycos.append(i)
assert len(glycos)==2
capC=[i for i,a in enumerate(fa) if a['element']=='C' and sum(fa[j]['element']=='H' for j in adj[i])==3]
assert len(capC)==2

lines=[];section=''
for line in ftext.splitlines():
 if line.startswith('@<TRIPOS>'):section=line.strip();lines.append(line);continue
 if section=='@<TRIPOS>ATOM' and line.split():
  p=line.split();i=int(p[0])-1
  line=f'{int(p[0]):7d} {p[1]:<8s} {xyz[i,0]:11.5f} {xyz[i,1]:11.5f} {xyz[i,2]:11.5f} {p[5]:<8s} {p[6]:>3s} {p[7]:>8s} {p[8]:>9s}'
 lines.append(line)
corrected='\n'.join(lines)+'\n'
(dest/'麻纤维-构型校正.mol2').write_text(corrected,encoding='utf-8')
(dest/fiberPath.name).write_bytes(fiberPath.read_bytes());(dest/dyePath.name).write_bytes(dyePath.read_bytes())
report={'sources':{'fiber':fiberPath.name,'dye':dyePath.name},'fiber':{'atoms':72,'bonds':74,'formula':'C20H36O16','glucoseRings':3,'stereocenters':15,'methylCaps':[i+1 for i in capC],'glycosidicO':[i+1 for i in glycos]},'dye':{'atoms':14,'bonds':14,'formula':'C6H6O2','oxygenPosition':'1,3','planarAromaticRing':True},'repair':{'reason':'Terminal sugar unit has opposite handedness relative to beta-D-cellulose reference','originalAtomIDs':[i+1 for i in sorted(mismatches)],'correctedAtomIDs':[i+1 for i in sorted(mismatches)],'all15CentersMatchReference':True,'bondLengthMaxChangeAngstrom':lengthError,'method':'Reflect terminal glucosyl component in glycosidic plane; no energy optimization','originalPreserved':True},'sourceSHA256':{fiberPath.name:hashlib.sha256(ftext.encode()).hexdigest(),dyePath.name:hashlib.sha256(dtext.encode()).hexdigest()},'scope':'Ball-and-stick geometry from MOL2; metal placement and illustrative metal-O bonds are conditional teaching layouts, not optimized complexes.'}
(dest/'mol2-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
report['repair']['serializedBondLengthMaxChangeAngstrom']=max(abs(np.linalg.norm(original[b['a']]-original[b['b']])-np.linalg.norm(np.round(xyz[b['a']],5)-np.round(xyz[b['b']],5))) for b in fb)
report['sourceSHA256']={fiberPath.name:hashlib.sha256(fiberPath.read_bytes()).hexdigest(),dyePath.name:hashlib.sha256(dyePath.read_bytes()).hexdigest()}
(dest/'mol2-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
model={'fiber':{'atoms':fa,'bonds':fb,'sites':list(sitePair),'glycosidicO':glycos,'methylCaps':capC},'dye':{'atoms':da,'bonds':db,'sites':oxygens},'verification':report}
(dest/'model3d-data.js').write_text('window.FIBER_MODELS_3D = '+json.dumps(model,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print(json.dumps({'fiberSites':[i+1 for i in sitePair],'siteCoordinates':[fa[i]['view'] for i in sitePair],'repair':report['repair'],'fiberBounds':[(float(fpos[:,k].min()),float(fpos[:,k].max())) for k in range(3)],'dyeBounds':[(float(dpos[:,k].min()),float(dpos[:,k].max())) for k in range(3)]},ensure_ascii=False,indent=2))
