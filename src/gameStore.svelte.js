// ===== 原音麻将 — 响应式游戏状态存储 =====
// 所有 Svelte 组件通过此 store 访问游戏状态

import { createEngine } from './game-engine.js';
import { createAI } from './ai.js';
import { createVoice } from './voice.js';
import { SFX } from './config.js';
import { LLM_WORKER_URL } from './config.js';
import { botDecide } from './llm-service.js';
import { sichuanRules } from './rules/sichuan-rules.js';

let sfxEnabled = $state(true);

const engine = createEngine(sichuanRules);
const ai = createAI(sichuanRules);

let state = $state(engine.getState());
let selectedTile = $state(-1);
let drawnTileIndex = $state(-1);
let toastMsg = $state('');
let toastVisible = $state(false);
let toastTimer = null;

// UI 状态
let ttsEnabled = $state(false);
let quickChatOpen = $state(false);
let settingsOpen = $state(false);
let actionPrompt = $state('');
let asrMode = $state('auto'); // 'auto' | 'native' | 'funasr'

let voice = null;

function initVoice(ui) {
  voice = createVoice(engine, ui, () => asrMode);
}

function refreshState() {
  state = engine.getState();
}

function showToast(msg) {
  toastMsg = msg;
  toastVisible = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastVisible = false; }, 2000);

  if (ttsEnabled && window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance(msg.replace(/[🎉💬]/g, ''));
    u.lang = 'zh-CN';
    u.rate = 1.2;
    window.speechSynthesis.speak(u);
  }
}

// ========== 协调器 ==========

function processActionResult(result) {
  if (!result.ok) { showToast('无效操作'); return; }
  if (result.message) showToast(result.message);
  if (result.sound && sfxEnabled) SFX[result.sound]();

  refreshState();
  selectedTile = -1;
  drawnTileIndex = -1;

  if (result.phase === 'ended') {
    const win = engine.getWinResult();
    if (win) return { type: 'hu-result', win };
    return { type: 'end', reason: result.message };
  }

  if (result.phase === 'preparing') {
    return { type: 'quemen' };
  }

  if (result.nextAction === 'startTurn') {
    return processActionResult(engine.startTurn());
  }

  if (result.nextAction === 'aiTurn') {
    setTimeout(() => runAITurn(result.playerIndex), 800);
    return { type: 'ok' };
  }

  if (result.nextAction === 'waitForResponse') {
    showActionPrompt();
    scheduleAIResponses(state.pendingAction);
    return { type: 'waiting' };
  }

  if (result.nextAction === 'gangDraw') {
    setTimeout(() => {
      processActionResult(engine.gangDraw(result.playerIndex));
    }, 600);
    return { type: 'ok' };
  }

  if (result.nextAction === 'aiDiscard') {
    setTimeout(() => {
      runAITurn(result.playerIndex);
    }, 600);
    return { type: 'ok' };
  }

  return { type: 'ok' };
}

function showActionPrompt() {
  const pending = engine.getPendingAction();
  if (!pending) return;
  const humanResp = pending.responses.find(r => r.player === 0);
  if (humanResp) {
    const R = sichuanRules;
    const td = R.tileTypes[pending.tile];
    const actionNames = humanResp.actions.map(a => ({ hu: '胡', gang: '杠', peng: '碰' }[a])).join('/');
    const fromName = state.players[pending.from].name;
    actionPrompt = `${fromName}打出 ${td.char}${td.sub}，可以${actionNames}`;
  }
}

function hideActionPrompt() {
  actionPrompt = '';
}

// ========== 机器人决策 ==========

async function decideAction(playerIndex, currentState) {
  // LLM 决策
  if (LLM_WORKER_URL) {
    const p = currentState.players[playerIndex];
    const enriched = { ...currentState };
    enriched.selfActions = sichuanRules.getSelfActions(p.hand, p.exposed, p.queSuit);
    enriched.tileTypes = sichuanRules.tileTypes;

    try {
      const llmAction = await botDecide(playerIndex, enriched);
      // 模拟思考
      await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
      if (llmAction.action === 'discard' && llmAction.tile) {
        const idx = currentState.players[playerIndex].hand.indexOf(llmAction.tile);
        if (idx >= 0) return { type: 'discard', tileIndex: idx };
      }
      if (['peng', 'gang', 'hu', 'pass'].includes(llmAction.action)) {
        return { type: llmAction.action };
      }
    } catch (err) {
      console.warn('LLM bot decide failed, using heuristic:', err);
    }
  }

  // 降级: 启发式 AI
  await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
  return ai.decideAction(playerIndex, currentState);
}

