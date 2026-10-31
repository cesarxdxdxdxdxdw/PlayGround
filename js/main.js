import { createWorld, canOccupy, hasLineOfSight, findPath, randomOpenCell, formatClock, ITEM_DEFS } from './world.js';
import { Renderer } from './renderer.js';
import { Soundscape } from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const els = {
  canvas: $('scene'),
  hud: $('hud'),
  objectiveText: $('objectiveText'),
  itemSlots: $('itemSlots'),
  sensorBars: [...document.querySelectorAll('#sensorBars i')],
  sensorState: $('sensorState'),
  reticle: $('reticle'),
  threat: $('threat'),
  toast: $('toast'),
  prompt: $('prompt'),
  promptText: $('promptText'),
  joystick: $('joystick'),
  joystickThumb: $('joystickThumb'),
  sprintBtn: $('sprintBtn'),
  useBtn: $('useBtn'),
  staminaBar: $('staminaBar'),
  pauseBtn: $('pauseBtn'),
  desktopHint: $('desktopHint'),
  introCaption: $('introCaption'),
  startScreen: $('startScreen'),
  startBtn: $('startBtn'),
  tiltBtn: $('tiltBtn'),
  muteBtn: $('muteBtn'),
  pauseScreen: $('pauseScreen'),
  resumeBtn: $('resumeBtn'),
  restartBtn: $('restartBtn'),
  pauseTiltBtn: $('pauseTiltBtn'),
  pauseMuteBtn: $('pauseMuteBtn'),
  fullscreenBtn: $('fullscreenBtn'),
  menuStatus: $('menuStatus'),
  pauseStatus: $('pauseStatus'),
  gameoverScreen: $('gameoverScreen'),
  deathStats: $('deathStats'),
  retryBtn: $('retryBtn'),
  menuBtn: $('menuBtn'),
  winScreen: $('winScreen'),
  winStats: $('winStats'),
  againBtn: $('againBtn'),
  winMenuBtn: $('winMenuBtn'),
  jumpscare: $('jumpscare'),
  scareCanvas: $('scareCanvas'),
};

const renderer = new Renderer(els.canvas);
const audio = new Soundscape();

function usesTouchLayout() {
  return navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900;
}

const game = {
  mode: 'menu',
  world: createWorld(),
  clock: 0,
  dt: 0,
  runTime: 0,
  player: {
    x: 1.5,
    y: 1.5,
    angle: Math.PI / 2,
    pitch: 0,
    bobY: 0,
    bobPhase: 0,
    stamina: 1,
    exhausted: false,
    sprinting: false,
    moving: false,
    noise: 0,
    stepTimer: 0,
  },
  robot: {
    x: 1.5,
    y: 1.5,
    angle: 0,
    state: 'dormant',
    anim: 0,
    path: [],
    pathTimer: 0,
    target: null,
    targetKey: '',
    lastSeen: { x: 1.5, y: 1.5 },
    lostTimer: 0,
    idleTimer: 0,
    dormantTimer: 9,
    stepTimer: 0,
    woke: false,
    speed: 0,
  },
  collected: 0,
  allCollected: false,
  flash: 0,
  near: null,
  promptKey: '',
  detectorTimer: 1.2,
  heartbeatTimer: 0.8,
  toastTimer: 0,
  introTimer: 0,
  deathTimer: 0,
  deathShown: false,
  huntToastShown: false,
};

const input = {
  keys: new Set(),
  joy: { x: 0, y: 0, active: false, pointerId: null },
  look: { pointerId: null, lastX: 0, lastY: 0 },
  sprintHeld: false,
  mouseDown: false,
};

const tilt = {
  enabled: false,
  supported: typeof window.DeviceOrientationEvent !== 'undefined',
  raw: 0,
  value: 0,
  offset: 0,
  calibrated: false,
  handler: null,
};

const slots = [];
for (let i = 0; i < ITEM_DEFS.length; i++) {
  const slot = document.createElement('i');
  slot.title = ITEM_DEFS[i].name;
  els.itemSlots.appendChild(slot);
  slots.push(slot);
}

function setBodyTouchLayout() {
  document.body.classList.toggle('is-touch', usesTouchLayout());
}

function showToast(text, tone = '', duration = 2400, sub = '') {
  els.toast.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
  els.toast.className = `toast show ${tone}`.trim();
  game.toastTimer = duration;
}

