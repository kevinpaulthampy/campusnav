let L={on:false};
const $=id=>document.getElementById(id);
const rad=Math.PI/180;
const ad=(a,b)=>((a-b)%360+540)%360-180;
const nrm=a=>((a%360)+360)%360;

function compass(alpha,beta,gamma){
 const a=alpha*rad,b=beta*rad,g=gamma*rad;
 const cA=Math.cos(a),sA=Math.sin(a),cB=Math.cos(b),sB=Math.sin(b),cG=Math.cos(g),sG=Math.sin(g);
 const rA=-cA*sG-sA*sB*cG,rB=-sA*sG+cA*sB*cG;
 let h=Math.atan(rA/rB);
 if(rB<0)h+=Math.PI;else if(rA<0)h+=2*Math.PI;
 return nrm(h/rad);
}

function liveBuild(){
 const nd=nodeById(),ids=route.nodes,eds=[...route.edges].reverse(),segs=[];
 let cum=0;
 for(let k=1;k<ids.length;k++){
  const a=nd[ids[k-1]],b=nd[ids[k]],e=G.edges[eds[k-1]],fa=fl(a.floor),fb=fl(b.floor);
  const len=Math.hypot(a.x-b.x,a.y-b.y);
  const kind=a.floor===b.floor?'walk':(fa.block===fb.block?'stairs':'link');
  const steps=kind==='stairs'?0:(e.w??len*(fa.scale||1));
  const ang=kind==='walk'&&steps>0.5&&len>3?nrm(Math.atan2(b.x-a.x,-(b.y-a.y))/rad):null;
  segs.push({a,b,kind,steps,start:cum,ang,to:fb});
  cum+=steps;
 }
 L.segs=segs;L.total=cum;L.corners=[];L.cleared=new Set();
 let pv=null;
 segs.forEach(g=>{
  if(g.kind!=='walk'){pv=null;return}
  if(g.ang===null)return;
  if(pv&&Math.abs(ad(g.ang,pv.ang))>35)L.corners.push({pos:g.start,turn:ad(g.ang,pv.ang),out:g.ang});
  pv=g;
 });
}

const segAt=s=>L.segs.find(g=>g.ang!==null&&s>=g.start-1e-6&&s<=g.start+g.steps+1e-6);
function liveCap(){const g=L.segs.find(g=>g.kind==='stairs'&&!L.cleared.has(g));return g?g.start:L.total}

function livePos(){
 const first=L.segs[0].a;
 if(L.s<1e-6)return{floor:first.floor,x:first.x,y:first.y};
 let node=first;
 for(const g of L.segs){
  if(g.kind==='stairs'){if(L.cleared.has(g)){node=g.b;continue}break}
  if(g.steps<=0){if(L.s>g.start+1e-6||L.s>=L.total-1e-6)node=g.b;continue}
  if(L.s>=g.start+g.steps-1e-6){node=g.b;continue}
  const t=(L.s-g.start)/g.steps;
  if(g.kind==='walk')return{floor:g.a.floor,x:g.a.x+(g.b.x-g.a.x)*t,y:g.a.y+(g.b.y-g.a.y)*t};
  const n=t<.5?g.a:g.b;
  return{floor:n.floor,x:n.x,y:n.y};
 }
 return{floor:node.floor,x:node.x,y:node.y};
}

function liveLog(ev,t){
 if(L.log.length>60000)return;
 L.log.push([Math.round(t-L.t0),...L.raw,L.gy.toFixed(0),...L.ori,L.hs===null?'':L.hs.toFixed(1),(L.lp-L.g).toFixed(2),ev]);
}

