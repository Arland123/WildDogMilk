/**
 * 游戏核心逻辑：物理世界、投放、合成、越线判定。纯逻辑，不碰画布。
 * 与 H5 版（index.html）的规则逐行对齐，只是把 DOM／音效／存储换成了钩子。
 */
var MG = MG || {};
(function () {
  var C = MG.C;
  var Matter = (typeof window !== 'undefined' && window.Matter) ? window.Matter : require('./matter.min.js');
  var Engine = Matter.Engine;
  var Bodies = Matter.Bodies;
  var Body = Matter.Body;
  var Composite = Matter.Composite;
  var Events = Matter.Events;

  var engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
  engine.gravity.y = 1.6;
  var world = engine.world;

  var S = {
    mode: 'hard',
    H: C.MODES.hard.h,
    score: 0, best: 0, maxLv: 0,
    curLv: 0, nextLv: 0, aimX: C.W / 2,
    dropCd: 0, dangerT: 0, shake: 0, over: false, time: 0,
    revive: 0, // 复活次数（侧边栏福利发放）
    particles: [], popups: [], mergeQueue: [], walls: [],
    hooks: { sound: null, onOver: null, saveBest: null },
  };

  var WALL = 200;

  function buildWalls() {
    var H = S.H, W = C.W;
    return [
      Bodies.rectangle(W / 2, H + WALL / 2, W + WALL * 2, WALL, { isStatic: true, friction: .6 }),
      Bodies.rectangle(-WALL / 2, H / 2 - 400, WALL, H + 800, { isStatic: true, friction: .1 }),
      Bodies.rectangle(W + WALL / 2, H / 2 - 400, WALL, H + 800, { isStatic: true, friction: .1 }),
    ];
  }

  function sound(name) { if (S.hooks.sound) S.hooks.sound(name); }
  function cartons() {
    return Composite.allBodies(world).filter(function (b) { return b.lv !== undefined; });
  }

  function randLv() {
    var weights = C.SPAWN_WEIGHTS;
    var cap = Math.min(weights.length, Math.max(3, S.maxLv));
    var total = 0, i;
    for (i = 0; i < cap; i++) total += weights[i];
    var r = Math.random() * total;
    for (i = 0; i < cap; i++) { r -= weights[i]; if (r < 0) return i; }
    return 0;
  }

  function spawnY(lv) { return C.DEAD_Y - 6 - C.LEVELS[lv].h / 2; }

  function clampAim(lv) {
    var half = C.LEVELS[lv].w / 2 + 1;
    return Math.min(C.W - half, Math.max(half, S.aimX));
  }

  function makeCarton(lv, x, y, angle, k) {
    var L = C.LEVELS[lv];
    var b = Bodies.rectangle(x, y, L.w * (k || 1), L.h * (k || 1), {
      angle: angle || 0,
      chamfer: { radius: L.round * (k || 1) },
      friction: .25, frictionStatic: .5, frictionAir: .004, restitution: .12, density: .0012,
    });
    b.lv = lv; b.k = k || 1; b.born = S.time; b.gone = false;
    Composite.add(world, b);
    return b;
  }

  function reset() {
    Composite.clear(world, false);
    S.walls = buildWalls();
    Composite.add(world, S.walls);
    S.particles.length = 0;
    S.popups.length = 0;
    S.mergeQueue.length = 0;
    S.score = 0; S.maxLv = 0; S.dangerT = 0; S.dropCd = 0; S.shake = 0; S.over = false;
    S.curLv = randLv(); S.nextLv = randLv();
    S.aimX = C.W / 2;
  }

  function setMode(key, best) {
    S.mode = C.MODES[key] ? key : 'hard';
    S.H = C.MODES[S.mode].h;
    S.best = best || 0;
  }

  function drop() {
    if (S.over || S.dropCd > 0) return false;
    var b = makeCarton(S.curLv, clampAim(S.curLv), spawnY(S.curLv));
    Body.setVelocity(b, { x: 0, y: 2 });
    sound('drop');
    S.curLv = S.nextLv;
    S.nextLv = randLv();
    S.dropCd = .5;
    return true;
  }

  function addScore(n, x, y) {
    S.score += n;
    S.popups.push({ x: x, y: y, text: '+' + n, life: 1 });
    if (S.score > S.best) {
      S.best = S.score;
      if (S.hooks.saveBest) S.hooks.saveBest(S.best);
    }
  }

  function burst(x, y, color, n, speed) {
    for (var k = 0; k < n; k++) {
      var a = Math.random() * Math.PI * 2;
      var v = speed * (.4 + Math.random() * .6);
      S.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * .3,
        r: 2 + Math.random() * 3.5, life: 1, decay: 1.2 + Math.random(),
        color: Math.random() < .6 ? '#fffdf5' : color,
      });
    }
  }

  function onCollide(e) {
    if (S.over) return;
    var pairs = e.pairs;
    for (var i = 0; i < pairs.length; i++) {
      var a = pairs[i].bodyA, b = pairs[i].bodyB;
      if (a.lv === undefined || a.lv !== b.lv || a.gone || b.gone) continue;
      a.gone = true; b.gone = true;
      S.mergeQueue.push([a, b]);
    }
  }

  function merge(a, b) {
    Composite.remove(world, [a, b]);
    var x = (a.position.x + b.position.x) / 2;
    var y = (a.position.y + b.position.y) / 2;
    if (a.lv === C.LAST) {
      burst(x, y, '#ffd34d', 70, 520);
      S.shake = 14;
      addScore(C.FINAL_BONUS, x, y);
      S.popups.push({ x: C.W / 2, y: S.H * .38, text: '狗奶大爆炸', life: 1.6, big: true });
      sound('big');
      return;
    }
    var lv = a.lv + 1, L = C.LEVELS[lv];
    // 新盒子从 0.5 倍长到原尺寸，避免一出生就把周围炸飞
    var nb = makeCarton(lv, x, y, (a.angle + b.angle) / 2, .5);
    Body.setVelocity(nb, {
      x: (a.velocity.x + b.velocity.x) / 2,
      y: Math.min(0, (a.velocity.y + b.velocity.y) / 2) - 1,
    });
    burst(x, y, L.color, 8 + lv * 2, 160 + lv * 25);
    addScore(C.MERGE_SCORE[lv], x, y - L.h / 2);
    if (lv > S.maxLv) {
      S.maxLv = lv;
      if (lv >= 5) S.popups.push({ x: C.W / 2, y: S.H * .38, text: L.name, life: 1.6, big: true });
    }
    if (lv === C.LAST) { S.shake = 10; sound('big'); } else { S.shake = Math.max(S.shake, lv * .5); sound('merge'); }
  }

  // 复活：清掉「越过自上往下第 2 条虚线」的所有奶盒，然后继续这一局
  function revive() {
    var line = C.REVIVE_LINE;
    var list = cartons();
    var removed = 0;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.bounds.min.y < line) {
        burst(b.position.x, b.position.y, C.LEVELS[b.lv].color, 10, 240);
        Composite.remove(world, b);
        removed++;
      }
    }
    S.over = false;
    S.dangerT = 0;
    S.shake = 10;
    S.popups.push({ x: C.W / 2, y: line - 56, text: '复活！清掉 ' + removed + ' 盒', life: 1.8, big: true });
    sound('big');
    return removed;
  }

  function update(dt) {
    S.time += dt;
    if (S.dropCd > 0) S.dropCd -= dt;

    if (!S.over) {
      Engine.update(engine, 1000 / 60);
      var q = S.mergeQueue;
      S.mergeQueue = [];
      for (var i = 0; i < q.length; i++) merge(q[i][0], q[i][1]);
      var list = cartons();
      for (var j = 0; j < list.length; j++) {
        var b = list[j];
        if (b.k < 1) {
          var k = Math.min(1, b.k + dt / .18);
          Body.scale(b, k / b.k, k / b.k);
          b.k = k;
        }
      }
    }

    var parts = S.particles;
    for (var p = 0; p < parts.length; p++) {
      var q2 = parts[p];
      q2.vy += 900 * dt; q2.x += q2.vx * dt; q2.y += q2.vy * dt; q2.life -= q2.decay * dt;
    }
    S.particles = parts.filter(function (o) { return o.life > 0; });

    var pops = S.popups;
    for (var r = 0; r < pops.length; r++) { pops[r].y -= 40 * dt; pops[r].life -= dt; }
    S.popups = pops.filter(function (o) { return o.life > 0; });

    S.shake = Math.max(0, S.shake - 40 * dt);

    if (S.over) return;
    // 越线：落定的奶盒顶在警戒线上方累计 2 秒
    var danger = cartons().some(function (b2) {
      return S.time - b2.born > 1.2 && b2.bounds.min.y < C.DEAD_Y && b2.speed < 1.5;
    });
    S.dangerT = danger ? S.dangerT + dt : Math.max(0, S.dangerT - dt * 2);
    if (S.dangerT > 2) {
      S.over = true;
      sound('over');
      if (S.hooks.onOver) S.hooks.onOver();
    }
  }

  Events.on(engine, 'collisionStart', onCollide);
  Events.on(engine, 'collisionActive', onCollide);

  MG.core = {
    S: S,
    world: world,
    reset: reset,
    setMode: setMode,
    drop: drop,
    revive: revive,
    update: update,
    cartons: cartons,
    clampAim: clampAim,
    spawnY: spawnY,
  };
})();