function hideToast() {
  els.toast.className = 'toast';
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function statsHTML() {
  return `
    <div><span>TIEMPO</span><b>${formatDuration(game.runTime)}</b></div>
    <div><span>PIEZAS</span><b>${game.collected}/5</b></div>
    <div><span>HORA</span><b>${formatClock(game.runTime)}</b></div>
  `;
}

function setObjective() {
  if (game.allCollected) {
    els.objectiveText.textContent = 'VUELVE A LA SALIDA';
  } else {
    const left = 5 - game.collected;
    els.objectiveText.textContent = `ENCUENTRA ${left} ${left === 1 ? 'PIEZA' : 'PIEZAS'}`;
  }
}

function updateSlots() {
  game.world.items.forEach((item, i) => {
    if (slots[i]) slots[i].classList.toggle('found', item.collected);
  });
}

function resetRun() {
  const world = game.world;
  game.mode = 'playing';
  game.runTime = 0;
  game.collected = 0;
  game.allCollected = false;
  game.flash = 0;
  game.near = null;
  game.promptKey = '';
  game.detectorTimer = 1.0;
  game.heartbeatTimer = 0.5;
  game.toastTimer = 0;
  game.introTimer = 4.2;
  game.deathTimer = 0;
  game.deathShown = false;
  game.huntToastShown = false;

  game.player.x = world.start.x;
  game.player.y = world.start.y;
  game.player.angle = world.start.angle;
  game.player.pitch = 0;
  game.player.bobY = 0;
  game.player.bobPhase = 0;
  game.player.stamina = 1;
  game.player.exhausted = false;
  game.player.sprinting = false;
  game.player.moving = false;
  game.player.noise = 0;
  game.player.stepTimer = 0;

  game.robot.x = world.robotStart.x;
  game.robot.y = world.robotStart.y;
  game.robot.angle = 0;
  game.robot.state = 'dormant';
  game.robot.anim = 0;
  game.robot.path = [];
  game.robot.pathTimer = 0;
  game.robot.target = null;
  game.robot.targetKey = '';
  game.robot.lastSeen = { x: world.robotStart.x, y: world.robotStart.y };
  game.robot.lostTimer = 0;
  game.robot.idleTimer = 0;
  game.robot.dormantTimer = 8.5;
  game.robot.stepTimer = 0;
  game.robot.woke = false;
  game.robot.speed = 0;

  input.keys.clear();
  input.joy.x = 0;
  input.joy.y = 0;
  input.joy.active = false;
  input.sprintHeld = false;
  els.joystickThumb.style.transform = '';
  els.sprintBtn.classList.remove('active');

  els.jumpscare.classList.add('hidden');
  els.gameoverScreen.classList.add('hidden');
  els.winScreen.classList.add('hidden');
  els.pauseScreen.classList.add('hidden');
  els.startScreen.classList.add('hidden');
  els.startScreen.classList.remove('leaving');
  els.hud.classList.remove('hidden');
  els.threat.classList.remove('show');
  els.useBtn.classList.add('hidden');
  els.prompt.classList.add('hidden');
  hideToast();
  setObjective();
  updateSlots();
  audio.setPaused(false);
  showIntroCaption();
}

function showIntroCaption() {
  els.introCaption.classList.add('show');
  window.clearTimeout(showIntroCaption.timer);
  showIntroCaption.timer = window.setTimeout(() => {
    els.introCaption.classList.remove('show');
  }, 4200);
}

async function beginGame() {
  audio.init().catch(() => {});
  audio.click();
  game.world = createWorld();
  resetRun();
  els.startScreen.classList.add('leaving');
  window.setTimeout(() => {
    if (game.mode === 'playing') els.startScreen.classList.add('hidden');
  }, 520);
  window.setTimeout(() => {
    if (game.mode === 'playing') showToast('ENCUENTRA 5 PIEZAS DE VALOR', '', 2600, 'EL DETECTOR PITA MÁS RÁPIDO SI ESTÁS CERCA');
  }, 900);
}

function restartRun() {
  audio.click();
  game.world = createWorld();
  resetRun();
  els.pauseScreen.classList.add('hidden');
  els.gameoverScreen.classList.add('hidden');
  els.winScreen.classList.add('hidden');
  audio.setPaused(false);
  showToast('NUEVA INCURSIÓN', '', 1800, 'EL VIGÍA-7 TAMBIÉN SE HA REINICIADO');
}

function goMenu() {
  game.mode = 'menu';
  game.world = createWorld();
  els.hud.classList.add('hidden');
  els.pauseScreen.classList.add('hidden');
  els.gameoverScreen.classList.add('hidden');
  els.winScreen.classList.add('hidden');
  els.jumpscare.classList.add('hidden');
  els.startScreen.classList.remove('hidden', 'leaving');
  els.threat.classList.remove('show');
  els.prompt.classList.add('hidden');
  els.useBtn.classList.add('hidden');
  hideToast();
  input.keys.clear();
  input.joy.x = 0;
  input.joy.y = 0;
  input.sprintHeld = false;
  els.joystickThumb.style.transform = '';
  els.sprintBtn.classList.remove('active');
  audio.setPaused(false);
}

function pauseGame() {
  if (game.mode !== 'playing') return;
  game.mode = 'paused';
  els.pauseScreen.classList.remove('hidden');
  els.prompt.classList.add('hidden');
  els.useBtn.classList.add('hidden');
  els.threat.classList.remove('show');
  hideToast();
  input.keys.clear();
  input.joy.x = 0;
  input.joy.y = 0;
  input.sprintHeld = false;
  els.joystickThumb.style.transform = '';
  els.sprintBtn.classList.remove('active');
  audio.setPaused(true);
}

function resumeGame() {
  if (game.mode !== 'paused') return;
  game.mode = 'playing';
  els.pauseScreen.classList.add('hidden');
  audio.setPaused(false);
}

function triggerDeath() {
  if (game.mode !== 'playing') return;
  game.mode = 'dead';
  game.deathTimer = 1.55;
  game.deathShown = false;
  game.player.sprinting = false;
  input.joy.x = 0;
  input.joy.y = 0;
  input.sprintHeld = false;
  els.threat.classList.remove('show');
  els.prompt.classList.add('hidden');
  els.useBtn.classList.add('hidden');
  hideToast();
  els.jumpscare.classList.remove('hidden');
  renderer.drawScare(0);
  audio.jumpscare();
}

function showDeathScreen() {
  game.deathShown = true;
  els.jumpscare.classList.add('hidden');
  els.deathStats.innerHTML = statsHTML();
  els.gameoverScreen.classList.remove('hidden');
  audio.setPaused(true);
}

function triggerWin() {
  if (game.mode !== 'playing') return;
  game.mode = 'won';
  game.player.sprinting = false;
  input.joy.x = 0;
  input.joy.y = 0;
  input.sprintHeld = false;
  els.threat.classList.remove('show');
  els.prompt.classList.add('hidden');
  els.useBtn.classList.add('hidden');
  hideToast();
  els.winStats.innerHTML = statsHTML();
  els.winScreen.classList.remove('hidden');
  audio.win();
  audio.setPaused(true);
}

function wakeRobot(alert = false) {
  const r = game.robot;
  if (r.state === 'dormant') {
    r.state = 'patrol';
    r.woke = true;
    r.target = null;
    r.pathTimer = 0;
    if (!alert) {
      showToast('ALGO SE HA ENCENDIDO', 'danger', 2800, 'UN ZUMBIDO METÁLICO RECORRE EL DESGUACE');
      audio.distantClang(0.15);
    }
  }
  if (alert) {
    r.state = 'hunt';
    r.lastSeen = { x: game.player.x, y: game.player.y };
    r.lostTimer = 0;
    r.target = { x: game.player.x, y: game.player.y };
    r.targetKey = '';
    r.pathTimer = 0;
    if (!game.huntToastShown) {
      game.huntToastShown = true;
      showToast('EL VIGÍA-7 TE HA OÍDO', 'danger', 2600, 'NO CORRAS EN LÍNEA RECTA');
      audio.alert();
    }
  }
}

function collectItem(item) {
  if (item.collected || game.mode !== 'playing') return;
  item.collected = true;
  game.collected += 1;
  game.flash = 1;
  updateSlots();
  audio.pickup(game.collected);
  wakeRobot(true);

  if (game.collected >= 5) {
    game.allCollected = true;
    setObjective();
    audio.unlock();
    showToast(`${item.name}`, 'gold', 4200, 'SALIDA DESBLOQUEADA · VUELVE A LA PUERTA');
    window.setTimeout(() => {
      if (game.mode === 'playing') showToast('LA PUERTA ESTÁ ABIERTA', 'danger', 2800, 'EL VIGÍA-7 YA NO PATRULLA. TE ESTÁ BUSCANDO.');
    }, 4400);
  } else {
    setObjective();
    showToast(item.name, 'gold', 2500, `${item.value} · ${game.collected}/5`);
  }
}

function interact() {
  if (game.mode !== 'playing') return;
  if (game.near?.type === 'item') {
    collectItem(game.near.item);
    return;
  }
  if (game.near?.type === 'gate') {
    if (game.allCollected) {
      triggerWin();
    } else {
      audio.deny();
      showToast('SALIDA BLOQUEADA', 'danger', 2000, `FALTAN ${5 - game.collected} PIEZAS DE VALOR`);
    }
    return;
  }
  audio.click();
}

function updateInteraction() {
  if (game.mode !== 'playing') {
    if (game.promptKey) {
      game.promptKey = '';
      els.prompt.classList.add('hidden');
      els.useBtn.classList.add('hidden');
      els.reticle.classList.remove('near');
    }
    game.near = null;
    return;
  }

  let nearest = null;
  let nearestDist = Infinity;
  for (const item of game.world.items) {
    if (item.collected) continue;
    const d = Math.hypot(item.x - game.player.x, item.y - game.player.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = item;
    }
  }

  const gateDist = Math.hypot(game.world.gate.x - game.player.x, game.world.gate.y - game.player.y);
  const gateAngle = Math.atan2(game.world.gate.y - game.player.y, game.world.gate.x - game.player.x);
  const facingGate = Math.cos(gateAngle - game.player.angle);
  let next = null;
  if (nearest && nearestDist < 1.3) next = { type: 'item', item: nearest, dist: nearestDist };
  else if (game.allCollected && gateDist < 2.35) next = { type: 'gate', dist: gateDist };
  else if (!game.allCollected && gateDist < 1.45 && facingGate > 0.28) next = { type: 'gate', dist: gateDist };

  game.near = next;
  let key = '';
  let text = '';
  let button = '';
  if (next?.type === 'item') {
    key = `item:${next.item.id}`;
    text = `RECOGER ${next.item.name}`;
    button = 'RECOGER';
  } else if (next?.type === 'gate') {
    key = `gate:${game.allCollected}:${game.collected}`;
    text = game.allCollected ? 'ABRIR LA SALIDA' : `SALIDA CERRADA · ${game.collected}/5`;
    button = game.allCollected ? 'ABRIR' : 'CERRADA';
  }

  if (key !== game.promptKey) {
    game.promptKey = key;
    if (!key) {
      els.prompt.classList.add('hidden');
      els.useBtn.classList.add('hidden');
      els.reticle.classList.remove('near');
    } else {
      els.promptText.textContent = text;
      els.prompt.classList.remove('hidden');
      els.useBtn.textContent = button;
      els.useBtn.classList.remove('hidden');
      els.reticle.classList.add('near');
    }
  }
}

function updateTilt(dt) {
  if (!tilt.enabled || game.mode !== 'playing') {
    tilt.value += (0 - tilt.value) * Math.min(1, dt * 5);
    return;
  }
  const target = Math.abs(tilt.raw) < 1.4 ? 0 : clamp(tilt.raw / 24, -1, 1);
  tilt.value += (target - tilt.value) * Math.min(1, dt * 7);
  game.player.angle += tilt.value * 1.75 * dt;
}

function updatePlayer(dt) {
  const p = game.player;
  updateTilt(dt);

  let forward = (input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0)
    - (input.keys.has('KeyS') || input.keys.has('ArrowDown') ? 1 : 0)
    - input.joy.y;
  let strafe = (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0)
    - (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0)
    + input.joy.x;

  const magnitude = Math.hypot(forward, strafe);
  if (magnitude > 1) {
    forward /= magnitude;
    strafe /= magnitude;
  }
  const moving = magnitude > 0.06;
  const wantsSprint = (input.sprintHeld || input.keys.has('ShiftLeft') || input.keys.has('ShiftRight')) && moving && forward > -0.2;
  p.sprinting = wantsSprint && !p.exhausted && p.stamina > 0.01;

  if (p.sprinting) {
    p.stamina = Math.max(0, p.stamina - dt * 0.285);
    if (p.stamina <= 0) p.exhausted = true;
  } else {
    p.stamina = Math.min(1, p.stamina + dt * 0.19);
    if (p.stamina > 0.24) p.exhausted = false;
  }

  let speed = p.sprinting ? 3.42 : 1.92;
  if (forward < -0.2 && Math.abs(forward) > Math.abs(strafe)) speed *= 0.68;
  if (magnitude < 0.35) speed *= 0.72;
  p.moving = moving;

  if (moving) {
    const moveX = (Math.cos(p.angle) * forward - Math.sin(p.angle) * strafe) * speed * dt;
    const moveY = (Math.sin(p.angle) * forward + Math.cos(p.angle) * strafe) * speed * dt;
    if (canOccupy(game.world, p.x + moveX, p.y, 0.205)) p.x += moveX;
    if (canOccupy(game.world, p.x, p.y + moveY, 0.205)) p.y += moveY;

    p.noise = p.sprinting ? 1 : 0.46;
    p.bobPhase += dt * (p.sprinting ? 13.5 : 8.5);
    const amp = p.sprinting ? 3.4 : 2.0;
    p.bobY += (Math.sin(p.bobPhase) * amp - p.bobY) * Math.min(1, dt * 16);
    p.stepTimer -= dt;
    if (p.stepTimer <= 0) {
      audio.footstep(p.sprinting);
      p.stepTimer = p.sprinting ? 0.31 : 0.53;
    }
  } else {
    p.noise = 0;
    p.bobY += (0 - p.bobY) * Math.min(1, dt * 8);
    p.stepTimer = 0;
  }

  p.pitch = clamp(p.pitch, -renderer.height * 0.22, renderer.height * 0.22);
  els.sprintBtn.classList.toggle('active', p.sprinting);
}

function robotPan() {
  const rel = Math.atan2(game.robot.y - game.player.y, game.robot.x - game.player.x) - game.player.angle;
  return clamp(Math.sin(rel), -0.95, 0.95);
}

function setRobotTarget(x, y, resetPath = true) {
  const r = game.robot;
  r.target = { x, y };
  r.targetKey = `${Math.floor(x)},${Math.floor(y)}`;
  if (resetPath) {
    r.path = [];
    r.pathTimer = 0;
  }
}

function choosePatrolTarget() {
  const target = randomOpenCell(game.world, Math.random, game.player, 5);
  setRobotTarget(target.x, target.y);
  game.robot.idleTimer = 0;
}

function updateRobot(dt) {
  const r = game.robot;
  const p = game.player;
  const dist = Math.hypot(r.x - p.x, r.y - p.y);
  const los = hasLineOfSight(game.world, r.x, r.y, p.x, p.y);

  if (r.state === 'dormant') {
    r.dormantTimer -= dt;
    if (dist < 4.2 || r.dormantTimer <= 0) {
      wakeRobot(false);
    }
    return;
  }

  const hearing = p.noise > 0.15 && dist < (p.sprinting ? 12.5 : 6.2);
  const sees = los && dist < (r.state === 'hunt' ? 10.5 : 8.3);

  if ((sees || hearing) && r.state !== 'hunt') {
    r.state = 'hunt';
    r.lostTimer = 0;
    r.lastSeen = { x: p.x, y: p.y };
    r.target = { x: p.x, y: p.y };
    r.targetKey = '';
    r.pathTimer = 0;
    if (!game.huntToastShown) {
      game.huntToastShown = true;
      showToast('EL VIGÍA-7 TE HA VISTO', 'danger', 2600, 'ROMPE LA LÍNEA DE VISIÓN');
      audio.alert();
    }
  }

  if (r.state === 'hunt') {
    if (sees || hearing) {
      r.lastSeen = { x: p.x, y: p.y };
      r.lostTimer = 0;
    } else {
      r.lostTimer += dt;
    }
    if (r.lostTimer > 3.4 && dist > 2.2) {
      r.state = 'search';
      r.target = { x: r.lastSeen.x, y: r.lastSeen.y };
      r.targetKey = '';
      r.pathTimer = 0;
      r.idleTimer = 0;
    } else {
      r.target = { x: p.x, y: p.y };
    }
  } else if (r.state === 'search') {
    if (sees || hearing) {
      r.state = 'hunt';
      r.lostTimer = 0;
      r.target = { x: p.x, y: p.y };
      r.targetKey = '';
      r.pathTimer = 0;
    } else if (!r.target || Math.hypot(r.x - r.target.x, r.y - r.target.y) < 0.45) {
      r.idleTimer -= dt;
      if (r.idleTimer <= 0) {
        r.state = 'patrol';
        choosePatrolTarget();
      }
    }
  } else if (r.state === 'patrol') {
    if (r.idleTimer > 0) {
      r.idleTimer -= dt;
      r.speed = 0;
      if (r.idleTimer <= 0) choosePatrolTarget();
    } else if (!r.target || Math.hypot(r.x - r.target.x, r.y - r.target.y) < 0.4) {
      r.idleTimer = 1.2 + Math.random() * 2.6;
      r.path = [];
      r.speed = 0;
    }
  }

  if (r.state === 'hunt') {
    r.speed = 2.0 + game.collected * 0.09;
  } else if (r.state === 'search') {
    r.speed = 1.48;
  } else {
    r.speed = 1.08;
  }

  if (r.idleTimer > 0 && r.state !== 'hunt') r.speed = 0;

  const target = r.state === 'hunt' ? { x: p.x, y: p.y } : r.target;
  let moved = false;
  if (target && r.speed > 0) {
    const targetKey = `${Math.floor(target.x)},${Math.floor(target.y)}`;
    if (targetKey !== r.targetKey || r.pathTimer <= 0) {
      r.path = findPath(game.world, r.x, r.y, target.x, target.y);
      r.targetKey = targetKey;
      r.pathTimer = r.state === 'hunt' ? 0.34 : 0.9;
    }
    r.pathTimer -= dt;

    let dx = target.x - r.x;
    let dy = target.y - r.y;
    const targetDist = Math.hypot(dx, dy);

    if (r.state === 'hunt' && los && targetDist < 3.2 && targetDist > 0.15) {
      // Direct pressure when it can see you.
      const nx = dx / targetDist;
      const ny = dy / targetDist;
      const step = r.speed * dt;
      if (canOccupy(game.world, r.x + nx * step, r.y + ny * step, 0.16)) {
        r.x += nx * step;
        r.y += ny * step;
        r.angle = Math.atan2(ny, nx);
        moved = true;
      }
    } else {
      if (r.path.length && Math.hypot(r.path[0].x - r.x, r.path[0].y - r.y) < 0.09) r.path.shift();
      const waypoint = r.path[0];
      if (waypoint) {
        dx = waypoint.x - r.x;
        dy = waypoint.y - r.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001) {
          const nx = dx / d;
          const ny = dy / d;
          const step = Math.min(d, r.speed * dt);
          if (canOccupy(game.world, r.x + nx * step, r.y + ny * step, 0.16)) {
            r.x += nx * step;
            r.y += ny * step;
            r.angle = Math.atan2(ny, nx);
            moved = true;
          } else {
            r.pathTimer = 0;
          }
        }
      } else if (r.state === 'hunt' && targetDist > 0.15) {
        // Same cell: go straight for the player.
        const nx = dx / targetDist;
        const ny = dy / targetDist;
        const step = Math.min(targetDist, r.speed * dt);
        r.x += nx * step;
        r.y += ny * step;
        r.angle = Math.atan2(ny, nx);
        moved = true;
      }
    }
  }

  if (moved) {
    r.anim += dt * (r.state === 'hunt' ? 7.6 : 4.6);
    r.stepTimer -= dt;
    if (r.stepTimer <= 0) {
      audio.robotStep(dist, robotPan(), r.state === 'hunt' ? 1.35 : 0.75);
      r.stepTimer = r.state === 'hunt' ? 0.43 : 0.72;
    }
  } else {
    r.stepTimer = 0;
  }

  if (dist < 0.58) {
    triggerDeath();
  }
}

