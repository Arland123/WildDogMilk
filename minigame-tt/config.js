/**
 * 静态配置：等级、难度、配色。与 H5 版（index.html）保持一致。
 */
var MG = MG || {};
(function () {
  // s：面积开方（决定体积）；aspect：贴图宽高比（assets/img/N.png 的裁切比例）
  var LEVELS = [
    { name: '野生马尿',         color: '#f2c230', s: 42,  aspect: .468 },
    { name: '野生狗尿',         color: '#5fa83c', s: 51,  aspect: .436 },
    { name: '野生鼠奶',         color: '#4a4f58', s: 62,  aspect: .433 },
    { name: '野生驴奶',         color: '#2e7fc9', s: 75,  aspect: .436 },
    { name: '老母鸡奶',         color: '#8a5a2b', s: 90,  aspect: .451 },
    { name: '野生见手青奶',     color: '#2f6a3d', s: 104, aspect: .440 },
    { name: '野老猫猴奶',       color: '#2b2b33', s: 120, aspect: .427 },
    { name: '野生爱因斯坦奶',   color: '#5b3a91', s: 136, aspect: .423 },
    { name: '幻纹虎奶',         color: '#d9531e', s: 154, aspect: .431 },
    { name: '野生龙奶',         color: '#e07a1f', s: 171, aspect: .435 },
    { name: '野生奶·终极进化版', color: '#1f4fa8', s: 211, aspect: .736 },
  ];
  LEVELS.forEach(function (L) {
    L.w = L.s * Math.sqrt(L.aspect);
    L.h = L.s / Math.sqrt(L.aspect);
    L.round = Math.max(3, L.w * 0.1);
  });

  var MODES = {
    hard: { key: 'hard', name: '困难', h: 720 },
    easy: { key: 'easy', name: '简单', h: 750 },
  };

  MG.C = {
    W: 400,
    DEAD_Y: 150,
    LEVELS: LEVELS,
    LAST: LEVELS.length - 1,
    MODES: MODES,
    SPAWN_WEIGHTS: [30, 28, 22, 13, 7],
    FINAL_BONUS: 1000,
    GAP: 3,
    SUM_W: LEVELS.reduce(function (t, L) { return t + L.w; }, 0),
    MERGE_SCORE: LEVELS.map(function (_, i) { return i * (i + 1); }),
    KEYS: { best: 'wdmBest_', mode: 'wdmMode', sound: 'wdmSound', gift: 'wdmGiftDay', revive: 'wdmRevive', legacyBest: 'wildDogMilkBest' },
    FONT: '"PingFang SC","Microsoft YaHei",sans-serif',
    COLOR: {
      ink: '#5a3d1e', red: '#c2410c', accent: '#e8553a',
      cream: '#fffaf0', warm: '#ffe9c7', shelf: '#f3d3a3',
      danger: 'rgba(200,120,60,.35)', dangerHot: 'rgba(230,40,30,',
      card: '#fff8ec', line: '#e8cfa8', ghost: '#8a5a2b', chipBg: '#ffffff',
    },
    SIDEBAR_REWARD: 500, // 侧边栏复访：每日首次进入奖励的起始分
  };

  // 复活线：自上往下数第 2 条货架虚线（虚线画在 DEAD_Y + 130 的倍数上）
  MG.C.REVIVE_LINE = MG.C.DEAD_Y + 130 * 2;
})();
