// TetrisXapp v7 — stable pro build
(() => {
  'use strict';
  // DOM
  const canvas = document.getElementById('game');
  const nextCanvas = document.getElementById('next');
  const holdCanvas = document.getElementById('hold');
  const ctx = canvas.getContext('2d');
  const nctx = nextCanvas.getContext('2d');
  const hctx = holdCanvas.getContext('2d');

  // DPR and sizing
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const COLS = 10, ROWS = 20;
  const qs = new URLSearchParams(location.search);
  let SIZE = parseInt(qs.get('size') || '', 10);
  let GRID = true;
  let THEME = 'auto';
  let MUTE = false;

  // Preferences keys
  const LS_SIZE = 'tetrisxapp_size';
  const LS_GRID = 'tetrisxapp_grid';
  const LS_THEME = 'tetrisxapp_theme';
  const LS_MUTE = 'tetrisxapp_mute';

  // UI elements (optional)
  const sizeSlider = document.getElementById('sizeSlider');
  const sizeValue = document.getElementById('sizeValue');
  const gridToggle = document.getElementById('gridToggle');
  const resetPrefs = document.getElementById('resetPrefs');
  const themeSelect = document.getElementById('themeSelect');
  const muteToggle = document.getElementById('muteToggle');

  function computeAutoSize(){
    const container = canvas.parentElement; // .board
    const avail = Math.max(260, Math.min(container.clientWidth - 40, 560));
    return Math.floor(avail / COLS);
  }
  function applyTheme(){
    const root = document.documentElement;
    if (THEME === 'dark') root.setAttribute('data-theme','light') && root.setAttribute('data-theme','dark'); // force repaint
    if (THEME === 'dark') root.setAttribute('data-theme','dark');
    else if (THEME === 'light') root.setAttribute('data-theme','light');
    else root.removeAttribute('data-theme');
  }
  function loadPrefs(){
    const s = parseInt(localStorage.getItem(LS_SIZE) || '', 10);
    if (Number.isFinite(s)) SIZE = Math.min(40, Math.max(16, s));
    const g = localStorage.getItem(LS_GRID); GRID = g === null ? true : g === '1';
    THEME = localStorage.getItem(LS_THEME) || 'auto';
    MUTE = localStorage.getItem(LS_MUTE) === '1';
    applyTheme();
  }
  function savePrefs(){
    try {
      localStorage.setItem(LS_SIZE, String(SIZE));
      localStorage.setItem(LS_GRID, GRID ? '1' : '0');
      localStorage.setItem(LS_THEME, THEME);
      localStorage.setItem(LS_MUTE, MUTE ? '1' : '0');
    } catch {}
  }

  if (!Number.isFinite(SIZE) || SIZE < 16 || SIZE > 48) SIZE = computeAutoSize();
  loadPrefs();

  // Canvas sizing helpers
  function applyCanvasSize(){
    canvas.width = COLS * SIZE * DPR;
    canvas.height = ROWS * SIZE * DPR;
    canvas.style.width = (COLS * SIZE) + 'px';
    canvas.style.height = (ROWS * SIZE) + 'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);

    const auxSize = 4 * SIZE * DPR;
    [nextCanvas, holdCanvas].forEach(c=>{
      c.width = auxSize; c.height = auxSize;
      c.style.width = (4*SIZE)+'px'; c.style.height=(4*SIZE)+'px';
    });
    nctx.setTransform(DPR,0,0,DPR,0,0);
    hctx.setTransform(DPR,0,0,DPR,0,0);
  }
  applyCanvasSize();

  window.addEventListener('resize', () => {
    if (!qs.get('size')){
      SIZE = computeAutoSize();
      applyCanvasSize(); draw(); drawNext(); drawHold();
      sizeSlider && (sizeSlider.value = SIZE, sizeValue.textContent = SIZE+' px');
      savePrefs();
    }
  });

  // Shapes/colors
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
  class Bag{constructor(){this.bag=[];} next(){if(!this.bag.length){this.bag=Object.keys(SHAPES); for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];} } return this.bag.pop();}}
  const bag = new Bag();
  const arena = Array.from({length:ROWS},()=>Array(COLS).fill(0));
  const rotate = m => {const h=m.length,w=m[0].length,res=Array.from({length:w},()=>Array(h).fill(0));for(let y=0;y<h;y++){for(let x=0;x<w;x++){res[x][h-1-y]=m[y][x];}}return res;};
  function collide(arena,p){const m=p.matrix,o=p.pos;for(let y=0;y<m.length;y++){for(let x=0;x<m[y].length;x++){if(!m[y][x]) continue; const ax=o.x+x, ay=o.y+y; if(ax<0||ax>=COLS||ay>=ROWS) return true; if(ay>=0 && arena[ay][ax]) return true;}} return false;}
  function merge(arena,p){p.matrix.forEach((row,y)=>row.forEach((v,x)=>{if(v && p.pos.y+y>=0) arena[p.pos.y+y][p.pos.x+x]=p.color;}));}
  function clearLines(){let n=0; outer: for(let y=arena.length-1;y>=0;y--){for(let x=0;x<arena[y].length;x++){if(!arena[y][x]) continue outer;} const row=arena.splice(y,1)[0].fill(0); arena.unshift(row); y++; n++;} return n;}

  function drawCell(x,y,c){const s=SIZE; ctx.fillStyle=c; ctx.fillRect(x*s,y*s,s,s); ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(x*s+2,y*s+2,s-4,s-4);}
  function draw(){
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0a0f1a';
    ctx.fillRect(0,0,COLS*SIZE,ROWS*SIZE);
    for(let y=0;y<arena.length;y++){for(let x=0;x<arena[y].length;x++){const v=arena[y][x]; if(v) drawCell(x,y,v);}}
    if (GRID){ ctx.strokeStyle='rgba(255,255,255,0.05)'; if (document.documentElement.getAttribute('data-theme')==='light') ctx.strokeStyle='rgba(0,0,0,0.06)';
      ctx.lineWidth=1; for(let x=0;x<=COLS;x++){ctx.beginPath(); ctx.moveTo(x*SIZE,0); ctx.lineTo(x*SIZE,ROWS*SIZE); ctx.stroke();} for(let y=0;y<=ROWS;y++){ctx.beginPath(); ctx.moveTo(0,y*SIZE); ctx.lineTo(COLS*SIZE,y*SIZE); ctx.stroke();} }
    const gy=ghostDropY(); drawPiece(player,gy,true); drawPiece(player,player.pos.y,false);
  }
  function drawPiece(p,yOverride,ghost){const m=p.matrix,yb=yOverride??p.pos.y; for(let y=0;y<m.length;y++){for(let x=0;x<m[y].length;x++){if(m[y][x]){ if(ghost){ctx.globalAlpha=.25; drawCell(x+p.pos.x,y+yb,p.color); ctx.globalAlpha=1;} else drawCell(x+p.pos.x,y+yb,p.color); }}}}
  function drawNext(){ const m=player.next.matrix,c=player.next.color; const s=SIZE; nctx.clearRect(0,0,4*s,4*s); const ox=Math.floor((4-m[0].length)/2), oy=Math.floor((4-m.length)/2); for(let y=0;y<m.length;y++){for(let x=0;x<m[y].length;x++){if(m[y][x]){ nctx.fillStyle=c; nctx.fillRect((x+ox)*s,(y+oy)*s,s,s); nctx.fillStyle='rgba(0,0,0,0.06)'; nctx.fillRect((x+ox)*s+2,(y+oy)*s+2,s-4,s-4);} }}}
  function drawHold(){ const s=SIZE; hctx.clearRect(0,0,4*s,4*s); if(!holdPiece) return; const m=holdPiece.matrix,c=holdPiece.color; const ox=Math.floor((4-m[0].length)/2), oy=Math.floor((4-m.length)/2); for(let y=0;y<m.length;y++){for(let x=0;x<m[y].length;x++){if(m[y][x]){ hctx.fillStyle=c; hctx.fillRect((x+ox)*s,(y+oy)*s,s,s); hctx.fillStyle='rgba(0,0,0,0.06)'; hctx.fillRect((x+ox)*s+2,(y+oy)*s+2,s-4,s-4);} }}}

  // Player state
  const player={pos:{x:0,y:0},matrix:null,color:'#fff',type:null,next:createPiece(randomType())};
  function randomType(){ return bag.next(); }
  function createPiece(t){return {type:t,matrix:SHAPES[t].map(r=>r.slice()),color:COLORS[t],pos:{x:0,y:0}};}
  function playerReset(){
    const t=randomType();
    player.matrix=SHAPES[t].map(r=>r.slice());
    player.type=t; player.color=COLORS[t];
    player.pos.y=0; player.pos.x=((COLS/2)|0)-((player.matrix[0].length/2)|0);
    if (collide(arena,player)){ for (let y=0;y<arena.length;y++) arena[y].fill(0); score=0; lines=0; level=1; dropInterval=1000; combo=-1; b2b=false; updateHUD(); }
    player.next=createPiece(randomType()); drawNext();
  }

  let dropCounter=0, dropInterval=1000, lastTime=0;
  let score=0, lines=0, level=1, best=+localStorage.getItem('tetrisxapp_best')||0, combo=-1, b2b=false;

  function update(t=0){ if(paused){ lastTime=t; requestAnimationFrame(update); return;} const d=t-lastTime; lastTime=t; dropCounter+=d; if(dropCounter>dropInterval) playerDrop(); draw(); requestAnimationFrame(update);}
  function playerDrop(){
    player.pos.y++;
    if (collide(arena,player)){
      player.pos.y--;
      merge(arena,player);
      holdUsed = false;
      const cleared=clearLines();
      if(cleared>0){
        lines+=cleared;
        let base=[0,100,300,500,800][cleared];
        if (cleared===4){ if (b2b) base=Math.floor(base*1.5); b2b=true; play('tetris'); } else { b2b=false; play('line'); }
        combo = combo < 0 ? 0 : combo + 1;
        const comboBonus = combo>0 ? combo*50 : 0;
        score += (base*level) + comboBonus;
        if(lines>=level*10){ level++; dropInterval=Math.max(100,1000-(level-1)*75); }
        if(score>best){best=score; localStorage.setItem('tetrisxapp_best',best);}
        updateHUD();
      } else {
        combo = -1;
      }
      // spawn next
      const next = player.next;
      player.matrix = next.matrix.map(r=>r.slice());
      player.color = next.color;
      player.type = next.type;
      player.pos.y = 0;
      player.pos.x = ((COLS/2)|0) - ((player.matrix[0].length/2)|0);
      player.next = createPiece(randomType());
      drawNext();
      if (collide(arena,player)) playerReset();
    }
    dropCounter=0;
  }

  function ghostDropY(){ const g={matrix:player.matrix,pos:{x:player.pos.x,y:player.pos.y},color:player.color}; while(!collide(arena,g)) g.pos.y++; return g.pos.y-1; }
  function playerMove(d){ player.pos.x+=d; if(collide(arena,player)) player.pos.x-=d; else play('move'); }
  function playerRotate(){ play('rotate'); const prev=player.matrix,rot=rotate(prev),oldX=player.pos.x; player.matrix=rot; const kicks=[0,-1,1,-2,2]; for(const k of kicks){ player.pos.x=oldX+k; if(!collide(arena,player)) return;} player.matrix=prev; player.pos.x=oldX; }
  function hardDrop(){ let dist=0; while(!collide(arena,player)) { player.pos.y++; dist++; } player.pos.y--; score += dist*2; play('drop'); playerDrop(); updateHUD(); }
  function softDrop(){ player.pos.y++; if(collide(arena,player)) player.pos.y--; else { score += 1; updateHUD(); } }

  function updateHUD(){ document.getElementById('score').textContent=score; document.getElementById('level').textContent=level; document.getElementById('lines').textContent=lines; document.getElementById('best').textContent=best; }

  // HOLD
  let holdPiece=null, holdUsed=false;
  function holdAction(){
    if (holdUsed) return;
    play('hold');
    if (!holdPiece){
      holdPiece=createPiece(player.type);
      playerReset();
    } else {
      const temp=holdPiece;
      holdPiece=createPiece(player.type);
      player.matrix=temp.matrix.map(r=>r.slice());
      player.type=temp.type; player.color=temp.color;
      player.pos.y=0; player.pos.x=((COLS/2)|0)-((player.matrix[0].length/2)|0);
    }
    holdUsed=true; drawHold();
  }
  function drawHoldWrapper(){ drawHold(); }

  // Audio
  let audioCtx=null;
  function play(name){
    if (MUTE) return;
    try { if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch { return; }
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type='square'; const now=audioCtx.currentTime; let f=440;
    if (name==='rotate') f=520; else if (name==='move') f=380; else if (name==='drop') f=600; else if (name==='line') f=700; else if (name==='tetris') f=880; else if (name==='hold') f=300;
    o.frequency.setValueAtTime(f,now); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.08, now+0.01); g.gain.exponentialRampToValueAtTime(0.0001, now+0.12);
    o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+0.13);
  }

  // Inputs
  let paused=false;
  document.addEventListener('keydown',(e)=>{switch(e.code){case'ArrowLeft':e.preventDefault();playerMove(-1);break;case'ArrowRight':e.preventDefault();playerMove(1);break;case'ArrowDown':e.preventDefault();softDrop();break;case'ArrowUp':case'KeyW':case'KeyZ':e.preventDefault();playerRotate();break;case'Space':e.preventDefault();hardDrop();break;case'KeyP':paused=!paused;break;case'KeyR':initGame(true);break;case'KeyC':holdAction();break;}});
  // Buttons (mouse + touch with repeat)
  const startRepeater=(fn)=>{fn(); let t=setInterval(fn,110); return ()=>clearInterval(t);};
  document.querySelectorAll('.btn').forEach(b=>{let stop=null; const act=b.dataset.act; const run=()=>{if(act==='left')playerMove(-1); else if(act==='right')playerMove(1); else if(act==='down')softDrop(); else if(act==='rotate')playerRotate(); else if(act==='drop')hardDrop(); else if(act==='pause')paused=!paused; else if(act==='reset')initGame(true); else if(act==='hold')holdAction();}; b.addEventListener('touchstart',(e)=>{e.preventDefault(); stop=startRepeater(run);},{passive:false}); b.addEventListener('touchend',()=>{if(stop)stop(); stop=null;},{passive:true}); b.addEventListener('mousedown',()=>{stop=startRepeater(run);}); b.addEventListener('mouseup',()=>{if(stop)stop(); stop=null;});});

  // Swipe on canvas
  let touchStart=null, minSwipe=18;
  canvas.addEventListener('touchstart',(e)=>{ if(e.touches.length>1) return; e.preventDefault(); const t=e.touches[0]; touchStart={x:t.clientX,y:t.clientY,moved:false,lastX:t.clientX,lastY:t.clientY}; },{passive:false});
  canvas.addEventListener('touchmove',(e)=>{ if(!touchStart||e.touches.length>1) return; e.preventDefault(); const t=e.touches[0]; const dx=t.clientX-touchStart.lastX, dy=t.clientY-touchStart.lastY; if(Math.abs(dx)>=minSwipe){ playerMove(dx>0?1:-1); touchStart.lastX=t.clientX; touchStart.moved=true;} if(dy>=minSwipe){ softDrop(); touchStart.lastY=t.clientY; touchStart.moved=true;} },{passive:false});
  canvas.addEventListener('touchend',()=>{ if(!touchStart) return; if(!touchStart.moved){ playerRotate(); } else { const totalDy=(touchStart.lastY - touchStart.y); if(totalDy<=-40) hardDrop(); } touchStart=null; },{passive:true});

  // Settings UI bindings (optional)
  function bindPrefsUI(){
    if (sizeSlider && sizeValue){ sizeSlider.value=SIZE; sizeValue.textContent=SIZE+' px'; sizeSlider.addEventListener('input',()=>{ SIZE=parseInt(sizeSlider.value,10); sizeValue.textContent=SIZE+' px'; applyCanvasSize(); draw(); drawNext(); drawHold(); savePrefs(); }); }
    if (gridToggle){ gridToggle.checked=GRID; gridToggle.addEventListener('change',()=>{ GRID=gridToggle.checked; draw(); savePrefs(); }); }
    if (themeSelect){ themeSelect.value=THEME; themeSelect.addEventListener('change',()=>{ THEME=themeSelect.value; applyTheme(); draw(); savePrefs(); }); }
    if (muteToggle){ muteToggle.checked=MUTE; muteToggle.addEventListener('change',()=>{ MUTE=muteToggle.checked; savePrefs(); }); }
    if (resetPrefs){ resetPrefs.addEventListener('click',()=>{ SIZE=computeAutoSize(); GRID=true; THEME='auto'; MUTE=false; applyTheme(); applyCanvasSize(); draw(); drawNext(); drawHold(); if (sizeSlider) sizeSlider.value=SIZE; if (sizeValue) sizeValue.textContent=SIZE+' px'; if (gridToggle) gridToggle.checked=GRID; if (themeSelect) themeSelect.value=THEME; if (muteToggle) muteToggle.checked=MUTE; savePrefs(); }); }
  }
  bindPrefsUI();

  function initGame(reset=false){
    if (reset){ for (let y=0;y<arena.length;y++) arena[y].fill(0); score=0; lines=0; level=1; dropInterval=1000; combo=-1; b2b=false; updateHUD(); }
    // ensure next exists for first draw
    if (!player.next) player.next=createPiece(randomType());
    playerReset(); draw(); drawHold();
  }

  // SW registration (v7)
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations().then(regs => { regs.forEach(reg => { try{ const url=(reg.active&&reg.active.scriptURL)|| (reg.installing&&reg.installing.scriptURL) || (reg.waiting&&reg.waiting.scriptURL); if(!url || !url.endsWith('/sw-v7.js')) reg.unregister(); }catch{} }); });
      navigator.serviceWorker.register('./sw-v7.js').catch(console.error);
    });
  }

  // Start
  initGame();
  requestAnimationFrame(update);
})();