function updateAudio(dt) {
  const p = game.player;
  const r = game.robot;
  const dist = Math.hypot(r.x - p.x, r.y - p.y);
  audio.update(dt, game);

  if (dist < 9.2) {
    game.heartbeatTimer -= dt;
    if (game.heartbeatTimer <= 0) {
      const intensity = clamp(1.15 - dist / 10, 0.28, 1);
      audio.heartbeat(intensity);
      game.heartbeatTimer = clamp(0.34 + dist * 0.075, 0.38, 1.18) * (r.state === 'hunt' ? 0.78 : 1);
    }
  } else {
    game.heartbeatTimer = Math.min(game.heartbeatTimer, 0.7);
  }

  if (!game.allCollected) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const item of game.world.items) {
      if (item.collected) continue;
      const d = Math.hypot(item.x - p.x, item.y - p.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = item;
      }
    }
    if (nearest) {
      game.detectorTimer -= dt;
      if (game.detectorTimer <= 0) {
        const rel = Math.atan2(nearest.y - p.y, nearest.x - p.x) - p.angle;
        audio.ping(Math.sin(rel), clamp(1 - nearestDist / 18, 0.2, 1));
        game.detectorTimer = clamp(0.42 + nearestDist * 0.17, 0.46, 3.3);
      }
    }
  }
}

