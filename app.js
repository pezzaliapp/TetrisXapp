// TetrisXapp — Vanilla JS PWA
// © 2025 PezzaliAPP — MIT License

(() => {
  'use strict';

  // Canvas setup with DPR scaling
  const canvas = document.getElementById('game');
  const nextCanvas = document.getElementById('next');
  const ctx = canvas.getContext('2d');
  const nctx = nextCanvas.getContext('2d');
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const COLS = 10, ROWS = 20, SIZE = 30;
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

  // Colors per tetromino
  const COLORS = {
    I: '#60a5fa', // Sky
    J: '#93c5fd',
    L: '#f59e0b', // Amber
    O: '#fbbf24',
    S: '#22c55e', // Green
    T: '#a78bfa', // Violet
    Z: '#ef4444'  // Red
  };

  // Shapes (4x4 matrices)
  const SHAPES = {
    I: [
      [0,0,0,0],
      [1,1,1,1],
      [0,0,0,0],
      [0,0,0,0],
    ],
    J: [
      [1,0,0],
      [1,1,1],
      [0,0,0],
    ],
    L: [
      [0,0,1],
      [1,1,1],
      [0,0,0],
    ],
    O: [
      [1,1],
      [1,1],
    ],
    S: [
      [0,1,1],
      [1,1,0],
      [0,0,0],
    ],
    T: [
      [0,1,0],
      [1,1,1],
      [0,0,0],
    ],
    Z: [
      [1,1,0],
      [0,1,1],
      [0,0,0],
    ],
  };

  // 7-bag randomizer
  class Bag {
    constructor(){ this.bag = []; }
    next(){
      if (this.bag.length === 0) {
        this.bag = Object.keys(SHAPES);
        // shuffle
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
      }
      return this.bag.pop();
    }
  }

  const bag = new Bag();

  // Arena (board)
  const arena = createMatrix(COLS, ROWS);

  function createMatrix(w, h){
    const m = [];
    for (let y=0;y<h;y++){
      m.push(new Array(w).fill(0));
    }
    return m;
  }

  function rotate(matrix){
    const m = matrix.map((row, y) => row.map((_, x) => matrix[matrix.length-1-x][y]));
    return m;
  }

  function collide(arena, piece){
    const [m, o] = [piece.matrix, piece.pos];
    for (let y=0;y<m.length;y++){
      for (let x=0;x<m[y].length;x++){
        if (m[y][x] && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0){
          return true;
        }
      }
    }
    return false;
  }

  function merge(arena, piece){
    piece.matrix.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val){
          arena[y + piece.pos.y][x + piece.pos.x] = piece.color;
        }
      });
    });
  }

  function clearLines(){
    let rowCount = 0;
    outer: for (let y = arena.length - 1; y >= 0; y--){
      for (let x = 0; x < arena[y].length; x++){
        if (arena[y][x] === 0) {
          continue outer;
        }
      }
      const row = arena.splice(y, 1)[0].fill(0);
      arena.unshift(row);
      y++;
      rowCount++;
    }
    return rowCount;
  }

  function createPiece(type){
    return {
      type,
      matrix: SHAPES[type].map(row => row.slice()),
      color: COLORS[type],
      pos: {x: 0, y: 0},
    };
  }

  let dropCounter = 0;
  let dropInterval = 1000; // ms, will speed up
  let lastTime = 0;

  let score = 0, lines = 0, level = 1, best = +localStorage.getItem('tetrisxapp_best') || 0;

  const player = {
    pos: {x: 0, y: 0},
    matrix: null,
    color: '#fff',
    type: null,
    next: createPiece(bag.next()),
  };

  function playerReset(){
    const t = bag.next();
    player.matrix = SHAPES[t].map(r => r.slice());
    player.type = t;
    player.color = COLORS[t];
    player.pos.y = 0;
    player.pos.x = ((COLS / 2) | 0) - ((player.matrix[0].length/2) | 0);
    // Check game over
    if (collide(arena, player)) {
      // reset arena
      for (let y=0;y<arena.length;y++) arena[y].fill(0);
      score = 0; lines = 0; level = 1; dropInterval = 1000;
      updateHUD();
    }
    // Prepare next
    player.next = createPiece(bag.next());
    drawNext();
  }

  function drawCell(x, y, color){
    const s = SIZE;
    ctx.fillStyle = color;
    ctx.fillRect(x*s, y*s, s, s);
    // grid/gloss
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x*s+2, y*s+2, s-4, s-4);
  }

  function draw(){
    // background
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, COLS*SIZE, ROWS*SIZE);

    // draw arena
    for (let y=0;y<arena.length;y++){
      for (let x=0;x<arena[y].length;x++){
        const v = arena[y][x];
        if (v) drawCell(x,y,v);
      }
    }

    // draw ghost
    const ghostY = ghostDropY();
    drawPiece(player, ghostY, true);

    // draw current
    drawPiece(player, player.pos.y, false);
  }

  function drawPiece(p, yOverride, ghost){
    const {matrix, pos, color} = p;
    const yBase = yOverride != null ? yOverride : pos.y;
    for (let y=0;y<matrix.length;y++){
      for (let x=0;x<matrix[y].length;x++){
        if (matrix[y][x]){
          if (ghost) {
            ctx.globalAlpha = 0.25;
            drawCell(x + pos.x, y + yBase, color);
            ctx.globalAlpha = 1;
          } else {
            drawCell(x + pos.x, y + yBase, color);
          }
        }
      }
    }
  }

  function drawNext(){
    nctx.clearRect(0,0,NEXT_SIZE,NEXT_SIZE);
    const m = player.next.matrix;
    const c = player.next.color;
    // center in 4x4 box
    const offsetX = Math.floor((4 - m[0].length)/2);
    const offsetY = Math.floor((4 - m.length)/2);
    for (let y=0;y<m.length;y++){
      for (let x=0;x<m[y].length;x++){
        if (m[y][x]) {
          nctx.fillStyle = c;
          nctx.fillRect((x+offsetX)*SIZE, (y+offsetY)*SIZE, SIZE, SIZE);
          nctx.fillStyle = 'rgba(255,255,255,0.06)';
          nctx.fillRect((x+offsetX)*SIZE+2, (y+offsetY)*SIZE+2, SIZE-4, SIZE-4);
        }
      }
    }
  }

  function update(time = 0){
    if (paused) {
      lastTime = time;
      requestAnimationFrame(update);
      return;
    }
    const delta = time - lastTime;
    lastTime = time;
    dropCounter += delta;
    if (dropCounter > dropInterval){
      playerDrop();
    }
    draw();
    requestAnimationFrame(update);
  }

  function playerDrop(){
    player.pos.y++;
    if (collide(arena, player)){
      player.pos.y--;
      merge(arena, player);
      const cleared = clearLines();
      if (cleared > 0){
        lines += cleared;
        // basic scoring
        const base = [0, 100, 300, 500, 800][cleared];
        score += (base * level);
        if (lines >= level * 10){
          level++;
          dropInterval = Math.max(100, 1000 - (level-1)*75);
        }
        if (score > best){ best = score; localStorage.setItem('tetrisxapp_best', best); }
        updateHUD();
      }
      // spawn next
      const next = player.next;
      player.matrix = next.matrix.map(r => r.slice());
      player.color = next.color;
      player.type = next.type;
      player.pos.y = 0;
      player.pos.x = ((COLS / 2) | 0) - ((player.matrix[0].length/2) | 0);
      player.next = createPiece(bag.next());
      drawNext();
      // if immediate collision -> game over handled in playerReset on next frame
      if (collide(arena, player)){
        playerReset();
      }
    }
    dropCounter = 0;
  }

  function ghostDropY(){
    let y = player.pos.y;
    while (true){
      y++;
      const test = { ...player, pos: { x: player.pos.x, y }};
      if (collide(arena, test)) {
        return y - 1;
      }
    }
  }

  function playerMove(dir){
    player.pos.x += dir;
    if (collide(arena, player)){
      player.pos.x -= dir;
    }
  }

  function playerRotate(){
    const prev = player.matrix;
    let m = rotate(prev);
    const oldX = player.pos.x;
    let offset = 1;
    player.matrix = m;
    // basic wall kick
    while (collide(arena, player)){
      player.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (Math.abs(offset) > 3){
        player.matrix = prev;
        player.pos.x = oldX;
        return;
      }
    }
  }

  function hardDrop(){
    while (!collide(arena, player)) {
      player.pos.y++;
    }
    player.pos.y--;
    playerDrop();
  }

  function softDrop(){
    player.pos.y++;
    if (collide(arena, player)){
      player.pos.y--;
    }
  }

  function updateHUD(){
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('lines').textContent = lines;
    document.getElementById('best').textContent = best;
  }

  // Input
  let paused = false;
  document.addEventListener('keydown', (e) => {
    switch(e.code){
      case 'ArrowLeft': playerMove(-1); break;
      case 'ArrowRight': playerMove(1); break;
      case 'ArrowDown': softDrop(); break;
      case 'ArrowUp':
      case 'KeyW':
      case 'KeyZ': playerRotate(); break;
      case 'Space': e.preventDefault(); hardDrop(); break;
      case 'KeyP': paused = !paused; break;
      case 'KeyR': initGame(true); break;
    }
  });

  // Buttons
  document.querySelectorAll('.btn').forEach(b => {
    b.addEventListener('click', () => {
      const act = b.dataset.act;
      if (act === 'left') playerMove(-1);
      else if (act === 'right') playerMove(1);
      else if (act === 'down') softDrop();
      else if (act === 'rotate') playerRotate();
      else if (act === 'drop') hardDrop();
      else if (act === 'pause') paused = !paused;
      else if (act === 'reset') initGame(true);
    });
  });

  // Install prompt
  let deferredPrompt = null;
  const installBtn = document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });

  function initGame(reset=false){
    if (reset){
      for (let y=0;y<arena.length;y++) arena[y].fill(0);
      score = 0; lines = 0; level = 1; dropInterval = 1000; updateHUD();
    }
    playerReset();
    draw();
  }

  // SW registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(console.error);
    });
  }

  initGame();
  update();
})();
