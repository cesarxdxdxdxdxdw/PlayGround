const MAP_W = 21;
const MAP_H = 21;

export const ITEM_DEFS = [
  { id: 'watch', name: 'RELOJ DE ORO', short: 'RELOJ', tone: '#e7b65b', value: 'ORO 18K' },
  { id: 'ring', name: 'ANILLO DE DIAMANTE', short: 'ANILLO', tone: '#d9e3e4', value: 'PIEDRA CLARA' },
  { id: 'camera', name: 'CÁMARA ANTIGUA', short: 'CÁMARA', tone: '#c4b79b', value: 'COLECCIÓN' },
  { id: 'coil', name: 'BOBINA DE COBRE', short: 'BOBINA', tone: '#d97a44', value: 'COBRE PURO' },
  { id: 'medal', name: 'MEDALLA MILITAR', short: 'MEDALLA', tone: '#d6c68c', value: 'EDICIÓN 1943' },
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function makeGrid(fill) {
  return Array.from({ length: MAP_H }, () => Array(MAP_W).fill(fill));
}

function carveMaze(walls, rng) {
  const stack = [{ x: 1, y: 1 }];
  walls[1][1] = 0;
  const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];

  while (stack.length) {
    const current = stack[stack.length - 1];
    const options = [];
    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx > 0 && ny > 0 && nx < MAP_W - 1 && ny < MAP_H - 1 && walls[ny][nx] === 1) {
        options.push({ x: nx, y: ny, wx: current.x + dx / 2, wy: current.y + dy / 2 });
      }
    }
    if (!options.length) {
      stack.pop();
      continue;
    }
    const next = options[Math.floor(rng() * options.length)];
    walls[next.wy][next.wx] = 0;
    walls[next.y][next.x] = 0;
    stack.push({ x: next.x, y: next.y });
  }
}

function carveRooms(walls, rng) {
  const rooms = [];
  let attempts = 0;
  while (rooms.length < 5 && attempts++ < 80) {
    const w = rng() < 0.55 ? 3 : 5;
    const h = rng() < 0.65 ? 3 : 5;
    const x = 1 + Math.floor(rng() * (MAP_W - w - 2));
    const y = 1 + Math.floor(rng() * (MAP_H - h - 2));
    if (x < 3 && y < 3) continue;
    const overlaps = rooms.some((r) => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y);
    if (overlaps) continue;
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) walls[yy][xx] = 0;
    }
    rooms.push({ x, y, w, h });
  }
  return rooms;
}

function addLoops(walls, rng) {
  const candidates = [];
  for (let y = 2; y < MAP_H - 2; y++) {
    for (let x = 2; x < MAP_W - 2; x++) {
      if (walls[y][x] !== 1) continue;
      const horizontal = walls[y][x - 1] === 0 && walls[y][x + 1] === 0;
      const vertical = walls[y - 1][x] === 0 && walls[y + 1][x] === 0;
      if (horizontal || vertical) candidates.push({ x, y });
    }
  }
  shuffle(candidates, rng);
  const count = Math.min(24, Math.floor(candidates.length * 0.24));
  for (let i = 0; i < count; i++) {
    const c = candidates[i];
    if (walls[c.y][c.x] === 1) walls[c.y][c.x] = 0;
  }
}

function isOpen(walls, x, y) {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && walls[y][x] === 0;
}

export function cellOf(x, y) {
  return { x: Math.floor(x), y: Math.floor(y) };
}

export function findPath(world, fromX, fromY, toX, toY) {
  const sx = Math.floor(fromX);
  const sy = Math.floor(fromY);
  const tx = Math.floor(toX);
  const ty = Math.floor(toY);
  if (!isOpen(world.walls, sx, sy) || !isOpen(world.walls, tx, ty)) return [];

  const total = MAP_W * MAP_H;
  const prev = new Int16Array(total).fill(-1);
  const seen = new Uint8Array(total);
  const queue = new Int16Array(total);
  let head = 0;
  let tail = 0;
  const startIndex = sy * MAP_W + sx;
  const goalIndex = ty * MAP_W + tx;
  queue[tail++] = startIndex;
  seen[startIndex] = 1;

  const dirs = [1, -1, MAP_W, -MAP_W];
  while (head < tail) {
    const current = queue[head++];
    if (current === goalIndex) break;
    const cx = current % MAP_W;
    const cy = (current / MAP_W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const ni = ny * MAP_W + nx;
      if (seen[ni] || world.walls[ny][nx] !== 0) continue;
      seen[ni] = 1;
      prev[ni] = current;
      queue[tail++] = ni;
    }
  }

  if (!seen[goalIndex]) return [];
  const path = [];
  let node = goalIndex;
  while (node !== startIndex && node >= 0) {
    path.push({ x: (node % MAP_W) + 0.5, y: ((node / MAP_W) | 0) + 0.5 });
    node = prev[node];
  }
  path.reverse();
  return path;
}