function updateHUD(dt) {
  if (game.mode === 'menu') return;
  const p = game.player;

  els.staminaBar.style.width = `${(p.stamina * 100).toFixed(1)}%`;
  els.staminaBar.classList.toggle('low', p.stamina < 0.28);

  let nearestDist = Infinity;
  for (const item of game.world.items) {
    if (item.collected) continue;
    nearestDist = Math.min(nearestDist, Math.hypot(item.x - p.x, item.y - p.y));
  }

  let level = 0;
  let sensorLabel = '—';
  if (game.allCollected) {
    level = 5;
    sensorLabel = 'SALIDA';
  } else if (nearestDist < Infinity) {
    level = clamp(Math.ceil((1 - nearestDist / 19) * 5), 0, 5);
    sensorLabel = nearestDist < 3 ? 'AQUÍ' : nearestDist < 7 ? 'CERCA' : nearestDist < 13 ? 'MEDIA' : 'LEJOS';
  }
  els.sensorBars.forEach((bar, i) => {
    bar.classList.toggle('on', i < level);
    bar.classList.toggle('hot', i < level && (game.allCollected || nearestDist < 4.5));
  });
  if (els.sensorState.textContent !== sensorLabel) els.sensorState.textContent = sensorLabel;

  const robotDist = Math.hypot(game.robot.x - p.x, game.robot.y - p.y);
  const threatOn = game.robot.state === 'hunt' && robotDist < 10;
  els.threat.classList.toggle('show', threatOn);
  if (threatOn) els.threat.textContent = robotDist < 4 ? 'CORRE' : 'TE HA VISTO';

  if (game.flash > 0) game.flash = Math.max(0, game.flash - dt * 2.3);
  if (game.toastTimer > 0) {
    game.toastTimer -= dt;
    if (game.toastTimer <= 0) hideToast();
  }
  if (game.introTimer > 0) {
    game.introTimer -= dt;
    if (game.introTimer <= 0) els.introCaption.classList.remove('show');
  }
}

