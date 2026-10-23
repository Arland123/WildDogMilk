/**
 * 提示模式（彩蛋）：只有玩家自己合成出第 11 级「野生奶·终极进化版」后才解锁，解锁后永久记住。
 *
 * 设计约束：
 *   - 只读游戏已有的全局状态（world / score / curLv ...），不改游戏规则；
 *   - 求解在 Web Worker 里跑，主线程不掉帧；没有 Worker 环境时退化为「不可用」；
 *   - 每次投放/重开/切难度后旧结果立即失效，绝不展示过期提示。
 *
 * 对外钩子（index.html 调用）：
 *   window.__hintUnlock()      —— 合成出最高级时调用
 *   window.__hintInvalidate()  —— 局面变化时调用
 *   window.__hintDraw(ctx)     —— 在棋盘坐标系内绘制提示
 */
(function () {
  'use strict';

  var HKEY = (typeof SCOPE === 'string' ? SCOPE : '') + 'wildDogMilkHint';

  var unlocked = false;
  try { unlocked = localStorage.getItem(HKEY) === '1'; } catch (e) {}

  var worker = null;
  var pendingId = 0;
  var pending = false;
  var result = null;      // { x, nextX, totalGain, risk, elapsed }
  var btn = null;

  function cartons() {
    return Matter.Composite.allBodies(world).filter(function (b) { return b.lv !== undefined; });
  }

  // 把当前局面转成求解器要的快照（与 physics.js 的 snapshot() 同构）
  function buildSnapshot() {
    var all = Matter.Composite.allBodies(world);
    var ids = {};
    all.forEach(function (b) { ids[b.id] = true; });
    function vertexRef(v) { return v ? { id: v.body.id, index: v.index } : null; }

    var pairs = engine.pairs.list.filter(function (p) { return ids[p.bodyA.id] && ids[p.bodyB.id]; })
      .map(function (p) {
        return {
          a: p.bodyA.id, b: p.bodyB.id,
          separation: p.separation, isActive: p.isActive,
          timeCreated: p.timeCreated, timeUpdated: p.timeUpdated, contactCount: p.contactCount,
          collision: {
            collided: p.collision.collided, depth: p.collision.depth,
            normal: { x: p.collision.normal.x, y: p.collision.normal.y },
            tangent: { x: p.collision.tangent.x, y: p.collision.tangent.y },
            penetration: { x: p.collision.penetration.x, y: p.collision.penetration.y },
            supports: (p.collision.supports || []).map(vertexRef), supportCount: p.collision.supportCount,
          },
          contacts: (p.contacts || []).map(function (c) {
            return { vertex: vertexRef(c.vertex), normalImpulse: c.normalImpulse, tangentImpulse: c.tangentImpulse };
          }),
        };
      });

    var bodies = cartons().map(function (b, i) {
      return {
        id: b.id, gameId: i,
        lv: b.lv, k: b.k, born: b.born,
        x: b.position.x, y: b.position.y, angle: b.angle,
        vx: b.velocity.x, vy: b.velocity.y, av: b.angularVelocity,
        px: b.positionPrev.x, py: b.positionPrev.y, pa: b.anglePrev,
        ix: b.positionImpulse.x, iy: b.positionImpulse.y, deltaTime: b.deltaTime,
        vertices: b.vertices.map(function (v) { return { x: v.x, y: v.y }; }),
        dynamics: {
          axes: b.axes.map(function (a) { return { x: a.x, y: a.y }; }),
          bounds: { min: { x: b.bounds.min.x, y: b.bounds.min.y }, max: { x: b.bounds.max.x, y: b.bounds.max.y } },
          area: b.area, mass: b.mass, inverseMass: b.inverseMass,
          inertia: b.inertia, inverseInertia: b.inverseInertia,
          speed: b.speed, angularSpeed: b.angularSpeed, motion: b.motion,
          sleepCounter: b.sleepCounter, totalContacts: b.totalContacts,
          force: { x: b.force.x, y: b.force.y }, torque: b.torque,
          constraintImpulse: { x: b.constraintImpulse.x, y: b.constraintImpulse.y },
        },
      };
    });

    return {
      time: time, score: score, maxLv: maxLv, dangerT: dangerT, over: over,
      serial: bodies.length, merges: (typeof mergeCount === 'number' ? mergeCount : 0),
      timing: { timestamp: engine.timing.timestamp, lastDelta: engine.timing.lastDelta },
      pairs: pairs,
      bodies: bodies,
    };
  }

  function ensureWorker() {
    if (worker || typeof Worker !== 'function') return worker;
    try {
      worker = new Worker('js/hint/worker.js');
      worker.onmessage = function (e) {
        var d = e.data || {};
        if (d.id !== pendingId) return;   // 过期结果直接丢弃
        pending = false;
        if (d.ok) {
          result = d.ans;
          if (btn) btn.textContent = d.ans.totalGain > 0 ? '提示 +' + d.ans.totalGain : '提示';
        } else {
          result = null;
          if (btn) btn.textContent = '提示';
          console.warn('[提示] 计算失败：', d.error);
        }
      };
      worker.onerror = function (err) {
        worker = null; pending = false; result = null;
        if (btn) btn.textContent = '提示';
        console.warn('[提示] Worker 不可用：', err && err.message);
      };
    } catch (e) {
      worker = null;
    }
    return worker;
  }

  function requestHint() {
    if (!unlocked || over || pending) return;
    var w = ensureWorker();
    if (!w) { if (btn) btn.textContent = '提示不可用'; return; }
    if (!cartons().length) { if (btn) btn.textContent = '先投一盒'; return; }
    pendingId += 1;
    pending = true;
    result = null;
    if (btn) btn.textContent = '算中…';
    w.postMessage({
      id: pendingId, H: H, mode: 'balanced',
      snapshot: buildSnapshot(), lv: curLv, nextLv: nextLv,
    });
  }

  function invalidate() {
    pendingId += 1;          // 让在途结果作废
    pending = false;
    result = null;
    if (btn) btn.textContent = '提示';
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try { localStorage.setItem(HKEY, '1'); } catch (e) {}
    if (btn) btn.hidden = false;
    popups.push({ x: W / 2, y: H * 0.30, text: '彩蛋解锁 · 提示模式', life: 3, big: true });
    popups.push({ x: W / 2, y: H * 0.30 + 36, text: '点上方「提示」看推荐落点', life: 3 });
    tone(760, .18, 'sine', .22, .1);
    setTimeout(function () { tone(1140, .22, 'sine', .2, .1); }, 130);
  }

  // 在棋盘坐标系内绘制（由 render() 调用）
  function draw(g) {
    if (!unlocked || !result || over || pending) return;
    var x = result.x;
    if (typeof x !== 'number') return;

    g.save();
    // 推荐落点：绿色虚线 + 箭头
    g.setLineDash([10, 9]);
    g.lineWidth = 2.5;
    g.strokeStyle = 'rgba(22,163,74,.75)';
    g.beginPath(); g.moveTo(x, C_DEAD() - 34); g.lineTo(x, H); g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(22,163,74,.9)';
    g.beginPath();
    g.moveTo(x, C_DEAD() - 34);
    g.lineTo(x - 7, C_DEAD() - 46);
    g.lineTo(x + 7, C_DEAD() - 46);
    g.closePath();
    g.fill();

    // 下一盒的预估位置：蓝色更淡的线
    if (typeof result.nextX === 'number') {
      g.setLineDash([6, 10]);
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(37,99,235,.45)';
      g.beginPath(); g.moveTo(result.nextX, C_DEAD() - 54); g.lineTo(result.nextX, H); g.stroke();
    }
    g.restore();
  }

  function C_DEAD() { return DEAD_Y; }

  function install() {
    btn = document.getElementById('hintBtn');
    if (!btn) return;
    btn.hidden = !unlocked;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      requestHint();
    });
    if (unlocked) btn.textContent = '提示';
  }

  window.__hintUnlock = unlock;
  window.__hintInvalidate = invalidate;
  window.__hintDraw = draw;
  window.__hintRequest = requestHint;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
