// ===== 原音麻将 — LLM 代理 Worker =====
// 部署: cd llm-proxy && wrangler deploy
// 需要设置 env: LLM_ENDPOINT, LLM_API_KEY, LLM_MODEL (可选)

// ========== Voice 解析 prompt ==========
function buildVoicePrompt(state, playerIndex = 0) {
  const p = state.players[playerIndex];
  const handDisplay = p.hand.map(tid => {
    const td = state.tileTypes[tid];
    return `${td.char}${td.sub}(${tid})`;
  }).join(' ');

  let available = [];
  if (state.phase === 'playing' && state.currentPlayer === playerIndex) {
    available.push('出牌');
    if (state.selfActions?.canZiMo) available.push('自摸胡');
    if (state.selfActions?.canAnGang?.length > 0) available.push('暗杠');
    if (state.selfActions?.canBuGang?.length > 0) available.push('补杠');
  } else if (state.phase === 'waiting' && state.pendingAction) {
    const resp = state.pendingAction.responses?.find(r => r.player === playerIndex);
    if (resp) {
      if (resp.actions.includes('hu')) available.push('胡');
      if (resp.actions.includes('gang')) available.push('杠');
      if (resp.actions.includes('peng')) available.push('碰');
      available.push('过');
    }
  }

  let discardInfo = '';
  if (state.phase === 'waiting' && state.pendingAction) {
    const td = state.tileTypes[state.pendingAction.tile];
    discardInfo = `\n- ${state.players[state.pendingAction.from].name}打出了${td.char}${td.sub}(${state.pendingAction.tile})`;
  }

  return `你是麻将语音助手。玩家用口语说牌名或操作，你解析成游戏指令。你必须返回JSON。

牌名映射规则:
- "一万/一萬/1万" → tile="1w", 二万→"2w", 三万→"3w", 四万→"4w", 五万→"5w", 六万→"6w", 七万→"7w", 八万→"8w", 九万→"9w"
- "一条/一條/1条/鸡/幺鸡/妖姬" → tile="1t", 二条→"2t", 三条→"3t", 四条→"4t", 五条→"5t", 六条→"6t", 七条→"7t", 八条→"8t", 九条→"9t"
- "一筒/1筒" → tile="1b", 二筒→"2b", 三筒→"3b", 四筒→"4b", 五筒→"5b", 六筒→"6b", 七筒→"7b", 八筒→"8b", 九筒→"9b"

规则:
1. 玩家说牌名（如"打三万""出五筒""七条"）→ 返回 {"action":"discard","tile":"牌ID"}，tile 按映射规则填
2. 玩家说"碰/杠/胡/过/不要" → 返回对应操作
3. 完全无法理解才返回 {"action":"unknown"}

JSON 示例:
{"action":"discard","tile":"3w"}
{"action":"peng"}
{"action":"gang"}
{"action":"hu"}
{"action":"pass"}
{"action":"unknown"}`;
}