function update(dt) {
  game.runTime += dt;
  updatePlayer(dt);
  updateRobot(dt);
  if (game.mode !== 'playing') return;
  updateInteraction();
  updateAudio(dt);
  updateHUD(dt);
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - frame.last) / 1000));
  frame.last = now;
  game.dt = dt;
  game.clock += dt;

  if (game.mode === 'playing') {
    update(dt);
  } else if (game.mode === 'dead') {
    if (game.deathTimer > 0) {
      game.deathTimer -= dt;
      renderer.drawScare(Math.floor((1.55 - game.deathTimer) / 0.11));
      if (game.deathTimer <= 0 && !game.deathShown) showDeathScreen();
    }
    updateHUD(dt);
  } else if (game.mode === 'paused' || game.mode === 'won') {
    updateHUD(dt);
  }

  renderer.render(game);
  requestAnimationFrame(frame);
}
frame.last = performance.now();

/* ------------------------------------------------------------------ */
/* input                                                               */
/* ------------------------------------------------------------------ */

window.addEventListener('keydown', (event) => {
  const code = event.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) event.preventDefault();
  if (code === 'Escape') {
    if (game.mode === 'playing') pauseGame();
    else if (game.mode === 'paused') resumeGame();
    return;
  }
  if (code === 'KeyE') {
    if (game.mode === 'playing') interact();
    return;
  }
  if (code === 'KeyM') {
    toggleMute();
    return;
  }
  if (code === 'KeyF') {
    toggleFullscreen();
    return;
  }
  input.keys.add(code);
});

