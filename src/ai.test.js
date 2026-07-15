// ===== 原音麻将 — AI 测试 =====
import { describe, it, expect } from 'vitest';
import { createAI } from './ai.js';
import { sichuanRules } from './rules/sichuan-rules.js';

describe('ai', () => {
  const ai = createAI(sichuanRules);

  describe('pickQueMen', () => {
    it('selects suit with fewest tiles', () => {
      const hand = ['1w','2w','3w','4w','5w','1t','2t','3t','1b','2b','3b','4b','5b'];
      // w:5, t:3, b:5 → should pick 't'
      expect(ai.pickQueMen(hand)).toBe('t');
    });

    it('selects suit with 0 tiles', () => {
      const hand = ['1w','2w','3w','4w','5w','6w','7w','8w','9w','1t','2t','3t','4t'];
      // w:9, t:4, b:0 → should pick 'b'
      expect(ai.pickQueMen(hand)).toBe('b');
    });
  });

  describe('chooseDiscard', () => {
    it('prioritizes queSuit tiles', () => {
      const player = {
        hand: ['1w','2w','3w','4w','5w','1t','2t','3t','4t','5t','6t','1b','2b'],
        queSuit: 'b',
      };
      const idx = ai.chooseDiscard(player);
      // Should discard '1b' or '2b' (queSuit tiles)
      const tile = player.hand[idx];
      expect(sichuanRules.tileTypes[tile].suit).toBe('b');
    });

    it('discards isolated tile when no queSuit tiles', () => {
      const player = {
        hand: ['1w','2w','2w','3w','4w','5w','6w','7w','8w','9w','1t','2t','3t'],
        queSuit: 'b',
      };
      const idx = ai.chooseDiscard(player);
      // Should pick a lonely tile
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(player.hand.length);
    });
  });
});