async function liveStart(){
 if(!route){msg('Show a route first, then press Live.');return}
 if(!isSecureContext){msg('Live mode needs https (or localhost).');return}
 try{
  for(const E of [window.DeviceMotionEvent,window.DeviceOrientationEvent]){
   if(E&&E.requestPermission){const r=await E.requestPermission();if(r!=='granted'){msg('Motion permission was denied.');return}}
  }
 }catch(e){msg('Could not get sensor permission: '+e.message);return}
 L={on:true,s:0,steps:0,off:0,cal:false,hist:[],hs:null,href:null,hprev:null,turn:false,still:0,cand:[],rhythm:false,lastStep:0,lastPeak:0,
    above:false,lp:9.8,g:9.8,tPrev:0,gy:0,raw:[0,0,0],ori:['','',''],log:[],t0:performance.now(),bad:0,mute:0,lastEv:0,stairMsg:false,th:+$('lth').value};
 liveBuild();
 window.addEventListener('devicemotion',onMotion);
 if('ondeviceorientationabsolute' in window)window.addEventListener('deviceorientationabsolute',onOri);
 else window.addEventListener('deviceorientation',onOri);
 L.timer=setInterval(liveTick,300);
 try{L.wake=await navigator.wakeLock.request('screen')}catch(e){}
 $('live').style.display='block';$('lv').textContent='Stop live';$('lv').classList.add('on');
 const p=livePos();L.pos=p;
 setFloor(p.floor);liveCenter(p,true);render();
 msg('Live mode on. Start at the door of your first room and walk along the corridor. Keep the screen on.');
 setTimeout(()=>{if(L.on&&!L.lastEv)msg('No motion data. In Chrome open Site settings and allow Motion sensors, then reload.');
  else if(L.on&&L.hs===null)msg('No compass data. Steps still work, but turns and wrong-path checks are off.')},3000);
}

function liveStop(){
 if(!L.on)return;
 L.on=false;clearInterval(L.timer);
 window.removeEventListener('devicemotion',onMotion);
 window.removeEventListener('deviceorientationabsolute',onOri);
 window.removeEventListener('deviceorientation',onOri);
 try{L.wake&&L.wake.release()}catch(e){}
 $('live').style.display='none';$('lv').textContent='Live';$('lv').classList.remove('on');
 render();
}

function onMotion(ev){
 const a=ev.accelerationIncludingGravity,r=ev.rotationRate;
 if(!L.on||!a||a.x==null)return;
 const t=performance.now(),dt=L.tPrev?Math.min((t-L.tPrev)/1000,0.2):0.016;
 L.tPrev=t;L.lastEv=t;
 const m=Math.hypot(a.x,a.y,a.z);
 L.lp+=(1-Math.exp(-dt/0.04))*(m-L.lp);
 L.g+=(1-Math.exp(-dt/2))*(m-L.g);
 L.gy=r?Math.hypot(r.alpha||0,r.beta||0,r.gamma||0):0;
 L.raw=[a.x.toFixed(2),a.y.toFixed(2),a.z.toFixed(2)];
 const dev=L.lp-L.g;
 if(!L.lastRow||t-L.lastRow>30){L.lastRow=t;liveLog('',t)}
 if(dev>L.th&&!L.above){
  L.above=true;
  if(t-L.lastPeak>300)candidate(t);
 }
 if(dev<L.th*0.4)L.above=false;
}

function candidate(t){
 L.lastPeak=t;
 if(L.gy>200){liveLog('twist-ignored',t);return}
 if(L.cand.length&&t-L.cand[L.cand.length-1]>1200)L.cand.length=0;
 L.cand.push(t);
 if(L.rhythm){L.lastStep=t;onStep();return}
 if(L.cand.length>=3){L.rhythm=true;L.lastStep=t;for(let i=0;i<L.cand.length;i++)onStep();liveLog('rhythm-start',t)}
}

function onOri(ev){
 if(!L.on)return;
 let h=null;
 if(ev.webkitCompassHeading!=null)h=ev.webkitCompassHeading;
 else if(ev.alpha!=null&&(ev.absolute||ev.type==='deviceorientationabsolute'))h=compass(ev.alpha,ev.beta,ev.gamma);
 if(h===null)return;
 L.ori=[(ev.alpha??0).toFixed(0),(ev.beta??0).toFixed(0),(ev.gamma??0).toFixed(0)];
 L.hs=L.hs===null?h:nrm(L.hs+0.15*ad(h,L.hs));
}