window.addEventListener('keyup', (event) => {
  input.keys.delete(event.code);
});

window.addEventListener('blur', () => {
  input.keys.clear();
  input.sprintHeld = false;
  input.joy.x = 0;
  input.joy.y = 0;
  els.sprintBtn.classList.remove('active');
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.mode === 'playing') pauseGame();
});

/* look / mouse drag */
els.canvas.addEventListener('pointerdown', (event) => {
  if (game.mode !== 'playing') return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (input.look.pointerId !== null) return;
  input.look.pointerId = event.pointerId;
  input.look.lastX = event.clientX;
  input.look.lastY = event.clientY;
  try { els.canvas.setPointerCapture(event.pointerId); } catch {}
});

els.canvas.addEventListener('pointermove', (event) => {
  if (game.mode !== 'playing' || input.look.pointerId !== event.pointerId) return;
  const dx = event.clientX - input.look.lastX;
  const dy = event.clientY - input.look.lastY;
  input.look.lastX = event.clientX;
  input.look.lastY = event.clientY;
  const sensitivity = event.pointerType === 'touch' ? 0.0052 : 0.0032;
  game.player.angle += dx * sensitivity;
  game.player.pitch -= dy * (event.pointerType === 'touch' ? 0.42 : 0.32);
  game.player.pitch = clamp(game.player.pitch, -renderer.height * 0.22, renderer.height * 0.22);
});

