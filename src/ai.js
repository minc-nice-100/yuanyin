// ===== 原音麻将 — AI 决策模块 =====
import { countTiles } from './utils.js';

/**
 * 创建 AI 决策器
 * @param {Object} rulesPlugin - 规则插件
 * @returns {Object} AI API
 */
export function createAI(rulesPlugin) {
  const R = rulesPlugin;

  return {
    /**
     * 选择缺门花色：选择手中张数最少的花色
     * @param {string[]} hand - 手牌
     * @returns {string} 花色代码
     */
    pickQueMen(hand) {
      const c = { w: 0, t: 0, b: 0 };
      for (const t of hand) {
        const suit = R.tileTypes[t].suit;
        if (c[suit] !== undefined) c[suit]++;
      }
      return Object.entries(c).sort((a, b) => a[1] - b[1])[0][0];
    },

    /**
     * 选择弃牌：优先出缺门牌，其次出孤张
     * @param {Object} player - 玩家对象 { hand, queSuit }
     * @returns {number} 弃牌索引
     */
    chooseDiscard(player) {
      const { hand, queSuit } = player;

      // 优先出缺门牌
      for (let i = 0; i < hand.length; i++) {
        if (R.tileTypes[hand[i]].suit === queSuit) return i;
      }

      // 出孤张（相邻牌最少）
      const counts = countTiles(hand);
      let best = 0;
      let bestScore = 99;
      for (let i = 0; i < hand.length; i++) {
        const td = R.tileTypes[hand[i]];
        let score = counts[hand[i]];
        const prev = (td.rank > 1) ? (td.rank - 1) + td.suit : null;
        const next = (td.rank < 9) ? (td.rank + 1) + td.suit : null;
        if (prev && counts[prev]) score += 1;
        if (next && counts[next]) score += 1;
        if (score < bestScore) { bestScore = score; best = i; }
      }
      return best;
    },

    /**
     * 决策行动：返回 { type, tileIndex?, tile? }
     * @param {number} playerIndex - 玩家索引
     * @param {Object} state - 当前游戏状态
     * @returns {Object} 行动对象
     */
    decideAction(playerIndex, state) {
      const p = state.players[playerIndex];
      const priority = R.getAIPriority();

      // 如果处于 waiting 状态，检查是否可以响应
      if (state.phase === 'waiting' && state.pendingAction) {
        const resp = state.pendingAction.responses.find(r => r.player === playerIndex);
        if (resp) {
          for (const act of priority) {
            if (resp.actions.includes(act)) {
              return { type: act };
            }
          }
        }
        return { type: 'pass' };
      }

      // 自己在 playing 状态，检查自身操作
      if (state.phase === 'playing' && state.currentPlayer === playerIndex) {
        const selfActions = R.getSelfActions(p.hand, p.exposed, p.queSuit);

        // 暗杠
        if (selfActions.canAnGang.length > 0) {
          // 检查杠的牌是否不是缺门
          for (const tile of selfActions.canAnGang) {
            if (R.tileTypes[tile].suit !== p.queSuit) {
              return { type: 'gang' };
            }
          }
        }
        // 补杠
        if (selfActions.canBuGang.length > 0) {
          return { type: 'gang' };
        }
        // 自摸
        if (selfActions.canZiMo) {
          return { type: 'hu' };
        }

        // 弃牌
        const di = this.chooseDiscard(p);
        return { type: 'discard', tileIndex: di };
      }

      return { type: 'pass' };
    },
  };
}