function onStep(){
 const cap=liveCap();
 L.steps++;
 L.s=Math.min(L.s+1,cap);
 if(L.hs!==null){
  const seg=segAt(L.s),near=L.corners.some(c=>Math.abs(c.pos-L.s)<6);
  if(!L.cal){
   L.hist.push(L.hs);if(L.hist.length>5)L.hist.shift();
   if(L.hist.length===5&&seg&&L.hist.every(x=>Math.abs(ad(x,L.hist[4]))<25)){
    L.off=ad(L.hist[4],seg.ang);L.cal=true;liveLog('calibrated',performance.now());
   }
  }else if(seg){
   const d=ad(nrm(L.hs-L.off),seg.ang);
   if(Math.abs(d)<40){L.off+=0.05*d;L.bad=0}
   else if(!near&&!L.turn){L.bad++}
   if(L.bad>=5&&!L.mute){showWhere('You may be off route.')}
  }
  if(L.mute>0)L.mute--;
 }
 if(L.s>=cap&&cap<L.total&&!L.stairMsg){L.stairMsg=true}
 liveUpdate();
}

function snapTurn(d){
 let best=null;
 L.corners.forEach(c=>{
  const dd=Math.abs(c.pos-L.s);
  if(dd<=8&&Math.sign(c.turn)===Math.sign(d)&&Math.abs(c.turn-d)<60&&(!best||dd<best.dd))best={c,dd};
 });
 if(!best){liveLog('turn-no-corner '+d.toFixed(0),performance.now());return}
 L.s=Math.min(L.s+0.7*(best.c.pos-L.s),liveCap());
 L.off+=0.3*ad(nrm(L.hs-L.off),best.c.out);
 L.bad=0;
 liveLog('snap '+best.c.pos.toFixed(1),performance.now());
}

function liveTick(){
 if(!L.on)return;
 const now=performance.now();
 if(L.rhythm&&now-L.lastStep>1500){L.rhythm=false;L.cand.length=0}
 if(L.hs!==null){
  if(L.href===null){L.href=L.hs;L.hprev=L.hs}
  const stable=Math.abs(ad(L.hs,L.hprev))<5;
  L.hprev=L.hs;
  if(!L.turn){
   if(Math.abs(ad(L.hs,L.href))>25){L.turn=true;L.tStart=L.href;L.still=0}else if(stable)L.href=L.hs;
  }else{
   L.still=stable?L.still+1:0;
   if(L.still>=2){
    const d=ad(L.hs,L.tStart);
    L.turn=false;L.href=L.hs;
    if(Math.abs(d)>50&&now-L.lastStep<3000)snapTurn(d);else liveLog('turn-ignored '+d.toFixed(0),now);
    liveUpdate();
   }
  }
 }
 liveHud();
}

function liveCenter(p,zoom){
 const f=fl(p.floor),w=zoom?f.w/3:vb[2],h=w*svg.clientHeight/Math.max(svg.clientWidth,1);
 vb=[p.x-w/2,p.y-h/2,w,h];
}

function liveUpdate(){
 const p=livePos(),prevFloor=L.pos&&L.pos.floor;
 L.pos=p;
 if(p.floor!==cur){setFloor(p.floor);liveCenter(p,true)}
 else if(p.x<vb[0]+vb[2]*0.15||p.x>vb[0]+vb[2]*0.85||p.y<vb[1]+vb[3]*0.15||p.y>vb[1]+vb[3]*0.85)liveCenter(p,false);
 const link=L.segs.find(g=>g.kind==='link'&&L.s>=g.start+g.steps-1e-6&&L.s<=g.start+g.steps+1);
 if(link&&prevFloor&&prevFloor!==p.floor&&fl(prevFloor).block!==fl(p.floor).block){L.cal=false;L.hist=[]}
 render();liveHud();
}

