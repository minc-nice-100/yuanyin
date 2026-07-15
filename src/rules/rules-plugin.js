// ===== 原音麻将 — 规则插件接口定义 =====
//
// 本文件定义了所有地区麻将规则插件必须实现的接口。
// 新增规则变体时，只需实现此接口，无需修改引擎或 UI。
//
// ============================================================
//
// 一个规则插件必须导出以下内容：
//
// @property {Object} meta
// @property {string} meta.name            — 唯一标识，如 "sichuan"
// @property {string} meta.displayName     — 显示名，如 "四川麻将"
// @property {number} meta.handSize        — 初始手牌数，如 13
// @property {boolean} meta.requiresQueMen — 是否需要缺门
//
// @property {Object<string, TileType>} tileTypes
//   Key = 牌 ID 字符串 (如 "5w")，Value = {
//     char: string,   // 点数字符，如 "五"
//     sub: string,    // 花色显示名，如 "萬"
//     color: string,  // CSS 颜色类，如 "green"
//     suit: string,   // 花色代码，如 "w"
//     rank: number,   // 1-9（字牌为 0）
//     icon: string    // 牌图标路径，如 "tiles/Mpt5m.png"
//   }
//
// @property {string} tileBackIcon — 牌背图标路径
//
// @property {function(): string[]} buildDeck
//   构建完整牌墙。四川麻将：3 花色 × 9 点数 × 4 张 = 108 张。
//
// @property {function(string[]): void} sortHand
//   原地理牌排序。
//
// @property {function(string[], string?): boolean} canWin
//   检查手牌（可含额外牌）是否胡牌。
//   queSuit 可选，仅缺门变体需要。
//
// @property {function(string[], Object[], boolean): number} calcFan
//   计算番数。
//   exposed = [{type: 'peng'|'zhigang'|'angang'|'bugang', tile: string}]
//
// @property {function(number): number} calcScore
//   番数 → 分数倍率。
//
// @property {function(string[], Object[], boolean): string[]} getFanDetails
//   返回番种明细文本数组。
//
// @property {function(string[], Object[], string?): SelfActions} getSelfActions
//   返回自己回合的可行操作。
//   SelfActions = { canZiMo: boolean, canAnGang: string[], canBuGang: string[] }
//
// @property {function(string[], string, string?): string[]} getResponseActions
//   返回对他人弃牌的响应操作。返回 ['hu', 'peng', 'gang'] 的子集。
//
// @property {function(): string[]} getAIPriority
//   返回 AI 行动优先级顺序，如 ['hu', 'gang', 'peng']。

/**
 * 验证规则插件是否实现了所有必需的方法
 * @param {Object} plugin
 * @returns {boolean}
 * @throws {Error} 如果缺少必需的方法
 */
export function validatePlugin(plugin) {
  const required = [
    'meta', 'tileTypes', 'tileBackIcon', 'buildDeck', 'sortHand',
    'canWin', 'calcFan', 'calcScore', 'getFanDetails',
    'getSelfActions', 'getResponseActions', 'getAIPriority',
  ];
  const missing = required.filter(k => !(k in plugin));
  if (missing.length > 0) {
    throw new Error(`Rules plugin missing: ${missing.join(', ')}`);
  }

  // Validate meta
  const metaRequired = ['name', 'displayName', 'handSize', 'requiresQueMen'];
  const metaMissing = metaRequired.filter(k => !(k in plugin.meta));
  if (metaMissing.length > 0) {
    throw new Error(`Rules plugin meta missing: ${metaMissing.join(', ')}`);
  }

  return true;
}