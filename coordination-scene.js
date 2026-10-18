'use strict';
// Rigid-body teaching layout. No molecular orbitals or optimized metal complex
// geometry are calculated here. Coordinates inside each MOL2 molecule are fixed.
(() => {
 const models=window.FIBER_MODELS_3D;
 if(!models)return;
 const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const mul=(a,n)=>a.map(v=>v*n),norm=a=>mul(a,1/(Math.hypot(...a)||1));
 const smooth=(a,b,p)=>{const t=Math.max(0,Math.min(1,(p-a)/(b-a)));return t*t*(3-2*t);};
 const mean=a=>mul(a.reduce(add),1/a.length),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 // Orthogonal, right-handed placement: donor O atoms face the metal, while
 // the actual molecular framework extends outwards. No atoms are distorted.
 function outward(model,side,gap,twist){
  const source=model.atoms.map(a=>a.view),mid=mean(model.sites.map(i=>source[i]));
  const y=norm(sub(source[model.sites[1]],source[model.sites[0]]));
  const towardBody=sub(mean(source.filter((_,i)=>model.atoms[i].element!=='H')),mid);
  const x=norm(sub(towardBody,mul(y,dot(towardBody,y)))),z=cross(x,y);
  return source.map(p=>{const q=sub(p,mid),u=side*dot(q,x),v=dot(q,y),w=side*dot(q,z);
   return[side*gap+u*Math.cos(twist)+w*Math.sin(twist),v,-u*Math.sin(twist)+w*Math.cos(twist)];});
 }
 const fiberFinal=outward(models.fiber,-1,2.35,.12),dyeFinal=outward(models.dye,1,2.35,-.10);
 const fiberInitialShift=[-3.2,0,0],dyeInitialShift=[3.2,0,0];
 const fiberFinalSites=models.fiber.sites.map(i=>fiberFinal[i]);
 const dyeFinalSites=models.dye.sites.map(i=>dyeFinal[i]);
 function at(p){const f=smooth(.08,.5,p),d=smooth(.54,.96,p);
  const fiberPoints=fiberFinal.map(a=>add(a,mul(fiberInitialShift,1-f)));
  const dyePoints=dyeFinal.map(a=>add(a,mul(dyeInitialShift,1-d)));
  const metal=[0,0,0],fiberSites=models.fiber.sites.map(i=>fiberPoints[i]),dyeSites=models.dye.sites.map(i=>dyePoints[i]);
  const fiberBinding=smooth(.23,.5,p),dyeBinding=smooth(.73,1,p);
  const electronPairs=[...fiberSites,...dyeSites].map((o,i)=>{const binding=i<2?fiberBinding:dyeBinding,shared=smooth(.22,.90,binding);
   const fraction=(1-shared)*(.55/Math.hypot(...sub(metal,o)))+shared*.5;
   return{donor:o,metal,binding,shared,center:add(o,mul(sub(metal,o),fraction)),count:2};});
  return{metal,fiberPoints,dyePoints,fiberSites,dyeSites,fiberMove:f,dyeMove:d,fiberBinding,dyeBinding,electronPairs};
 }
 function path(model){const start=model.sites[0],end=model.sites[1],adj=Array.from({length:model.atoms.length},()=>[]);
  model.bonds.forEach(b=>{adj[b.a].push(b.b);adj[b.b].push(b.a);});const queue=[start],prev=new Map([[start,null]]);
  while(queue.length){const i=queue.shift();if(i===end)break;for(const j of adj[i])if(!prev.has(j)){prev.set(j,i);queue.push(j);}}
  const result=[];for(let i=end;i!==null;i=prev.get(i)){if(i===undefined)throw Error('Disconnected teaching sites');result.unshift(i);}return result;
 }
 const p0=at(0),p1=at(1);
 // A fixed start/end envelope keeps the metal fixed in screen position AND size
 // throughout playback. It changes only when the user rotates, zooms or resizes.
 const envelope=[...p0.fiberPoints,...p1.fiberPoints,...p0.dyePoints,...p1.dyePoints,[0,0,0]];
 window.COORDINATION_SCENE={at,envelope,orbitalDirections:[...fiberFinalSites,...dyeFinalSites].map(norm),ringPaths:{fiber:path(models.fiber),dye:path(models.dye)}};
})();
