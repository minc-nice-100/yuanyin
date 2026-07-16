// ===== 原音麻将 — 配置与常量 =====

// --- Whisper ASR 地址 ---
const param = new URLSearchParams(window.location.search);
export const ASR_URL = param.get('asr') || 'https://www.project-resonance.net/api/whisper-asr';

// --- 音效开关 ---
export let sfxEnabled = true;

// --- 音效系统 (Web Audio API) ---
const sfxCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSfx(freq, duration = 0.1, type = 'sine', vol = 0.3) {
  if (!sfxEnabled) return;
  const o = sfxCtx.createOscillator();
  const g = sfxCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, sfxCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, sfxCtx.currentTime + duration);
  o.connect(g);
  g.connect(sfxCtx.destination);
  o.start();
  o.stop(sfxCtx.currentTime + duration);
}

export const SFX = {
  discard: () => playSfx(800, 0.08, 'sine', 0.2),
  draw: () => playSfx(600, 0.06, 'sine', 0.15),
  peng: () => { playSfx(523, 0.12, 'square', 0.2); setTimeout(() => playSfx(659, 0.12, 'square', 0.2), 80); },
  gang: () => { playSfx(440, 0.1, 'square', 0.25); setTimeout(() => playSfx(554, 0.1, 'square', 0.25), 70); setTimeout(() => playSfx(659, 0.1, 'square', 0.25), 140); },
  hu: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playSfx(f, 0.2, 'sine', 0.3), i * 100)); },
  select: () => playSfx(1200, 0.04, 'sine', 0.1),
};

// --- 快捷短语 ---
export const QUICK_PHRASES = ['不急慢慢来', '快点出牌', '厉害！', '再想想', '运气好', '下把加油'];

// --- LLM 语义出牌配置 ---
export const LLM_WORKER_URL = param.get('llm') || '';