function endLook(event) {
  if (input.look.pointerId === event.pointerId) input.look.pointerId = null;
}
els.canvas.addEventListener('pointerup', endLook);
els.canvas.addEventListener('pointercancel', endLook);

/* joystick */
function updateJoystick(event) {
  const rect = els.joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = event.clientX - cx;
  let dy = event.clientY - cy;
  const radius = rect.width * 0.34;
  const length = Math.hypot(dx, dy);
  if (length > radius) {
    dx = (dx / length) * radius;
    dy = (dy / length) * radius;
  }
  const nx = dx / radius;
  const ny = dy / radius;
  input.joy.x = Math.abs(nx) < 0.12 ? 0 : nx;
  input.joy.y = Math.abs(ny) < 0.12 ? 0 : ny;
  const visualRadius = rect.width * 0.3;
  els.joystickThumb.style.transform = `translate(${nx * visualRadius}px, ${ny * visualRadius}px)`;
}

els.joystick.addEventListener('pointerdown', (event) => {
  if (game.mode !== 'playing') return;
  event.preventDefault();
  input.joy.active = true;
  input.joy.pointerId = event.pointerId;
  els.joystick.setPointerCapture(event.pointerId);
  updateJoystick(event);
});

els.joystick.addEventListener('pointermove', (event) => {
  if (!input.joy.active || input.joy.pointerId !== event.pointerId) return;
  event.preventDefault();
  updateJoystick(event);
});

function endJoystick(event) {
  if (input.joy.pointerId !== event.pointerId) return;
  input.joy.active = false;
  input.joy.pointerId = null;
  input.joy.x = 0;
  input.joy.y = 0;
  els.joystickThumb.style.transform = '';
}
els.joystick.addEventListener('pointerup', endJoystick);
els.joystick.addEventListener('pointercancel', endJoystick);

/* sprint hold */
els.sprintBtn.addEventListener('pointerdown', (event) => {
  if (game.mode !== 'playing') return;
  event.preventDefault();
  input.sprintHeld = true;
  els.sprintBtn.classList.add('active');
  try { els.sprintBtn.setPointerCapture(event.pointerId); } catch {}
});
function endSprint(event) {
  if (event) event.preventDefault();
  input.sprintHeld = false;
  els.sprintBtn.classList.remove('active');
}
els.sprintBtn.addEventListener('pointerup', endSprint);
els.sprintBtn.addEventListener('pointercancel', endSprint);
els.sprintBtn.addEventListener('pointerleave', (event) => {
  if (event.pointerType === 'mouse') endSprint(event);
});

els.useBtn.addEventListener('click', (event) => {
  event.preventDefault();
  interact();
});

els.pauseBtn.addEventListener('click', pauseGame);
els.resumeBtn.addEventListener('click', resumeGame);
els.restartBtn.addEventListener('click', restartRun);
els.retryBtn.addEventListener('click', restartRun);
els.againBtn.addEventListener('click', restartRun);
els.menuBtn.addEventListener('click', goMenu);
els.winMenuBtn.addEventListener('click', goMenu);
els.startBtn.addEventListener('click', beginGame);

