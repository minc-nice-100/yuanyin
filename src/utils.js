// ===== 原音麻将 — 通用工具函数 =====

/**
 * 统计手牌中每种牌的数量
 * @param {string[]} hand - 牌 ID 数组，如 ['1w', '2w', '1w']
 * @returns {Object<string, number>} 牌 ID → 数量
 */
export function countTiles(hand) {
  const c = {};
  for (const t of hand) c[t] = (c[t] || 0) + 1;
  return c;
}

/**
 * Fisher-Yates 洗牌，原地修改数组
 * @param {any[]} arr - 待洗牌数组
 */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}