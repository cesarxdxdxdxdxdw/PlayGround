function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function makeNoiseBuffer(ctx, seconds, brown = false) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

export class Soundscape {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambientGain = null;
    this.servoGain = null;
    this.servoPan = null;
    this.ready = false;
    this.muted = localStorage.getItem('oxido-muted') === '1';
    this.lastCreak = 0;
    this.ambientTimer = 5 + Math.random() * 8;
    this.stepFlip = false;
    this.danger = 0;
  }

  async init() {
    if (this.ready) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.58;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.24;
    master.connect(compressor);
    compressor.connect(ctx.destination);
    this.master = master;
    this.noise = makeNoiseBuffer(ctx, 3.2);
    this.noiseBrown = makeNoiseBuffer(ctx, 6, true);
    this.startAmbient();
    this.startServo();
    this.ready = true;
    if (ctx.state === 'suspended') await ctx.resume();
  }

  startAmbient() {
    const ctx = this.ctx;
    const ambient = ctx.createGain();
    ambient.gain.value = 0.0001;
    ambient.connect(this.master);
    this.ambientGain = ambient;

    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBrown;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 240;
    windFilter.Q.value = 0.7;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.16;
    wind.connect(windFilter).connect(windGain).connect(ambient);
    wind.start();

    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 41;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.055;
    drone.connect(droneGain).connect(ambient);
    drone.start();

    const drone2 = ctx.createOscillator();
    drone2.type = 'triangle';
    drone2.frequency.value = 61.5;
    const drone2Gain = ctx.createGain();
    drone2Gain.gain.value = 0.018;
    drone2.connect(drone2Gain).connect(ambient);
    drone2.start();

    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 118;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.006;
    hum.connect(humGain).connect(ambient);
    hum.start();

    ambient.gain.setTargetAtTime(1, ctx.currentTime, 1.4);
  }

  startServo() {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 260;
    filter.Q.value = 2.4;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 43;
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 87;
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.18;
    osc.connect(filter);
    osc2.connect(osc2Gain).connect(filter);
    filter.connect(gain);
    if (pan) {
      gain.connect(pan).connect(this.master);
      this.servoPan = pan;
    } else {
      gain.connect(this.master);
    }
    osc.start();
    osc2.start();
    this.servoGain = gain;
    this.servoFilter = filter;
    this.servoOsc = osc;
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('oxido-muted', muted ? '1' : '0');
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.58, this.ctx.currentTime, 0.05);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setPaused(paused) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (this.ambientGain) this.ambientGain.gain.setTargetAtTime(paused ? 0.34 : 1, t, 0.18);
    if (this.servoGain) this.servoGain.gain.setTargetAtTime(0.0001, t, 0.12);
  }

  update(dt, game) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (!game || game.mode !== 'playing') {
      if (this.servoGain) this.servoGain.gain.setTargetAtTime(0.0001, t, 0.12);
      return;
    }
    const robot = game.robot;
    const dist = Math.hypot(robot.x - game.player.x, robot.y - game.player.y);
    const rel = Math.atan2(robot.y - game.player.y, robot.x - game.player.x) - game.player.angle;
    const pan = clamp(Math.sin(rel), -0.92, 0.92);
    if (this.servoPan) this.servoPan.pan.setTargetAtTime(pan, t, 0.08);
    const active = robot.state === 'hunt' ? 1 : robot.state === 'search' ? 0.58 : 0.32;
    const volume = clamp((1 - dist / 16) * 0.065 * active, 0.0001, 0.075);
    this.servoGain.gain.setTargetAtTime(volume, t, 0.12);
    if (this.servoFilter) this.servoFilter.frequency.setTargetAtTime(robot.state === 'hunt' ? 390 : 220, t, 0.2);
    if (this.servoOsc) this.servoOsc.frequency.setTargetAtTime(robot.state === 'hunt' ? 51 : 41, t, 0.2);

    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 7 + Math.random() * 13;
      if (Math.random() < 0.62) this.creak();
      else this.distantClang();
    }
  }

  footstep(sprint = false) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.stepFlip = !this.stepFlip;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.playbackRate.value = 0.8 + Math.random() * 0.3;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = sprint ? 620 : 420;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(sprint ? 0.17 : 0.1, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (sprint ? 0.12 : 0.16));
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) {
      pan.pan.value = this.stepFlip ? -0.12 : 0.12;
      source.connect(filter).connect(gain).connect(pan).connect(this.master);
    } else {
      source.connect(filter).connect(gain).connect(this.master);
    }
    source.start(t);
    source.stop(t + 0.2);

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(sprint ? 72 : 62, t);
    thump.frequency.exponentialRampToValueAtTime(35, t + 0.08);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.exponentialRampToValueAtTime(sprint ? 0.09 : 0.06, t + 0.01);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    thump.connect(tg).connect(this.master);
    thump.start(t);
    thump.stop(t + 0.14);
  }

  robotStep(distance, pan, intensity = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const vol = clamp((1 - distance / 14) * 0.19 * intensity, 0, 0.2);
    if (vol < 0.004) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.playbackRate.value = 0.55 + Math.random() * 0.2;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 850;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = clamp(pan, -0.95, 0.95);
      source.connect(filter).connect(gain).connect(panner).connect(this.master);
    } else {
      source.connect(filter).connect(gain).connect(this.master);
    }
    source.start(t);
    source.stop(t + 0.32);

    const clank = ctx.createOscillator();
    clank.type = 'triangle';
    clank.frequency.setValueAtTime(138 + Math.random() * 24, t);
    clank.frequency.exponentialRampToValueAtTime(72, t + 0.15);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, t);
    cg.gain.exponentialRampToValueAtTime(vol * 0.42, t + 0.008);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    clank.connect(cg).connect(this.master);
    clank.start(t);
    clank.stop(t + 0.22);
  }

  heartbeat(intensity = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const beat = (offset, strength) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, t + offset);
      osc.frequency.exponentialRampToValueAtTime(28, t + offset + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + offset);
      g.gain.exponentialRampToValueAtTime(0.15 * strength * intensity, t + offset + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.17);
      osc.connect(g).connect(this.master);
      osc.start(t + offset);
      osc.stop(t + offset + 0.2);
    };
    beat(0, 1);
    beat(0.2, 0.65);
  }

  ping(pan = 0, strength = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, t);
    osc.frequency.exponentialRampToValueAtTime(980, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.032 * strength, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = clamp(pan, -1, 1);
      osc.connect(g).connect(panner).connect(this.master);
    } else {
      osc.connect(g).connect(this.master);
    }
    osc.start(t);
    osc.stop(t + 0.2);
  }

  pickup(index = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 3 ? 'sine' : 'triangle';
      osc.frequency.value = notes[i] * (1 + index * 0.015);
      const g = ctx.createGain();
      const start = t + i * 0.07;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.09, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
      osc.connect(g).connect(this.master);
      osc.start(start);
      osc.stop(start + 0.45);
    }
  }

  unlock() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [110, 164.81, 220, 329.63].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 3 ? 'sine' : 'sawtooth';
      osc.frequency.value = freq;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.045, t + i * 0.05 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 1.4);
      osc.connect(filter).connect(g).connect(this.master);
      osc.start(t + i * 0.05);
      osc.stop(t + i * 0.05 + 1.5);
    });
    this.distantClang(0.16);
  }

  creak() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const base = 62 + Math.random() * 55;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.linearRampToValueAtTime(base * (0.55 + Math.random() * 0.3), t + 0.8);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 360 + Math.random() * 280;
    filter.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.028, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.6;
      osc.connect(filter).connect(g).connect(panner).connect(this.master);
    } else {
      osc.connect(filter).connect(g).connect(this.master);
    }
    osc.start(t);
    osc.stop(t + 1.3);
  }

  alert() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(820, t + 0.16);
    osc.frequency.exponentialRampToValueAtTime(96, t + 0.7);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 2.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.075, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    osc.connect(filter).connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.85);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noise;
    noise.playbackRate.value = 1.4;
    const nf = ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 1300;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.035, t + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    noise.connect(nf).connect(ng).connect(this.master);
    noise.start(t);
    noise.stop(t + 0.4);
  }

  distantClang(volume = 0.09) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.playbackRate.value = 0.4 + Math.random() * 0.2;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 620 + Math.random() * 500;
    filter.Q.value = 7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.7;
      source.connect(filter).connect(g).connect(panner).connect(this.master);
    } else {
      source.connect(filter).connect(g).connect(this.master);
    }
    source.start(t);
    source.stop(t + 1);
  }

  jumpscare() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.setPaused(false);
    if (this.master) this.master.gain.setValueAtTime(this.muted ? 0 : 0.72, t);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noise;
    noise.playbackRate.value = 0.55;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.setValueAtTime(900, t);
    nf.frequency.exponentialRampToValueAtTime(180, t + 1.3);
    nf.Q.value = 0.9;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    noise.connect(nf).connect(ng).connect(this.master);
    noise.start(t);
    noise.stop(t + 1.6);

    const scream = ctx.createOscillator();
    scream.type = 'sawtooth';
    scream.frequency.setValueAtTime(920, t);
    scream.frequency.exponentialRampToValueAtTime(180, t + 0.9);
    const vibrato = ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.value = 22;
    const vibGain = ctx.createGain();
    vibGain.gain.value = 70;
    vibrato.connect(vibGain).connect(scream.frequency);
    const sf = ctx.createBiquadFilter();
    sf.type = 'lowpass';
    sf.frequency.value = 2400;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    scream.connect(sf).connect(sg).connect(this.master);
    scream.start(t);
    vibrato.start(t);
    scream.stop(t + 1.2);
    vibrato.stop(t + 1.2);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(90, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 1.2);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0.0001, t);
    subG.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
    subG.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    sub.connect(subG).connect(this.master);
    sub.start(t);
    sub.stop(t + 1.5);

    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.58, t + 1.8, 0.3);
  }

  win() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [130.81, 196, 261.63, 329.63, 392].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const start = t + i * 0.11;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.055, start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 2.1);
      osc.connect(g).connect(this.master);
      osc.start(start);
      osc.stop(start + 2.2);
    });
    this.distantClang(0.13);
  }

  click() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.018, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  deny() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [190, 140].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.025, t + i * 0.09 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.12);
      osc.connect(g).connect(this.master);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.14);
    });
  }
}
