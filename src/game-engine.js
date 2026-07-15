// ===== 原音麻将 — 游戏引擎（状态机） =====
import { countTiles, shuffle } from './utils.js';

/**
 * 创建游戏引擎实例
 * @param {Object} rulesPlugin - 规则插件
 * @returns {Object} 引擎 API
 */
export function createEngine(rulesPlugin) {
  const R = rulesPlugin;

  let state = createInitialState();

  function createInitialState() {
    return {
      phase: 'idle', // 'idle' | 'preparing' | 'playing' | 'waiting' | 'ended'
      wall: [],
      currentPlayer: 0,
      lastDiscard: null, // { tile: string, from: number } | null
      pendingAction: null, // { tile, from, responses: [{player, actions}] } | null
      players: [
        { name: '你', hand: [], exposed: [], discards: [], queSuit: null, isHuman: true },
        { name: '小明', hand: [], exposed: [], discards: [], queSuit: null, isHuman: false },
        { name: '老王', hand: [], exposed: [], discards: [], queSuit: null, isHuman: false },
        { name: '小红', hand: [], exposed: [], discards: [], queSuit: null, isHuman: false },
      ],
      winResult: null,
    };
  }

  // ========== 内部辅助 ==========

  function result(ok, phase, message, sound, nextAction, playerIndex) {
    return { ok, phase, message, sound, nextAction, playerIndex };
  }

  // ========== 公开 API ==========

  return {
    // --- 状态访问 ---
    getState() {
      return state;
    },
    getPhase() {
      return state.phase;
    },
    getCurrentPlayer() {
      return state.currentPlayer;
    },
    getPendingAction() {
      return state.pendingAction;
    },
    getWinResult() {
      return state.winResult;
    },

    // ========== 游戏生命周期 ==========

    startNewGame() {
      state = createInitialState();

      // 构建牌墙
      state.wall = R.buildDeck();
      shuffle(state.wall);

      // 发牌
      for (const p of state.players) {
        p.hand = [];
        p.exposed = [];
        p.discards = [];
        p.queSuit = null;
      }
      for (let i = 0; i < R.meta.handSize; i++) {
        for (let p = 0; p < 4; p++) {
          state.players[p].hand.push(state.wall.pop());
        }
      }
      for (const p of state.players) R.sortHand(p.hand);

      if (R.meta.requiresQueMen) {
        state.phase = 'preparing';
      } else {
        state.phase = 'playing';
      }
      return result(true, 'preparing', null, null, null);
    },

    selectQueMen(playerIndex, suit) {
      state.players[playerIndex].queSuit = suit;

      const allDone = state.players.every(p => p.queSuit !== null);
      if (allDone) {
        state.phase = 'playing';
        state.currentPlayer = 0;
        return result(true, 'playing', null, null, 'startTurn');
      }
      return result(true, 'preparing', null, null, null);
    },

    // ========== 回合流程 ==========

    startTurn() {
      if (state.phase === 'ended') return result(false, 'ended');
      if (state.wall.length === 0) {
        state.phase = 'ended';
        return result(true, 'ended', '流局 - 牌堆已空', null, null);
      }

      const p = state.players[state.currentPlayer];
      const drawn = state.wall.pop();
      p.hand.push(drawn);
      R.sortHand(p.hand);

      const td = R.tileTypes[drawn];
      const msg = p.isHuman ? `摸牌: ${td.char}${td.sub}` : null;

      if (p.isHuman) {
        return result(true, 'playing', msg, 'draw', null);
      }
      return result(true, 'playing', null, null, 'aiTurn', state.currentPlayer);
    },

    // ========== 出牌 ==========

    discard(playerIndex, tileIndex) {
      const p = state.players[playerIndex];
      if (tileIndex < 0 || tileIndex >= p.hand.length) {
        return result(false, state.phase);
      }

      const tile = p.hand.splice(tileIndex, 1)[0];
      p.discards.push(tile);
      state.lastDiscard = { tile, from: playerIndex };
      R.sortHand(p.hand);

      const td = R.tileTypes[tile];

      // 检查其他玩家能否响应
      state.pendingAction = { tile, from: playerIndex, responses: [] };
      for (let i = 0; i < 4; i++) {
        if (i === playerIndex) continue;
        const actions = R.getResponseActions(
          state.players[i].hand, tile, state.players[i].queSuit,
        );
        if (actions.length > 0) {
          state.pendingAction.responses.push({ player: i, actions });
        }
      }

      if (state.pendingAction.responses.length > 0) {
        state.phase = 'waiting';
        return result(
          true, 'waiting',
          `${p.name} 出牌: ${td.char}${td.sub}`,
          'discard', 'waitForResponse',
        );
      }

      // 无人能响应，进入下一回合
      state.phase = 'playing';
      state.pendingAction = null;
      state.currentPlayer = (playerIndex + 1) % 4;
      return result(
        true, 'playing',
        `${p.name} 出牌: ${td.char}${td.sub}`,
        'discard', 'startTurn',
      );
    },

    // ========== 碰 ==========

    peng(playerIndex) {
      if (state.phase !== 'waiting' || !state.pendingAction) {
        return result(false, state.phase);
      }

      const p = state.players[playerIndex];
      const tile = state.pendingAction.tile;
      const fromPI = state.pendingAction.from;

      // 从手牌中移除 2 张
      let rm = 0;
      p.hand = p.hand.filter(t => {
        if (t === tile && rm < 2) { rm++; return false; }
        return true;
      });

      // 从弃牌者弃牌堆中移除
      const d = state.players[fromPI].discards;
      const idx = d.lastIndexOf(tile);
      if (idx >= 0) d.splice(idx, 1);

      p.exposed.push({ type: 'peng', tile });
      R.sortHand(p.hand);

      state.currentPlayer = playerIndex;
      state.phase = 'playing';
      state.pendingAction = null;

      const td = R.tileTypes[tile];
      return result(
        true, 'playing',
        `${p.name} 碰！${td.char}${td.sub}`,
        'peng',
        p.isHuman ? null : 'aiDiscard',
        playerIndex,
      );
    },

    // ========== 杠 ==========

    gang(playerIndex) {
      const p = state.players[playerIndex];

      // 判断杠的类型
      if (state.phase === 'waiting' && state.pendingAction) {
        // 直杠（杠对手的弃牌）
        return doZhiGang(playerIndex);
      }
      if (state.phase === 'playing') {
        // 暗杠或补杠
        const selfActions = R.getSelfActions(p.hand, p.exposed, p.queSuit);
        if (selfActions.canAnGang.length > 0) {
          return doAnGang(playerIndex, selfActions.canAnGang[0]);
        }
        if (selfActions.canBuGang.length > 0) {
          return doBuGang(playerIndex, selfActions.canBuGang[0]);
        }
      }
      return result(false, state.phase);
    },

    gangDraw(playerIndex) {
      if (state.wall.length === 0) {
        state.phase = 'ended';
        return result(true, 'ended', '流局', null, null);
      }
      const p = state.players[playerIndex];
      const drawn = state.wall.pop();
      p.hand.push(drawn);
      R.sortHand(p.hand);

      if (p.isHuman) {
        return result(true, 'playing', null, null, null);
      }
      return result(true, 'playing', null, null, 'aiTurn', playerIndex);
    },

    // ========== 胡 ==========

    hu(playerIndex) {
      const p = state.players[playerIndex];
      let hand = [...p.hand];
      let tile = null;
      let isSelfDraw = false;

      if (state.phase === 'waiting' && state.pendingAction) {
        // 点炮
        tile = state.pendingAction.tile;
        hand.push(tile);
        // 从弃牌者弃牌堆中移除
        const d = state.players[state.pendingAction.from]?.discards;
        if (d) {
          const i = d.lastIndexOf(tile);
          if (i >= 0) d.splice(i, 1);
        }
        isSelfDraw = false;
      } else if (state.phase === 'playing') {
        // 自摸
        isSelfDraw = true;
      } else {
        return result(false, state.phase);
      }

      const fan = R.calcFan(hand, p.exposed, isSelfDraw);
      const score = R.calcScore(fan);
      const method = isSelfDraw ? '自摸' : '点炮';

      state.phase = 'ended';
      state.pendingAction = null;
      state.winResult = {
        winner: playerIndex,
        name: p.name,
        hand,
        exposed: p.exposed,
        fan,
        score,
        isSelfDraw,
        method,
        winTile: tile,
      };

      return result(true, 'ended', `${p.name} 胡！${method}`, 'hu', null, playerIndex);
    },

    // ========== 过 ==========

    pass(playerIndex) {
      if (state.phase !== 'waiting' || !state.pendingAction) {
        return result(false, state.phase);
      }

      // 移除该玩家的响应
      state.pendingAction.responses = state.pendingAction.responses.filter(
        r => r.player !== playerIndex,
      );

      if (state.pendingAction.responses.length === 0) {
        // 所有玩家都过了，进入下一回合
        state.phase = 'playing';
        const nextPlayer = (state.pendingAction.from + 1) % 4;
        state.currentPlayer = nextPlayer;
        state.pendingAction = null;
        return result(true, 'playing', null, null, 'startTurn');
      }

      return result(true, 'waiting', null, null, null);
    },

    // ========== AI 内部辅助 ==========

    aiDiscardAfterAction(playerIndex) {
      const p = state.players[playerIndex];
      if (p.hand.length === 0) return result(false, state.phase);
      // AI 选择弃牌后返回 discard action
      return result(true, 'playing', null, null, 'aiDiscard', playerIndex);
    },
  };

  // ========== 内部：杠操作 ==========

  function doZhiGang(playerIndex) {
    const p = state.players[playerIndex];
    const tile = state.pendingAction.tile;
    const fromPI = state.pendingAction.from;

    let rm = 0;
    p.hand = p.hand.filter(t => {
      if (t === tile && rm < 3) { rm++; return false; }
      return true;
    });

    const d = state.players[fromPI].discards;
    const idx = d.lastIndexOf(tile);
    if (idx >= 0) d.splice(idx, 1);

    p.exposed.push({ type: 'zhigang', tile });
    R.sortHand(p.hand);

    state.currentPlayer = playerIndex;
    state.phase = 'playing';
    state.pendingAction = null;

    const td = R.tileTypes[tile];
    return result(
      true, 'playing',
      `${p.name} 杠！${td.char}${td.sub} (直杠)`,
      'gang', 'gangDraw', playerIndex,
    );
  }

  function doAnGang(playerIndex, tile) {
    const p = state.players[playerIndex];
    p.hand = p.hand.filter(t => t !== tile);
    p.exposed.push({ type: 'angang', tile });
    R.sortHand(p.hand);

    return result(
      true, 'playing',
      `${p.name} 暗杠！`,
      'gang', 'gangDraw', playerIndex,
    );
  }

  function doBuGang(playerIndex, tile) {
    const p = state.players[playerIndex];
    const idx = p.hand.indexOf(tile);
    if (idx >= 0) p.hand.splice(idx, 1);

    for (const g of p.exposed) {
      if (g.type === 'peng' && g.tile === tile) {
        g.type = 'bugang';
        break;
      }
    }
    R.sortHand(p.hand);

    const td = R.tileTypes[tile];
    return result(
      true, 'playing',
      `${p.name} 补杠！${td.char}${td.sub}`,
      'gang', 'gangDraw', playerIndex,
    );
  }
}