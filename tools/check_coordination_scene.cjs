const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const dist=path.join(__dirname,'..'),context={window:{}};
vm.createContext(context);
for(const name of ['structures/model3d-data.js','coordination-scene.js'])vm.runInContext(fs.readFileSync(path.join(dist,name),'utf8'),context);
const {FIBER_MODELS_3D:models,COORDINATION_SCENE:scene}=context.window;
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const volume=p=>dot(sub(p[1],p[0]),cross(sub(p[2],p[0]),sub(p[3],p[0])));
let worst=0;
for(const p of [0,.1,.25,.5,.75,.9,1]){
 const frame=scene.at(p);
 assert.equal(JSON.stringify(frame.metal),'[0,0,0]');
 for(const name of ['fiber','dye']){
  const atoms=models[name].atoms,points=frame[name+'Points'];
  for(let i=0;i<atoms.length;i++)for(let j=0;j<i;j++){
   const error=Math.abs(distance(atoms[i].view,atoms[j].view)-distance(points[i],points[j]));
   worst=Math.max(worst,error);assert.ok(error<1e-10,`${name}: distorted atoms ${i}/${j}`);
  }
  for(let i=0;i<atoms.length;i++){
   const neighbors=models[name].bonds.filter(b=>b.a===i||b.b===i).map(b=>b.a===i?b.b:b.a);
   if(neighbors.length>=3){const indices=[i,...neighbors.slice(0,3)],before=volume(indices.map(j=>atoms[j].view)),after=volume(indices.map(j=>points[j]));assert.ok(Math.abs(before-after)<1e-10,`${name}: handedness changed at ${i}`);}
  }
 }
 assert.equal(frame.electronPairs.length,4);
 for(const pair of frame.electronPairs){assert.equal(pair.count,2);if(p===1){assert.equal(pair.shared,1);assert.ok(Math.abs(distance(pair.center,pair.donor)-distance(pair.center,pair.metal))<1e-10);assert.ok(distance(pair.center,pair.donor)>.55);}if(p===0){assert.ok(Math.abs(distance(pair.center,pair.donor)-.55)<1e-10);assert.equal(pair.shared,0);}}
}
for(const name of ['fiber','dye']){
 const model=models[name],ring=scene.ringPaths[name];
 assert.equal(ring[0],model.sites[0]);assert.equal(ring.at(-1),model.sites[1]);
 for(let i=1;i<ring.length;i++)assert.ok(model.bonds.some(b=>(b.a===ring[i-1]&&b.b===ring[i])||(b.b===ring[i-1]&&b.a===ring[i])));
 const at0=scene.at(0)[name+'Sites'],at1=scene.at(1)[name+'Sites'];
 for(let i=0;i<at0.length;i++)assert.ok(distance(at1[i],[0,0,0])<distance(at0[i],[0,0,0]));
}
const html=fs.readFileSync(path.join(dist,'fiber.html'),'utf8');
assert.ok(html.includes('高中课堂演示'));assert.ok(html.includes('螯合环条件示意'));assert.ok(html.includes('不是实际轨道形状'));
console.log(JSON.stringify({metalFixed:true,frames:7,rigidBodyMaxError:worst,handednessPreserved:true,closedPathsUseCovalentBonds:true,donorsApproachMetal:true,sharedPairs:4,electronsPerPair:2}));