function liveHud(){
 const cap=liveCap(),held=L.s>=cap-1e-6&&cap<L.total;
 let next='';
 const stair=L.segs.find(g=>g.kind==='stairs'&&!L.cleared.has(g));
 const c=L.corners.find(c=>c.pos>L.s+0.5);
 if(L.s>=L.total-0.5)next='You have arrived.';
 else if(held)next='Take the stairs to the '+stair.to.label.toLowerCase()+' (about 26 steps), then tap the button below.';
 else if(c&&(!stair||c.pos<stair.start))next='Turn '+(c.turn>0?'right':'left')+' in about '+Math.max(0,Math.round(c.pos-L.s))+' steps.';
 else if(stair)next='Stairs in about '+Math.max(0,Math.round(stair.start-L.s))+' steps.';
 else next='Destination in about '+Math.round(L.total-L.s)+' steps.';
 const hm=L.hs===null?'no compass':Math.round(L.hs)+'° (map '+(L.cal?Math.round(nrm(L.hs-L.off))+'°':'not set')+')';
 $('lstat').innerHTML='<b>'+next+'</b><br><small>Steps '+L.steps+' · progress '+Math.round(L.s)+'/'+Math.round(L.total)+' · heading '+hm+' · '+(L.rhythm?'walking':'still')+' · signal '+(L.lp-L.g).toFixed(1)+'</small>';
 $('lst').style.display=held?'inline-block':'none';
}

function showWhere(t){
 $('wtxt').textContent=t+' Where are you now?';
 $('where').style.display='block';
 L.mute=999;
}
function hideWhere(){$('where').style.display='none';L.bad=0;L.mute=20}

function liveDraw(R){
 if(!L.on||!L.pos||L.pos.floor!==cur)return;
 let h=`<circle cx="${L.pos.x}" cy="${L.pos.y}" r="${R*1.6}" fill="#2563eb" opacity=".25"/>`;
 if(L.cal&&L.hs!==null){const a=nrm(L.hs-L.off)*rad;h+=`<line x1="${L.pos.x}" y1="${L.pos.y}" x2="${L.pos.x+Math.sin(a)*R*3}" y2="${L.pos.y-Math.cos(a)*R*3}" stroke="#2563eb" stroke-width="${R*.35}" stroke-linecap="round"/>`}
 return h+`<circle cx="${L.pos.x}" cy="${L.pos.y}" r="${R*.9}" fill="#2563eb" stroke="#fff" stroke-width="${R*.3}"/>`;
}

$('lv').onclick=()=>{if(L.on)liveStop();else liveStart()};
$('lstep').onclick=()=>{if(L.on){L.lastStep=performance.now();onStep()}};
$('lset').onclick=()=>{
 if(!L.on||L.hs===null)return;
 const seg=segAt(Math.max(L.s,0.01))||L.segs.find(g=>g.ang!==null);
 if(seg){L.off=ad(L.hs,seg.ang);L.cal=true;L.bad=0;liveUpdate()}
};
$('lst').onclick=()=>{
 const g=L.segs.find(g=>g.kind==='stairs'&&!L.cleared.has(g));
 if(g){L.cleared.add(g);L.stairMsg=false;liveLog('stairs-done',performance.now());liveUpdate()}
};
$('lwh').onclick=()=>showWhere('');
$('wok').onclick=hideWhere;
$('wgo').onclick=()=>{
 const v=$('wi').value.trim(),id=places[v];
 if(!id){$('wtxt').textContent='Pick a place from the list.';return}
 liveLog('corrected-to '+id+' from s='+L.s.toFixed(1),performance.now());
 $('from').value=v;showRoute();
 if(!route)return;
 liveBuild();L.s=0;L.bad=0;L.mute=20;L.hist=[];
 $('where').style.display='none';$('wi').value='';
 liveUpdate();liveCenter(L.pos,true);render();
};
$('llog').onclick=()=>{
 const rows=[['t_ms','ax','ay','az','gyro','alpha','beta','gamma','heading','signal','event'],...L.log];
 const a=document.createElement('a');
 a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}));
 a.download='livelog.csv';a.click();
};
$('lth').oninput=e=>{if(L.on)L.th=+e.target.value;$('lthv').textContent=e.target.value};
window.addEventListener('keydown',e=>{if(e.code==='Space'&&L.on&&e.target.tagName!=='INPUT'){e.preventDefault();$('lstep').click()}});
