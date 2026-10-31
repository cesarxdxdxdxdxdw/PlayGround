import { makeWallTextures, makeItemSprites, makeRobotFrames, makeScareFrames, makePropSprites } from './sprites.js';

const FOV = (76 * Math.PI) / 180;
const HALF_FOV = FOV / 2;
const PLANE_LEN = Math.tan(HALF_FOV);

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.textures = makeWallTextures();
    this.itemSprites = makeItemSprites();
    this.robotFrames = makeRobotFrames();
    this.propSprites = makePropSprites();
    this.scareFrames = makeScareFrames(this.robotFrames);
    this.width = 1;
    this.height = 1;
    this.depth = new Float32Array(1);
    this.dust = Array.from({ length: 46 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      s: Math.random() < 0.75 ? 1 : 2,
      speed: 0.005 + Math.random() * 0.018,
      drift: (Math.random() - 0.5) * 0.004,
      phase: Math.random() * 10,
    }));
    this.flicker = 1;
    this.flickerTarget = 1;
    this.flickerTimer = 0;
    this.resize();
  }

  resize() {
    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const targetW = clamp(Math.round(vw * dpr * 0.7), 300, 680);
    const targetH = Math.round(targetW * (vh / vw));
    this.canvas.width = targetW;
    this.canvas.height = targetH;
    this.width = targetW;
    this.height = targetH;
    this.depth = new Float32Array(targetW);
    this.ctx.imageSmoothingEnabled = false;
  }

  project(wx, wy, z, camera) {
    const dirX = Math.cos(camera.angle);
    const dirY = Math.sin(camera.angle);
    const planeX = -dirY * PLANE_LEN;
    const planeY = dirX * PLANE_LEN;
    const dx = wx - camera.x;
    const dy = wy - camera.y;
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const tx = invDet * (dirY * dx - dirX * dy);
    const ty = invDet * (-planeY * dx + planeX * dy);
    if (ty <= 0.06) return null;
    const sx = (this.width / 2) * (1 + tx / ty);
    const horizon = this.height / 2 + (camera.pitch || 0);
    const sy = horizon + (0.5 - z) * this.height / ty;
    return { sx, sy, depth: ty, tx };
  }

  render(game) {
    const { ctx, width: w, height: h } = this;
    const camera = game.mode === 'menu'
      ? {
        x: game.world.menu.x,
        y: game.world.menu.y,
        angle: game.world.menu.angle + Math.sin(game.clock * 0.13) * 0.035,
        pitch: Math.sin(game.clock * 0.37) * 2,
      }
      : {
        x: game.player.x,
        y: game.player.y,
        angle: game.player.angle,
        pitch: game.player.pitch + game.player.bobY,
      };

    this.flickerTimer -= game.dt;
    if (this.flickerTimer <= 0) {
      this.flickerTarget = 0.9 + Math.random() * 0.12;
      this.flickerTimer = 0.035 + Math.random() * 0.16;
    }
    this.flicker += (this.flickerTarget - this.flicker) * Math.min(1, game.dt * 22);
    const flicker = this.flicker;

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    this.drawBackdrop(camera, game);
    this.drawFloorCells(camera, game, flicker);
    this.castWalls(camera, game, flicker);
    this.drawFloorDebris(camera, game, flicker);
    this.drawGlows(camera, game, flicker);
    this.drawSprites(camera, game, flicker);
    this.drawPost(camera, game, flicker);
  }

  drawBackdrop(camera, game) {
    const { ctx, width: w, height: h } = this;
    const horizon = h / 2 + (camera.pitch || 0);
    ctx.fillStyle = '#020202';
    ctx.fillRect(0, 0, w, h);

    const ceiling = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon));
    ceiling.addColorStop(0, '#010101');
    ceiling.addColorStop(0.55, '#060604');
    ceiling.addColorStop(0.93, '#0b0a07');
    ceiling.addColorStop(1, '#070605');
    ctx.fillStyle = ceiling;
    ctx.fillRect(0, 0, w, Math.max(0, horizon));

    const floor = ctx.createLinearGradient(0, Math.max(0, horizon), 0, h);
    floor.addColorStop(0, '#090806');
    floor.addColorStop(0.28, '#070605');
    floor.addColorStop(0.72, '#040403');
    floor.addColorStop(1, '#010101');
    ctx.fillStyle = floor;
    ctx.fillRect(0, Math.max(0, horizon), w, h - Math.max(0, horizon));

    // flashlight pool on the floor
    const pool = ctx.createRadialGradient(w * 0.5, h * 0.79, 0, w * 0.5, h * 0.79, Math.max(w, h) * 0.5);
    pool.addColorStop(0, 'rgba(153, 118, 71, .24)');
    pool.addColorStop(0.32, 'rgba(92, 68, 42, .12)');
    pool.addColorStop(0.72, 'rgba(37, 29, 20, .04)');
    pool.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, Math.max(0, horizon), w, h - Math.max(0, horizon));

    // a cold smear of light at the vanishing point
    const haze = ctx.createRadialGradient(w * 0.5, horizon, 0, w * 0.5, horizon, w * 0.36);
    haze.addColorStop(0, 'rgba(94,78,54,.14)');
    haze.addColorStop(0.45, 'rgba(47,38,28,.06)');
    haze.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);

    // low dust / mist band
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#9b8967';
    for (let i = 0; i < 14; i++) {
      const y = horizon + Math.sin(game.clock * 0.2 + i * 2.7) * h * 0.018 + i * 1.7;
      ctx.fillRect((i * 97) % w, y, 20 + ((i * 53) % 60), 1);
    }
    ctx.globalAlpha = 1;
  }

  castWalls(camera, game, flicker) {
    const { ctx, width: w, height: h, depth } = this;
    const { world } = game;
    const dirX = Math.cos(camera.angle);
    const dirY = Math.sin(camera.angle);
    const planeX = -dirY * PLANE_LEN;
    const planeY = dirX * PLANE_LEN;
    const horizon = h / 2 + (camera.pitch || 0);
    const beamHalf = HALF_FOV * 0.66;
    const maxSteps = 64;

    for (let x = 0; x < w; x++) {
      const cameraX = (2 * x) / w - 1;
      const rayX = dirX + planeX * cameraX;
      const rayY = dirY + planeY * cameraX;
      let mapX = Math.floor(camera.x);
      let mapY = Math.floor(camera.y);
      const deltaX = rayX === 0 ? 1e30 : Math.abs(1 / rayX);
      const deltaY = rayY === 0 ? 1e30 : Math.abs(1 / rayY);
      const stepX = rayX < 0 ? -1 : 1;
      const stepY = rayY < 0 ? -1 : 1;
      let sideX = rayX < 0 ? (camera.x - mapX) * deltaX : (mapX + 1 - camera.x) * deltaX;
      let sideY = rayY < 0 ? (camera.y - mapY) * deltaY : (mapY + 1 - camera.y) * deltaY;
      let side = 0;
      let hit = 0;
      let material = 0;
      let steps = 0;

      while (steps++ < maxSteps) {
        if (sideX < sideY) {
          sideX += deltaX;
          mapX += stepX;
          side = 0;
        } else {
          sideY += deltaY;
          mapY += stepY;
          side = 1;
        }
        if (mapX < 0 || mapY < 0 || mapX >= world.W || mapY >= world.H) break;
        material = world.walls[mapY][mapX];
        if (material !== 0) {
          hit = 1;
          break;
        }
      }

      if (!hit) {
        depth[x] = 1e9;
        continue;
      }

      const perp = side === 0
        ? sideX - deltaX
        : sideY - deltaY;
      const safePerp = Math.max(0.035, perp);
      depth[x] = safePerp;
      const lineHeight = h / safePerp;
      let top = horizon - lineHeight / 2;
      let bottom = horizon + lineHeight / 2;

      let wallX;
      if (side === 0) wallX = camera.y + safePerp * rayY;
      else wallX = camera.x + safePerp * rayX;
      wallX -= Math.floor(wallX);

      const texture = this.textures[material] || this.textures[1];
      let texX = Math.floor(wallX * texture.width);
      if (side === 0 && rayX > 0) texX = texture.width - texX - 1;
      if (side === 1 && rayY < 0) texX = texture.width - texX - 1;
      texX = clamp(texX, 0, texture.width - 1);

      const relative = normAngle(Math.atan2(rayY, rayX) - camera.angle);
      const spot = Math.pow(Math.max(0, 1 - Math.abs(relative) / beamHalf), 1.35);
      const distanceFalloff = 1 / (1 + safePerp * safePerp * 0.016 + safePerp * 0.028);
      let light = 0.055 + spot * distanceFalloff * 1.42 * flicker;
      if (side === 1) light *= 0.8;
      light = clamp(light, 0, 1);

      let srcY = 0;
      let srcH = texture.height;
      let destY = top;
      let destH = bottom - top;
      if (destY < 0) {
        const cut = -destY;
        srcY = (cut / destH) * srcH;
        srcH -= srcY;
        destH -= cut;
        destY = 0;
      }
      if (destY + destH > h) {
        const cut = destY + destH - h;
        srcH -= (cut / destH) * srcH;
        destH -= cut;
      }
      if (destH <= 0 || srcH <= 0) continue;

      ctx.globalAlpha = light;
      ctx.drawImage(texture, texX, srcY, 1, srcH, x, destY, 1, destH);
    }
    ctx.globalAlpha = 1;
  }

  drawFloorCells(camera, game, flicker) {
    const { ctx, width: w, height: h } = this;
    const { world } = game;
    const beamHalf = HALF_FOV * 0.72;
    const cx = Math.floor(camera.x);
    const cy = Math.floor(camera.y);
    const radius = 7;
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (x < 0 || y < 0 || x >= world.W || y >= world.H) continue;
        if (world.walls[y][x] !== 0) continue;
        const dx = x + 0.5 - camera.x;
        const dy = y + 0.5 - camera.y;
        const dist = Math.hypot(dx, dy);
        if (dist > radius + 0.7) continue;
        const rel = normAngle(Math.atan2(dy, dx) - camera.angle);
        const spot = Math.max(0, 1 - Math.abs(rel) / beamHalf);
        const falloff = 1 / (1 + dist * dist * 0.016 + dist * 0.03);
        const light = clamp(0.045 + spot * falloff * 1.22 * flicker, 0, 1);
        if (light < 0.025) continue;

        const corners = [
          this.project(x, y, 0.004, camera),
          this.project(x + 1, y, 0.004, camera),
          this.project(x + 1, y + 1, 0.004, camera),
          this.project(x, y + 1, 0.004, camera),
        ];
        if (corners.some((p) => !p)) continue;
        const minX = Math.min(...corners.map((p) => p.sx));
        const maxX = Math.max(...corners.map((p) => p.sx));
        const minY = Math.min(...corners.map((p) => p.sy));
        const maxY = Math.max(...corners.map((p) => p.sy));
        if (maxX < 0 || minX > w || maxY < 0 || minY > h) continue;

        const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        const tone = (hash % 100) / 100;
        const baseR = 54 + tone * 36;
        const baseG = 48 + tone * 28;
        const baseB = 39 + tone * 20;
        const r = Math.round(baseR * light);
        const g = Math.round(baseG * light);
        const b = Math.round(baseB * light);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.moveTo(corners[0].sx, corners[0].sy);
        ctx.lineTo(corners[1].sx, corners[1].sy);
        ctx.lineTo(corners[2].sx, corners[2].sy);
        ctx.lineTo(corners[3].sx, corners[3].sy);
        ctx.closePath();
        ctx.fill();

        if (maxX - minX > 12 && maxY - minY > 3) {
          ctx.strokeStyle = `rgba(8, 7, 5, ${0.22 + light * 0.2})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.strokeStyle = `rgba(166, 142, 101, ${0.035 + light * 0.05})`;
          ctx.beginPath();
          ctx.moveTo(corners[0].sx, corners[0].sy);
          ctx.lineTo(corners[1].sx, corners[1].sy);
          ctx.stroke();
        }
      }
    }
  }

  drawFloorDebris(camera, game, flicker) {
    const { ctx, width: w, height: h, depth } = this;
    const horizon = h / 2 + (camera.pitch || 0);
    const beamHalf = HALF_FOV * 0.84;
    ctx.save();
    for (const d of game.world.debris) {
      const p = this.project(d.x, d.y, 0.008, camera);
      if (!p || p.sy < horizon + 1 || p.sy > h + 4) continue;
      const ix = Math.round(p.sx);
      if (ix < 0 || ix >= w || depth[ix] < p.depth) continue;
      const rel = normAngle(Math.atan2(d.y - camera.y, d.x - camera.x) - camera.angle);
      const spot = Math.max(0, 1 - Math.abs(rel) / beamHalf);
      const alpha = (0.035 + spot * 0.58) * clamp(1 - p.depth / 9.5, 0, 1) * flicker;
      if (alpha < 0.025) continue;
      const size = clamp((d.size * h) / p.depth, 0.7, 5);
      if (d.glint) {
        ctx.fillStyle = `rgba(216, 195, 150, ${alpha * 0.9})`;
        ctx.fillRect(p.sx, p.sy, Math.max(1, size * 0.7), 1);
      } else {
        const warm = d.tone < 0.65;
        ctx.fillStyle = warm
          ? `rgba(119, 84, 52, ${alpha * 0.55})`
          : `rgba(82, 80, 68, ${alpha * 0.46})`;
        ctx.fillRect(p.sx, p.sy, Math.max(1, size * d.length), Math.max(1, size * 0.36));
      }
    }
    ctx.restore();
  }

  drawGlows(camera, game, flicker) {
    const { ctx, width: w, height: h, depth } = this;
    if (game.mode === 'menu') return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const drawGlow = (wx, wy, z, radiusWorld, color, baseAlpha) => {
      const p = this.project(wx, wy, z, camera);
      if (!p) return;
      const ix = Math.round(p.sx);
      if (ix < 0 || ix >= w || depth[ix] < p.depth) return;
      const radius = Math.max(3, (h / p.depth) * radiusWorld);
      const alpha = baseAlpha * clamp(1.2 - p.depth * 0.035, 0.08, 1) * flicker;
      if (alpha <= 0.01) return;
      const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, radius);
      g.addColorStop(0, color.replace('ALPHA', alpha.toFixed(3)));
      g.addColorStop(0.3, color.replace('ALPHA', (alpha * 0.28).toFixed(3)));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.sx - radius, p.sy - radius, radius * 2, radius * 2);
    };

    for (const lamp of game.world.lamps) {
      const pulse = lamp.flicker
        ? 0.6 + 0.4 * Math.max(0, Math.sin(game.clock * 7.7 + lamp.phase) * Math.sin(game.clock * 2.3 + lamp.phase * 2))
        : 0.82 + Math.sin(game.clock * 1.2 + lamp.phase) * 0.05;
      const color = lamp.warm === '#9fc38a'
        ? 'rgba(151, 202, 123, ALPHA)'
        : 'rgba(255, 172, 86, ALPHA)';
      drawGlow(lamp.x, lamp.y, lamp.baseZ + 0.08, 0.42, color, 0.24 * pulse);
    }

    for (const item of game.world.items) {
      if (item.collected) continue;
      const bob = Math.sin(game.clock * 1.9 + item.phase) * 0.018;
      drawGlow(item.x, item.y, item.baseZ + item.height * 0.55 + bob, 0.34, 'rgba(255, 191, 85, ALPHA)', 0.28);
    }

    if (game.allCollected) {
      const sign = game.world.exitSign;
      drawGlow(sign.x, sign.y, sign.baseZ + 0.13, 0.5, 'rgba(136, 232, 130, ALPHA)', 0.26);
    }

    if (game.mode === 'playing' || game.mode === 'paused' || game.mode === 'dead') {
      const robot = game.robot;
      const p = this.project(robot.x, robot.y, 0.74, camera);
      if (p) {
        const ix = Math.round(p.sx);
        if (ix >= 0 && ix < w && depth[ix] > p.depth && robot.state === 'hunt') {
          const radius = Math.max(4, (h / p.depth) * 0.42);
          const alpha = clamp(0.38 - p.depth * 0.018, 0.04, 0.32);
          const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, radius);
          g.addColorStop(0, `rgba(255, 54, 27, ${alpha})`);
          g.addColorStop(0.4, `rgba(186, 23, 9, ${alpha * 0.3})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(p.sx - radius, p.sy - radius, radius * 2, radius * 2);
        }
      }
    }

    ctx.restore();
  }

  drawSprites(camera, game, flicker) {
    const { ctx, width: w, height: h, depth } = this;
    const horizon = h / 2 + (camera.pitch || 0);
    const sprites = [];

    if (game.mode === 'menu') {
      const menu = game.world.menu;
      for (const prop of game.world.props) {
        sprites.push({
          image: this.propSprites[prop.type],
          x: prop.x,
          y: prop.y,
          baseZ: prop.baseZ,
          height: prop.height,
          widthScale: prop.widthScale,
          alpha: prop.tint * 0.72,
          kind: 'prop',
        });
      }
      for (const lamp of game.world.lamps) {
        sprites.push({
          image: this.propSprites.lamp,
          x: lamp.x,
          y: lamp.y,
          baseZ: lamp.baseZ,
          height: lamp.height,
          alpha: 0.58,
          kind: 'lamp',
        });
      }
      sprites.push({
        image: this.robotFrames.walk[0],
        x: menu.robotX,
        y: menu.robotY,
        baseZ: 0,
        height: 1.33,
        alpha: 0.78,
        kind: 'robot',
      });
    } else {
      for (const item of game.world.items) {
        if (item.collected) continue;
        const bob = Math.sin(game.clock * 1.9 + item.phase) * 0.018;
        sprites.push({
          image: this.itemSprites[item.id],
          x: item.x,
          y: item.y,
          baseZ: item.baseZ + bob,
          height: item.height,
          alpha: 1,
          kind: 'item',
          glow: true,
        });
      }

      for (const prop of game.world.props) {
        sprites.push({
          image: this.propSprites[prop.type],
          x: prop.x,
          y: prop.y,
          baseZ: prop.baseZ,
          height: prop.height,
          widthScale: prop.widthScale,
          alpha: prop.tint * 0.92,
          kind: 'prop',
        });
      }

      for (const lamp of game.world.lamps) {
        const pulse = lamp.flicker
          ? 0.72 + 0.28 * Math.max(0, Math.sin(game.clock * 7.7 + lamp.phase) * Math.sin(game.clock * 2.3 + lamp.phase * 2))
          : 1;
        sprites.push({
          image: this.propSprites.lamp,
          x: lamp.x,
          y: lamp.y,
          baseZ: lamp.baseZ,
          height: lamp.height,
          alpha: 0.72 * pulse,
          kind: 'lamp',
          glow: true,
        });
      }

      sprites.push({
        image: this.propSprites.exitSign,
        x: game.world.exitSign.x,
        y: game.world.exitSign.y,
        baseZ: game.world.exitSign.baseZ,
        height: game.world.exitSign.height,
        widthScale: 0.9,
        alpha: game.allCollected ? 0.95 : 0.34,
        kind: 'sign',
        glow: true,
      });

      if (game.mode !== 'menu') {
        const frameSet = game.robot.state === 'hunt' ? this.robotFrames.hunt : this.robotFrames.walk;
        const frame = frameSet[Math.floor(game.robot.anim) % frameSet.length];
        sprites.push({
          image: frame,
          x: game.robot.x,
          y: game.robot.y,
          baseZ: 0,
          height: 1.38,
          alpha: 1,
          kind: 'robot',
          glow: game.robot.state === 'hunt',
        });
      }
    }

    for (const sprite of sprites) {
      const dx = sprite.x - camera.x;
      const dy = sprite.y - camera.y;
      sprite.distance = dx * dx + dy * dy;
    }
    sprites.sort((a, b) => b.distance - a.distance);

    for (const sprite of sprites) {
      const p = this.project(sprite.x, sprite.y, 0, camera);
      if (!p) continue;
      const spriteH = Math.abs((h / p.depth) * sprite.height);
      if (spriteH < 1) continue;
      const aspect = sprite.image.width / sprite.image.height;
      const spriteW = spriteH * aspect * (sprite.widthScale || 1);
      const bottom = horizon + (0.5 - sprite.baseZ) * (h / p.depth);
      const top = bottom - spriteH;
      const left = p.sx - spriteW / 2;
      const right = left + spriteW;
      if (right < 0 || left > w || bottom < 0 || top > h) continue;

      let brightness = 0.16 + 0.9 / (1 + p.depth * 0.17);
      if (sprite.kind === 'item') brightness = Math.max(brightness, 0.58);
      if (sprite.kind === 'lamp' || sprite.kind === 'sign') brightness = Math.max(brightness, 0.52);
      if (sprite.kind === 'robot') brightness = Math.max(brightness, 0.34);
      brightness = clamp(brightness * flicker, 0.1, 1) * sprite.alpha;

      const x0 = Math.max(0, Math.floor(left));
      const x1 = Math.min(w, Math.ceil(right));
      if (x1 <= x0) continue;
      const imgW = sprite.image.width;
      const imgH = sprite.image.height;
      let runStart = -1;
      let runEnd = -1;

      const flush = (end) => {
        if (runStart < 0) return;
        const u0 = clamp((runStart - left) / spriteW, 0, 1) * imgW;
        const u1 = clamp((end - left) / spriteW, 0, 1) * imgW;
        if (u1 > u0) {
          ctx.globalAlpha = brightness;
          ctx.drawImage(sprite.image, u0, 0, Math.max(0.1, u1 - u0), imgH, runStart, top, Math.max(1, end - runStart), spriteH);
        }
        runStart = -1;
      };

      for (let x = x0; x < x1; x++) {
        const visible = depth[x] > p.depth;
        if (visible) {
          if (runStart < 0) runStart = x;
          runEnd = x + 1;
        } else if (runStart >= 0) {
          flush(x);
        }
      }
      flush(x1);
    }

    ctx.globalAlpha = 1;
  }

  drawPost(camera, game, flicker) {
    const { ctx, width: w, height: h } = this;

    // flashlight bloom
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createRadialGradient(w * 0.5, h * 0.54, 0, w * 0.5, h * 0.54, Math.max(w, h) * 0.46);
    beam.addColorStop(0, `rgba(255, 208, 143, ${0.045 * flicker})`);
    beam.addColorStop(0.3, `rgba(255, 187, 111, ${0.018 * flicker})`);
    beam.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // dust motes
    ctx.save();
    ctx.fillStyle = '#c9b78f';
    for (const d of this.dust) {
      d.y -= d.speed * game.dt * (game.mode === 'playing' ? 1 : 0.3);
      d.x += Math.sin(game.clock * 0.3 + d.phase) * 0.00012 + d.drift * game.dt;
      if (d.y < -0.02) d.y = 1.02;
      if (d.x < -0.02) d.x = 1.02;
      if (d.x > 1.02) d.x = -0.02;
      ctx.globalAlpha = 0.08 + Math.sin(game.clock * 0.7 + d.phase) * 0.04;
      ctx.fillRect(Math.floor(d.x * w), Math.floor(d.y * h), d.s, d.s);
    }
    ctx.restore();

    const robot = game.robot;
    let danger = 0;
    if (game.mode !== 'menu' && robot) {
      const dist = Math.hypot(robot.x - camera.x, robot.y - camera.y);
      danger = clamp(1 - dist / 7.5, 0, 1);
      if (robot.state === 'hunt') danger = Math.max(danger, 0.38);
    }
    if (danger > 0.02) {
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(game.clock * (4.2 + danger * 4));
      const g = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.18, w * 0.5, h * 0.5, Math.max(w, h) * 0.68);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.65, `rgba(100, 9, 4, ${danger * 0.14 * pulse})`);
      g.addColorStop(1, `rgba(118, 7, 3, ${danger * 0.38 * pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    if (game.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const a = clamp(game.flash, 0, 1);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, Math.max(w, h) * 0.7);
      g.addColorStop(0, `rgba(255, 210, 128, ${a * 0.38})`);
      g.addColorStop(0.4, `rgba(230, 151, 66, ${a * 0.12})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // menu darkening, to leave the scene readable behind the type
    if (game.mode === 'menu') {
      ctx.fillStyle = 'rgba(1,1,1,.12)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawScare(frameIndex) {
    const canvas = document.getElementById('scareCanvas');
    if (!canvas) return;
    const frames = this.scareFrames;
    const frame = frames[frameIndex % frames.length];
    if (canvas.width !== frame.width) {
      canvas.width = frame.width;
      canvas.height = frame.height;
    }
    const ctx = canvas.getContext('2d');
    ctx.drawImage(frame, 0, 0);
  }
}
