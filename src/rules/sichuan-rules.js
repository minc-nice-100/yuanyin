// ===== 四川麻将（成都麻将）规则插件 =====
import { countTiles } from '../utils.js';

// --- 牌型定义: 只有饼/条/万, 27种×4=108张 ---
const SUITS = {
  w: { name: '萬', color: '' },
  t: { name: '條', color: 'green' },
  b: { name: '筒', color: 'blue' },
};
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const RANK_CHARS = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九' };
const SUIT_TO_ICON = { w: 'm', t: 's', b: 'p' };

const TILE_TYPES = {};
for (const s of Object.keys(SUITS)) {
  for (const r of RANKS) {
    TILE_TYPES[r + s] = {
      char: RANK_CHARS[r],
      sub: SUITS[s].name,
      color: SUITS[s].color,
      suit: s,
      rank: +r,
      icon: `tiles/Mpt${r}${SUIT_TO_ICON[s]}.png`,
    };
  }
}

const TILE_ORDER = Object.keys(TILE_TYPES);

export const sichuanRules = {
  meta: {
    name: 'sichuan',
    displayName: '四川麻将',
    handSize: 13,
    requiresQueMen: true,
  },

  tileTypes: TILE_TYPES,
  tileBackIcon: 'tiles/Mpt00.png',

  // --- 牌墙构建 ---
  buildDeck() {
    const deck = [];
    for (const id of Object.keys(TILE_TYPES)) {
      for (let i = 0; i < 4; i++) deck.push(id);
    }
    return deck;
  },

  // --- 理牌 ---
  sortHand(hand) {
    hand.sort((a, b) => TILE_ORDER.indexOf(a) - TILE_ORDER.indexOf(b));
  },

  // --- 胡牌判定 ---
  canWin(hand, queSuit) {
    if (!queSuit) return false;
    // 手牌中不能有缺门花色
    for (const t of hand) {
      if (TILE_TYPES[t].suit === queSuit) return false;
    }
    if (hand.length % 3 !== 2) return false;
    if (hand.length === 14 && isSevenPairs(hand)) return true;
    return canDecompose(hand);
  },

  // --- 番数计算 ---
  calcFan(hand, exposed, isSelfDraw) {
    let fan = 0;
    if (isSelfDraw) fan++;
    if (isAllTriplets(hand)) fan++;
    if (isOneSuit(hand, exposed)) fan += 2;
    if (hand.length === 14 && isSevenPairs(hand)) fan += 2;
    // 根: count all gang types
    fan += exposed.filter(g => g.type.includes('gang')).length;
    return Math.min(fan, 3);
  },

  // --- 分数倍率 ---
  calcScore(fan) {
    return Math.pow(2, Math.min(fan, 3));
  },

  // --- 番种明细 ---
  getFanDetails(hand, exposed, isSelfDraw) {
    const details = [];
    if (isSelfDraw) details.push('自摸 +1番');
    if (isAllTriplets(hand)) details.push('对对和 +1番');
    if (isOneSuit(hand, exposed)) details.push('清一色 +2番');
    if (hand.length === 14 && isSevenPairs(hand)) details.push('七对子 +2番');
    const gangCnt = exposed.filter(g => g.type.includes('gang')).length;
    if (gangCnt > 0) details.push(`根×${gangCnt} +${gangCnt}番`);
    return details;
  },

  // --- 自己回合可行操作 ---
  getSelfActions(hand, exposed, queSuit) {
    const counts = countTiles(hand);

    // 暗杠：手中有4张相同
    const canAnGang = [];
    for (const [tile, cnt] of Object.entries(counts)) {
      if (cnt === 4) canAnGang.push(tile);
    }

    // 补杠：已有碰的牌，手中还有一张
    const canBuGang = [];
    for (const g of exposed) {
      if (g.type === 'peng' && hand.includes(g.tile)) {
        canBuGang.push(g.tile);
      }
    }

    // 自摸
    const canZiMo = this.canWin(hand, queSuit);

    return { canZiMo, canAnGang, canBuGang };
  },

  // --- 对他人弃牌的响应操作 ---
  getResponseActions(hand, discardTile, queSuit) {
    const actions = [];
    const c = countTiles(hand);

    if (this.canWin([...hand, discardTile], queSuit)) actions.push('hu');
    if (c[discardTile] === 3) actions.push('gang');
    if (c[discardTile] >= 2) actions.push('peng');

    return actions;
  },

  // --- AI 行动优先级 ---
  getAIPriority() {
    return ['hu', 'gang', 'peng'];
  },
};

// ========== 内部辅助函数 ==========

function isSevenPairs(hand) {
  const c = countTiles(hand);
  return Object.values(c).every(v => v === 2 || v === 4) && hand.length === 14;
}

function canDecompose(hand) {
  const c = countTiles(hand);
  for (const tile of Object.keys(c)) {
    if (c[tile] >= 2) {
      c[tile] -= 2;
      if (canFormSets(c)) { c[tile] += 2; return true; }
      c[tile] += 2;
    }
  }
  return false;
}

function canFormSets(counts) {
  let first = null;
  for (const t of TILE_ORDER) {
    if (counts[t] > 0) { first = t; break; }
  }
  if (!first) return true;

  const td = TILE_TYPES[first];

  // 刻子
  if (counts[first] >= 3) {
    counts[first] -= 3;
    if (canFormSets(counts)) { counts[first] += 3; return true; }
    counts[first] += 3;
  }

  // 顺子
  if (td.rank <= 7) {
    const n1 = (td.rank + 1) + td.suit;
    const n2 = (td.rank + 2) + td.suit;
    if ((counts[n1] || 0) > 0 && (counts[n2] || 0) > 0) {
      counts[first]--;
      counts[n1]--;
      counts[n2]--;
      if (canFormSets(counts)) { counts[first]++; counts[n1]++; counts[n2]++; return true; }
      counts[first]++;
      counts[n1]++;
      counts[n2]++;
    }
  }
  return false;
}

function isAllTriplets(hand) {
  const c = countTiles(hand);
  for (const t of Object.keys(c)) {
    if (c[t] >= 2) {
      c[t] -= 2;
      if (canFormTripletsOnly({ ...c })) { c[t] += 2; return true; }
      c[t] += 2;
    }
  }
  return false;
}

function canFormTripletsOnly(c) {
  for (const [t, v] of Object.entries(c)) {
    if (v > 0) {
      if (v < 3) return false;
      c[t] -= 3;
      const r = canFormTripletsOnly(c);
      c[t] += 3;
      return r;
    }
  }
  return true;
}

function isOneSuit(hand, exposed) {
  const suits = new Set();
  for (const t of hand) suits.add(TILE_TYPES[t].suit);
  for (const g of exposed) suits.add(TILE_TYPES[g.tile].suit);
  return suits.size === 1;
}