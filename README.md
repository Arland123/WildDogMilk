合成野生狗奶

在线试玩：**https://arland123.github.io/WildDogMilk/**

把「合成大西瓜」玩法搬进超市冷柜的纯静态网页小游戏：十一级奶盒连锁合成，从野生马尿一路养到野生奶·终极进化版。

## 玩法

- 移动鼠标/手指瞄准，点击或松手投放
- 两盒同级的奶撞在一起，合成为更高一级
- 奶盒堆过警戒线持续 2 秒即结束
- 两盒终极狗奶相撞会一起炸掉，+1000 分
- 键盘：← → 瞄准，空格投放，R 重开

## 技术

- 无构建、无后端，直接打开 `index.html` 即可运行
- 物理：Matter.js 0.20.0（MIT，已本地化于 `lib/matter.min.js`）
- 渲染：Canvas 2D，四级贴图取自 `img/1.png`~`img/11.png`

## 本地运行

```bash
python -m http.server 8000
# 打开 http://localhost:8000
```
