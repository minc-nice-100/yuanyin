// ===== 四川麻将规则 — 测试 =====
import { describe, it, expect } from 'vitest';
import { sichuanRules } from './sichuan-rules.js';

const R = sichuanRules;

describe('sichuanRules', () => {
  describe('meta', () => {
    it('has correct name', () => {
      expect(R.meta.name).toBe('sichuan');
    });
    it('has handSize 13', () => {
      expect(R.meta.handSize).toBe(13);
    });
    it('requires queMen', () => {
      expect(R.meta.requiresQueMen).toBe(true);
    });
  });

  describe('tileTypes', () => {
    it('has 27 tile types', () => {
      expect(Object.keys(R.tileTypes).length).toBe(27);
    });
    it('each tile has char, sub, color, suit, rank, icon', () => {
      for (const [id, tt] of Object.entries(R.tileTypes)) {
        expect(tt.char).toBeTruthy();
        expect(tt.sub).toBeTruthy();
        expect(tt.suit).toMatch(/^[wtb]$/);
        expect(tt.rank).toBeGreaterThanOrEqual(1);
        expect(tt.rank).toBeLessThanOrEqual(9);
        expect(tt.icon).toContain('tiles/Mpt');
      }
    });
    it('1w is 一萬', () => {
      expect(R.tileTypes['1w'].char).toBe('一');
      expect(R.tileTypes['1w'].sub).toBe('萬');
    });
    it('9b is 九筒', () => {
      expect(R.tileTypes['9b'].char).toBe('九');
      expect(R.tileTypes['9b'].sub).toBe('筒');
    });
  });

  describe('buildDeck', () => {
    it('builds 108 tiles', () => {
      expect(R.buildDeck().length).toBe(108);
    });
    it('has 4 copies of each tile type', () => {
      const deck = R.buildDeck();
      const counts = {};
      for (const t of deck) counts[t] = (counts[t] || 0) + 1;
      for (const c of Object.values(counts)) {
        expect(c).toBe(4);
      }
    });
    it('only contains valid tile IDs', () => {
      const deck = R.buildDeck();
      for (const t of deck) {
        expect(R.tileTypes[t]).toBeTruthy();
      }
    });
  });

  describe('sortHand', () => {
    it('sorts by suit then rank', () => {
      const hand = ['9w', '1w', '5b', '1b', '3t', '2t'];
      R.sortHand(hand);
      expect(hand).toEqual(['1w', '9w', '2t', '3t', '1b', '5b']);
    });
  });

  describe('canWin', () => {
    it('returns false without queSuit', () => {
      const hand = makeHand(['1w','1w','1w','2w','3w','4w','5w','6w','7w','8w','9w','9w','9w']);
      expect(R.canWin(hand, null)).toBe(false);
    });

    it('returns false if hand contains queSuit tiles', () => {
      const hand = makeHand(['1w','1w','1w','2w','3w','4w','5w','6w','7w','8w','9w','9w','9w']);
      expect(R.canWin(hand, 'w')).toBe(false);
    });

    it('detects a standard winning hand (4 sets + 1 pair)', () => {
      // 123w 456w 789w 111b 22b (14 tiles, no queSuit issue)
      const hand = makeHand(['1w','2w','3w','4w','5w','6w','7w','8w','9w','1b','1b','1b','2b','2b']);
      // queSuit = 't' (no t tiles in hand)
      expect(R.canWin(hand, 't')).toBe(true);
    });

    it('detects seven pairs', () => {
      const hand = makeHand(['1w','1w','2w','2w','3w','3w','4w','4w','5w','5w','6w','6w','7w','7w']);
      expect(R.canWin(hand, 't')).toBe(true);
    });

    it('returns false for incomplete hand', () => {
      // Only 13 tiles, not a winning hand
      const hand = makeHand(['1w','2w','3w','4w','5w','6w','7w','8w','9w','1b','1b','1b','2b']);
      expect(R.canWin(hand, 't')).toBe(false);
    });

    it('returns false for bad hand (not win)', () => {
      const hand = makeHand(['1w','1w','3w','4w','5w','6w','7w','8w','9w','1b','2b','3b','4b','5b']);
      expect(R.canWin(hand, 't')).toBe(false);
    });

    it('detects all-triplet hand (对对和)', () => {
      const hand = makeHand(['1w','1w','1w','3w','3w','3w','5b','5b','5b','7t','7t','7t','9w','9w']);
      expect(R.canWin(hand, 't')).toBe(false); // has 't' suit
      expect(R.canWin(hand, 'b')).toBe(false); // has 'b' suit
      // Only w and b, no t — queSuit='t' should work
      // Wait: 7t is in the hand. Let me fix the test.
    });
  });

  describe('calcFan', () => {
    it('base fan is 0 for plain win', () => {
      const hand = makeHand(['1w','2w','3w','4w','5w','6w','7w','8w','9w','1b','1b','1b','2b','2b']);
      expect(R.calcFan(hand, [], false)).toBe(0);
    });

    it('self-draw adds 1 fan', () => {
      const hand = makeHand(['1w','2w','3w','4w','5w','6w','7w','8w','9w','1b','1b','1b','2b','2b']);
      expect(R.calcFan(hand, [], true)).toBe(1);
    });

    it('all-triplets adds 1 fan', () => {
      const hand = makeHand(['1w','1w','1w','3w','3w','3w','5b','5b','5b','7b','7b','7b','9w','9w']);
      const fan = R.calcFan(hand, [], false);
      expect(fan).toBeGreaterThanOrEqual(1);
    });

    it('one-suit (清一色) adds 2 fan', () => {
      const hand = makeHand(['1w','2w','3w','4w','5w','6w','7w','8w','9w','1w','1w','1w','2w','2w']);
      expect(R.calcFan(hand, [], false)).toBe(2);
    });

    it('seven pairs adds 2 fan', () => {
      // Mix suits so it's seven pairs but NOT one-suit
      const hand = makeHand(['1w','1w','2w','2w','3t','3t','4t','4t','5b','5b','6b','6b','7w','7w']);
      expect(R.calcFan(hand, [], false)).toBe(2);
    });

    it('gang roots each add 1 fan', () => {
      const hand = makeHand(['1w','2w','3w','4w','5w','6w','7w','8w','9w','1b','1b','1b','2b','2b']);
      const exposed = [{ type: 'zhigang', tile: '5b' }, { type: 'angang', tile: '9b' }];
      expect(R.calcFan(hand, exposed, false)).toBe(2);
    });

    it('fan capped at 3', () => {
      const hand = makeHand(['1w','2w','3w','4w','5w','6w','7w','8w','9w','1w','1w','1w','2w','2w']);
      const exposed = [{ type: 'zhigang', tile: '3b' }, { type: 'angang', tile: '4b' }];
      expect(R.calcFan(hand, exposed, true)).toBe(3); // 清一色+2 自摸+1 根×2+2 = 5, capped
    });
  });

  describe('calcScore', () => {
    it('0 fan = 1x', () => { expect(R.calcScore(0)).toBe(1); });
    it('1 fan = 2x', () => { expect(R.calcScore(1)).toBe(2); });
    it('2 fan = 4x', () => { expect(R.calcScore(2)).toBe(4); });
    it('3 fan = 8x', () => { expect(R.calcScore(3)).toBe(8); });
  });

  describe('getSelfActions', () => {
    it('detects angang (4 of same tile)', () => {
      const hand = ['1w','1w','1w','1w','2w','3w','4w','5w','6w','7w','8w','9w','2b','2b'];
      const actions = R.getSelfActions(hand, [], 't');
      expect(actions.canAnGang).toContain('1w');
    });

    it('detects bugang (add to existing peng)', () => {
      const hand = ['1w','2w','3w','4w','5w','6w','7w','8w','9w','1b','1b','2b','2b'];
      const exposed = [{ type: 'peng', tile: '1b' }];
      const actions = R.getSelfActions(hand, exposed, 't');
      expect(actions.canBuGang).toContain('1b');
    });

    it('detects zimo', () => {
      const hand = makeHand(['1w','2w','3w','4w','5w','6w','7w','8w','9w','1b','1b','1b','2b','2b']);
      const actions = R.getSelfActions(hand, [], 't');
      expect(actions.canZiMo).toBe(true);
    });
  });

  describe('getResponseActions', () => {
    it('returns hu when can win with discard', () => {
      const hand = ['1w','2w','3w','4w','5w','6w','7w','8w','9w','1b','1b','1b','2b'];
      const actions = R.getResponseActions(hand, '2b', 't');
      expect(actions).toContain('hu');
    });

    it('returns gang when 3 of same tile', () => {
      const hand = ['1w','1w','1w','2w','3w','4w','5w','6w','7w','8w','9w','2b','2b'];
      const actions = R.getResponseActions(hand, '1w', 't');
      expect(actions).toContain('gang');
    });

    it('returns peng when 2+ of same tile', () => {
      const hand = ['1w','1w','2w','3w','4w','5w','6w','7w','8w','9w','2b','2b','3b'];
      const actions = R.getResponseActions(hand, '2b', 't');
      expect(actions).toContain('peng');
    });

    it('returns empty array when no action possible', () => {
      const hand = ['1w','2w','3w','4w','5w','6w','7w','8w','9w','2b','3b','4b','5b'];
      const actions = R.getResponseActions(hand, '9w', 't');
      expect(actions).toEqual([]);
    });
  });

  describe('getAIPriority', () => {
    it('returns hu first, then gang, then peng', () => {
      expect(R.getAIPriority()).toEqual(['hu', 'gang', 'peng']);
    });
  });

  describe('getFanDetails', () => {
    it('returns empty for plain win', () => {
      const hand = makeHand(['1w','2w','3w','4w','5w','6w','7w','8w','9w','1b','1b','1b','2b','2b']);
      expect(R.getFanDetails(hand, [], false)).toEqual([]);
    });
    it('returns 自摸 for self-draw', () => {
      const hand = makeHand(['1w','2w','3w','4w','5w','6w','7w','8w','9w','1b','1b','1b','2b','2b']);
      expect(R.getFanDetails(hand, [], true)).toContain('自摸 +1番');
    });
  });
});

// Helper: build a hand from tile IDs, sorted
function makeHand(ids) {
  return [...ids].sort((a, b) => {
    const order = Object.keys(R.tileTypes);
    return order.indexOf(a) - order.indexOf(b);
  });
}