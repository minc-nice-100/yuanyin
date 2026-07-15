// ===== 游戏引擎 — 测试 =====
import { describe, it, expect, beforeEach } from 'vitest';
import { createEngine } from './game-engine.js';
import { sichuanRules } from './rules/sichuan-rules.js';

describe('game-engine', () => {
  let engine;

  beforeEach(() => {
    engine = createEngine(sichuanRules);
  });

  describe('startNewGame', () => {
    it('sets phase to preparing (Sichuan requires queMen)', () => {
      const result = engine.startNewGame();
      expect(result.ok).toBe(true);
      expect(result.phase).toBe('preparing');
    });

    it('deals 13 tiles to each player', () => {
      engine.startNewGame();
      const state = engine.getState();
      for (const p of state.players) {
        expect(p.hand.length).toBe(13);
      }
    });

    it('builds a wall of 108 - 52 = 56 tiles remaining', () => {
      engine.startNewGame();
      const state = engine.getState();
      expect(state.wall.length).toBe(108 - 52);
    });

    it('all hands are sorted', () => {
      engine.startNewGame();
      const state = engine.getState();
      for (const p of state.players) {
        const sorted = [...p.hand].sort((a, b) => {
          const order = Object.keys(sichuanRules.tileTypes);
          return order.indexOf(a) - order.indexOf(b);
        });
        expect(p.hand).toEqual(sorted);
      }
    });
  });

  describe('selectQueMen', () => {
    it('sets queSuit for a player', () => {
      engine.startNewGame();
      const result = engine.selectQueMen(0, 'w');
      expect(result.ok).toBe(true);
      expect(engine.getState().players[0].queSuit).toBe('w');
    });

    it('transitions to playing when all 4 players selected', () => {
      engine.startNewGame();
      engine.selectQueMen(0, 'w');
      engine.selectQueMen(1, 't');
      engine.selectQueMen(2, 'b');
      const result = engine.selectQueMen(3, 'w');
      expect(result.phase).toBe('playing');
      expect(result.nextAction).toBe('startTurn');
    });
  });

  describe('startTurn', () => {
    beforeEach(() => {
      engine.startNewGame();
      // Select queMen for all players
      for (let i = 0; i < 4; i++) engine.selectQueMen(i, 'w');
    });

    it('draws a tile and increases hand size', () => {
      const state = engine.getState();
      const before = state.players[0].hand.length;
      engine.startTurn();
      expect(engine.getState().players[0].hand.length).toBe(before + 1);
    });

    it('returns playing phase with draw message', () => {
      const result = engine.startTurn();
      expect(result.phase).toBe('playing');
      expect(result.message).toContain('摸牌');
      expect(result.sound).toBe('draw');
    });

    it('returns ended if wall is empty', () => {
      const state = engine.getState();
      state.wall.length = 0;
      const result = engine.startTurn();
      expect(result.phase).toBe('ended');
      expect(result.message).toContain('流局');
    });
  });

  describe('discard', () => {
    beforeEach(() => {
      engine.startNewGame();
      for (let i = 0; i < 4; i++) engine.selectQueMen(i, 'w');
      engine.startTurn();
    });

    it('removes tile from hand and adds to discards', () => {
      const state = engine.getState();
      const handLen = state.players[0].hand.length;
      const result = engine.discard(0, 0);
      expect(result.ok).toBe(true);
      expect(engine.getState().players[0].hand.length).toBe(handLen - 1);
      expect(engine.getState().players[0].discards.length).toBe(1);
    });

    it('sets lastDiscard', () => {
      const state = engine.getState();
      const tile = state.players[0].hand[0];
      engine.discard(0, 0);
      const ld = engine.getState().lastDiscard;
      expect(ld.tile).toBe(tile);
      expect(ld.from).toBe(0);
    });

    it('returns false for invalid index', () => {
      const result = engine.discard(0, 999);
      expect(result.ok).toBe(false);
    });
  });

  describe('peng', () => {
    it('pengs when player has 2+ of the pending tile', () => {
      // Setup a scenario where player 1 discards and player 0 can peng
      engine.startNewGame();
      for (let i = 0; i < 4; i++) engine.selectQueMen(i, 'w');

      // Manually set up a peng scenario
      const state = engine.getState();
      state.players[0].hand = ['1t','1t','2t','3t','4t','5t','6t','7t','8t','9t','1b','2b','3b'];
      state.players[1].hand = ['1t','2w','3w','4w','5w','6w','7w','8w','9w','2b','3b','4b','5b'];
      state.players[1].discards = ['1t'];
      state.lastDiscard = { tile: '1t', from: 1 };
      state.phase = 'waiting';
      state.pendingAction = {
        tile: '1t',
        from: 1,
        responses: [{ player: 0, actions: ['peng', 'hu'] }],
      };

      const result = engine.peng(0);
      expect(result.ok).toBe(true);
      const p = engine.getState().players[0];
      expect(p.exposed.some(g => g.type === 'peng' && g.tile === '1t')).toBe(true);
      // Hand should have removed 2 copies of '1t'
      expect(p.hand.filter(t => t === '1t').length).toBe(0);
    });
  });

  describe('hu', () => {
    it('sets phase to ended and populates winResult', () => {
      engine.startNewGame();
      for (let i = 0; i < 4; i++) engine.selectQueMen(i, 't');

      const state = engine.getState();
      const hand = ['1w','2w','3w','4w','5w','6w','7w','8w','9w','1b','1b','1b','2b','2b'];
      sichuanRules.sortHand(hand);
      state.players[0].hand = hand;
      state.phase = 'playing';
      state.pendingAction = null;

      const result = engine.hu(0);
      expect(result.ok).toBe(true);
      expect(result.phase).toBe('ended');
      const wr = engine.getWinResult();
      expect(wr).toBeTruthy();
      expect(wr.winner).toBe(0);
    });
  });

  describe('pass', () => {
    it('advances to next turn when all pass', () => {
      engine.startNewGame();
      for (let i = 0; i < 4; i++) engine.selectQueMen(i, 'w');

      const state = engine.getState();
      state.phase = 'waiting';
      state.currentPlayer = 0;
      state.pendingAction = {
        tile: '5b',
        from: 1,
        responses: [{ player: 2, actions: ['peng'] }],
      };
      state.lastDiscard = { tile: '5b', from: 1 };

      const result = engine.pass(2);
      expect(result.ok).toBe(true);
      // After all responses cleared, it should advance to next turn
      expect(result.nextAction).toBe('startTurn');
    });
  });
});