// ===== LLM 语义出牌服务 =====

let workerUrl = '';

export function configureLLM({ workerUrl: url }) {
  workerUrl = url;
}

async function callWorker(path, body, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`${workerUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Worker error: ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** POST /voice — 语音识别文字 → 游戏操作 */
export async function parseCommand(userText, state) {
  return await callWorker('/voice', { userText, gameState: state }, 15000);
}

/** POST /bot — 机器人出牌决策 */
export async function botDecide(playerIndex, state) {
  return await callWorker('/bot', { gameState: state, playerIndex }, 30000);
}