function scheduleAIResponses(pending) {
  if (!pending) return;
  const aiResponders = pending.responses.filter(r => r.player !== 0);
  aiResponders.forEach((r, i) => {
    setTimeout(async () => {
      const currentState = engine.getState();
      if (currentState.phase !== 'waiting') return;
      const action = await decideAction(r.player, currentState);
      if (action.type === 'pass') {
        processActionResult(engine.pass(r.player));
      } else {
        let result;
        switch (action.type) {
          case 'hu': result = engine.hu(r.player); break;
          case 'gang': result = engine.gang(r.player); break;
          case 'peng': result = engine.peng(r.player); break;
        }
        if (result) processActionResult(result);
      }
    }, 300 + i * 200);
  });
}

async function runAITurn(playerIndex) {
  const currentState = engine.getState();
  if (currentState.phase !== 'playing') return;
  const action = await decideAction(playerIndex, currentState);
  let result;
  switch (action.type) {
    case 'discard':
      result = engine.discard(playerIndex, action.tileIndex);
      break;
    case 'peng':
      result = engine.peng(playerIndex);
      break;
    case 'gang':
      result = engine.gang(playerIndex);
      break;
    case 'hu':
      result = engine.hu(playerIndex);
      break;
    default:
      return;
  }
  processActionResult(result);
}

// ========== 公开 API ==========

export function getStore() {
  return {
    get state() { return state; },
    get selectedTile() { return selectedTile; },
    get drawnTileIndex() { return drawnTileIndex; },
    get toastMsg() { return toastMsg; },
    get toastVisible() { return toastVisible; },
    get ttsEnabled() { return ttsEnabled; },
    get quickChatOpen() { return quickChatOpen; },
    get settingsOpen() { return settingsOpen; },
    get actionPrompt() { return actionPrompt; },

    get engine() { return engine; },
    get ai() { return ai; },
    get rules() { return sichuanRules; },
    get voice() { return voice; },

    startNewGame() {
      return processActionResult(engine.startNewGame());
    },
    selectQueMen(suit) {
      processActionResult(engine.selectQueMen(0, suit));
      for (let i = 1; i < 4; i++) {
        engine.selectQueMen(i, ai.pickQueMen(engine.getState().players[i].hand));
      }
      return processActionResult(engine.startTurn());
    },
    handleTileClick(index) {
      if (state.phase !== 'playing' || state.currentPlayer !== 0) return;
      if (selectedTile === index) {
        const result = processActionResult(engine.discard(0, index));
        return result;
      } else {
        selectedTile = index;
        SFX.select();
        return { type: 'ok' };
      }
    },
    playerAction(action) {
      let result;
      switch (action) {
        case 'peng': result = engine.peng(0); break;
        case 'gang': result = engine.gang(0); break;
        case 'hu': result = engine.hu(0); break;
        case 'pass':
          hideActionPrompt();
          result = engine.pass(0);
          break;
      }
      return processActionResult(result);
    },
    showToast,
    initVoice,
    get asrMode() { return asrMode; },
    toggleTTS() { ttsEnabled = !ttsEnabled; },
    toggleSFX() { sfxEnabled = !sfxEnabled; },
    toggleASR() { asrMode = asrMode === 'native' ? 'auto' : 'native'; },
    toggleQuickChat() { quickChatOpen = !quickChatOpen; },
    toggleSettings() { settingsOpen = !settingsOpen; },
    hideActionPrompt,
    refreshState,
  };
}

// ========== 语音事件监听 ==========

window.addEventListener('voice-action', (e) => {
  const { action, tileIndex } = e.detail;
  if (action === 'discard' && tileIndex !== undefined) {
    processActionResult(engine.discard(0, tileIndex));
  } else if (['peng', 'gang', 'hu', 'pass'].includes(action)) {
    let result;
    if (action === 'pass') {
      hideActionPrompt();
      result = engine.pass(0);
    } else {
      result = engine[action](0);
    }
    processActionResult(result);
  }
});

window.addEventListener('voice-start-game', () => {
  processActionResult(engine.startNewGame());
});