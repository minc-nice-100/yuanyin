// ===== 原音麻将 — LLM 代理 Worker =====
// 部署后通过 ?llm=https://xxx.workers.dev 指定
// 需要设置环境变量: LLM_ENDPOINT, LLM_API_KEY
//
// 接口:
//   POST /voice  — 语音识别结果 → 游戏操作
//   POST /bot    — 机器人出牌决策

function buildVoicePrompt(state) {
  const p = state.players[0];
  const handDisplay = p.hand.map(tid => {
    const td = state.tileTypes[tid];
    return `${td.char}${td.sub}(${tid})`;
  }).join(' ');

  let available = [];
  if (state.phase === 'playing' && state.currentPlayer === 0) {
    available.push('出牌');
    if (state.selfActions?.canZiMo) available.push('自摸胡');
    if (state.selfActions?.canAnGang?.length > 0) available.push('暗杠');
    if (state.selfActions?.canBuGang?.length > 0) available.push('补杠');
  } else if (state.phase === 'waiting' && state.pendingAction) {
    const resp = state.pendingAction.responses?.find(r => r.player === 0);
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

  return `你是麻将语音助手。用户用口语说牌名或操作，你需要解析成游戏指令。

牌名映射规则（必须严格遵守）:
- "一万/一萬/1万" → tile="1w", "二万/二萬/2万" → tile="2w", 以此类推到"九万/九萬/9万" → tile="9w"
- "一条/一條/1条" → tile="1t", "二条/二條/2条" → tile="2t", 以此类推到"九条/九條/9条" → tile="9t"
- "一筒/1筒" → tile="1b", "二筒/2筒" → tile="2b", 以此类推到"九筒/9筒" → tile="9b"

当前手牌: ${handDisplay} (共${p.hand.length}张)
缺门: ${p.queSuit ? {w:'萬',t:'條',b:'筒'}[p.queSuit] : '无'}
阶段: ${state.phase === 'playing' ? '你的回合，请出牌' : '等待响应'}
可操作: ${available.join('、') || '无'}${discardInfo}

规则:
1. 用户说牌名（如"三万""五筒""七条"）→ 必须返回 discard，tile 按映射规则填写，不要管手牌里有没有
2. 用户说"碰/杠/胡/过" → 返回对应操作
3. 只有完全无法理解时才返回 unknown

返回JSON（只返回JSON，不要其他内容）:
{"action":"discard","tile":"牌ID"}  出牌
{"action":"peng"}  碰
{"action":"gang"}  杠
{"action":"hu"}  胡
{"action":"pass"}  过
{"action":"unknown"}  完全无法理解`;
}

function buildBotPrompt(state, playerIndex) {
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

  let discardInfo = '';
  if (state.phase === 'waiting' && state.pendingAction) {
    const td = state.tileTypes[state.pendingAction.tile];
    discardInfo = `\n- ${state.players[state.pendingAction.from].name}打出了${td.char}${td.sub}(${state.pendingAction.tile})`;
  }

  return `你是四川麻将AI玩家${p.name}。根据当前游戏状态，选择最优操作并返回JSON。

当前状态:
- 你是: ${p.name}
- 手牌: ${handDisplay} (共${p.hand.length}张)
- 缺门: ${p.queSuit ? {w:'萬',t:'條',b:'筒'}[p.queSuit] : '无'}
- 阶段: ${state.phase === 'playing' ? '你的回合，请出牌' : '等待响应'}
- 可操作: ${available.join('、') || '无'}${discardInfo}

策略: 优先出缺门牌，优先出孤张，有碰就碰，有杠就杠，能胡就胡。

返回JSON（只返回JSON）:
{"action":"discard","tile":"牌ID"}  出牌
{"action":"peng"}  碰
{"action":"gang"}  杠
{"action":"hu"}  胡
{"action":"pass"}  过`;
}

async function callLLM(env, systemPrompt, userText) {
  const resp = await fetch(env.LLM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.LLM_MODEL || 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
      max_tokens: 100,
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`LLM ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  try {
    return Response.json(JSON.parse(content));
  } catch {
    return Response.json({ action: 'unknown' });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST') {
      try {
        const body = await request.json();

        if (url.pathname === '/voice') {
          const { userText, gameState } = body;
          if (!userText || !gameState) {
            return Response.json({ error: 'Missing userText or gameState' }, { status: 400 });
          }
          return await callLLM(env, buildVoicePrompt(gameState), userText);
        }

        if (url.pathname === '/bot') {
          const { gameState, playerIndex } = body;
          if (!gameState || playerIndex == null) {
            return Response.json({ error: 'Missing gameState or playerIndex' }, { status: 400 });
          }
          const prompt = buildBotPrompt(gameState, playerIndex);
          if (!prompt) return Response.json({ action: 'pass' });
          return await callLLM(env, prompt, '请决定');
        }

        return Response.json({ error: 'Unknown endpoint' }, { status: 404 });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  },
};