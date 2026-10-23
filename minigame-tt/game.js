/**
 * 抖音小游戏入口。按顺序加载各模块（CommonJS require，路径相对本文件）。
 * 依赖：Matter.js（本地引入，MIT）
 */
require('./platform.js');
require('./config.js');
require('./core.js');
require('./render.js');
require('./main.js');
