// ===== LLM 语义出牌服务 =====

let workerUrl = '';

export function configureLLM({ workerUrl: url }) {
  workerUrl = url;
}

async function callWorker(path, body) {
  const resp = await fetch(`${workerUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Worker error: ${resp.status}`);
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/** POST /voice — 语音识别文字 → 游戏操作 */
export async function parseCommand(userText, state) {
  return await callWorker('/voice', { userText, gameState: state });
}

/** POST /bot — 机器人出牌决策 */
export async function botDecide(playerIndex, state) {
  return await callWorker('/bot', { gameState: state, playerIndex });
}

/**
 * POST /voice/stream — SSE 流式语音识别
 * @param {string} userText
 * @param {Object} state
 * @param {function} onDelta — 流式回调
 * @returns {Promise<{action: string, tile?: string}>}
 */
export async function parseCommandSSE(userText, state, onDelta) {
  const resp = await fetch(`${workerUrl}/voice/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userText, gameState: state }),
  });

  if (!resp.ok) throw new Error(`Worker error: ${resp.status}`);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = { action: 'unknown' };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.action) {
            result = parsed;
            if (onDelta) onDelta(parsed);
          }
        } catch {}
      }
    }
  }

  return result;
}