# 合成野生狗奶 —— 项目长期记忆

## 是什么

「合成大西瓜」玩法的纯静态网页游戏：11 级奶盒（野生马尿 → 野生奶·终极进化版）同级相撞合成。
无构建、无后端、无包管理，`index.html` 单文件承载全部逻辑（CSS/JS 内联），
物理用本地化的 Matter.js 0.20.0，贴图在 `img/1.png`~`img/11.png`。

## 线上部署（已上线）

- 公网：**https://arland123.github.io/WildDogMilk/**
- 仓库：`https://github.com/Arland123/WildDogMilk`（public，main 分支，root 目录发布 Pages）
- 生效文件：`index.html`、`lib/`、`img/`、`.nojekyll`（禁 Jekyll，避免多余处理）

## 约定

- 仓库名用 ASCII（中文会被 GitHub/gh 洗成 `-`）；中文名只放 README 标题和 description。
- 布局靠 `layout()` 按视口宽高比自适应，改 UI 尺寸时注意 `chainScale`/`chainRatio` 的联动。
- 世界坐标固定 `W=400, H=640`，绘制统一 `viewScale * dpr`，新绘制代码不要在 CSS 像素里算。

## 发布踩坑（详见 2026-10-22 日志）

- 本机 `git push` 到 GitHub 会 `curl 55 Connection was reset`，不可用；
  改用 `gh api -X PUT .../contents/<path>` 逐文件上传。
