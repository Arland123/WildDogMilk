/**
 * 提示计算 Worker：把求解器放到独立线程，避免阻塞游戏主循环。
 * 入参：{ id, H, snapshot, lv, nextLv, mode }
 * 出参：{ id, ok, ans | error }
 */
// Worker 是独立全局环境，Matter 必须自己加载（路径相对本文件）
importScripts('../../lib/matter.min.js', 'physics.js', 'solver.js');

self.onmessage = async function (e) {
  var d = e.data;
  try {
    GamePhysics.setHeight(d.H || 720);
    var ans = await PlacementSolver.solve(d.snapshot, d.lv, d.nextLv, { mode: d.mode || 'balanced' });
    self.postMessage({
      id: d.id,
      ok: true,
      ans: {
        x: ans.x,
        nextX: ans.nextX,
        value: ans.value,
        totalGain: ans.totalGain,
        totalMerges: ans.totalMerges,
        risk: ans.risk,
        simulations: ans.simulations,
        elapsed: ans.elapsed,
      },
    });
  } catch (err) {
    self.postMessage({ id: d.id, ok: false, error: String((err && err.message) || err) });
  }
};
