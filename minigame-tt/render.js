/**
 * 全部绘制：顶部信息栏、棋盘、合成表、以及三种弹窗。
 * 所有坐标都用 CSS 像素（canvas 已按 dpr 缩放），棋盘内部再切到 400×H 的世界坐标。
 */
var MG = MG || {};
(function () {
  var C = MG.C;
  var P = MG.platform;
  var hits = [];

  function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function font(size, weight) {
    return (weight || 'normal') + ' ' + Math.round(size) + 'px ' + C.FONT;
  }

  function text(g, str, x, y, size, color, weight, align) {
    g.font = font(size, weight);
    g.fillStyle = color;
    g.textAlign = align || 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(str, x, y);
  }

  // 在 (x,y) 画一盒第 i 级奶，k 为缩放
  function drawCarton(g, i, x, y, k, angle, alpha) {
    k = k || 1; angle = angle || 0; alpha = alpha === undefined ? 1 : alpha;
    var L = C.LEVELS[i];
    var w = L.w * k, h = L.h * k, r = L.round * k;
    var img = MG.images[i];
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.rotate(angle);
    g.fillStyle = 'rgba(80,45,10,.22)';
    roundRect(g, -w / 2 + 1.5 * k, -h / 2 + 2.5 * k, w, h, r);
    g.fill();
    if (img && img.width) {
      g.save();
      roundRect(g, -w / 2, -h / 2, w, h, r);
      g.clip();
      g.drawImage(img, -w / 2, -h / 2, w, h);
      g.restore();
    } else {
      g.fillStyle = L.color;
      roundRect(g, -w / 2, -h / 2, w, h, r);
      g.fill();
      g.fillStyle = '#fff';
      g.font = font(Math.min(w * .22, h / L.name.length), 'bold');
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      var chars = L.name.split('');
      for (var n = 0; n < chars.length; n++) {
        g.fillText(chars[n], 0, (n - (chars.length - 1) / 2) * h / (chars.length + 1));
      }
      g.textBaseline = 'alphabetic';
    }
    roundRect(g, -w / 2, -h / 2, w, h, r);
    g.lineWidth = Math.max(1, w * .025);
    g.strokeStyle = 'rgba(60,35,10,.45)';
    g.stroke();
    if (i === C.LAST) {
      g.lineWidth = w * .03;
      g.strokeStyle = '#ffd34d';
      roundRect(g, -w / 2 - g.lineWidth / 2, -h / 2 - g.lineWidth / 2, w + g.lineWidth, h + g.lineWidth, r);
      g.stroke();
    }
    g.restore();
  }

  // 圆角按钮
  function pill(g, id, label, x, y, w, h, opts) {
    opts = opts || {};
    var primary = opts.primary;
    g.fillStyle = 'rgba(120,70,20,.18)';
    roundRect(g, x, y + 3, w, h, h / 2);
    g.fill();
    g.fillStyle = primary ? C.COLOR.accent : '#fff';
    roundRect(g, x, y, w, h, h / 2);
    g.fill();
    text(g, label, x + w / 2, y + h / 2 + h * 0.18, opts.size || 15, primary ? '#fff' : C.COLOR.ghost, 'bold', 'center');
    if (id) hits.push({ id: id, x: x, y: y, w: w, h: h });
  }

  function chip(g, id, label, x, y, hRatio) {
    var pad = 7;
    g.font = font(11, 'bold');
    var w = g.measureText(label).width + pad * 2;
    var h = hRatio || 17;
    g.fillStyle = C.COLOR.chipBg;
    roundRect(g, x, y, w, h, h / 2);
    g.fill();
    text(g, label, x + w / 2, y + h * 0.72, 11, C.COLOR.ghost, 'bold', 'center');
    hits.push({ id: id, x: x, y: y, w: w, h: h });
    return w;
  }

  // ===== 棋盘 =====
  function drawBoard(g, L) {
    var S = MG.core.S;
    var H = S.H, W = C.W;
    g.save();
    roundRect(g, L.boardX, L.boardY, L.boardW, L.boardH, 14);
    g.clip();
    g.translate(L.boardX, L.boardY);
    g.scale(L.boardW / W, L.boardW / W);

    var bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, C.COLOR.cream);
    bg.addColorStop(1, C.COLOR.warm);
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // 货架横线：虚线
    g.save();
    g.setLineDash([12, 10]);
    g.lineWidth = 3;
    g.strokeStyle = C.COLOR.shelf;
    for (var y = C.DEAD_Y + 130; y < H; y += 130) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.restore();
    g.fillStyle = '#d69a55';
    g.fillRect(0, H - 6, W, 6);

    // 警戒线：实线，越线闪红
    g.save();
    g.lineWidth = 2;
    g.strokeStyle = S.dangerT > 0
      ? C.COLOR.dangerHot + (.5 + .5 * Math.sin(S.time * 18)) + ')'
      : C.COLOR.danger;
    g.beginPath(); g.moveTo(0, C.DEAD_Y); g.lineTo(W, C.DEAD_Y); g.stroke();
    g.restore();

    // 瞄准线 + 手上那盒
    if (!S.over) {
      var ax = MG.core.clampAim(S.curLv), ay = MG.core.spawnY(S.curLv);
      g.save();
      g.setLineDash([4, 8]);
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(150,100,50,.25)';
      g.beginPath(); g.moveTo(ax, ay + C.LEVELS[S.curLv].h / 2); g.lineTo(ax, H); g.stroke();
      g.restore();
      drawCarton(g, S.curLv, ax, ay, 1, 0, S.dropCd > 0 ? .45 : 1);
    }

    var list = MG.core.cartons();
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      drawCarton(g, b.lv, b.position.x, b.position.y, b.k, b.angle);
    }

    for (var p = 0; p < S.particles.length; p++) {
      var q = S.particles[p];
      g.globalAlpha = Math.max(0, q.life);
      g.fillStyle = q.color;
      g.beginPath(); g.arc(q.x, q.y, q.r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (var k2 = 0; k2 < S.popups.length; k2++) {
      var pop = S.popups[k2];
      g.globalAlpha = Math.min(1, pop.life * 2);
      g.font = font(pop.big ? 26 : 18, 'bold');
      g.lineWidth = 4;
      g.strokeStyle = '#fff';
      g.strokeText(pop.text, pop.x, pop.y);
      g.fillStyle = pop.big ? C.COLOR.red : C.COLOR.accent;
      g.fillText(pop.text, pop.x, pop.y);
    }
    g.globalAlpha = 1;
    g.textBaseline = 'alphabetic';

    if (!list.length && !S.over) {
      text(g, '移动瞄准，点击 / 松手投放', W / 2, H * .5, 16, 'rgba(90,61,30,.55)', 'bold', 'center');
      text(g, '两盒一样的撞在一起，合成更大的奶', W / 2, H * .5 + 26, 16, 'rgba(90,61,30,.55)', 'bold', 'center');
    }
    g.restore();
  }

  // ===== 顶部信息栏 =====
  function drawHud(g, L, ui) {
    var S = MG.core.S;
    var cw = L.cw, head = L.head;

    text(g, '合成野生狗奶', 12, head * 0.31, 17, C.COLOR.red, 'bold');
    text(g, String(S.score), 12, head * 0.74, 30, C.COLOR.ink, 'bold');

    var bx = 12;
    g.font = font(11, 'normal');
    var bestLabel = '最高 ' + S.best;
    text(g, bestLabel, bx, head * 0.95, 11, 'rgba(90,61,30,.72)');
    bx += g.measureText(bestLabel).width + 7;
    bx += chip(g, 'mode', C.MODES[S.mode].name, bx, head * 0.95 - 13) + 6;
    chip(g, 'gift', S.revive > 0 ? '复活×1' : (ui.giftReady ? '福利·可领' : '福利'), bx, head * 0.95 - 13);

    // 右上：下一个预览
    var pw = 56, ph = 62;
    var px = cw - 12 - pw, py = 8;
    g.fillStyle = 'rgba(255,255,255,.72)';
    roundRect(g, px, py, pw, ph, 10);
    g.fill();
    text(g, '下一个', px + pw / 2, py + 12, 10, 'rgba(90,61,30,.7)', 'normal', 'center');
    // 按当前这一级自身尺寸填满框高（H5 版是按最大可投放级统一缩放，预览里小盒子会小到看不清）
    var cur = C.LEVELS[S.nextLv];
    var kk = Math.min((pw - 14) / cur.w, (ph - 26) / cur.h);
    drawCarton(g, S.nextLv, px + pw / 2, py + 14 + (ph - 22) / 2, kk);

    // 右上两个小按钮
    var bs = 28, gap = 6;
    var b1x = cw - 12 - bs, b2x = b1x - gap - bs, by = py + ph + 6;
    g.fillStyle = '#fff';
    roundRect(g, b1x, by, bs, bs, 8); g.fill();
    roundRect(g, b2x, by, bs, bs, 8); g.fill();
    text(g, P.audio.isOn() ? '音' : '静', b1x + bs / 2, by + bs * 0.68, 13, C.COLOR.ink, 'bold', 'center');
    text(g, '重', b2x + bs / 2, by + bs * 0.68, 13, C.COLOR.ink, 'bold', 'center');
    hits.push({ id: 'sound', x: b1x, y: by, w: bs, h: bs });
    hits.push({ id: 'reset', x: b2x, y: by, w: bs, h: bs });
  }

  // ===== 合成表 =====
  function drawChain(g, L) {
    var S = MG.core.S;
    var k = (L.boardW - C.GAP * (C.LEVELS.length - 1) - 6) / C.SUM_W;
    var x = L.boardX + 3;
    var baseY = L.chainY + L.chainH - 4;
    for (var i = 0; i < C.LEVELS.length; i++) {
      var Lv = C.LEVELS[i];
      drawCarton(g, i, x + Lv.w * k / 2, baseY - Lv.h * k / 2, k, 0, i <= S.maxLv ? 1 : .32);
      x += Lv.w * k + C.GAP;
    }
  }

  // ===== 弹窗 =====
  function card(g, L, h) {
    var w = Math.min(L.boardW * 0.88, 300);
    var x = L.boardX + (L.boardW - w) / 2;
    var y = L.boardY + Math.max(16, (L.boardH - h) * 0.34);
    g.fillStyle = 'rgba(0,0,0,.42)';
    roundRect(g, L.boardX, L.boardY, L.boardW, L.boardH, 14);
    g.fill();
    g.fillStyle = 'rgba(60,30,0,.25)';
    roundRect(g, x, y + 6, w, h, 16);
    g.fill();
    g.fillStyle = C.COLOR.card;
    roundRect(g, x, y, w, h, 16);
    g.fill();
    return { x: x, y: y, w: w, h: h };
  }

  function drawOver(g, L) {
    var S = MG.core.S;
    var hasRevive = S.revive > 0;
    var c = card(g, L, hasRevive ? 262 : 218);
    var cx = c.x + c.w / 2;
    text(g, '奶溢出来了', cx, c.y + 40, 21, C.COLOR.ink, 'bold', 'center');
    text(g, '本局得分', cx, c.y + 66, 12, 'rgba(90,61,30,.7)', 'normal', 'center');
    text(g, String(S.score), cx, c.y + 102, 32, C.COLOR.red, 'bold', 'center');
    text(g, '最高分 ' + S.best, cx, c.y + 124, 12, 'rgba(90,61,30,.72)', 'normal', 'center');
    text(g, '本局最高合成 Lv.' + (S.maxLv + 1) + ' ' + C.LEVELS[S.maxLv].name, cx, c.y + 148, 12, 'rgba(90,61,30,.72)', 'normal', 'center');
    var halfW = (c.w - 44) / 2;
    if (hasRevive) {
      pill(g, 'revive', '使用复活 · 清掉高位奶盒', c.x + 16, c.y + 160, c.w - 32, 40, { primary: true, size: 13.5 });
      pill(g, 'again', '再来一局', c.x + 16, c.y + 208, halfW, 38, { size: 14 });
      pill(g, 'askMode', '切换难度', c.x + 28 + halfW, c.y + 208, halfW, 38, { size: 13 });
    } else {
      pill(g, 'again', '再来一局', c.x + 16, c.y + 162, halfW, 40, { primary: true, size: 15 });
      pill(g, 'askMode', '切换难度', c.x + 28 + halfW, c.y + 162, halfW, 40, { size: 14 });
    }
  }

  function drawAsk(g, L, target) {
    var c = card(g, L, 168);
    var cx = c.x + c.w / 2;
    text(g, '切到「' + C.MODES[target].name + '」？', cx, c.y + 40, 19, C.COLOR.ink, 'bold', 'center');
    text(g, '切换难度需要重开本局', cx, c.y + 68, 13, 'rgba(90,61,30,.78)', 'normal', 'center');
    text(g, '当前这局的分数不会保留', cx, c.y + 88, 12, 'rgba(90,61,30,.6)', 'normal', 'center');
    pill(g, 'askCancel', '再想想', c.x + 16, c.y + 108, (c.w - 44) / 2, 40, { size: 14 });
    pill(g, 'askOk', '切换', c.x + 28 + (c.w - 44) / 2, c.y + 108, (c.w - 44) / 2, 40, { primary: true, size: 15 });
  }

  function drawGift(g, L, claimed) {
    var c = card(g, L, 248);
    var cx = c.x + c.w / 2;
    text(g, '限定福利 · 复活机会', cx, c.y + 36, 18, C.COLOR.red, 'bold', 'center');
    text(g, '把游戏添加到抖音首页侧边栏即可领取', cx, c.y + 60, 12, 'rgba(90,61,30,.8)', 'normal', 'center');
    var steps = [
      '① 点下方「去首页侧边栏」',
      '② 在侧边栏点「合成野生狗奶」',
      '③ 回到游戏，自动获得 1 次复活',
    ];
    for (var i = 0; i < steps.length; i++) {
      text(g, steps[i], c.x + 18, c.y + 86 + i * 21, 12, 'rgba(90,61,30,.74)');
    }
    text(g, '复活效果：清掉越过第 2 条虚线的奶盒', c.x + 18, c.y + 160, 11.5, C.COLOR.ghost, 'bold');
    if (claimed) {
      text(g, '今天的福利已领取，明天再来', cx, c.y + 192, 12.5, 'rgba(90,61,30,.7)', 'normal', 'center');
      pill(g, 'giftClose', '知道了', c.x + c.w / 2 - 60, c.y + 204, 120, 34, { primary: true, size: 14 });
    } else {
      pill(g, 'giftGo', '去首页侧边栏', c.x + 16, c.y + 182, c.w - 78, 38, { primary: true, size: 14 });
      pill(g, 'giftClose', '关闭', c.x + c.w - 58, c.y + 182, 42, 38, { size: 13 });
    }
  }

  function draw(L, ui) {
    hits = [];
    var g = P.ctx;
    g.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
    g.clearRect(0, 0, L.cw, L.ch);

    // 画布底色（棋盘外的区域）
    var bg = g.createLinearGradient(0, 0, 0, L.ch);
    bg.addColorStop(0, '#fff8ec');
    bg.addColorStop(1, '#ffdca8');
    g.fillStyle = bg;
    g.fillRect(0, 0, L.cw, L.ch);

    drawHud(g, L, ui);
    drawBoard(g, L);
    drawChain(g, L);

    if (ui.overlay === 'over') drawOver(g, L);
    else if (ui.overlay === 'ask') drawAsk(g, L, ui.target);
    else if (ui.overlay === 'gift') drawGift(g, L, ui.giftClaimed);

    MG.render.hits = hits;
  }

  MG.render = { draw: draw, drawCarton: drawCarton, hits: [] };
})();
