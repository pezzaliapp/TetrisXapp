// TetrisXapp v6 — clean, touch-enabled
(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const nextCanvas = document.getElementById('next');
  const ctx = canvas.getContext('2d');
  const nctx = nextCanvas.getContext('2d');
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const COLS = 10, ROWS = 20;
  const qs = new URLSearchParams(location.search);
  let SIZE = parseInt(qs.get('size') || '', 10);
  if (!Number.isFinite(SIZE) || SIZE < 16 || SIZE > 48) SIZE = 24;
  canvas.width = COLS * SIZE * DPR;
  canvas.height = ROWS * SIZE * DPR;
  canvas.style.width = (COLS * SIZE) + 'px';
  canvas.style.height = (ROWS * SIZE) + 'px';
  ctx.scale(DPR, DPR);
  const NEXT_SIZE = 4 * SIZE;
  nextCanvas.width = NEXT_SIZE * DPR;
  nextCanvas.height = NEXT_SIZE * DPR;
  nextCanvas.style.width = NEXT_SIZE + 'px';
  nextCanvas.style.height = NEXT_SIZE + 'px';
  nctx.scale(DPR, DPR);

  const COLORS = {I:'#60a5fa',J:'#93c5fd',L:'#f59e0b',O:'#fbbf24',S:'#22c55e',T:'#a78bfa',Z:'#ef4444'};
  const SHAPES = {
    I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    J:[[1,0,0],[1,1,1],[0,0,0]],
    L:[[0,0,1],[1,1,1],[0,0,0]],
    O:[[1,1],[1,1]],
    S:[[0,1,1],[1,1,0],[0,0,0]],
    T:[[0,1,0],[1,1,1],[0,0,0]],
    Z:[[1,1,0],[0,1,1],[0,0,0]],
  };
  class Bag{constructor(){this.bag=[];} next(){if(!this.bag.length){this.bag=Object.keys(SHAPES);for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}} return this.bag.pop();}}
  const bag = new Bag();
  const arena = Array.from({length:ROWS},()=>Array(COLS).fill(0));
  const rotate = m => {const h=m.length,w=m[0].length,res=Array.from({length:w},()=>Array(h).fill(0));for(let y=0;y<h;y++){for(let x=0;x<w;x++){res[x][h-1-y]=m[y][x];}}return res;};
  function collide(arena,p){const m=p.matrix,o=p.pos;for(let y=0;y<m.length;y++){for(let x=0;x<m[y].length;x++){if(!m[y][x]) continue; const ax=o.x+x, ay=o.y+y; if(ax<0||ax>=COLS||ay>=ROWS) return true; if(ay>=0 && arena[ay][ax]) return true;}} return false;}
  function merge(arena,p){p.matrix.forEach((row,y)=>row.forEach((v,x)=>{if(v && p.pos.y+y>=0) arena[p.pos.y+y][p.pos.x+x]=p.color;}));}
  function clearLines(){let n=0; outer: for(let y=arena.length-1;y>=0;y--){for(let x=0;x<arena[y].length;x++){if(!arena[y][x]) continue outer;} const row=arena.splice(y,1)[0].fill(0); arena.unshift(row); y++; n++;} return n;}
  function drawCell(x,y,c){const s=SIZE; ctx.fillStyle=c; ctx.fillRect(x*s,y*s,s,s); ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(x*s+2,y*s+2,s-4,s-4);}
  function draw(){ ctx.fillStyle='#0a0f1a'; ctx.fillRect(0,0,COLS*SIZE,ROWS*SIZE);
    for(let y=0;y<arena.length;y++){for(let x=0;x<arena[y].length;x++){const v=arena[y][x]; if(v) drawCell(x,y,v);}}
    const gy=ghostDropY(); drawPiece(player,gy,true); drawPiece(player,player.pos.y,false);
  }
  function drawPiece(p,yOverride,ghost){const m=p.matrix,yb=yOverride??p.pos.y; for(let y=0;y<m.length;y++){for(let x=0;x<m[y].length;x++){if(m[y][x]){ if(ghost){ctx.globalAlpha=.25; drawCell(x+p.pos.x,y+yb,p.color); ctx.globalAlpha=1;} else drawCell(x+p.pos.x,y+yb,p.color); }}}}
  function drawNext(){ nctx.clearRect(0,0,NEXT_SIZE,NEXT_SIZE); const m=player.next.matrix,c=player.next.color; const ox=Math.floor((4-m[0].length)/2), oy=Math.floor((4-m.length)/2); for(let y=0;y<m.length;y++){for(let x=0;x<m[y].length;x++){if(m[y][x]){ nctx.fillStyle=c; nctx.fillRect((x+ox)*SIZE,(y+oy)*SIZE,SIZE,SIZE); nctx.fillStyle='rgba(255,255,255,0.06)'; nctx.fillRect((x+ox)*SIZE+2,(y+oy)*SIZE+2,SIZE-4,SIZE-4); }}}}
  const player={pos:{x:0,y:0},matrix:null,color:'#fff',type:null,next:createPiece(bag.next())};
  function createPiece(t){return {type:t,matrix:SHAPES[t].map(r=>r.slice()),color:COLORS[t],pos:{x:0,y:0}};}
  function playerReset(){const t=bag.next(); player.matrix=SHAPES[t].map(r=>r.slice()); player.type=t; player.color=COLORS[t]; player.pos.y=0; player.pos.x=((COLS/2)|0)-((player.matrix[0].length/2)|0); if(collide(arena,player)){ for(let y=0;y<arena.length;y++) arena[y].fill(0); score=0; lines=0; level=1; dropInterval=1000; updateHUD(); } player.next=createPiece(bag.next()); drawNext();}
  let dropCounter=0, dropInterval=1000, lastTime=0; let score=0, lines=0, level=1, best=+localStorage.getItem('tetrisxapp_best')||0;
  function update(t=0){ if(paused){ lastTime=t; requestAnimationFrame(update); return;} const d=t-lastTime; lastTime=t; dropCounter+=d; if(dropCounter>dropInterval) playerDrop(); draw(); requestAnimationFrame(update);}
  function playerDrop(){ player.pos.y++; if(collide(arena,player)){ player.pos.y--; merge(arena,player); const cleared=clearLines(); if(cleared>0){ lines+=cleared; const base=[0,100,300,500,800][cleared]; score+=(base*level); if(lines>=level*10){ level++; dropInterval=Math.max(100,1000-(level-1)*75);} if(score>best){best=score; localStorage.setItem('tetrisxapp_best',best);} updateHUD();}
      const next=player.next; player.matrix=next.matrix.map(r=>r.slice()); player.color=next.color; player.type=next.type; player.pos.y=0; player.pos.x=((COLS/2)|0)-((player.matrix[0].length/2)|0); player.next=createPiece(bag.next()); drawNext(); if(collide(arena,player)) playerReset(); }
    dropCounter=0; }
  function ghostDropY(){ const g={matrix:player.matrix,pos:{x:player.pos.x,y:player.pos.y},color:player.color}; while(!collide(arena,g)) g.pos.y++; return g.pos.y-1; }
  function playerMove(d){ player.pos.x+=d; if(collide(arena,player)) player.pos.x-=d; }
  function playerRotate(){ const prev=player.matrix,rot=rotate(prev),oldX=player.pos.x; player.matrix=rot; const kicks=[0,-1,1,-2,2]; for(const k of kicks){ player.pos.x=oldX+k; if(!collide(arena,player)) return;} player.matrix=prev; player.pos.x=oldX; }
  function hardDrop(){ while(!collide(arena,player)) player.pos.y++; player.pos.y--; playerDrop(); }
  function softDrop(){ player.pos.y++; if(collide(arena,player)) player.pos.y--; }
  function updateHUD(){ document.getElementById('score').textContent=score; document.getElementById('level').textContent=level; document.getElementById('lines').textContent=lines; document.getElementById('best').textContent=best; }
  let paused=false;
  document.addEventListener('keydown',(e)=>{switch(e.code){case'ArrowLeft':e.preventDefault();playerMove(-1);break;case'ArrowRight':e.preventDefault();playerMove(1);break;case'ArrowDown':e.preventDefault();softDrop();break;case'ArrowUp':case'KeyW':case'KeyZ':e.preventDefault();playerRotate();break;case'Space':e.preventDefault();hardDrop();break;case'KeyP':paused=!paused;break;case'KeyR':initGame(true);break;}});
  // Buttons press & hold
  const startRepeater=(fn)=>{fn(); let t=setInterval(fn,110); return ()=>clearInterval(t);};
  document.querySelectorAll('.btn').forEach(b=>{let stop=null; const act=b.dataset.act; const run=()=>{if(act==='left')playerMove(-1); else if(act==='right')playerMove(1); else if(act==='down')softDrop(); else if(act==='rotate')playerRotate(); else if(act==='drop')hardDrop(); else if(act==='pause')paused=!paused; else if(act==='reset')initGame(true);}; b.addEventListener('touchstart',(e)=>{e.preventDefault(); stop=startRepeater(run);},{passive:false}); b.addEventListener('touchend',()=>{if(stop)stop(); stop=null;},{passive:true}); b.addEventListener('mousedown',()=>{stop=startRepeater(run);}); b.addEventListener('mouseup',()=>{if(stop)stop(); stop=null;});});
  // Swipe gestures on canvas
  let touchStart=null, minSwipe=18;
  canvas.addEventListener('touchstart',(e)=>{ if(e.touches.length>1) return; e.preventDefault(); const t=e.touches[0]; touchStart={x:t.clientX,y:t.clientY,moved:false,lastX:t.clientX,lastY:t.clientY}; },{passive:false});
  canvas.addEventListener('touchmove',(e)=>{ if(!touchStart||e.touches.length>1) return; e.preventDefault(); const t=e.touches[0]; const dx=t.clientX-touchStart.lastX, dy=t.clientY-touchStart.lastY; if(Math.abs(dx)>=minSwipe){ playerMove(dx>0?1:-1); touchStart.lastX=t.clientX; touchStart.moved=true;} if(dy>=minSwipe){ softDrop(); touchStart.lastY=t.clientY; touchStart.moved=true;} },{passive:false});
  canvas.addEventListener('touchend',()=>{ if(!touchStart) return; if(!touchStart.moved){ playerRotate(); } else { const totalDy=(touchStart.lastY - touchStart.y); if(totalDy<=-40) hardDrop(); } touchStart=null; },{passive:true});

  function initGame(reset=false){ if(reset){ for(let y=0;y<arena.length;y++) arena[y].fill(0); score=0; lines=0; level=1; dropInterval=1000; updateHUD(); } playerReset(); draw(); }

  // SW v6 registration and old SW cleanup
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations().then(regs => { regs.forEach(reg => { try{ const url=(reg.active&&reg.active.scriptURL)|| (reg.installing&&reg.installing.scriptURL) || (reg.waiting&&reg.waiting.scriptURL); if(!url || !url.endsWith('/sw-v6.js')) reg.unregister(); }catch{} }); });
      navigator.serviceWorker.register('./sw-v6.js').catch(console.error);
    });
  }

  initGame();
  update();
})();