export function distanceMap(world, startX, startY) {
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  const dist = new Int16Array(MAP_W * MAP_H).fill(-1);
  const queue = new Int16Array(MAP_W * MAP_H);
  let head = 0;
  let tail = 0;
  const startIndex = sy * MAP_W + sx;
  dist[startIndex] = 0;
  queue[tail++] = startIndex;
  while (head < tail) {
    const current = queue[head++];
    const cx = current % MAP_W;
    const cy = (current / MAP_W) | 0;
    const cd = dist[current];
    for (let d = 0; d < 4; d++) {
      const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (!isOpen(world.walls, nx, ny)) continue;
      const ni = ny * MAP_W + nx;
      if (dist[ni] !== -1) continue;
      dist[ni] = cd + 1;
      queue[tail++] = ni;
    }
  }
  return dist;
}

function wallStyleAt(world, x, y, rng) {
  if (x === 1 && y === 0) return 6;
  const edge = x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1;
  if (edge) return rng() < 0.68 ? 1 : rng() < 0.55 ? 2 : 4;
  const n = rng();
  if (n < 0.36) return 1;
  if (n < 0.63) return 2;
  if (n < 0.78) return 3;
  if (n < 0.9) return 4;
  return 5;
}

function neighborWalls(walls, cx, cy) {
  const result = [];
  if (walls[cy - 1]?.[cx] !== 0) result.push({ x: 0, y: -1 });
  if (walls[cy + 1]?.[cx] !== 0) result.push({ x: 0, y: 1 });
  if (walls[cy]?.[cx - 1] !== 0) result.push({ x: -1, y: 0 });
  if (walls[cy]?.[cx + 1] !== 0) result.push({ x: 1, y: 0 });
  return result;
}

function pickItems(world, rng) {
  const { walls } = world;
  const dist = distanceMap(world, 1.5, 1.5);
  const deadEnds = [];
  const farCells = [];

  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (walls[y][x] !== 0) continue;
      const d = dist[y * MAP_W + x];
      if (d < 0) continue;
      if (x === 1 && y === 1) continue;
      if (Math.hypot(x + 0.5 - 1.5, y + 0.5 - 1.5) < 5.4) continue;
      if (d >= 7) farCells.push({ x, y, d });
      let exits = 0;
      if (isOpen(walls, x + 1, y)) exits++;
      if (isOpen(walls, x - 1, y)) exits++;
      if (isOpen(walls, x, y + 1)) exits++;
      if (isOpen(walls, x, y - 1)) exits++;
      if (exits === 1 && d >= 5) deadEnds.push({ x, y, d });
    }
  }

  shuffle(deadEnds, rng);
  farCells.sort((a, b) => b.d - a.d);

  const chosen = [];
  const pool = [...deadEnds, ...farCells];
  for (const cell of pool) {
    if (chosen.length >= ITEM_DEFS.length) break;
    if (cell.x <= 2 && cell.y <= 2) continue;
    if (chosen.some((c) => Math.abs(c.x - cell.x) + Math.abs(c.y - cell.y) < 5)) continue;
    chosen.push(cell);
  }
  if (chosen.length < ITEM_DEFS.length) {
    for (const cell of farCells) {
      if (chosen.length >= ITEM_DEFS.length) break;
      if (!chosen.includes(cell)) chosen.push(cell);
    }
  }

  return chosen.map((cell, i) => {
    const def = ITEM_DEFS[i];
    return {
      ...def,
      index: i,
      x: cell.x + 0.5 + (rng() - 0.5) * 0.24,
      y: cell.y + 0.5 + (rng() - 0.5) * 0.24,
      cellX: cell.x,
      cellY: cell.y,
      distance: cell.d,
      collected: false,
      baseZ: 0.23 + rng() * 0.06,
      height: 0.34,
      phase: rng() * Math.PI * 2,
    };
  });
}

