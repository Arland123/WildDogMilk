/**
 * 平台适配层：抖音小游戏用 tt.*，浏览器环境自动回退（供 debug.html 本地预览）。
 * 只暴露游戏需要的 5 件事：画布 / 图片 / 存储 / 音效 / 触摸。
 */
var MG = MG || {};
(function () {
  var isTT = typeof tt !== 'undefined' && typeof tt.getSystemInfoSync === 'function';
  var sys = isTT
    ? tt.getSystemInfoSync()
    : { windowWidth: window.innerWidth, windowHeight: window.innerHeight, pixelRatio: window.devicePixelRatio || 1 };

  var dpr = Math.min(sys.pixelRatio || 1, 3);
  var cssW = sys.windowWidth;
  var cssH = sys.windowHeight;

  // 抖音：第一个 createCanvas() 上屏；浏览器：用 debug.html 里的 canvas
  var canvas = isTT ? tt.createCanvas() : document.getElementById('game');
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  var ctx = canvas.getContext('2d');

  // ===== 图片 =====
  function createImage(src) {
    var img = isTT ? tt.createImage() : new Image();
    img.src = src;
    return img;
  }

  // ===== 存储（抖音/微信的签名有 key,data 与 {key,data} 两种，两种都试） =====
  var store = {
    get: function (key) {
      try {
        if (!isTT) return localStorage.getItem(key);
        var v = tt.getStorageSync(key);
        return (v && typeof v === 'object' && 'data' in v) ? v.data : v;
      } catch (e) { return null; }
    },
    getNum: function (key) {
      var v = store.get(key);
      var n = Number(v);
      return isFinite(n) ? n : 0;
    },
    set: function (key, val) {
      try {
        if (!isTT) { localStorage.setItem(key, String(val)); return; }
        try { tt.setStorageSync(key, val); }
        catch (e) { tt.setStorageSync({ key: key, data: val }); }
      } catch (e) {}
    },
  };

  // ===== 音效：小游戏没有 WebAudio，用 gif/wav 文件 =====
  var pool = {};
  var soundOn = true;
  function play(name) {
    if (!soundOn) return;
    try {
      if (isTT) {
        var a = pool[name];
        if (!a) {
          a = tt.createInnerAudioContext();
          a.src = 'assets/sfx/' + name + '.wav';
          a.volume = 0.6;
          pool[name] = a;
        }
        try { a.stop(); } catch (e) {}
        a.play();
      } else {
        var el = new Audio('assets/sfx/' + name + '.wav');
        el.volume = 0.4;
        el.play().catch(function () {});
      }
    } catch (e) {}
  }

  // ===== 触摸 =====
  function pointOf(e) {
    var t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
    return {
      x: t.clientX !== undefined ? t.clientX : t.pageX,
      y: t.clientY !== undefined ? t.clientY : t.pageY,
    };
  }
  function bindTouch(h) {
    if (isTT) {
      tt.onTouchStart(function (e) { h.start(pointOf(e)); });
      tt.onTouchMove(function (e) { h.move(pointOf(e)); });
      tt.onTouchEnd(function (e) { h.end(pointOf(e)); });
      if (tt.onTouchCancel) tt.onTouchCancel(function (e) { h.cancel && h.cancel(pointOf(e)); });
    } else {
      canvas.addEventListener('pointerdown', function (e) { h.start(pointOf(e)); });
      canvas.addEventListener('pointermove', function (e) { h.move(pointOf(e)); });
      canvas.addEventListener('pointerup', function (e) { h.end(pointOf(e)); });
      canvas.addEventListener('pointercancel', function () { h.cancel && h.cancel({ x: 0, y: 0 }); });
    }
  }

  // ===== 侧边栏复访（必接能力）=====
  var SIDEBAR_SCENES = ['021036', '101036', '181036', '261036'];
  function launchScene() {
    try { return isTT && tt.getLaunchOptionsSync ? String(tt.getLaunchOptionsSync().scene || '') : ''; }
    catch (e) { return ''; }
  }
  function fromSidebar() { return SIDEBAR_SCENES.indexOf(launchScene()) >= 0; }
  function gotoSidebar(done) {
    var cb = function () { if (done) done(); };
    try {
      if (isTT && tt.navigateToScene) tt.navigateToScene({ scene: 'sidebar', success: cb, fail: cb });
      else cb();
    } catch (e) { cb(); }
  }

  MG.platform = {
    isTT: isTT,
    cssW: cssW, cssH: cssH, dpr: dpr,
    canvas: canvas, ctx: ctx,
    createImage: createImage,
    store: store,
    audio: {
      play: play,
      isOn: function () { return soundOn; },
      setOn: function (v) { soundOn = !!v; },
    },
    bindTouch: bindTouch,
    sidebar: {
      fromSidebar: fromSidebar,
      fromScene: function (sc) { return SIDEBAR_SCENES.indexOf(String(sc)) >= 0; },
      goto: gotoSidebar,
      scene: launchScene,
    },
  };
})();
