import { mulberry32 } from './world.js';

const TEX = 64;

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function fillNoise(ctx, w, h, rng, colors, density = 0.35) {
  const count = Math.floor(w * h * density);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    ctx.globalAlpha = 0.1 + rng() * 0.32;
    const s = rng() < 0.86 ? 1 : 2;
    ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * h), s, s);
  }
  ctx.globalAlpha = 1;
}

function rustPatch(ctx, rng, x, y, w, h, opacity = 0.65) {
  ctx.save();
  ctx.globalAlpha = opacity;
  const grad = ctx.createRadialGradient(x + w * 0.5, y + h * 0.5, 0, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.7);
  grad.addColorStop(0, `rgba(${110 + rng() * 40}, ${47 + rng() * 25}, 20, .9)`);
  grad.addColorStop(0.5, 'rgba(92, 40, 17, .5)');
  grad.addColorStop(1, 'rgba(45, 24, 14, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, rng() * Math.PI, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function scratch(ctx, rng, x, y, len, alpha = 0.18) {
  ctx.strokeStyle = `rgba(205, 190, 160, ${alpha})`;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + len * 0.7, y + (rng() - 0.5) * 4);
  ctx.stroke();
}

function makeCorrugated(rng) {
  const c = canvasOf(TEX, TEX);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2b2e2a';
  ctx.fillRect(0, 0, TEX, TEX);
  for (let x = 0; x < TEX; x += 5) {
    const light = 30 + Math.floor(rng() * 18);
    ctx.fillStyle = `rgb(${light}, ${light + 2}, ${light - 2})`;
    ctx.fillRect(x, 0, 2, TEX);
    ctx.fillStyle = 'rgba(0,0,0,.33)';
    ctx.fillRect(x + 2, 0, 2, TEX);
  }
  ctx.fillStyle = 'rgba(10,10,8,.75)';
  ctx.fillRect(0, 31, TEX, 2);
  ctx.fillStyle = 'rgba(125,125,112,.22)';
  ctx.fillRect(0, 30, TEX, 1);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = 'rgba(40,35,28,.7)';
    ctx.beginPath();
    ctx.arc(4 + rng() * 56, 6 + rng() * 52, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  rustPatch(ctx, rng, 4, 37, 23, 24, 0.72);
  rustPatch(ctx, rng, 42, 8, 18, 25, 0.42);
  for (let i = 0; i < 6; i++) scratch(ctx, rng, rng() * 64, rng() * 64, 6 + rng() * 14, 0.13);
  fillNoise(ctx, TEX, TEX, rng, ['#0b0c0a', '#b6b09b', '#6d4a2f'], 0.12);
  return c;
}

function makeRustPlate(rng) {
  const c = canvasOf(TEX, TEX);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#473226';
  ctx.fillRect(0, 0, TEX, TEX);
  ctx.fillStyle = 'rgba(22,16,12,.55)';
  ctx.fillRect(0, 0, 64, 2);
  ctx.fillRect(0, 30, 64, 2);
  ctx.fillRect(0, 61, 64, 3);
  ctx.fillRect(31, 0, 2, 64);
  for (let i = 0; i < 7; i++) rustPatch(ctx, rng, rng() * 52, rng() * 50, 12 + rng() * 18, 10 + rng() * 20, 0.45);
  for (let i = 0; i < 10; i++) {
    const x = 4 + rng() * 56;
    const y = 4 + rng() * 56;
    ctx.fillStyle = 'rgba(18,14,11,.85)';
    ctx.beginPath();
    ctx.arc(x, y, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(174,126,85,.38)';
    ctx.fillRect(x - 0.7, y - 1.1, 0.8, 0.7);
  }
  for (let i = 0; i < 9; i++) {
    const x = rng() * 60;
    ctx.fillStyle = `rgba(${50 + rng() * 20}, ${31 + rng() * 15}, 16, .35)`;
    ctx.fillRect(x, 0, 1 + rng() * 2, 14 + rng() * 50);
  }
  fillNoise(ctx, TEX, TEX, rng, ['#1b120d', '#bb7a4b', '#6d4126', '#d4a46b'], 0.2);
  return c;
}

function makeTires(rng) {
  const c = canvasOf(TEX, TEX);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#161614';
  ctx.fillRect(0, 0, TEX, TEX);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 2; col++) {
      const x = 16 + col * 32 + (row % 2 ? 2 : 0);
      const y = 8 + row * 16;
      ctx.fillStyle = '#0a0a09';
      ctx.beginPath();
      ctx.ellipse(x, y, 17, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(95,91,78,.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y - 1, 13, 5.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      for (let t = 0; t < 7; t++) {
        const a = (t / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 9, y + Math.sin(a) * 4);
        ctx.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 7);
        ctx.stroke();
      }
    }
  }
  for (let i = 0; i < 7; i++) rustPatch(ctx, rng, rng() * 56, rng() * 56, 8, 8, 0.25);
  fillNoise(ctx, TEX, TEX, rng, ['#000', '#4e4a3e', '#6f3d21'], 0.14);
  return c;
}

function makeConcrete(rng) {
  const c = canvasOf(TEX, TEX);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3b3a34';
  ctx.fillRect(0, 0, TEX, TEX);
  fillNoise(ctx, TEX, TEX, rng, ['#24241f', '#5d5b51', '#7b7564', '#151512'], 0.36);
  for (let i = 0; i < 7; i++) {
    ctx.strokeStyle = 'rgba(16,16,14,.55)';
    ctx.lineWidth = 0.7;
    let x = rng() * 64;
    let y = rng() * 64;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      x += (rng() - 0.5) * 10;
      y += rng() * 8;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const x = rng() * 55;
    ctx.fillStyle = `rgba(22,22,18,${0.12 + rng() * 0.15})`;
    ctx.fillRect(x, 0, 3 + rng() * 7, 26 + rng() * 38);
  }
  rustPatch(ctx, rng, 7, 40, 20, 18, 0.28);
  return c;
}

function makeScrap(rng) {
  const c = canvasOf(TEX, TEX);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#25231f';
  ctx.fillRect(0, 0, TEX, TEX);
  for (let i = 0; i < 14; i++) {
    const x = rng() * 50;
    const y = rng() * 50;
    const w = 8 + rng() * 22;
    const h = 6 + rng() * 16;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((rng() - 0.5) * 0.7);
    ctx.fillStyle = ['#4b3326', '#353b36', '#57402c', '#292b28'][Math.floor(rng() * 4)];
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
  ctx.fillStyle = '#161614';
  ctx.fillRect(0, 43, 64, 6);
  ctx.fillStyle = 'rgba(182,75,34,.35)';
  for (let i = 0; i < 6; i++) ctx.fillRect(i * 12, 43, 6, 6);
  ctx.strokeStyle = 'rgba(92,72,48,.65)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(2, 9);
  ctx.bezierCurveTo(28, 2, 33, 38, 62, 21);
  ctx.stroke();
  rustPatch(ctx, rng, 12, 10, 36, 30, 0.35);
  fillNoise(ctx, TEX, TEX, rng, ['#000', '#ad774d', '#676a5c'], 0.16);
  return c;
}

function makeGate(rng) {
  const c = canvasOf(TEX, TEX);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2f2b24';
  ctx.fillRect(0, 0, TEX, TEX);
  // corrugated roll-up door
  for (let x = 0; x < TEX; x += 4) {
    ctx.fillStyle = 'rgba(0,0,0,.24)';
    ctx.fillRect(x, 0, 1.5, 64);
    ctx.fillStyle = 'rgba(165,148,117,.1)';
    ctx.fillRect(x + 2, 0, 1, 64);
  }
  // horizontal slats
  for (let y = 6; y < 64; y += 8) {
    ctx.fillStyle = 'rgba(8,7,6,.58)';
    ctx.fillRect(0, y, 64, 1.5);
    ctx.fillStyle = 'rgba(174,155,118,.12)';
    ctx.fillRect(0, y + 1.5, 64, 0.8);
  }
  // cross brace
  ctx.strokeStyle = 'rgba(10,9,7,.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, 8);
  ctx.lineTo(62, 52);
  ctx.moveTo(62, 8);
  ctx.lineTo(2, 52);
  ctx.stroke();
  // central lock box
  ctx.fillStyle = '#1c1a16';
  ctx.fillRect(25, 26, 14, 12);
  ctx.strokeStyle = 'rgba(190,165,110,.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(26, 27, 12, 10);
  ctx.fillStyle = '#b13a24';
  ctx.beginPath();
  ctx.arc(32, 32, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,90,54,.45)';
  ctx.beginPath();
  ctx.arc(32, 32, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // hazard stripe at the bottom
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 53, 64, 9);
  ctx.clip();
  ctx.fillStyle = '#b99a35';
  ctx.fillRect(0, 53, 64, 9);
  ctx.fillStyle = '#17140e';
  for (let i = -20; i < 90; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, 53);
    ctx.lineTo(i + 5, 53);
    ctx.lineTo(i - 6, 62);
    ctx.lineTo(i - 11, 62);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // stencil
  ctx.fillStyle = 'rgba(12,11,9,.75)';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SALIDA', 32, 20);
  ctx.fillStyle = 'rgba(212,195,152,.18)';
  ctx.font = 'bold 4px monospace';
  ctx.fillText('MANTENIMIENTO · 7', 32, 24);
  rustPatch(ctx, rng, 3, 44, 26, 15, 0.52);
  rustPatch(ctx, rng, 40, 5, 21, 17, 0.34);
  fillNoise(ctx, TEX, TEX, rng, ['#0a0907', '#8c5c36', '#c0a64f'], 0.13);
  return c;
}

export function makeWallTextures() {
  const rng = mulberry32(0x0d1d0a7);
  return {
    1: makeCorrugated(rng),
    2: makeRustPlate(rng),
    3: makeTires(rng),
    4: makeConcrete(rng),
    5: makeScrap(rng),
    6: makeGate(rng),
  };
}

/* ------------------------------------------------------------------ */
/* items                                                               */
/* ------------------------------------------------------------------ */

function glow(ctx, x, y, radius, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(0.38, color.replace(/[\d.]+\)$/, '0.24)'));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function itemBase(ctx, rng) {
  glow(ctx, 48, 46, 44, 'rgba(255, 189, 81, 0.42)');
  ctx.save();
  ctx.translate(48, 48);
  ctx.shadowColor = 'rgba(255,188,74,.9)';
  ctx.shadowBlur = 10;
}

function finishItem(ctx, rng) {
  ctx.restore();
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2;
    const r = 23 + rng() * 17;
    ctx.fillStyle = `rgba(255, 224, 157, ${0.25 + rng() * 0.55})`;
    ctx.fillRect(48 + Math.cos(a) * r, 48 + Math.sin(a) * r, 1, 1);
  }
}

function drawWatch(ctx, rng) {
  itemBase(ctx, rng);
  ctx.strokeStyle = '#f3cf7d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#8e5a27';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#d6b064';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3b2a16';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -7);
  ctx.moveTo(0, 0);
  ctx.lineTo(5, 2);
  ctx.stroke();
  ctx.fillStyle = '#4a321b';
  ctx.beginPath();
  ctx.arc(0, 0, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e2bb6e';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, -21, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-11, -14);
  ctx.quadraticCurveTo(-25, -22, -26, -6);
  ctx.stroke();
  finishItem(ctx, rng);
}

function drawRing(ctx, rng) {
  itemBase(ctx, rng);
  ctx.strokeStyle = '#e6d18a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 6, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,248,210,.65)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(-3, 3, 12, Math.PI * 1.1, Math.PI * 1.65);
  ctx.stroke();
  ctx.fillStyle = '#d8edf0';
  ctx.beginPath();
  ctx.moveTo(0, -23);
  ctx.lineTo(9, -10);
  ctx.lineTo(0, 1);
  ctx.lineTo(-9, -10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(-2, -10);
  ctx.lineTo(0, 0);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath();
  ctx.moveTo(-8, -11);
  ctx.lineTo(0, -22);
  ctx.lineTo(-2, -10);
  ctx.closePath();
  ctx.fill();
  finishItem(ctx, rng);
}

function drawCamera(ctx, rng) {
  itemBase(ctx, rng);
  ctx.fillStyle = '#2b2925';
  ctx.strokeStyle = '#d2b978';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-24, -14, 48, 31, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5d574c';
  ctx.fillRect(-16, -20, 13, 7);
  ctx.fillStyle = '#0d0d0c';
  ctx.beginPath();
  ctx.arc(0, 1, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c3ad74';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 1, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#2f4a50';
  ctx.beginPath();
  ctx.arc(0, 1, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(177, 225, 226, .55)';
  ctx.beginPath();
  ctx.arc(-3, -2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d8c17f';
  ctx.fillRect(17, -9, 4, 5);
  ctx.fillStyle = 'rgba(220,206,166,.6)';
  ctx.font = '5px monospace';
  ctx.fillText('LEICA', -13, 24);
  finishItem(ctx, rng);
}

function drawCoil(ctx, rng) {
  itemBase(ctx, rng);
  for (let i = 0; i < 8; i++) {
    const y = -17 + i * 4.7;
    ctx.strokeStyle = i % 2 ? '#b9612f' : '#e08b4e';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.ellipse(0, y, 17, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,199,126,.55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(-2, y - 1, 14, 4.5, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  ctx.strokeStyle = '#7e3d20';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(16, -10);
  ctx.bezierCurveTo(31, -20, 25, 16, 35, 8);
  ctx.stroke();
  finishItem(ctx, rng);
}

function drawMedal(ctx, rng) {
  itemBase(ctx, rng);
  ctx.strokeStyle = '#d6c68c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-13, -25);
  ctx.lineTo(-5, -10);
  ctx.lineTo(5, -10);
  ctx.lineTo(13, -25);
  ctx.stroke();
  ctx.fillStyle = '#8c2e24';
  ctx.beginPath();
  ctx.moveTo(-12, -25);
  ctx.lineTo(-5, -10);
  ctx.lineTo(-13, -14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#283f64';
  ctx.beginPath();
  ctx.moveTo(12, -25);
  ctx.lineTo(5, -10);
  ctx.lineTo(13, -14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d5bd74';
  ctx.beginPath();
  ctx.arc(0, 6, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a5c24';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 6, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#5f4a1e';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 5 : 10;
    ctx.lineTo(Math.cos(a) * r, 6 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  finishItem(ctx, rng);
}

export function makeItemSprites() {
  const rng = mulberry32(0x515ca1);
  const makers = { watch: drawWatch, ring: drawRing, camera: drawCamera, coil: drawCoil, medal: drawMedal };
  const result = {};
  for (const [id, maker] of Object.entries(makers)) {
    const c = canvasOf(96, 96);
    maker(c.getContext('2d'), rng);
    result[id] = c;
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* robot                                                               */
/* ------------------------------------------------------------------ */

const R_W = 160;
const R_H = 240;

function strokeLimb(ctx, x1, y1, x2, y2, width, color, highlight = null) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  if (highlight) {
    ctx.strokeStyle = highlight;
    ctx.lineWidth = Math.max(1, width * 0.18);
    ctx.beginPath();
    ctx.moveTo(x1 - 1, y1);
    ctx.lineTo(x2 - 1, y2);
    ctx.stroke();
  }
}

function drawRobotFrame(phase, hunt) {
  const c = canvasOf(R_W, R_H);
  const ctx = c.getContext('2d');
  const rng = mulberry32(0xbadc0de + Math.floor(phase * 100) + (hunt ? 91 : 0));
  const swing = Math.sin(phase);
  const swing2 = Math.sin(phase + Math.PI);
  const bob = Math.abs(Math.sin(phase)) * 2.2;
  const lean = Math.sin(phase * 0.5) * 1.8;
  const baseY = 230 - bob;
  const bodyTop = 88 - bob;
  const bodyBottom = 176 - bob;

  ctx.save();
  ctx.translate(lean, 0);

  // back leg
  const backKneeX = 72 + swing2 * 9;
  const backKneeY = 196 + Math.max(0, -swing2) * 5;
  const backFootX = 70 + swing2 * 17;
  strokeLimb(ctx, 72, bodyBottom - 6, backKneeX, backKneeY, 13, '#2c211b', '#5a3d2b');
  strokeLimb(ctx, backKneeX, backKneeY, backFootX, baseY - 4, 10, '#241b17', '#493324');
  ctx.fillStyle = '#171310';
  ctx.beginPath();
  ctx.ellipse(backFootX + 3, baseY - 3, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // back arm
  const backElbowX = 38 + swing * 8;
  const backElbowY = 132 + Math.abs(swing) * 5;
  const backHandX = 27 + swing * 15;
  const backHandY = 184 + (hunt ? -18 : 0) + swing * 5;
  strokeLimb(ctx, 48, bodyTop + 15, backElbowX, backElbowY, 11, '#34251d', '#65452f');
  strokeLimb(ctx, backElbowX, backElbowY, backHandX, backHandY, 8, '#2b201a', '#513726');

  // torso silhouette
  ctx.fillStyle = '#37271f';
  ctx.beginPath();
  ctx.moveTo(58, bodyTop + 2);
  ctx.quadraticCurveTo(80, bodyTop - 7, 103, bodyTop + 3);
  ctx.lineTo(116, bodyTop + 37);
  ctx.lineTo(108, bodyBottom - 4);
  ctx.lineTo(89, bodyBottom + 5);
  ctx.lineTo(63, bodyBottom - 1);
  ctx.lineTo(50, bodyTop + 43);
  ctx.closePath();
  ctx.fill();

  // torso plates
  ctx.fillStyle = '#4c3528';
  ctx.beginPath();
  ctx.moveTo(61, bodyTop + 13);
  ctx.lineTo(101, bodyTop + 10);
  ctx.lineTo(106, bodyTop + 42);
  ctx.lineTo(91, bodyTop + 52);
  ctx.lineTo(62, bodyTop + 47);
  ctx.lineTo(57, bodyTop + 27);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(14,11,9,.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#2b201a';
  ctx.fillRect(70, bodyTop + 22, 23, 12);
  ctx.strokeStyle = 'rgba(178,124,76,.5)';
  ctx.strokeRect(70, bodyTop + 22, 23, 12);
  ctx.fillStyle = '#a3402b';
  ctx.fillRect(74, bodyTop + 26, 5, 2);
  ctx.fillStyle = '#72836a';
  ctx.fillRect(82, bodyTop + 26, 6, 2);

  // exposed wires
  ctx.strokeStyle = '#24170f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(58, bodyTop + 39);
  ctx.bezierCurveTo(42, bodyTop + 45, 52, bodyTop + 57, 37, bodyTop + 64);
  ctx.stroke();
  ctx.strokeStyle = '#8f3d26';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(59, bodyTop + 39);
  ctx.bezierCurveTo(43, bodyTop + 46, 54, bodyTop + 55, 39, bodyTop + 63);
  ctx.stroke();
  ctx.strokeStyle = '#292e2a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(102, bodyTop + 42);
  ctx.bezierCurveTo(118, bodyTop + 49, 106, bodyTop + 61, 119, bodyTop + 69);
  ctx.stroke();

  // shoulders
  ctx.fillStyle = '#493327';
  ctx.beginPath();
  ctx.ellipse(54, bodyTop + 12, 17, 13, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(106, bodyTop + 13, 16, 12, 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#251b16';
  ctx.beginPath();
  ctx.arc(52, bodyTop + 10, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(108, bodyTop + 12, 6.5, 0, Math.PI * 2);
  ctx.fill();

  // front leg
  const frontKneeX = 88 + swing * 8;
  const frontKneeY = 196 + Math.max(0, -swing) * 4;
  const frontFootX = 91 + swing * 17;
  strokeLimb(ctx, 88, bodyBottom - 7, frontKneeX, frontKneeY, 14, '#36261d', '#6b4930');
  strokeLimb(ctx, frontKneeX, frontKneeY, frontFootX, baseY - 4, 11, '#2d211a', '#573a26');
  ctx.fillStyle = '#1b1511';
  ctx.beginPath();
  ctx.ellipse(frontFootX + 3, baseY - 3, 13, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(151,99,57,.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(frontKneeX, frontKneeY, 5, 0, Math.PI * 2);
  ctx.stroke();

  // front arm
  const elbowX = 122 - swing * 7;
  const elbowY = 132 + Math.abs(swing) * 4;
  const handX = 132 - swing * 12 + (hunt ? 2 : 0);
  const handY = 186 + (hunt ? -25 : 0) - swing * 4;
  strokeLimb(ctx, 111, bodyTop + 16, elbowX, elbowY, 12, '#3b2a20', '#704c31');
  strokeLimb(ctx, elbowX, elbowY, handX, handY, 9, '#2f221b', '#5a3a26');
  // claws
  ctx.strokeStyle = '#221915';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(handX + 7 + i * 2.5, handY + 8 + i * 3.5);
    ctx.stroke();
  }

  // neck
  ctx.fillStyle = '#211814';
  ctx.fillRect(72, bodyTop - 8, 18, 14);
  ctx.strokeStyle = '#7d4c2d';
  ctx.lineWidth = 1;
  ctx.strokeRect(73, bodyTop - 7, 16, 11);

  // head
  const hx = 80 + Math.sin(phase * 0.5) * 2.2;
  const hy = 50 - bob;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-0.08 + Math.sin(phase * 0.5) * 0.025);
  ctx.fillStyle = '#413027';
  ctx.beginPath();
  ctx.moveTo(-25, -18);
  ctx.lineTo(18, -23);
  ctx.lineTo(27, -8);
  ctx.lineTo(23, 19);
  ctx.lineTo(8, 29);
  ctx.lineTo(-17, 24);
  ctx.lineTo(-27, 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(11,8,7,.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // face plate
  ctx.fillStyle = '#211916';
  ctx.beginPath();
  ctx.moveTo(-20, -12);
  ctx.lineTo(17, -16);
  ctx.lineTo(22, 2);
  ctx.lineTo(10, 14);
  ctx.lineTo(-16, 11);
  ctx.closePath();
  ctx.fill();
  // brow
  ctx.fillStyle = '#5d4230';
  ctx.beginPath();
  ctx.moveTo(-23, -16);
  ctx.lineTo(19, -20);
  ctx.lineTo(17, -12);
  ctx.lineTo(-21, -8);
  ctx.closePath();
  ctx.fill();
  // eye socket
  ctx.fillStyle = '#0b0806';
  ctx.beginPath();
  ctx.ellipse(1, -4, 15, 10, -0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7c4c2e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(1, -4, 15, 10, -0.04, 0, Math.PI * 2);
  ctx.stroke();
  // jaw
  ctx.fillStyle = '#2b1e18';
  ctx.beginPath();
  ctx.moveTo(-18, 13);
  ctx.lineTo(13, 15);
  ctx.lineTo(8, 25);
  ctx.lineTo(-9, 23);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0d0a08';
  for (let i = 0; i < 6; i++) {
    const tx = -14 + i * 5;
    ctx.beginPath();
    ctx.moveTo(tx, 15);
    ctx.lineTo(tx + 2.5, 21);
    ctx.lineTo(tx + 4, 15);
    ctx.closePath();
    ctx.fill();
  }
  // antenna
  ctx.strokeStyle = '#2d211b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(15, -20);
  ctx.lineTo(23, -35);
  ctx.stroke();
  ctx.fillStyle = hunt ? '#ff4c30' : '#6e2a1c';
  ctx.beginPath();
  ctx.arc(23, -36, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // rust / grime inside silhouette only
  ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 170; i++) {
    const x = 25 + rng() * 115;
    const y = 25 + rng() * 200;
    ctx.fillStyle = rng() < 0.6 ? `rgba(${96 + rng() * 40}, ${49 + rng() * 22}, 20, ${0.1 + rng() * 0.4})` : `rgba(11,9,7,${0.1 + rng() * 0.3})`;
    const s = rng() < 0.85 ? 1 : 2;
    ctx.fillRect(x, y, s, s);
  }
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = `rgba(203,184,148,${0.08 + rng() * 0.15})`;
    ctx.lineWidth = 0.7;
    const x = 30 + rng() * 105;
    const y = 30 + rng() * 180;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4 + rng() * 12, y + (rng() - 0.5) * 4);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';

  // glowing eye
  const eyeY = hy - 4;
  const eyeX = hx + 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glowRadius = hunt ? 25 : 13;
  const eyeGlow = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, glowRadius);
  eyeGlow.addColorStop(0, hunt ? 'rgba(255,110,70,.95)' : 'rgba(255,88,52,.6)');
  eyeGlow.addColorStop(0.3, hunt ? 'rgba(255,49,25,.55)' : 'rgba(201,47,24,.25)');
  eyeGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = eyeGlow;
  ctx.fillRect(eyeX - glowRadius, eyeY - glowRadius, glowRadius * 2, glowRadius * 2);
  ctx.restore();
  ctx.fillStyle = hunt ? '#ffd1b9' : '#d76b45';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, hunt ? 4.3 : 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a0a05';
  ctx.beginPath();
  ctx.arc(eyeX + 0.6, eyeY + 0.2, hunt ? 2 : 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  return c;
}

export function makeRobotFrames() {
  const walk = [];
  const hunt = [];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const phase = (i / count) * Math.PI * 2;
    walk.push(drawRobotFrame(phase, false));
    hunt.push(drawRobotFrame(phase, true));
  }
  return { walk, hunt };
}

export function makeScareFrames(robotFrames) {
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const c = canvasOf(640, 640);
    const ctx = c.getContext('2d');
    const rng = mulberry32(0xdeaf + f * 91);
    ctx.fillStyle = '#030202';
    ctx.fillRect(0, 0, 640, 640);
    const g = ctx.createRadialGradient(320, 300, 20, 320, 300, 420);
    g.addColorStop(0, 'rgba(119,20,8,.65)');
    g.addColorStop(0.45, 'rgba(50,8,4,.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 640);

    const src = robotFrames.hunt[f * 3 % robotFrames.hunt.length];
    ctx.save();
    ctx.translate(320 + (f - 1) * 14, 325);
    ctx.rotate((f - 1) * 0.035);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 42, 15, 78, 78, -280, -310, 560, 560);
    ctx.restore();

    // glitch slices
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const sy = Math.floor(rng() * 640);
      const sh = 2 + Math.floor(rng() * 15);
      ctx.globalAlpha = 0.18 + rng() * 0.3;
      ctx.drawImage(c, 0, sy, 640, sh, (rng() - 0.5) * 28, sy, 640, sh);
    }
    ctx.restore();

    // static
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 2000; i++) {
      const v = Math.floor(rng() * 220);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(rng() * 640, rng() * 640, rng() < 0.9 ? 1 : 2, 1);
    }
    ctx.globalAlpha = 1;
    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    for (let y = 0; y < 640; y += 3) ctx.fillRect(0, y, 640, 1);
    // red eye bloom
    ctx.globalCompositeOperation = 'lighter';
    const eye = ctx.createRadialGradient(330, 300, 2, 330, 300, 150);
    eye.addColorStop(0, 'rgba(255,100,60,.85)');
    eye.addColorStop(0.2, 'rgba(218,38,15,.28)');
    eye.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = eye;
    ctx.fillRect(0, 0, 640, 640);
    ctx.globalCompositeOperation = 'source-over';
    frames.push(c);
  }
  return frames;
}

/* ------------------------------------------------------------------ */
/* props + signage                                                     */
/* ------------------------------------------------------------------ */

function makeBarrel(rng) {
  const c = canvasOf(80, 104);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2e3a38';
  ctx.beginPath();
  ctx.roundRect(16, 14, 48, 86, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(9,11,10,.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#1b2524';
  ctx.beginPath();
  ctx.ellipse(40, 15, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#54665f';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(40, 15, 21, 5.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (const y of [32, 60, 88]) {
    ctx.fillStyle = '#1c2725';
    ctx.fillRect(15, y, 50, 5);
    ctx.fillStyle = 'rgba(133,147,134,.16)';
    ctx.fillRect(16, y, 48, 1);
  }
  ctx.fillStyle = '#8c4026';
  ctx.fillRect(28, 43, 20, 13);
  ctx.fillStyle = '#d2b36e';
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('7', 38, 52);
  rustPatch(ctx, rng, 19, 50, 35, 35, 0.45);
  fillNoise(ctx, 80, 104, rng, ['#0c0d0b', '#9e6843', '#516059'], 0.15);
  return c;
}

function makeTireStack(rng) {
  const c = canvasOf(90, 90);
  const ctx = c.getContext('2d');
  for (let i = 0; i < 3; i++) {
    const y = 68 - i * 20;
    ctx.fillStyle = '#0b0b0a';
    ctx.beginPath();
    ctx.ellipse(45, y, 37, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(92,86,72,.24)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(45, y - 2, 27, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.ellipse(45, y - 2, 19, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  rustPatch(ctx, rng, 28, 55, 28, 17, 0.2);
  fillNoise(ctx, 90, 90, rng, ['#000', '#524a3b'], 0.1);
  return c;
}

function makeCrate(rng) {
  const c = canvasOf(90, 86);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4a3825';
  ctx.beginPath();
  ctx.rect(12, 20, 66, 62);
  ctx.fill();
  ctx.strokeStyle = '#1c150f';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 20, 66, 62);
  ctx.strokeStyle = '#2e2116';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(14, 24); ctx.lineTo(76, 78);
  ctx.moveTo(76, 24); ctx.lineTo(14, 78);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(148,109,68,.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(18, 26, 54, 50);
  ctx.fillStyle = '#8f7a55';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CHATARRA', 45, 15);
  fillNoise(ctx, 90, 86, rng, ['#0b0907', '#9e7148'], 0.1);
  return c;
}

function makeEngine(rng) {
  const c = canvasOf(96, 80);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3d3b35';
  ctx.beginPath();
  ctx.roundRect(14, 20, 68, 48, 4);
  ctx.fill();
  ctx.strokeStyle = '#11100e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#24231f';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.roundRect(20 + i * 20, 12, 14, 18, 3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = '#786749';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(25, 42); ctx.lineTo(70, 42);
  ctx.moveTo(25, 51); ctx.lineTo(70, 51);
  ctx.stroke();
  rustPatch(ctx, rng, 20, 35, 50, 28, 0.35);
  fillNoise(ctx, 96, 80, rng, ['#000', '#a66a40'], 0.12);
  return c;
}

function makePipe(rng) {
  const c = canvasOf(70, 110);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#3b3a34';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(35, 102);
  ctx.lineTo(35, 60);
  ctx.quadraticCurveTo(35, 25, 12, 18);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(158,151,132,.24)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(30, 100);
  ctx.lineTo(30, 60);
  ctx.quadraticCurveTo(30, 28, 10, 20);
  ctx.stroke();
  ctx.strokeStyle = '#1b1a17';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(12, 18, 9, 0, Math.PI * 2);
  ctx.stroke();
  rustPatch(ctx, rng, 25, 52, 24, 40, 0.38);
  fillNoise(ctx, 70, 110, rng, ['#000', '#9c5e36'], 0.1);
  return c;
}

function makeLamp() {
  const c = canvasOf(48, 64);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#29231c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(24, 0); ctx.lineTo(24, 12);
  ctx.stroke();
  ctx.strokeStyle = '#4b4133';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(24, 30, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,190,103,.9)';
  ctx.beginPath();
  ctx.arc(24, 31, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,244,205,.85)';
  ctx.beginPath();
  ctx.arc(24, 31, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,18,14,.7)';
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(24 + i * 9, 16);
    ctx.lineTo(24 + i * 9, 46);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(8, 30); ctx.lineTo(40, 30);
  ctx.stroke();
  return c;
}

function makeExitSign() {
  const c = canvasOf(128, 56);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b1710';
  ctx.fillRect(8, 8, 112, 40);
  ctx.strokeStyle = '#57735b';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, 112, 40);
  ctx.fillStyle = '#a9d49a';
  ctx.font = 'bold 19px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#8ed480';
  ctx.shadowBlur = 10;
  ctx.fillText('SALIDA', 64, 29);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(180,220,170,.25)';
  ctx.fillRect(8, 8, 112, 2);
  return c;
}

export function makePropSprites() {
  const rng = mulberry32(0xc0ffee);
  return {
    barrel: makeBarrel(rng),
    tires: makeTireStack(rng),
    crate: makeCrate(rng),
    engine: makeEngine(rng),
    pipe: makePipe(rng),
    lamp: makeLamp(),
    exitSign: makeExitSign(),
  };
}
