# 合成野生狗奶 · 抖音小游戏版

从 `index.html`（H5 版）移植过来的小游戏工程：**游戏规则、物理、贴图完全一致**，只是把 DOM 换成了 canvas 绘制 + `tt.*` 接口。

## 目录

| 文件 | 作用 |
|---|---|
| `game.js` | 入口，按顺序 `require` 各模块 |
| `game.json` | 小游戏配置（竖屏） |
| `project.config.json` | 开发者工具工程配置（appid `ttcfe4b959519a6dfb02`） |
| `platform.js` | 平台适配层：画布 / 图片 / 存储 / 音效 / 触摸 / 侧边栏；无 `tt` 时自动回退浏览器 |
| `config.js` | 等级表、难度、配色、存档 key |
| `core.js` | 纯逻辑：Matter.js 物理、投放、合成、越线判定 |
| `render.js` | 全部绘制：顶部栏、棋盘、合成表、三种弹窗 |
| `main.js` | 布局、触摸命中、主循环、弹窗状态机 |
| `matter.min.js` | Matter.js 0.20.0（MIT） |
| `assets/img/*.png` | 11 级贴图 |
| `assets/sfx/*.wav` | 4 个音效（小游戏没有 WebAudio，必须是文件）|
| `debug.html` | **浏览器预览**：同一套 js 走 platform 的浏览器分支 |

## 本地预览（不用开发者工具）

```bash
python -m http.server 8000
# 打开 http://localhost:8000/minigame-tt/debug.html
```

线上预览：<https://arland123.github.io/WildDogMilk/minigame-tt/debug.html>

## 用抖音开发者工具打开

1. 下载「抖音开发者工具」
2. 新建/导入项目 → 选择本目录 `minigame-tt/`
3. AppID 填 `ttcfe4b959519a6dfb02`
4. 真机预览 / 上传测试版本

## 已实现的平台能力

- **侧边栏复访（平台必接）**：`platform.js` 的 `MG.platform.sidebar`
  - 判断来源场景值 `021036 / 101036 / 181036 / 261036`
  - **奖励：每日首次从侧边栏进入 → 获得 1 次复活机会**（最多存 1 次）
  - 复活效果：结算弹窗里点「使用复活」，**清掉越过「自上往下第 2 条货架虚线」的所有奶盒**后继续这一局
    （该虚线在 `config.js` 的 `REVIVE_LINE = DEAD_Y + 260 = 410`，正好是画面上的第 2 条虚线）
  - 游戏内「福利」入口 → `tt.navigateToScene({ scene: 'sidebar' })`
- 客服能力、敏感词：本游戏无内购、无自定义输入，按平台规则不需要接入

## 与 H5 版的关系

两边的 **等级表 / 难度参数 / 评分规则必须保持一致**。改 `index.html` 里这些常量时，同步改 `config.js` 和 `core.js`：

- 等级尺寸：`LEVELS`（`s` / `aspect`）
- 难度：`MODES.hard.h = 720`、`MODES.easy.h = 750`，`DEAD_Y = 150`
- 评分：`MERGE_SCORE = i*(i+1)`、`FINAL_BONUS = 1000`