/* tilt */
function updateToggleUI() {
  const tiltLabel = `INCLINACIÓN <b>${tilt.enabled ? 'ON' : 'OFF'}</b>`;
  for (const button of [els.tiltBtn, els.pauseTiltBtn]) {
    button.innerHTML = tiltLabel;
    button.classList.toggle('active', tilt.enabled);
  }
  const soundLabel = `SONIDO <b>${audio.muted ? 'OFF' : 'ON'}</b>`;
  for (const button of [els.muteBtn, els.pauseMuteBtn]) {
    button.innerHTML = soundLabel;
    button.classList.toggle('active', !audio.muted);
  }
}

function handleTilt(event) {
  if (!tilt.enabled || event.gamma === null || event.gamma === undefined) return;
  if (!tilt.calibrated) {
    tilt.offset = event.gamma;
    tilt.calibrated = true;
  }
  tilt.raw = event.gamma - tilt.offset;
}

async function toggleTilt() {
  if (tilt.enabled) {
    tilt.enabled = false;
    tilt.raw = 0;
    tilt.value = 0;
    updateToggleUI();
    showToast('INCLINACIÓN DESACTIVADA', '', 1600, 'CONTROLES TÁCTILES ACTIVOS');
    return;
  }
  if (typeof window.DeviceOrientationEvent === 'undefined') {
    showToast('INCLINACIÓN NO DISPONIBLE', 'danger', 2400, 'ESTE DISPOSITIVO NO TIENE ACELERÓMETRO');
    return;
  }
  try {
    if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      const permission = await window.DeviceOrientationEvent.requestPermission();
      if (permission !== 'granted') {
        showToast('PERMISO DENEGADO', 'danger', 2600, 'ACTIVA EL MOVIMIENTO EN LOS AJUSTES DEL NAVEGADOR');
        return;
      }
    }
    tilt.enabled = true;
    tilt.calibrated = false;
    tilt.raw = 0;
    tilt.value = 0;
    if (!tilt.handler) {
      tilt.handler = handleTilt;
      window.addEventListener('deviceorientation', tilt.handler, true);
    }
    updateToggleUI();
    showToast('INCLINACIÓN ACTIVA', '', 2400, 'INCLINA EL DISPOSITIVO PARA GIRAR LA VISTA');
    audio.click();
  } catch (error) {
    showToast('PERMISO NO CONCEDIDO', 'danger', 2600, 'PRUEBA DE NUEVO DESDE UN TOQUE EN PANTALLA');
  }
}

els.tiltBtn.addEventListener('click', toggleTilt);
els.pauseTiltBtn.addEventListener('click', toggleTilt);

function toggleMute() {
  audio.init().catch(() => {});
  audio.toggleMuted();
  updateToggleUI();
  if (!audio.muted) audio.click();
  showToast(audio.muted ? 'SONIDO SILENCIADO' : 'SONIDO ACTIVADO', '', 1500);
}

els.muteBtn.addEventListener('click', toggleMute);
els.pauseMuteBtn.addEventListener('click', toggleMute);

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  } catch {
    showToast('PANTALLA COMPLETA NO DISPONIBLE', 'danger', 2200, 'USA EL MENÚ DEL NAVEGADOR');
  }
}

els.fullscreenBtn.addEventListener('click', toggleFullscreen);

/* resize */
let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    renderer.resize();
    setBodyTouchLayout();
    game.player.pitch = clamp(game.player.pitch, -renderer.height * 0.22, renderer.height * 0.22);
  }, 90);
});
window.addEventListener('orientationchange', () => {
  window.setTimeout(() => renderer.resize(), 180);
});

/* initial state */
setBodyTouchLayout();
updateToggleUI();
setObjective();
els.startScreen.classList.remove('hidden');
requestAnimationFrame(frame);

/* debug hooks for automated verification */
window.__OXIDO__ = {
  game,
  renderer,
  start: beginGame,
  teleport(x, y, angle = game.player.angle) {
    game.player.x = x;
    game.player.y = y;
    game.player.angle = angle;
    game.player.pitch = 0;
  },
  teleportToItem(index = 0) {
    const item = game.world.items[index];
    if (!item) return null;
    game.player.x = item.x - 0.72;
    game.player.y = item.y;
    game.player.angle = 0;
    return item;
  },
  setRobot(x, y, state = 'hunt') {
    game.robot.x = x;
    game.robot.y = y;
    game.robot.state = state;
    game.robot.pathTimer = 0;
    game.robot.target = { x: game.player.x, y: game.player.y };
    game.robot.targetKey = '';
    if (state === 'hunt') game.robot.lostTimer = 0;
  },
  collect(index = 0) {
    const item = game.world.items[index];
    if (item) collectItem(item);
  },
  interact,
  kill: triggerDeath,
  win: triggerWin,
  getState() {
    return {
      mode: game.mode,
      collected: game.collected,
      allCollected: game.allCollected,
      player: { x: game.player.x, y: game.player.y, angle: game.player.angle, stamina: game.player.stamina },
      robot: { x: game.robot.x, y: game.robot.y, state: game.robot.state },
      items: game.world.items.map((i) => ({ id: i.id, x: i.x, y: i.y, collected: i.collected })),
      gate: game.world.gate,
      seed: game.world.seed,
    };
  },
};
