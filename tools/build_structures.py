"""Build verified structure SVGs. Requires RDKit; no runtime dependency for the website."""
from pathlib import Path
import json, math, sys
from rdkit import Chem
from rdkit.Chem import AllChem, rdMolDescriptors
from rdkit.Chem.Draw import rdMolDraw2D
import numpy as np

root=Path(__file__).resolve().parent.parent
data=root/'structures'
dest=root/'structures'
dest.mkdir(exist_ok=True)
res=Chem.MolFromMolFile(str(data/'resorcinol-pubchem.sdf'),removeHs=True)
tetra=Chem.MolFromMolFile(str(data/'cellotetraose-pubchem.sdf'),removeHs=True)
assert rdMolDescriptors.CalcMolFormula(res)=='C6H6O2'
assert rdMolDescriptors.CalcMolFormula(tetra)=='C24H42O21'
rings=[set(r) for r in tetra.GetRingInfo().AtomRings() if len(r)==6]
assert len(rings)==3 # PubChem 170125 has an open-chain reducing end.
ring_atoms=set.union(*rings)
# Retain the three cyclic glucosyl residues and their substituents, removing
# the open-chain reducing residue at its glycosidic oxygen. Both cuts become
# O--* continuation points. No new glucose stereocentres are invented.
keep=set(ring_atoms)
for i in ring_atoms:
 for a in tetra.GetAtomWithIdx(i).GetNeighbors():
  j=a.GetIdx()
  if j in ring_atoms:continue
  keep.add(j)
  if a.GetAtomicNum()==6:
   for b in a.GetNeighbors():
    if b.GetAtomicNum()==8:keep.add(b.GetIdx())
boundary=[]
for i in keep:
 for a in tetra.GetAtomWithIdx(i).GetNeighbors():
  if a.GetIdx() not in keep:boundary.append(i)
assert len(boundary)==1 and tetra.GetAtomWithIdx(boundary[0]).GetAtomicNum()==8
rw=Chem.RWMol(tetra)
removed=sorted(set(range(tetra.GetNumAtoms()))-keep,reverse=True)
for i in removed:rw.RemoveAtom(i)
mapping={old:i for i,old in enumerate(sorted(keep))}
cutO=mapping[boundary[0]]
frag=rw.GetMol();Chem.SanitizeMol(frag)
frings=[set(r) for r in frag.GetRingInfo().AtomRings()]
numbering=[]
for ring in frings:
 ringO=next(i for i in ring if frag.GetAtomWithIdx(i).GetAtomicNum()==8)
 O_neighbors=[n.GetIdx() for n in frag.GetAtomWithIdx(ringO).GetNeighbors() if n.GetIdx() in ring]
 # C5 carries the exocyclic CH2OH group; the other neighbour is C1.
 def exoC(i):return [n.GetIdx() for n in frag.GetAtomWithIdx(i).GetNeighbors() if n.GetIdx() not in ring and n.GetAtomicNum()==6]
 C5=next(i for i in O_neighbors if exoC(i));C1=next(i for i in O_neighbors if i!=C5)
 C2=next(n.GetIdx() for n in frag.GetAtomWithIdx(C1).GetNeighbors() if n.GetIdx() in ring and n.GetIdx()!=ringO)
 C3=next(n.GetIdx() for n in frag.GetAtomWithIdx(C2).GetNeighbors() if n.GetIdx() in ring and n.GetIdx()!=C1)
 C4=next(n.GetIdx() for n in frag.GetAtomWithIdx(C3).GetNeighbors() if n.GetIdx() in ring and n.GetIdx()!=C2)
 assert frag.GetBondBetweenAtoms(C4,C5)
 C6=exoC(C5)[0];O6=next(n.GetIdx() for n in frag.GetAtomWithIdx(C6).GetNeighbors() if n.GetAtomicNum()==8)
 O4=next(n.GetIdx() for n in frag.GetAtomWithIdx(C4).GetNeighbors() if n.GetIdx() not in ring and n.GetAtomicNum()==8)
 numbering.append(dict(C1=C1,C2=C2,C3=C3,C4=C4,C5=C5,C6=C6,O6=O6,O4=O4))
terminalO4=[d['O4'] for d in numbering if frag.GetAtomWithIdx(d['O4']).GetDegree()==1]
assert len(terminalO4)==1
rw=Chem.RWMol(frag)
for o in [cutO,terminalO4[0]]:
 dummy=rw.AddAtom(Chem.Atom(0));rw.AddBond(o,dummy,Chem.BondType.SINGLE)
frag=rw.GetMol();Chem.SanitizeMol(frag);Chem.AssignStereochemistry(frag,cleanIt=True,force=True)
assert len(Chem.FindMolChiralCenters(frag,includeUnassigned=True))==15
assert all(c!='?' for _,c in Chem.FindMolChiralCenters(frag,includeUnassigned=True))
links=[]
for d in numbering:
 for n in frag.GetAtomWithIdx(d['C1']).GetNeighbors():
  if n.GetAtomicNum()!=8 or n.GetIdx() in ring_atoms:continue
  for other in numbering:
   if other is not d and frag.GetBondBetweenAtoms(n.GetIdx(),other['C4']):links.append([d['C1'],n.GetIdx(),other['C4']])
