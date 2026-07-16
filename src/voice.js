// ===== 原音麻将 — 语音识别集成 (Push-to-Talk) =====
// 三级 fallback: FunASR → 浏览器原生语音 → 关键词匹配
// Push-to-talk 场景优先用原生语音（即时启动），FunASR 作为可选升级
import { FUNASR_URL, LLM_WORKER_URL } from './config.js';
import { configureLLM, parseCommand } from './llm-service.js';
import { sichuanRules } from './rules/sichuan-rules.js';

let voiceOn = false;
let hintText = '按住说话并出牌';
let fallbackTimer = null;

// 检查是否配置了真实的 FunASR 服务（非默认 localhost）
const useFunASRConfigured = FUNASR_URL && !FUNASR_URL.includes('127.0.0.1') && !FUNASR_URL.includes('localhost');

if (LLM_WORKER_URL) {
  configureLLM({ workerUrl: LLM_WORKER_URL });
}

export function createVoice(engine, ui, getASRMode) {
  let asrClient = null;
  let isRecording = false;

  function createClient() {
    const mode = getASRMode ? getASRMode() : 'auto';
    const useFunASR = mode === 'funasr' || (mode === 'auto' && useFunASRConfigured);
    if (useFunASR) {
      return new window.FunASRClient(FUNASR_URL);
    }
    return new window.NativeSpeechClient();
  }

  function initASR() {
    if (!asrClient) {
      asrClient = createClient();

      asrClient.onConnect = () => {
        isRecording = true;
        hintText = '正在听...';
      };

      asrClient.onDisconnect = () => {
        isRecording = false;
        hintText = '按住说话并出牌';
      };

      asrClient.onError = (err) => {
        const mode = getASRMode ? getASRMode() : 'auto';
        if (mode !== 'native' && err.includes('连接失败')) {
          ui.showToast('FunASR连接失败，切换浏览器内置语音...');
          if (asrClient) { asrClient.stop(); asrClient = null; }
          clearTimeout(fallbackTimer);
          fallbackTimer = setTimeout(() => {
            if (voiceOn) startMic();
          }, 300);
        } else {
          ui.showToast(err);
        }
      };

      asrClient.onResult = (text, isFinal) => {
        if (text && isFinal) {
          ui.showToast(`识别: ${text}`);
          handleVoiceCommand(text);
        }
      };
    }
    return asrClient;
  }

  function isHumanTurn() {
    const state = engine.getState();
    if (state.phase === 'playing' && state.currentPlayer === 0) return true;
    if (state.phase === 'waiting' && state.pendingAction?.responses?.some(r => r.player === 0)) return true;
    return false;
  }

  function startMic() {
    if (!voiceOn) return;
    if (!isHumanTurn()) {
      ui.showToast('还没轮到你呢');
      return;
    }
    const client = initASR();
    if (!client.isRecording) {
      client.start();
    }
  }

  function stopMic() {
    if (asrClient?.isRecording) {
      asrClient.stop();
    }
  }

  window.addEventListener('voice-action', () => {
    stopMic();
  });

  async function handleVoiceCommand(text) {
    const phase = engine.getPhase();

    if (text.includes('开始') && phase === 'idle') {
      window.dispatchEvent(new CustomEvent('voice-start-game'));
      return;
    }

    try {
      const state = engine.getState();
      const p = state.players[0];
      state.selfActions = sichuanRules.getSelfActions(p.hand, p.exposed, p.queSuit);
      state.tileTypes = sichuanRules.tileTypes;

      const action = await parseCommand(text, state);
      dispatchAction(action);
    } catch (err) {
      console.warn('LLM parse failed, using keyword fallback:', err);
      handleKeywordFallback(text);
    }
  }

  function dispatchAction(action) {
    switch (action.action) {
      case 'discard': {
        if (!action.tile) { ui.showToast('没听清要出哪张牌'); return; }
        const idx = engine.getState().players[0].hand.indexOf(action.tile);
        if (idx >= 0) {
          window.dispatchEvent(new CustomEvent('voice-action', { detail: { action: 'discard', tileIndex: idx } }));
        } else {
          ui.showToast('手中没有这张牌');
        }
        break;
      }
      case 'peng':
        window.dispatchEvent(new CustomEvent('voice-action', { detail: { action: 'peng' } }));
        break;
      case 'gang':
        window.dispatchEvent(new CustomEvent('voice-action', { detail: { action: 'gang' } }));
        break;
      case 'hu':
        window.dispatchEvent(new CustomEvent('voice-action', { detail: { action: 'hu' } }));
        break;
      case 'pass':
        window.dispatchEvent(new CustomEvent('voice-action', { detail: { action: 'pass' } }));
        break;
      default:
        ui.showToast('没听清，请再说一次');
    }
  }

  // 语音 → 牌ID 解析（兼容繁简）
  const RANK_MAP = { '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9' };
  const SUIT_MAP = { '万': 'w', '萬': 'w', '条': 't', '條': 't', '筒': 'b' };

  function parseTileFromSpeech(text) {
    // 匹配 "数字+花色" 或 "中文数字+花色"，如 "一万" "一萬" "1万" "3筒" "五条"
    const m = text.match(/([1-9一二三四五六七八九])\s*([万萬条條筒])/);
    if (!m) return null;
    const rank = RANK_MAP[m[1]] || m[1]; // 中文数字 → 阿拉伯，或直接是阿拉伯数字
    const suit = SUIT_MAP[m[2]];
    return rank + suit;
  }

  function handleKeywordFallback(text) {
    const phase = engine.getPhase();

    // 尝试解析牌名出牌
    if (phase === 'playing' && engine.getCurrentPlayer() === 0) {
      const tileId = parseTileFromSpeech(text);
      if (tileId) {
        const idx = engine.getState().players[0].hand.indexOf(tileId);
        if (idx >= 0) {
          dispatchAction({ action: 'discard', tile: tileId });
          return;
        } else {
          ui.showToast('手中没有这张牌');
          return;
        }
      }
      if (text.includes('胡')) { dispatchAction({ action: 'hu' }); return; }
      if (text.includes('杠')) { dispatchAction({ action: 'gang' }); return; }
    }

    if (phase === 'waiting') {
      if (text.includes('碰')) { dispatchAction({ action: 'peng' }); return; }
      if (text.includes('杠')) { dispatchAction({ action: 'gang' }); return; }
      if (text.includes('胡')) { dispatchAction({ action: 'hu' }); return; }
      if (text.includes('过') || text.includes('不要')) { dispatchAction({ action: 'pass' }); return; }
    }

    ui.showToast('没听清，请再说一次');
  }

  // ===== 公开 API =====

  return {
    press() {
      const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      if (!hasSpeechAPI) {
        ui.showToast('当前浏览器不支持语音识别');
        return;
      }

      // 切换 ASR 模式时重建 client
      if (asrClient) { asrClient.stop(); asrClient = null; }

      voiceOn = true;
      startMic();
    },

    release() {
      voiceOn = false;
      clearTimeout(fallbackTimer);
      stopMic();
    },

    init: initASR,
    get listening() { return isRecording; },
    get hintText() { return hintText; },
  };
}