'use strict';
(() => {
 const $=id=>document.getElementById(id),data=window.FIBER_STRUCTURES,svg=$('fiberScene'),NS='http://www.w3.org/2000/svg';
 if(!data){$('announcement').textContent='结构数据未载入，请保持 structures 文件夹与网页放在一起。';return;}
 const state={p:0,playing:false,speed:1,zoom:1,panX:0,panY:0,sites:true,electrons:false,labels:true,glyco:false};
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),mix=(a,b,t)=>a+(b-a)*t;
 const ease=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
 const node=(name,attrs,parent)=>{const n=document.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent.appendChild(n);return n;};
 const fiberY=450,donors=data.fiber.donors.map(d=>({x:d.x,y:d.y+fiberY}));
 const target={x:(donors[0].x+donors[1].x)/2,y:352};
 const metalPaths=donors.map(()=>node('path',{class:'interaction-line'},$('metalLinks')));
 const dyePaths=data.dye.donors.map(()=>node('path',{class:'interaction-line dye-link'},$('dyeLinks')));
 donors.forEach(d=>node('circle',{cx:d.x,cy:d.y,r:20,class:'site-circle'},$('fiberHighlights')));
 const dyeCircles=data.dye.donors.map(()=>node('circle',{r:21,class:'site-circle dye-site'},$('dyeHighlights')));
 const glycoGroup=$('glycosidicMarkers');
 for(const d of data.fiber.glycosidicO){node('circle',{cx:d.x,cy:d.y+fiberY,r:27,class:'glyco-marker'},glycoGroup);const text=node('text',{x:d.x,y:d.y+fiberY+48,'text-anchor':'middle',class:'svg-small'},glycoGroup);text.textContent='β(1→4)';}
 const pairs=Array.from({length:4},()=>[node('circle',{r:4.6,class:'electron-dot'},$('electronMarkers')),node('circle',{r:4.6,class:'electron-dot'},$('electronMarkers'))]);
 const stages=[{badge:'认识纤维素',title:'麻纤维：关注羟基氧',timeline:'先认识纤维素链上的羟基',note:'麻纤维的主要成分是纤维素。本图用一段不断延伸的纤维素链表示，重点观察链上的羟基氧。'},{badge:'引入金属',title:'羟基氧与金属离子的作用',timeline:'金属离子靠近，观察纤维上的氧位点',note:'氧原子上的孤电子对可参与配位。图中虚线连接示例氧位点与金属，用来说明相互作用关系，未指定实际配位数。'},{badge:'引入染料',title:'纤维—金属—染料作用关系',timeline:'观察染料含氧片段与金属的关系',note:'染料中的含氧基团也可能参与金属配位。上方保留间苯二酚的 1,3 位结构；两条虚线不代表两个氧必然同时与同一金属成键。'}];
 let raf=0,last=0,lastStage=-1;
 function draw(){
  const m=ease(.08,.5,state.p),d=ease(.54,.96,state.p),stage=state.p<.25?0:state.p<.63?1:2;
  const metal={x:mix(925,target.x,m),y:mix(370,target.y,m)};
  const dye={x:mix(880,target.x,d),y:mix(180,205,d)};
  $('world').setAttribute('transform',`translate(${550+state.panX} ${390+state.panY}) scale(${state.zoom}) translate(-550 -390)`);
  $('metalGroup').setAttribute('transform',`translate(${metal.x} ${metal.y})`);
  $('metalGroup').style.opacity=String(mix(.32,1,m));
  $('dyeGroup').setAttribute('transform',`translate(${dye.x} ${dye.y})`);
  $('dyeGroup').style.opacity=String(mix(.18,1,d));
  const dyePoints=data.dye.donors.map(o=>({x:dye.x+o.x-190,y:dye.y+o.y-150}));
  metalPaths.forEach((line,i)=>{const from=donors[i],t=ease(.23,.5,state.p),x=mix(from.x,metal.x,t),y=mix(from.y,metal.y,t);line.setAttribute('d',`M${from.x} ${from.y}L${x} ${y}`);line.style.opacity=String(t);});
  dyePaths.forEach((line,i)=>{const from=dyePoints[i],t=ease(.73,1,state.p);line.setAttribute('d',`M${from.x} ${from.y}L${mix(from.x,metal.x,t)} ${mix(from.y,metal.y,t)}`);line.style.opacity=String(t);});
  dyeCircles.forEach((c,i)=>{c.setAttribute('cx',dyePoints[i].x);c.setAttribute('cy',dyePoints[i].y);});
  $('fiberHighlights').style.display=state.sites?'':'none';$('dyeHighlights').style.display=state.sites?'':'none';$('dyeHighlights').style.opacity=String(d);
  $('glycosidicMarkers').style.display=state.glyco?'':'none';
  document.querySelectorAll('.annotation').forEach(n=>{n.style.visibility=state.labels?'visible':'hidden';});
  $('linkCaption').style.opacity=String(m);
  $('electronMarkers').style.display=state.electrons?'':'none';
  [...donors,...dyePoints].forEach((o,i)=>{const destination=metal;const dx=destination.x-o.x,dy=destination.y-o.y,len=Math.hypot(dx,dy)||1;const ux=dx/len,uy=dy/len;for(let j=0;j<2;j++){const side=j?5:-5;pairs[i][j].setAttribute('cx',o.x+ux*24-uy*side);pairs[i][j].setAttribute('cy',o.y+uy*24+ux*side);pairs[i][j].style.opacity=i<2?'1':String(d);}});
  $('progress').value=String(Math.round(state.p*1000));$('progress').style.setProperty('--progress',`${state.p*100}%`);$('progressText').textContent=`${Math.round(state.p*100)}%`;
  const s=stages[stage];$('stageBadge').textContent=s.badge;$('stageTitle').textContent=s.title;$('timelineLabel').textContent=s.timeline;$('observation').textContent=s.note;
  document.querySelectorAll('.step').forEach((b,i)=>{b.classList.toggle('active',i===stage);b.setAttribute('aria-pressed',String(i===stage));});document.querySelectorAll('[data-sequence]').forEach((n,i)=>n.classList.toggle('current',i<=stage));
  $('playIcon').textContent=state.playing?'Ⅱ':state.p>=1?'↻':'▶';$('playText').textContent=state.playing?'暂停过程':state.p>=1?'重新播放':'播放过程';$('playButton').setAttribute('aria-label',state.playing?'暂停三步演示':state.p>=1?'重新播放三步演示':'播放三步演示');$('playButton').setAttribute('aria-pressed',String(state.playing));
  if(lastStage!==stage){$('announcement').textContent=s.title;lastStage=stage;}
 }
 function request(){if(!raf)raf=requestAnimationFrame(tick);}
 function tick(t){raf=0;const dt=last?Math.min((t-last)/1000,.06):0;last=t;if(state.playing){state.p=clamp(state.p+dt*state.speed/16,0,1);if(state.p>=1)state.playing=false;}draw();if(state.playing)request();else last=0;}
 function progress(p){state.p=clamp(p,0,1);state.playing=false;request();}
 $('playButton').addEventListener('click',()=>{if(state.p>=1)state.p=0;state.playing=!state.playing;request();});$('restartButton').addEventListener('click',()=>progress(0));$('progress').addEventListener('input',e=>progress(Number(e.target.value)/1000));$('speed').addEventListener('change',e=>state.speed=Number(e.target.value));document.querySelectorAll('.step').forEach(b=>b.addEventListener('click',()=>progress(Number(b.dataset.progress))));
 for(const [id,key]of[['showSites','sites'],['showElectrons','electrons'],['showLabels','labels'],['showGlycosidic','glyco']])$(id).addEventListener('change',e=>{state[key]=e.target.checked;request();});
 const zoom=f=>{state.zoom=clamp(state.zoom*f,.7,2.4);request();};
 $('zoomIn').addEventListener('click',()=>zoom(1.18));$('zoomOut').addEventListener('click',()=>zoom(1/1.18));$('resetView').addEventListener('click',()=>{state.zoom=1;state.panX=state.panY=0;request();});
 svg.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.001));},{passive:false});
 const pointers=new Map();let pinch=0;
 svg.addEventListener('pointerdown',e=>{svg.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const[a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}});
 svg.addEventListener('pointermove',e=>{const prev=pointers.get(e.pointerId);if(!prev)return;const cur={x:e.clientX,y:e.clientY};pointers.set(e.pointerId,cur);if(pointers.size===2){const[a,b]=[...pointers.values()],dist=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)zoom(dist/pinch);pinch=dist;}else{const rect=svg.getBoundingClientRect();const ratio=Math.max(1100/rect.width,780/rect.height);state.panX=clamp(state.panX+(cur.x-prev.x)*ratio,-800,800);state.panY=clamp(state.panY+(cur.y-prev.y)*ratio,-500,500);request();}});
 const release=e=>{pointers.delete(e.pointerId);pinch=0;};svg.addEventListener('pointerup',release);svg.addEventListener('pointercancel',release);svg.addEventListener('lostpointercapture',release);
 svg.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','+','=','-','0',' '].includes(e.key))e.preventDefault();if(e.key==='ArrowUp')state.panY-=25;if(e.key==='ArrowDown')state.panY+=25;if(e.key==='ArrowLeft')state.panX-=25;if(e.key==='ArrowRight')state.panX+=25;if(e.key==='+'||e.key==='=')zoom(1.18);if(e.key==='-')zoom(1/1.18);if(e.key==='0')$('resetView').click();if(e.key===' ')$('playButton').click();request();});
 $('aboutButton').addEventListener('click',()=>{$('modelDetails').open=!$('modelDetails').open;if($('modelDetails').open)$('modelDetails').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'center'});});
 $('fullscreenButton').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.querySelector('.fiber-experiment').requestFullscreen)await document.querySelector('.fiber-experiment').requestFullscreen();else throw Error('unavailable');}catch{$('announcement').textContent='浏览器未允许全屏，可继续使用放大和阶段按钮。';}});
 document.addEventListener('fullscreenchange',()=>{$('fullscreenButton').setAttribute('aria-label',document.fullscreenElement?'退出演示全屏':'切换演示全屏');});document.addEventListener('visibilitychange',()=>{last=0;if(!document.hidden)request();});request();
})();