function pickRobotStart(world, rng) {
  const dist = distanceMap(world, 1.5, 1.5);
  let best = { x: 1.5, y: 1.5, d: -1 };
  const candidates = [];
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (world.walls[y][x] !== 0) continue;
      const d = dist[y * MAP_W + x];
      if (d > best.d) best = { x, y, d };
      if (d > 10) candidates.push({ x, y, d });
    }
  }
  if (candidates.length) {
    candidates.sort((a, b) => b.d - a.d);
    const pick = candidates[Math.min(candidates.length - 1, Math.floor(rng() * Math.min(6, candidates.length)))];
    best = pick;
  }
  return { x: best.x + 0.5, y: best.y + 0.5, cellX: best.x, cellY: best.y };
}

function makeProps(world, rng, items, robot) {
  const blocked = new Set();
  blocked.add('1,1');
  for (const item of items) blocked.add(`${item.cellX},${item.cellY}`);
  blocked.add(`${robot.cellX},${robot.cellY}`);

  const candidates = [];
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (world.walls[y][x] !== 0 || blocked.has(`${x},${y}`)) continue;
      if (Math.abs(x - 1) + Math.abs(y - 1) <= 3) continue;
      const wallDirs = neighborWalls(world.walls, x, y);
      if (wallDirs.length) candidates.push({ x, y, wallDirs });
    }
  }
  shuffle(candidates, rng);
  const propTypes = ['barrel', 'tires', 'crate', 'engine', 'pipe', 'barrel', 'crate'];
  const props = [];
  const count = Math.min(38, Math.floor(candidates.length * 0.45));
  for (let i = 0; i < count; i++) {
    const cell = candidates[i];
    const dir = cell.wallDirs[Math.floor(rng() * cell.wallDirs.length)];
    const offset = 0.26 + rng() * 0.09;
    const type = propTypes[Math.floor(rng() * propTypes.length)];
    props.push({
      type,
      x: cell.x + 0.5 + dir.x * offset,
      y: cell.y + 0.5 + dir.y * offset,
      baseZ: 0,
      height: type === 'tires' ? 0.43 : type === 'pipe' ? 0.55 : 0.38,
      widthScale: 0.8 + rng() * 0.4,
      phase: rng() * Math.PI * 2,
      tint: 0.72 + rng() * 0.3,
    });
  }
  return props;
}

function makeLamps(world, rng, items) {
  const blocked = new Set(items.map((i) => `${i.cellX},${i.cellY}`));
  const cells = [];
  for (let y = 2; y < MAP_H - 2; y++) {
    for (let x = 2; x < MAP_W - 2; x++) {
      if (world.walls[y][x] === 0 && !blocked.has(`${x},${y}`)) cells.push({ x, y });
    }
  }
  shuffle(cells, rng);
  const lamps = [];
  const count = Math.max(8, Math.floor(cells.length / 10));
  for (let i = 0; i < count && i < cells.length; i++) {
    const c = cells[i];
    lamps.push({
      x: c.x + 0.5 + (rng() - 0.5) * 0.18,
      y: c.y + 0.5 + (rng() - 0.5) * 0.18,
      baseZ: 0.78,
      height: 0.2,
      phase: rng() * Math.PI * 2,
      flicker: rng() < 0.45,
      warm: rng() < 0.8 ? '#ffb35c' : '#9fc38a',
    });
  }
  return lamps;
}

function makeDebris(world, rng) {
  const debris = [];
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (world.walls[y][x] !== 0) continue;
      const count = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < count; i++) {
        debris.push({
          x: x + 0.08 + rng() * 0.84,
          y: y + 0.08 + rng() * 0.84,
          size: 0.008 + rng() * 0.026,
          length: 0.6 + rng() * 2.4,
          tone: rng(),
          glint: rng() < 0.16,
        });
      }
    }
  }
  return debris;
}

