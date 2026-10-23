/**
 * 入口逻辑：布局、资源加载、触摸命中、主循环、难度/福利的状态机。
 */
var MG = MG || {};
(function () {
  var C = MG.C;
  var P = MG.platform;
  var S = MG.core.S;

  var L = { cw: P.cssW, ch: P.cssH, head: 96, boardX: 0, boardY: 0, boardW: 0, boardH: 0, chainY: 0, chainH: 0 };
  var ui = { overlay: 'none', target: 'easy', giftClaimed: false, giftReady: true };

  // ===== 资源 =====
  MG.images = [];
  for (var i = 0; i < C.LEVELS.length; i++) {
    MG.images.push(P.createImage('assets/img/' + (i + 1) + '.png'));
  }

  // ===== 存档 =====
  function bestKey(m) { return C.KEYS.best + m; }
  function loadBest(m) { return P.store.getNum(bestKey(m)); }
  var mode = P.store.get(C.KEYS.mode) === 'easy' ? 'easy' : 'hard';
  var soundOn = P.store.get(C.KEYS.sound) !== '0';

  // 老版本单一最高分（那时只有困难模式）迁移一次
  (function migrate() {
    var legacy = P.store.getNum(C.KEYS.legacyBest);
    if (legacy > 0 && P.store.get(bestKey('hard')) === null) {
      P.store.set(bestKey('hard'), legacy);
    }
    P.store.set(C.KEYS.legacyBest, '');
  })();

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function claimedToday() { return P.store.get(C.KEYS.gift) === today(); }

  // ===== 钩子 =====
  P.audio.setOn(soundOn);
  MG.core.setMode(mode, loadBest(mode));
  S.revive = P.store.getNum(C.KEYS.revive) >= 1 ? 1 : 0;
  S.hooks.sound = function (n) { P.audio.play(n); };
  S.hooks.saveBest = function (v) { P.store.set(bestKey(S.mode), v); };
  S.hooks.onOver = function () { ui.overlay = 'over'; };

  // ===== 布局 =====
  function layout() {
    var cw = P.cssW, ch = P.cssH;
    var head = Math.round(Math.min(104, Math.max(86, ch * 0.12)));
    var chainRatio = C.LEVELS[C.LAST].h / C.SUM_W;
    var availH = ch - head - 16;
    var boardW = Math.floor(Math.min(cw - 10, availH / (S.H / C.W + chainRatio)));
    boardW = Math.max(200, boardW);
    var boardH = Math.round(boardW * S.H / C.W);
    L.cw = cw; L.ch = ch; L.head = head;
    L.boardW = boardW; L.boardH = boardH;
    L.boardX = Math.round((cw - boardW) / 2);
    L.boardY = head;
    L.chainH = Math.round(C.LEVELS[C.LAST].h * ((boardW - C.GAP * C.LAST - 6) / C.SUM_W)) + 8;
    L.chainY = Math.min(ch - L.chainH - 4, L.boardY + boardH + 6);
  }

  // ===== 交互 =====
  function toWorldX(cssX) { return (cssX - L.boardX) / L.boardW * C.W; }
  function inBoard(p) {
    return p.x >= L.boardX - 4 && p.x <= L.boardX + L.boardW + 4 &&
      p.y >= L.boardY - 4 && p.y <= L.chainY + L.chainH + 4;
  }
  function hitAt(p) {
    var hs = MG.render.hits;
    for (var i = hs.length - 1; i >= 0; i--) {
      var h = hs[i];
      if (p.x >= h.x - 3 && p.x <= h.x + h.w + 3 && p.y >= h.y - 3 && p.y <= h.y + h.h + 3) return h.id;
    }
    return null;
  }

  var press = null, dragging = false;

  function handleButton(id) {
    if (id === 'sound') {
      soundOn = !soundOn;
      P.audio.setOn(soundOn);
      P.store.set(C.KEYS.sound, soundOn ? '1' : '0');
      return;
    }
    if (id === 'reset' || id === 'again') { ui.overlay = 'none'; MG.core.reset(); return; }
    if (id === 'mode' || id === 'askMode') {
      ui.target = S.mode === 'hard' ? 'easy' : 'hard';
      ui.overlay = 'ask';
      return;
    }
    if (id === 'askOk') { applyMode(ui.target); return; }
    if (id === 'askCancel') { ui.overlay = 'none'; return; }
    if (id === 'revive') {
      if (S.revive > 0) {
        S.revive -= 1;
        P.store.set(C.KEYS.revive, S.revive);
        MG.core.revive();      // 清掉越过第 2 条虚线的奶盒，继续这一局
        ui.overlay = 'none';
      }
      return;
    }
    if (id === 'gift') { ui.giftClaimed = claimedToday(); ui.overlay = 'gift'; return; }
    if (id === 'giftGo') { P.sidebar.goto(); return; }
    if (id === 'giftClose') { ui.overlay = 'none'; return; }
  }

  function applyMode(next) {
    if (C.MODES[next] && next !== S.mode) {
      mode = next;
      P.store.set(C.KEYS.mode, mode);
      MG.core.setMode(mode, loadBest(mode));
    }
    layout();
    MG.core.reset();
    ui.overlay = 'none';
    claimSidebarReward();
  }

  // 侧边栏复访：每日首次从侧边栏进入 → 获得 1 次复活机会（最多存 1 次）
  function claimSidebarReward() {
    if (claimedToday()) { ui.giftReady = false; return; }
    if (!P.sidebar.fromSidebar()) { ui.giftReady = true; return; }
    P.store.set(C.KEYS.gift, today());
    ui.giftReady = false;
    if (S.revive < 1) {
      S.revive = 1;
      P.store.set(C.KEYS.revive, 1);
      S.popups.push({ x: C.W / 2, y: S.H * 0.32, text: '获得 1 次复活', life: 2.2, big: true });
      P.audio.play('merge');
    }
  }

  P.bindTouch({
    start: function (p) {
      press = { x: p.x, y: p.y, id: hitAt(p) };
      dragging = false;
      if (!press.id && ui.overlay === 'none' && inBoard(p)) {
        dragging = true;
        S.aimX = toWorldX(p.x);
      }
    },
    move: function (p) {
      if (dragging) S.aimX = toWorldX(p.x);
    },
    end: function (p) {
      var id = hitAt(p);
      if (press && press.id && id === press.id) {
        handleButton(id);
      } else if (dragging) {
        S.aimX = toWorldX(p.x);
        MG.core.drop();
      }
      press = null;
      dragging = false;
    },
    cancel: function () { press = null; dragging = false; },
  });

  // 从侧边栏切回来时补发奖励
  if (P.isTT && typeof tt.onShow === 'function') {
    tt.onShow(function (res) {
      if (P.sidebar.fromScene && P.sidebar.fromScene(res && res.scene)) {
        claimSidebarReward();
        layout();
      }
    });
  }

  // ===== 主循环 =====
  var STEP = 1000 / 60, last = 0, acc = 0;
  var raf = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : function (cb) { setTimeout(function () { cb(Date.now()); }, 16); };

  function frame(ts) {
    var now = ts || Date.now();
    var dt = Math.min(100, now - (last || now));
    last = now;
    acc += dt;
    var n = 0;
    while (acc >= STEP && n++ < 6) { MG.core.update(STEP / 1000); acc -= STEP; }
    if (n >= 6) acc = 0;
    MG.render.draw(L, ui);
    raf(frame);
  }

  layout();
  MG.core.reset();
  claimSidebarReward();
  raf(frame);

  MG.main = { L: L, ui: ui, layout: layout, applyMode: applyMode };
})();
