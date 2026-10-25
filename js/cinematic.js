// 狗奶大爆炸过场动画：全屏 canvas 实时渲染，约 5 秒，点击 / 按键可跳过。
// 对外只暴露 window.__playBoomCinematic()，主逻辑在 megaBoom() 里调用；没加载这个文件游戏照常运行。
(function () {
  'use strict';
  const DUR = 5.2;
  const TAU = Math.PI * 2;
  const FONT = '"PingFang SC","Microsoft YaHei",sans-serif';
  const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const seg = (t, a, b) => clamp01((t - a) / (b - a));

  const img = new Image();
  img.src = 'img/11.png';

  let cvs = null, g = null, raf = 0, t0 = 0, t = 0, W = 0, H = 0, dpr = 1;
  let sparks = [], confetti = [], rings = [], motes = [];
  let fired = { crack: false, boom: false, title: false };
  let actx = null, playing = false;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // ---------- 音效（独立 AudioContext，遵循游戏的静音开关） ----------
  function soundEnabled() { try { return typeof soundOn === 'undefined' ? true : soundOn; } catch (e) { return true; } }
  function osc(type, f0, f1, start, dur, vol) {
    const o = actx.createOscillator(), gn = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, start);
    o.frequency.exponentialRampToValueAtTime(f1, start + dur);
    gn.gain.setValueAtTime(.0001, start);
    gn.gain.exponentialRampToValueAtTime(vol, start + Math.min(.05, dur / 3));
    gn.gain.exponentialRampToValueAtTime(.0001, start + dur);
    o.connect(gn).connect(actx.destination);
    o.start(start); o.stop(start + dur + .05);
  }
  function noise(start, dur, vol, f0, f1) {
    const len = Math.floor(actx.sampleRate * dur);
    const buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const s = actx.createBufferSource(), lp = actx.createBiquadFilter(), gn = actx.createGain();
    s.buffer = buf; lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f0, start); lp.frequency.exponentialRampToValueAtTime(f1, start + dur);
    gn.gain.setValueAtTime(vol, start); gn.gain.exponentialRampToValueAtTime(.001, start + dur);
    s.connect(lp).connect(gn).connect(actx.destination); s.start(start);
  }
  function playAudio() {
    if (!soundEnabled()) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const n = actx.currentTime;
      osc('sawtooth', 70, 900, n, 1.45, .12);            // 蓄力上扬
      osc('sine', 55, 440, n + .1, 1.35, .22);
      for (let i = 0; i < 8; i++) osc('square', 1200, 1000, n + .2 + i * .15, .05, .05);  // 滴滴滴
      noise(n + 1.45, 1.8, .9, 4000, 90);                // 爆炸
      osc('sine', 120, 28, n + 1.45, 1.6, .7);           // 低频轰鸣
      osc('sawtooth', 220, 60, n + 1.45, .8, .25);
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => {  // 凯旋琶音
        osc('triangle', f, f * .98, n + 1.9 + i * .1, .9, .16);
        osc('sine', f * 2, f * 2, n + 1.9 + i * .1, .6, .05);
      });
      osc('triangle', 1047, 1047, n + 2.7, 1.6, .12);
      osc('triangle', 1319, 1319, n + 2.7, 1.6, .1);
      osc('triangle', 1568, 1568, n + 2.7, 1.6, .1);
    } catch (e) { /* 静默 */ }
  }

  // ---------- 画布 ----------
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cvs.width = W * dpr; cvs.height = H * dpr;
  }

  function spawnBurst() {
    const cx = W / 2, cy = H * .5, S = Math.max(W, H);
    const cols = ['#ffd34d', '#ff6b4a', '#4ad0ff', '#7cff6b', '#ff7ad9', '#fffdf5'];
    for (let i = 0; i < 220; i++) {
      const a = rand(0, TAU), v = rand(.4, 2.2) * S;
      sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand(1.5, 4), life: 1, decay: rand(.45, 1.1),
        c: Math.random() < .5 ? '#ffe9a0' : '#ffb347', tr: [] });
    }
    for (let i = 0; i < 200; i++) {
      const a = rand(0, TAU), v = rand(.3, 1.5) * S;
      confetti.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - S * .5, r: rand(5, 11), life: 1, decay: rand(.18, .3),
        c: cols[i % cols.length], rot: rand(0, TAU), vr: rand(-16, 16) });
    }
    for (let i = 0; i < 5; i++) rings.push({ r: 20, v: S * (1.6 + i * .25), w: 40 - i * 5, life: 1, delay: i * .1 });
  }

  function frame(now) {
    if (!playing) return;
    t = (now - t0) / 1000;
    if (t >= DUR) return stop();
    const dt = 1 / 60;
    draw(dt);
    raf = requestAnimationFrame(frame);
  }

  function draw(dt) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * .5, S = Math.min(W, H), BIG = Math.max(W, H);
    const charge = seg(t, 0, 1.45), after = t - 1.45;     // 1.45s 为爆炸时刻
    const out = 1 - seg(t, DUR - .7, DUR);

    // 事件触发
    if (!fired.boom && t >= 1.45) { fired.boom = true; spawnBurst(); }

    // 镜头抖动：蓄力渐强，爆炸后衰减
    let sh = t < 1.45 ? charge * charge * 12 : Math.max(0, 40 * Math.exp(-after * 3));
    g.save();
    g.translate(rand(-sh, sh), rand(-sh, sh));

    // 背景：幕布渐黑 → 爆炸后变成金红色放射
    const dark = ease(seg(t, 0, .35)) * .88;
    g.fillStyle = `rgba(8,4,18,${dark * out})`;
    g.fillRect(-60, -60, W + 120, H + 120);
    if (after > 0) {
      const a = Math.min(1, after * 4) * out;
      const bg = g.createRadialGradient(cx, cy, 0, cx, cy, BIG * .75);
      bg.addColorStop(0, `rgba(255,190,60,${.85 * a})`);
      bg.addColorStop(.45, `rgba(255,95,30,${.5 * a})`);
      bg.addColorStop(1, `rgba(60,10,70,${.55 * a})`);
      g.fillStyle = bg; g.fillRect(-60, -60, W + 120, H + 120);
    }

    // 蓄力：粒子向中心汇聚
    if (t < 1.45 && Math.random() < .9) {
      for (let k = 0; k < 3; k++) {
        const a = rand(0, TAU), d = rand(.45, .9) * BIG;
        motes.push({ a, d, life: 1, sp: rand(1.2, 2.2), r: rand(1.5, 3.5) });
      }
    }
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      m.life -= m.sp * dt * 1.1; m.d *= 1 - dt * 3.2 * m.sp;
      const x = cx + Math.cos(m.a) * m.d, y = cy + Math.sin(m.a) * m.d;
      g.globalAlpha = clamp01(m.life) * out;
      g.fillStyle = '#ffe9a0';
      g.beginPath(); g.arc(x, y, m.r, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,220,120,.5)'; g.lineWidth = m.r * .6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(cx + Math.cos(m.a) * m.d * 1.12, cy + Math.sin(m.a) * m.d * 1.12); g.stroke();
    }
    g.restore();
    motes = motes.filter((m) => m.life > 0 && m.d > 12);

    // 旋转光芒
    if (after > 0) {
      const a = Math.min(1, after * 5) * Math.min(1, (DUR - t) / 1.2);
      g.save(); g.globalCompositeOperation = 'lighter';
      g.translate(cx, cy); g.rotate(after * .6);
      const R = BIG * 1.1, N = 20;
      for (let i = 0; i < N; i++) {
        g.rotate(TAU / N);
        const w = (i % 2 ? .035 : .055) * R;
        const lg = g.createLinearGradient(0, 0, R, 0);
        lg.addColorStop(0, `rgba(255,230,140,${.55 * a})`); lg.addColorStop(1, 'rgba(255,200,60,0)');
        g.fillStyle = lg;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(R, -w); g.lineTo(R, w); g.closePath(); g.fill();
      }
      g.restore();
    }

    // 主角：狗奶
    if (img.complete && img.naturalWidth) {
      const ratio = img.naturalWidth / img.naturalHeight;
      let h, extraGlow = 0, y = cy, rot = 0, alpha = 1;
      if (t < 1.45) {
        h = S * (.14 + .32 * ease(seg(t, 0, .9)) + .06 * Math.sin(t * 28) * charge);
        extraGlow = charge;
        rot = Math.sin(t * 40) * .06 * charge;
      } else {
        const pop = seg(after, 0, .35);
        h = S * (.46 + .18 * ease(pop)) * (1 + Math.sin(after * 3) * .015);
        y = cy - S * .02 * Math.sin(after * 2.2);
        extraGlow = 1;
      }
      alpha = out;
      const w = h * ratio;
      // 光晕
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = h * (.9 + extraGlow * .7);
      const rg = g.createRadialGradient(cx, y, 0, cx, y, gr);
      rg.addColorStop(0, `rgba(255,236,160,${(.35 + .55 * extraGlow) * alpha})`);
      rg.addColorStop(1, 'rgba(255,170,40,0)');
      g.fillStyle = rg; g.fillRect(cx - gr, y - gr, gr * 2, gr * 2);
      g.restore();
      g.save();
      g.globalAlpha = alpha;
      g.translate(cx, y); g.rotate(rot);
      g.shadowColor = 'rgba(255,200,60,.9)'; g.shadowBlur = 30 + extraGlow * 40;
      g.drawImage(img, -w / 2, -h / 2, w, h);
      g.shadowBlur = 0;
      // 蓄力末段：裂纹 + 过曝
      if (t > .7 && t < 1.45) {
        const k = seg(t, .7, 1.45);
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(255,255,255,${k * k * .85})`;
        g.fillRect(-w / 2, -h / 2, w, h);
        g.globalCompositeOperation = 'source-over';
        g.strokeStyle = `rgba(255,255,255,${.9 * k})`; g.lineWidth = 2.5;
        const cracks = [[-.1, -.5, .05, -.2, -.15, 0, .08, .3, -.02, .5], [.3, -.4, .12, -.1, .25, .15, .1, .4], [-.35, .1, -.12, .05, -.05, -.1]];
        for (const c of cracks) {
          g.beginPath();
          for (let i = 0; i < c.length; i += 2) {
            const px = c[i] * w, py = c[i + 1] * h * Math.min(1, k * 1.6);
            i ? g.lineTo(px, py) : g.moveTo(px, py);
          }
          g.stroke();
        }
      }
      g.restore();
    }

    // 冲击波环
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const r of rings) {
      if (r.delay > 0) { r.delay -= dt; continue; }
      r.r += r.v * dt; r.v *= 1 - dt * 1.9; r.life -= dt * .85;
      if (r.life <= 0) continue;
      g.globalAlpha = clamp01(r.life);
      g.strokeStyle = '#ffe08a'; g.lineWidth = r.w * r.life + 1;
      g.beginPath(); g.arc(cx, cy, r.r, 0, TAU); g.stroke();
    }
    g.restore();
    rings = rings.filter((r) => r.life > 0);

    // 彩纸
    for (const p of confetti) {
      const k = Math.exp(-1.6 * dt); p.vx *= k; p.vy = p.vy * k + BIG * 1.1 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= p.decay * dt;
      g.save(); g.globalAlpha = clamp01(p.life * 1.5) * out;
      g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.cos(p.rot * 1.6));
      g.fillStyle = p.c; g.fillRect(-p.r, -p.r * .5, p.r * 2, p.r);
      g.restore();
    }
    confetti = confetti.filter((p) => p.life > 0 && p.y < H + 60);

    // 火花（拖尾）
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (const p of sparks) {
      p.vy += BIG * .5 * dt; p.vx *= 1 - dt * .6; p.vy *= 1 - dt * .6;
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
      p.tr.push(p.x, p.y); if (p.tr.length > 14) p.tr.splice(0, 2);
      g.globalAlpha = clamp01(p.life) * out;
      g.strokeStyle = p.c; g.lineWidth = p.r;
      g.beginPath(); g.moveTo(p.tr[0], p.tr[1]);
      for (let i = 2; i < p.tr.length; i += 2) g.lineTo(p.tr[i], p.tr[i + 1]);
      g.stroke();
    }
    g.restore();
    sparks = sparks.filter((p) => p.life > 0);

    // 标题
    if (after > .25) {
      const a2 = after - .25, e = seg(a2, 0, .3);
      const sc = e < 1 ? 3.2 - 2.2 * ease(e) + Math.sin(e * Math.PI) * .2 : 1 + Math.sin(a2 * 5) * .02;
      const fs = Math.min(W * .16, S * .2, 120);
      g.save();
      g.globalAlpha = Math.min(1, e * 2) * out;
      g.translate(cx, H * .2); g.scale(sc, sc);
      g.font = `900 ${fs}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.shadowColor = 'rgba(255,160,20,.95)'; g.shadowBlur = 40;
      g.lineWidth = fs * .2; g.strokeStyle = '#7a2a05'; g.strokeText('狗奶大爆炸', 0, 0);
      g.shadowBlur = 0; g.lineWidth = fs * .09; g.strokeStyle = '#fff'; g.strokeText('狗奶大爆炸', 0, 0);
      const lg = g.createLinearGradient(0, -fs / 2, 0, fs / 2);
      lg.addColorStop(0, '#fff7b0'); lg.addColorStop(.5, '#ffc72c'); lg.addColorStop(1, '#ff7a1a');
      g.fillStyle = lg; g.fillText('狗奶大爆炸', 0, 0);
      g.restore();
    }
    if (after > .9) {
      const e = ease(seg(after, .9, 1.3));
      const fs = Math.min(W * .06, 30);
      g.save();
      g.globalAlpha = e * out;
      g.translate(cx, H * .2 + Math.min(W * .16, S * .2, 120) * .85 + (1 - e) * 20);
      g.font = `900 ${fs}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.lineWidth = fs * .22; g.strokeStyle = '#7a2a05'; g.strokeText('终极进化 · 野生奶 降临', 0, 0);
      g.fillStyle = '#fff3c4'; g.fillText('终极进化 · 野生奶 降临', 0, 0);
      g.restore();
    }

    g.restore(); // 抖动

    // 速度线（爆炸瞬间）
    if (after > 0 && after < .6) {
      g.save(); g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(255,255,255,${.7 * (1 - after / .6)})`; g.lineWidth = 2;
      for (let i = 0; i < 46; i++) {
        const a = rand(0, TAU), r0 = BIG * rand(.15, .4), r1 = r0 + BIG * rand(.2, .5);
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
      }
      g.restore();
    }

    // 全屏白闪：爆炸瞬间 + 蓄力末尾轻微预闪
    let fl = 0;
    if (t > 1.2 && t < 1.45) fl = (t - 1.2) / .25 * .5;
    if (after >= 0) fl = Math.max(fl, Math.exp(-after * 5) * 1.1);
    if (fl > 0) { g.fillStyle = `rgba(255,252,235,${clamp01(fl)})`; g.fillRect(0, 0, W, H); }

    // 暗角
    const vg = g.createRadialGradient(cx, cy, BIG * .3, cx, cy, BIG * .85);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(20,0,30,${.55 * out})`);
    g.fillStyle = vg; g.fillRect(0, 0, W, H);

    // 跳过提示
    if (t > .8 && t < DUR - .8) {
      g.font = `700 13px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillStyle = 'rgba(255,255,255,.55)';
      g.fillText('点击任意处跳过', cx, H - 24 - (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0));
    }
  }

  function stop() {
    playing = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', skip, true);
    window.removeEventListener('resize', resize);
    if (cvs) { cvs.remove(); cvs = null; g = null; }
  }
  function skip(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (t < .4) return;       // 防止触发合成的那一下点击把它直接跳掉
    stop();
  }

  window.__playBoomCinematic = function () {
    if (playing) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    playing = true;
    sparks = []; confetti = []; rings = []; motes = [];
    fired = { crack: false, boom: false, title: false };
    cvs = document.createElement('canvas');
    cvs.setAttribute('aria-hidden', 'true');
    cvs.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:1000;touch-action:none;cursor:pointer';
    document.body.appendChild(cvs);
    g = cvs.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', skip, true);
    cvs.addEventListener('pointerdown', skip);
    t0 = performance.now(); t = 0;
    playAudio();
    raf = requestAnimationFrame(frame);
  };
})();