function chooseMenuView(world, rng) {
  const dirs = [
    { a: 0, x: 1, y: 0 },
    { a: Math.PI / 2, x: 0, y: 1 },
    { a: Math.PI, x: -1, y: 0 },
    { a: -Math.PI / 2, x: 0, y: -1 },
  ];
  let best = null;
  for (let y = 2; y < MAP_H - 2; y++) {
    for (let x = 2; x < MAP_W - 2; x++) {
      if (world.walls[y][x] !== 0) continue;
      for (const dir of dirs) {
        let length = 0;
        for (let step = 1; step < 9; step++) {
          if (!isOpen(world.walls, x + dir.x * step, y + dir.y * step)) break;
          length++;
        }
        if (length < 3) continue;
        const score = length + (world.walls[y - 1]?.[x] === 0 ? 0 : 0.2) + rng() * 0.4;
        if (!best || score > best.score) {
          best = {
            score,
            x: x + 0.5,
            y: y + 0.5,
            angle: dir.a,
            robotX: x + 0.5 + dir.x * Math.min(4.2, length - 0.35),
            robotY: y + 0.5 + dir.y * Math.min(4.2, length - 0.35),
          };
        }
      }
    }
  }
  if (!best) {
    return { x: 1.5, y: 1.5, angle: Math.PI / 2, robotX: 1.5, robotY: 5.5 };
  }
  return best;
}

export function createWorld(seed = Date.now()) {
  const rng = mulberry32(seed);
  const walls = makeGrid(1);
  carveMaze(walls, rng);
  carveRooms(walls, rng);
  addLoops(walls, rng);
  walls[1][1] = 0;

  const world = {
    seed,
    W: MAP_W,
    H: MAP_H,
    walls: makeGrid(1),
    start: { x: 1.5, y: 1.5, angle: Math.PI / 2 },
    gate: { x: 1.5, y: 0.9, cellX: 1, cellY: 0 },
    exitSign: { x: 1.5, y: 1.035, baseZ: 0.56, height: 0.08 },
  };

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      world.walls[y][x] = walls[y][x] === 1 ? wallStyleAt(world, x, y, rng) : 0;
    }
  }
  world.walls[0][1] = 6;

  const dist = distanceMap(world, 1.5, 1.5);
  const east = dist[1 * MAP_W + 2] ?? -1;
  const south = dist[2 * MAP_W + 1] ?? -1;
  world.start.angle = south >= east ? Math.PI / 2 : 0;

  world.robotStart = pickRobotStart(world, rng);
  world.items = pickItems(world, rng);
  const itemCells = new Set(world.items.map((item) => `${item.cellX},${item.cellY}`));
  if (itemCells.has(`${world.robotStart.cellX},${world.robotStart.cellY}`)) {
    let best = null;
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (world.walls[y][x] !== 0 || itemCells.has(`${x},${y}`) || (x === 1 && y === 1)) continue;
        const d = dist[y * MAP_W + x];
        if (!best || d > best.d) best = { x, y, d };
      }
    }
    if (best) {
      world.robotStart = { x: best.x + 0.5, y: best.y + 0.5, cellX: best.x, cellY: best.y };
    }
  }
  world.props = makeProps(world, rng, world.items, world.robotStart);
  world.lamps = makeLamps(world, rng, world.items);
  world.debris = makeDebris(world, rng);
  world.menu = chooseMenuView(world, rng);
  world.distFromStart = dist;
  return world;
}

export function isWall(world, x, y) {
  if (x < 0 || y < 0 || x >= world.W || y >= world.H) return true;
  return world.walls[Math.floor(y)][Math.floor(x)] !== 0;
}

export function canOccupy(world, x, y, radius = 0.23) {
  const r = radius;
  return !isWall(world, x - r, y - r)
    && !isWall(world, x + r, y - r)
    && !isWall(world, x - r, y + r)
    && !isWall(world, x + r, y + r);
}

export function hasLineOfSight(world, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 0.12));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isWall(world, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

export function randomOpenCell(world, rng, minDistanceFrom = null, minDistance = 0) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const x = 1 + Math.floor(rng() * (world.W - 2));
    const y = 1 + Math.floor(rng() * (world.H - 2));
    if (world.walls[y][x] !== 0) continue;
    if (minDistanceFrom) {
      const d = Math.hypot(x + 0.5 - minDistanceFrom.x, y + 0.5 - minDistanceFrom.y);
      if (d < minDistance) continue;
    }
    return { x: x + 0.5, y: y + 0.5 };
  }
  return { x: 1.5, y: 1.5 };
}

export function formatClock(seconds) {
  const base = 3 * 60 + 12 + Math.floor(seconds / 4);
  const h = Math.floor(base / 60) % 24;
  const m = base % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
