'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('moleculeCanvas'), ctx = canvas.getContext('2d');
  if (!ctx) { $('announcement').textContent = '当前浏览器不支持画布，请使用支持 Canvas 的浏览器。'; return; }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = { progress: 0, playing: false, speed: 1, yaw: 0.57, pitch: 0.57, zoom: 1, electrons: true, orbitals: true, labels: true, rotate: false, background: '#f6f7f2' };
  let width = 0, height = 0, dpr = 1, lastTime = 0, frame = 0, lastStage = -1, dirty = true;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
  const add = (a,b) => a.map((n,i)=>n+b[i]);
  const mul = (a,n) => a.map(v=>v*n);
  const dot = (a,b) => a.reduce((s,n,i)=>s+n*b[i],0);
  const norm = a => mul(a,1/(Math.hypot(...a)||1));
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dirs = [[1,0,0],[0,0,1],[-1,0,0],[0,0,-1]];
  const colors = {cu:['#ffe1a0','#d98b42','#945229'],o:['#ffd1bc','#d96c5d','#994039'],h:['#f7ffff','#bacbd0','#778f96'],electron:['#fff6bf','#efbf4f','#cc9026']};
  let scale = 60;
  function transform(p){const c=Math.cos(state.yaw),s=Math.sin(state.yaw),a=p[0]*c+p[2]*s,z=-p[0]*s+p[2]*c;return [a,p[1]*Math.cos(state.pitch)-z*Math.sin(state.pitch),p[1]*Math.sin(state.pitch)+z*Math.cos(state.pitch)];}
  function project(p){const a=transform(p),k=13/(13-a[2]);return {x:width/2+a[0]*scale*k,y:height*.48-a[1]*scale*k,z:a[2],k};}
  function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);dirty=true;requestFrame();}
  function sphere(p,r,color,alpha=1){const a=project(p);return {z:a.z,draw(){ctx.save();ctx.globalAlpha=alpha;const rr=r*scale*a.k;const g=ctx.createRadialGradient(a.x-rr*.34,a.y-rr*.4,rr*.02,a.x+rr*.14,a.y+rr*.19,rr*1.04);g.addColorStop(0,color[0]);g.addColorStop(.23,color[1]);g.addColorStop(1,color[2]);ctx.fillStyle=g;ctx.beginPath();ctx.arc(a.x,a.y,rr,0,Math.PI*2);ctx.fill();const shine=ctx.createRadialGradient(a.x-rr*.3,a.y-rr*.4,0,a.x-rr*.3,a.y-rr*.4,rr*.32);shine.addColorStop(0,'#ffffffb3');shine.addColorStop(1,'#ffffff00');ctx.fillStyle=shine;ctx.beginPath();ctx.arc(a.x-rr*.3,a.y-rr*.4,rr*.34,0,Math.PI*2);ctx.fill();ctx.restore();}};}
  function bond(a,b,r,color,alpha=1,dashed=false){const u=project(a),v=project(b);return {z:(u.z+v.z)/2,draw(){ctx.save();ctx.globalAlpha=alpha;const dx=v.x-u.x,dy=v.y-u.y,len=Math.hypot(dx,dy)||1,w=r*scale*(u.k+v.k)/2;const g=ctx.createLinearGradient(u.x-dy/len*w/2,u.y+dx/len*w/2,u.x+dy/len*w/2,u.y-dx/len*w/2);g.addColorStop(0,color[1]);g.addColorStop(.4,color[0]);g.addColorStop(1,color[2]);ctx.strokeStyle=g;ctx.lineWidth=w;ctx.lineCap='round';if(dashed)ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(u.x,u.y);ctx.lineTo(v.x,v.y);ctx.stroke();ctx.restore();}};}
  function lobe(center,axis,length,radius,tint,alpha){
    const n=norm(axis),u=norm(cross(n,Math.abs(n[1])>.8?[1,0,0]:[0,1,0])),v=cross(n,u),points=[];
    // Orthographic silhouette of the ellipsoid; its covariance follows the 3D view.
    const c=project(center),end=project(add(center,mul(n,length))),dx=end.x-c.x,dy=end.y-c.y;
    const major=Math.hypot(dx,dy),minor=radius*scale*c.k;
    const ax=Math.sqrt(major*major+minor*minor*.2),ay=minor;
    for(let i=0;i<=44;i++){const t=i/44*Math.PI*2;points.push([Math.cos(t)*ax,Math.sin(t)*ay]);}
    return {z:c.z-.06,draw(){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(Math.atan2(dy,dx));ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(-ax*.25,-ay*.35,0,0,0,Math.max(ax,ay));if(tint==='green'){g.addColorStop(0,'#d5efbb');g.addColorStop(.5,'#a4cc94');g.addColorStop(1,'#66a67a');ctx.strokeStyle='#79ad7660';}else{g.addColorStop(0,'#ffffff');g.addColorStop(.55,'#f6fcfc');g.addColorStop(1,'#aec3c8');ctx.strokeStyle='#b5c9cb80';}ctx.fillStyle=g;ctx.lineWidth=1;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}};
  }
  function tag(text,p,tint='#647760',offset=[0,0]){const c=project(p);ctx.save();ctx.font='500 11px "Segoe UI","Microsoft YaHei",sans-serif';const tw=ctx.measureText(text).width;const x=c.x+offset[0],y=c.y+offset[1];ctx.fillStyle='rgba(250,252,247,.88)';ctx.beginPath();ctx.roundRect(x-tw/2-8,y-11,tw+16,23,5);ctx.fill();ctx.fillStyle=tint;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y+1);ctx.restore();}
  function draw(){
    if(!width||!height)return;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle=state.background;ctx.fillRect(0,0,width,height);
    const p=state.progress,approach=smooth(.08,.79,p),r=mix(3.75,1.86,approach),forming=smooth(.52,.96,p);
    scale=Math.min(width/10.3,height/7.4)*state.zoom*(1+.48*approach);
    // A quiet spatial reference stays below the molecule and rotates with it.
    ctx.save();ctx.strokeStyle='#87987612';ctx.lineWidth=1;
    for(let i=-7;i<=7;i++){const a=project([i,-1.6,-7]),b=project([i,-1.6,7]),c=project([-7,-1.6,i]),d=project([7,-1.6,i]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.moveTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.stroke();}ctx.restore();
    const halo=ctx.createRadialGradient(width/2,height*.51,0,width/2,height*.51,Math.min(width,height)*.48);halo.addColorStop(0,'#d8e4c224');halo.addColorStop(1,'#d8e4c200');ctx.fillStyle=halo;ctx.fillRect(0,0,width,height);
    const items=[];const waters=[];
    // Dashed guides show the four in-plane coordination directions.
    if(state.orbitals){for(const d of dirs){const q=project(mul(d,3.1)),c=project(mul(d,.4));ctx.save();ctx.strokeStyle='#87a87638';ctx.lineWidth=1;ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.restore();items.push(lobe(mul(d,.76),d,.74,.32,'green',mix(.48,.16,forming)));}}
    for(let i=0;i<4;i++){
      const d=dirs[i],t=[-d[2],0,d[0]],O=mul(d,r);
      // A fixed water geometry moves as a rigid ligand; O always faces Cu.
      const H1=add(O,add(mul(d,.27),add([0,-.36,0],mul(t,.57))));
      const H2=add(O,add(mul(d,.27),add([0,-.36,0],mul(t,-.57))));
      items.push(bond(O,H1,.095,colors.h),bond(O,H2,.095,colors.h));
      items.push(sphere(H1,.175,colors.h),sphere(H2,.175,colors.h),sphere(O,.30,colors.o));
      if(forming>0){const target=mul(O,.2+forming*.8);items.push(bond([0,0,0],target,.115,['#e2d5b7','#c5b99b','#a29982'],forming));}
      const donorCenter=add(O,mul(d,-.43));
      const outerDir=norm(add(mul(d,.4),[0,.91,0]));
      const outerCenter=add(O,mul(outerDir,.43));
      if(state.electrons){
        const donation=add(O,mul(d,-mix(.58,.83,forming)));
        if(forming<1)items.push(lobe(donorCenter,d,.47,.23,'white',mix(.65,.14,forming)));
        // One pair becomes the bonding pair; the other remains on oxygen.
        const side=mul(t,.064);
        items.push(sphere(add(donation,side),.061,colors.electron),sphere(add(donation,mul(side,-1)),.061,colors.electron));
        items.push(lobe(outerCenter,outerDir,.46,.24,'white',.61));
        const outPos=add(O,mul(outerDir,.59)),sep=mul(t,.069);
        items.push(sphere(add(outPos,sep),.061,colors.electron),sphere(add(outPos,mul(sep,-1)),.061,colors.electron));
      }
      waters.push({O,H1,H2,d});
    }
    items.push(sphere([0,0,0],.43,colors.cu));
    // Painter order preserves which atoms and bonds are behind the centre.
    items.sort((a,b)=>a.z-b.z);items.forEach(o=>o.draw());
    if(state.labels){tag('Cu²⁺',[0,.67,0],'#a36535');const closest=waters.map(w=>({...w,pr:project(w.O)})).sort((a,b)=>b.pr.x-a.pr.x)[0];tag('H₂O',add(closest.O,mul(closest.d,.65)),'#86917d',[0,-15]);if(forming>.82){const left=waters.map(w=>({...w,pr:project(w.O)})).sort((a,b)=>a.pr.x-b.pr.x)[0];tag('O → Cu',mul(left.O,.52),'#6c8060',[0,-16]);}}
    // Small orientation triad: world axes make the model's rotation explicit.
    const origin=[width-32,40],axes=[{d:[.22,0,0],c:'#b99375',l:'x'},{d:[0,.22,0],c:'#87a080',l:'y'},{d:[0,0,.22],c:'#8ca4ad',l:'z'}];ctx.save();axes.forEach(a=>{const t=transform(a.d),x=origin[0]+t[0]*65,y=origin[1]-t[1]*65;ctx.strokeStyle=a.c;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(...origin);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle=a.c;ctx.font='8px sans-serif';ctx.fillText(a.l,x+3,y+3);});ctx.restore();
    dirty=false;
  }
  const stages=[{badge:'游离态',title:'水分子与铜离子分离',label:'水分子保持完整，氧原子朝向中心',geometry:'氧原子朝向 Cu²⁺',note:'水分子以氧原子作为配位原子；氧上的一对孤电子可参与配位成键。'},{badge:'定向靠近',title:'氧的孤电子对朝向铜离子',label:'四个水分子沿配位方向靠近',geometry:'观察氧上的黄色电子对',note:'每个水分子都有两对孤电子。面向铜离子的一对电子参与成键；另一对仍留在氧原子上。'},{badge:'配位完成',title:'形成四条 Cu—O 配位键',label:'[Cu(H₂O)₄]²⁺ · 平面正方形教学模型',geometry:'四个 Cu—O 方向共面',note:'四个水配体围绕 Cu²⁺ 排列。形成配位键的两个电子由配体提供，模型体系总电荷保持 2+。'}];
  function update(){const i=state.progress<.25?0:state.progress<.92?1:2,s=stages[i];$('progress').value=Math.round(state.progress*1000);$('progress').style.setProperty('--progress',`${state.progress*100}%`);$('progressText').textContent=`${Math.round(state.progress*100)}%`;$('stageBadge').textContent=s.badge;$('stageTitle').textContent=s.title;$('timelineLabel').textContent=s.label;$('geometryBadge').textContent=s.geometry;$('observation').textContent=s.note;document.querySelectorAll('.step').forEach((b,j)=>{b.classList.toggle('active',i===j);b.setAttribute('aria-pressed',String(i===j));});$('playIcon').textContent=state.playing?'Ⅱ':state.progress>=1?'↻':'▶';$('playText').textContent=state.playing?'暂停过程':state.progress>=1?'重新播放':'播放过程';$('playButton').setAttribute('aria-label',state.playing?'暂停形成过程':state.progress>=1?'重新播放形成过程':'播放形成过程');$('playButton').setAttribute('aria-pressed',String(state.playing));if(i!==lastStage){$('announcement').textContent=s.title;lastStage=i;}dirty=true;requestFrame();}
  function requestFrame(){if(!frame)frame=requestAnimationFrame(tick);}
  function tick(time){frame=0;const dt=lastTime?Math.min((time-lastTime)/1000,.06):0;lastTime=time;if(state.playing){state.progress=clamp(state.progress+dt*state.speed/14,0,1);if(state.progress>=1)state.playing=false;update();}if(state.rotate){state.yaw+=dt*.14;dirty=true;}if(dirty)draw();if(state.playing||state.rotate)requestFrame();else lastTime=0;}
  function setProgress(p){state.playing=false;state.progress=clamp(p,0,1);update();}
  $('playButton').addEventListener('click',()=>{if(state.progress>=1)state.progress=0;state.playing=!state.playing;update();});
  $('restartButton').addEventListener('click',()=>setProgress(0));
  $('progress').addEventListener('input',e=>setProgress(Number(e.target.value)/1000));
  $('speed').addEventListener('change',e=>{state.speed=Number(e.target.value);});
  document.querySelectorAll('.step').forEach(b=>b.addEventListener('click',()=>setProgress(Number(b.dataset.progress))));
  for(const [id,key] of [['showElectrons','electrons'],['showOrbitals','orbitals'],['showLabels','labels'],['autoRotate','rotate']])$(id).addEventListener('change',e=>{state[key]=e.target.checked;dirty=true;requestFrame();});
  $('backgroundColor').addEventListener('input',e=>{state.background=e.target.value;$('sceneWrap').style.background=state.background;dirty=true;requestFrame();});
  function zoom(delta){state.zoom=clamp(state.zoom*delta,.65,1.85);dirty=true;requestFrame();}
  $('zoomIn').addEventListener('click',()=>zoom(1.12));$('zoomOut').addEventListener('click',()=>zoom(1/1.12));
  function resetView(){state.yaw=.57;state.pitch=.57;state.zoom=1;dirty=true;requestFrame();}
  $('resetView').addEventListener('click',resetView);
  $('aboutButton').addEventListener('click',()=>{$('modelDetails').open=!$('modelDetails').open;if($('modelDetails').open)$('modelDetails').scrollIntoView({behavior:reducedMotion?'instant':'smooth',block:'center'});});
  $('fullscreenButton').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.querySelector('.experiment').requestFullscreen)await document.querySelector('.experiment').requestFullscreen();else throw new Error('unavailable');}catch{$('announcement').textContent='浏览器未允许全屏，你仍可旋转和缩放模型。';}});
  document.addEventListener('fullscreenchange',()=>{$('fullscreenButton').setAttribute('aria-label',document.fullscreenElement?'退出演示全屏':'切换演示全屏');resize();});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.001));},{passive:false});
  const pointers=new Map();let pinchDistance=0;
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);}});
  canvas.addEventListener('pointermove',e=>{const prev=pointers.get(e.pointerId);if(!prev)return;const curr={x:e.clientX,y:e.clientY};pointers.set(e.pointerId,curr);if(pointers.size===2){const[a,b]=[...pointers.values()],dist=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance>0)zoom(dist/pinchDistance);pinchDistance=dist;}else{state.yaw+=(curr.x-prev.x)*.008;state.pitch=clamp(state.pitch+(curr.y-prev.y)*.008,-1.45,1.45);dirty=true;requestFrame();}});
  const release=e=>{pointers.delete(e.pointerId);pinchDistance=0;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
  canvas.addEventListener('keydown',e=>{const k=e.key;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0',' '].includes(k))e.preventDefault();if(k==='ArrowLeft')state.yaw-=.12;if(k==='ArrowRight')state.yaw+=.12;if(k==='ArrowUp')state.pitch=clamp(state.pitch+.12,-1.45,1.45);if(k==='ArrowDown')state.pitch=clamp(state.pitch-.12,-1.45,1.45);if(k==='+'||k==='=')zoom(1.1);if(k==='-')zoom(1/1.1);if(k==='0')resetView();if(k===' ')$('playButton').click();dirty=true;requestFrame();});
  // No elapsed-time jump when returning to a hidden browser tab.
  document.addEventListener('visibilitychange',()=>{lastTime=0;if(!document.hidden){dirty=true;requestFrame();}});
  new ResizeObserver(resize).observe($('sceneWrap'));
  update();resize();
})();
