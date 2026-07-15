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

export async function parseCommand(userText, state) {
  return await callWorker('/voice', { userText, gameState: state });
}

export async function botDecide(playerIndex, state) {
  return await callWorker('/bot', { gameState: state, playerIndex });
}

/**
 * SSE 流式 — 边收边做，action 一到就返回
 */
export async function parseCommandStream(userText, state, onAction) {
  const resp = await fetch(`${workerUrl}/voice/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userText, gameState: state }),
  });

  if (!resp.ok) throw new Error(`Worker error: ${resp.status}`);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastAction = { action: 'unknown' };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const action = JSON.parse(data);
        if (action.action) {
          lastAction = action;
          if (onAction) onAction(action);
        }
      } catch {}
    }
  }

  return lastAction;
}