# Count links by connectivity, independent of atom numbering after trimming.
links=[]
for a in frag.GetAtoms():
 if a.GetAtomicNum()!=8 or a.IsInRing() or a.GetDegree()!=2:continue
 ns=[n.GetIdx() for n in a.GetNeighbors()]
 for d in numbering:
  for e in numbering:
   if d is not e and d['C1'] in ns and e['C4'] in ns:links.append([d['C1'],a.GetIdx(),e['C4']])
assert len(links)==2

def orient(mol,kind):
 AllChem.Compute2DCoords(mol)
 conf=mol.GetConformer();xy=np.array([[conf.GetAtomPosition(i).x,conf.GetAtomPosition(i).y] for i in range(mol.GetNumAtoms())]);xy-=xy.mean(0)
 if kind=='fiber':
  _,_,v=np.linalg.svd(xy,full_matrices=False);axis=v[0]
  if axis[0]<0:axis=-axis
  ang=-math.atan2(axis[1],axis[0])
 else:
  oxy=[a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum()==8]
  carb=[a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum()==6]
  direction=xy[oxy].mean(0)-xy[carb].mean(0)
  ang=-math.pi/2-math.atan2(direction[1],direction[0])
 rot=np.array([[math.cos(ang),-math.sin(ang)],[math.sin(ang),math.cos(ang)]])
 xy=xy@rot.T
 for i,p in enumerate(xy):conf.SetAtomPosition(i,(float(p[0]),float(p[1]),0))

def render(mol,name,w,h):
 drawer=rdMolDraw2D.MolDraw2DSVG(w,h)
 opts=drawer.drawOptions();opts.clearBackground=False;opts.padding=.06;opts.bondLineWidth=2.1
 opts.minFontSize=16;opts.maxFontSize=22
 for atom in mol.GetAtoms():
  if atom.GetAtomicNum()==0:opts.atomLabels[atom.GetIdx()]='*'
 opts.updateAtomPalette({6:(.16,.23,.20),8:(.72,.24,.20),0:(.46,.55,.40)})
 rdMolDraw2D.PrepareAndDrawMolecule(drawer,mol)
 positions=[{'x':round(drawer.GetDrawCoords(i).x,3),'y':round(drawer.GetDrawCoords(i).y,3),'element':a.GetSymbol(),'index':i} for i,a in enumerate(mol.GetAtoms())]
 drawer.FinishDrawing();svg=drawer.GetDrawingText()
 (dest/(name+'.svg')).write_text(svg,encoding='utf-8')
 return positions
orient(frag,'fiber');orient(res,'dye')
fpos=render(frag,'cellulose-fragment',1100,280)
rpos=render(res,'resorcinol',380,300)
hydroxyls=[dict(fpos[a.GetIdx()]) for a in frag.GetAtoms() if a.GetAtomicNum()==8 and a.GetDegree()==1]
upper=sorted(hydroxyls,key=lambda d:d['y'])
donors=[upper[0],next(d for d in upper[1:] if abs(d['x']-upper[0]['x'])>90)]
donors.sort(key=lambda d:d['x'])
resO=[a.GetIdx() for a in res.GetAtoms() if a.GetAtomicNum()==8]
resC=[a.GetNeighbors()[0].GetIdx() for a in res.GetAtoms() if a.GetAtomicNum()==8]
assert Chem.GetShortestPath(res,resC[0],resC[1]).__len__()==3
manifest={
 'fiber':{'width':1100,'height':280,'donors':donors,'glycosidicO':[fpos[l[1]] for l in links],
          'smiles':Chem.MolToSmiles(frag),'glucoseUnits':3,'definedStereocenters':15,
          'note':'Three cyclic glucosyl residues retained from PubChem CID 170125. Two * atoms mark continuation; not a free cellotriose molecule.'},
 'dye':{'width':380,'height':300,'donors':[rpos[i] for i in resO],'formula':'C6H6O2','smiles':Chem.MolToSmiles(res)},
 'sources':[{'cid':170125,'url':'https://pubchem.ncbi.nlm.nih.gov/compound/170125'}, {'cid':5054,'url':'https://pubchem.ncbi.nlm.nih.gov/compound/5054'}],
 'checks':{'sanitized':True,'fiberRings':3,'fiberStereocenters':15,'internalBeta14Links':2,'resorcinolOxygenSubstitution':'1,3','noComplexGeometryClaim':True}
}
(dest/'structure-data.js').write_text('window.FIBER_STRUCTURES = '+json.dumps(manifest,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
(dest/'verification.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
Chem.MolToMolFile(frag,str(dest/'cellulose-fragment.mol'))
for name in ['resorcinol','cellotetraose']:(dest/(name+'-pubchem.sdf')).write_bytes((data/(name+'-pubchem.sdf')).read_bytes())
print(json.dumps(manifest,ensure_ascii=False,indent=2))