// ========== Bot 自然语言 prompt ==========
function buildBotThinkPrompt(state, playerIndex) {
  const p = state.players[playerIndex];
  const handDisplay = p.hand.map(tid => {
    const td = state.tileTypes[tid];
    return `${td.char}${td.sub}(${tid})`;
  }).join(' ');

  let available = [];
  if (state.phase === 'playing' && state.currentPlayer === playerIndex) {
    available.push('出牌');
    if (state.selfActions?.canZiMo) available.push('自摸胡');
    if (state.selfActions?.canAnGang?.length > 0) available.push('暗杠');
    if (state.selfActions?.canBuGang?.length > 0) available.push('补杠');
  } else if (state.phase === 'waiting' && state.pendingAction) {
    const resp = state.pendingAction.responses?.find(r => r.player === playerIndex);
    if (resp) {
      if (resp.actions.includes('hu')) available.push('胡');
      if (resp.actions.includes('gang')) available.push('杠');
      if (resp.actions.includes('peng')) available.push('碰');
      available.push('过');
    } else {
      return null;
    }
  }

  let opponentsInfo = '';
  for (let i = 0; i < state.players.length; i++) {
    if (i === playerIndex) continue;
    const op = state.players[i];
    const discardsStr = op.discards.slice(-6).map(tid => {
      const td = state.tileTypes[tid];
      return `${td.char}${td.sub}`;
    }).join(' ');
    opponentsInfo += `\n- ${op.name}: ${op.handCount}张手牌, 缺${op.queSuit ? {w:'萬',t:'條',b:'筒'}[op.queSuit] : '?'}, 最近弃牌: ${discardsStr || '无'}`;
  }

  let discardInfo = '';
  if (state.phase === 'waiting' && state.pendingAction) {
    const td = state.tileTypes[state.pendingAction.tile];
    discardInfo = `${state.players[state.pendingAction.from].name}打出了${td.char}${td.sub}`;
  }

  const sit = state.phase === 'playing' && state.currentPlayer === playerIndex
    ? `现在轮到你了，你刚摸了一张牌，手上有${p.hand.length}张，请说"打X"来出牌`
    : `别人${discardInfo}，你可以说"碰"、"杠"、"胡"或"过"`;

  return `你是四川麻将玩家${p.name}。你的手牌: ${handDisplay}。你缺${p.queSuit ? {w:'萬',t:'條',b:'筒'}[p.queSuit] : '?'}。${sit}。
${opponentsInfo}

用自然口语回复，只用一句话，像真人打牌一样，例如:
- "打三万"
- "打五条"
- "碰"
- "杠"
- "胡了"
- "过，不要"`;
}

// ========== LLM 调用 ==========
async function callLLM(env, systemPrompt, userText, opts = {}) {
  const { temp = 0, useJson = false } = opts;
  const body = {
    model: env.LLM_MODEL || 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText },
    ],
    max_tokens: useJson ? 200 : 100,
    temperature: temp,
  };

  if (useJson) {
    body.response_format = { type: 'json_object' };
  }

  // 关闭思考模式
  const resp = await fetch(env.LLM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.LLM_API_KEY}`,
    },
    body: JSON.stringify({ ...body, extra_body: { thinking: { type: 'disabled' } } }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`LLM ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content.trim();
}

// ========== JSON 解析（兼容 regex 兜底） ==========
function parseJson(content) {
  try { return JSON.parse(content); } catch {}
  const m = content.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  return null;
}

// ========== 路由 ==========
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST') {
      try {
        const body = await request.json();

        // --- /voice: 语音文字 → 操作 JSON ---
        if (url.pathname === '/voice') {
          const { userText, gameState } = body;
          if (!userText || !gameState) {
            return Response.json({ error: 'Missing userText or gameState' }, { status: 400 });
          }
          const prompt = buildVoicePrompt(gameState, 0);
          const content = await callLLM(env, prompt, userText, { temp: 0, useJson: true });
          const parsed = parseJson(content);
          return Response.json(parsed || { action: 'unknown' });
        }

        // --- /bot: 机器人决策 → 自然语言 → 解析为操作 JSON ---
        if (url.pathname === '/bot') {
          const { gameState, playerIndex } = body;
          if (!gameState || playerIndex == null) {
            return Response.json({ error: 'Missing gameState or playerIndex' }, { status: 400 });
          }

          // Step 1: 让 LLM 用自然语言说它要干嘛
          const thinkPrompt = buildBotThinkPrompt(gameState, playerIndex);
          if (!thinkPrompt) return Response.json({ action: 'pass' });

          const naturalSpeech = await callLLM(env, thinkPrompt, '请决定', { temp: 0.8 });

          // Step 2: 用 voice 解析器把自然语言转成 JSON 操作
          const voicePrompt = buildVoicePrompt(gameState, playerIndex);
          const parsed = await callLLM(env, voicePrompt, naturalSpeech, { temp: 0, useJson: true });
          const action = parseJson(parsed);
          return Response.json(action || { action: 'unknown' });
        }

        return Response.json({ error: 'Unknown endpoint' }, { status: 404 });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  },
};