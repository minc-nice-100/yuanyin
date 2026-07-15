// ===== 原音麻将 — 语音识别集成 (LLM 语义出牌) =====
import { FUNASR_URL, LLM_WORKER_URL } from './config.js';
import { configureLLM, parseCommand } from './llm-service.js';
import { sichuanRules } from './rules/sichuan-rules.js';

if (LLM_WORKER_URL) {
  configureLLM({ workerUrl: LLM_WORKER_URL });
}

/**
 * 创建语音识别控制器
 * @param {Object} engine - 游戏引擎实例
 * @param {Object} ui - UI 功能
 * @returns {Object} 语音 API
 */
export function createVoice(engine, ui) {
  let asrClient = null;
  let useNativeFallback = false;

  function initVoiceRecognition() {
    if (!asrClient) {
      if (useNativeFallback) {
        asrClient = new window.NativeSpeechClient();
      } else {
        asrClient = new window.FunASRClient(FUNASR_URL);
      }

      asrClient.onConnect = () => {
        document.getElementById('voice-btn')?.classList.add('recording');
        const hint = document.querySelector('.voice-hint');
        if (hint) hint.textContent = '正在听...';
        const typeStr = useNativeFallback ? '内置' : 'FunASR';
        ui.showToast(`${typeStr}语音连接成功，请说话`);
      };

      asrClient.onDisconnect = () => {
        document.getElementById('voice-btn')?.classList.remove('recording');
        const hint = document.querySelector('.voice-hint');
        if (hint) hint.textContent = '按住说话并出牌';
      };

      asrClient.onError = (err) => {
        if (!useNativeFallback && err.includes('连接失败')) {
          ui.showToast('FunASR连接失败，正在为您切换为浏览器内置语音...');
          useNativeFallback = true;
          if (asrClient) { asrClient.stop(); asrClient = null; }
          setTimeout(() => start(), 800);
        } else {
          ui.showToast(err);
        }
      };

      asrClient.onResult = (text, isFinal) => {
        if (text) {
          ui.showToast(`识别: ${text}`);
          handleVoiceCommand(text);
          if (isFinal) asrClient.stop();
        }
      };
    }
    return asrClient;
  }

  async function handleVoiceCommand(text) {
    const phase = engine.getPhase();

    // 全局指令
    if (text.includes('开始') && phase === 'idle') {
      window.dispatchEvent(new CustomEvent('voice-start-game'));
      return;
    }

    // 使用 LLM 解析语义
    try {
      const state = engine.getState();
      const p = state.players[0];
      state.selfActions = sichuanRules.getSelfActions(p.hand, p.exposed, p.queSuit);
      state.tileTypes = sichuanRules.tileTypes;

      const action = await parseCommand(text, state);
      dispatchAction(action);
    } catch (err) {
      console.warn('LLM parse failed, falling back:', err);
      handleKeywordFallback(text);
    }
  }

  function dispatchAction(action) {
    switch (action.action) {
      case 'discard': {
        if (!action.tile) { ui.showToast('没听清要出哪张牌'); return; }
        const idx = engine.getState().players[0].hand.indexOf(action.tile);
        if (idx >= 0) {
          window.dispatchEvent(new CustomEvent('voice-action', {
            detail: { action: 'discard', tileIndex: idx },
          }));
        } else {
          ui.showToast(`手中没有这张牌`);
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

  function handleKeywordFallback(text) {
    const state = engine.getState();
    const phase = engine.getPhase();

    if (phase === 'waiting') {
      if (text.includes('碰')) { dispatchAction({ action: 'peng' }); return; }
      if (text.includes('杠')) { dispatchAction({ action: 'gang' }); return; }
      if (text.includes('胡')) { dispatchAction({ action: 'hu' }); return; }
      if (text.includes('过') || text.includes('不要')) { dispatchAction({ action: 'pass' }); return; }
    } else if (phase === 'playing' && engine.getCurrentPlayer() === 0) {
      if (text.includes('胡')) { dispatchAction({ action: 'hu' }); return; }
      if (text.includes('杠')) { dispatchAction({ action: 'gang' }); return; }
    }
    ui.showToast('没听清，请再说一次');
  }

  function start() {
    const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    if (useNativeFallback || (!asrClient && !window.FunASRClient)) {
      if (!hasSpeechAPI) {
        ui.showToast('当前浏览器不支持语音识别');
        return;
      }
    }
    const client = initVoiceRecognition();
    if (client.isRecording) {
      client.stop();
    } else {
      client.start();
    }
  }

  return { start, init: initVoiceRecognition };
}