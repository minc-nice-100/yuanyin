// ===== 原音麻将 — LLM 代理 Worker =====
// 部署: cd llm-proxy && wrangler deploy
// 需要设置 env: LLM_ENDPOINT, LLM_API_KEY, LLM_MODEL (可选)

// ========== 系统提示词（纯规则，不变） ==========
const VOICE_SYSTEM = `你是麻将语音助手。玩家用口语说牌名或操作，你解析成游戏指令。你必须返回JSON。

牌名映射规则:
- "一/1"→"1", "二/2"→"2", "三/3"→"3", "四/4"→"4", "五/5"→"5", "六/6"→"6", "七/7"→"7", "八/8"→"8", "九/9"→"9"
- 万/萬/wan → tile 以 "w" 结尾。如: 三万/三碗/3万/sanwan → "3w"
- 条/條/tiao/鸡/幺鸡/妖姬 → tile 以 "t" 结尾。如: 五条/五跳/5条/wutiao → "5t"；鸡/幺鸡 → "1t"
- 筒/桶/tong → tile 以 "b" 结尾。如: 一筒/一同/1筒/yitong → "1b"
- 碰/peng → 碰, 杠/gang → 杠, 胡/hu → 胡, 过/guo/不要/buyao → 过

关键规则:
1. 语音识别可能产生同音错字，请根据发音推测正确牌名（如"三碗"→三万、"五跳"→五条、"一同"→一筒）
2. 玩家说牌名 → {"action":"discard","tile":"牌ID"}
3. 玩家说碰/杠/胡/过 → {"action":"peng"}或对应操作
4. 完全无法理解 → {"action":"unknown"}`;

const BOT_THINK_SYSTEM = `你是四川麻将玩家，根据手牌和局面用自然口语说你要怎么打。只用一句话回复，像真人打牌一样。

例子:
- "打三万"
- "打五条"
- "碰"
- "杠"
- "胡了"
- "过，不要"`;

// ========== 动态数据（用户消息块） ==========

function voiceUserBlock(state, playerIndex) {
  const p = state.players[playerIndex];
  const hand = p.hand.map(tid => {
    const td = state.tileTypes[tid];
    return `${td.char}${td.sub}(${tid})`;
  }).join(' ');

  const que = p.queSuit ? {w:'萬',t:'條',b:'筒'}[p.queSuit] : '无';

  let avail = '';
  if (state.phase === 'playing' && state.currentPlayer === playerIndex) {
    avail = '你的回合，请出牌';
    if (state.selfActions?.canZiMo) avail += ' 可自摸胡';
  } else if (state.phase === 'waiting' && state.pendingAction) {
    const resp = state.pendingAction.responses?.find(r => r.player === playerIndex);
    if (resp) {
      const acts = resp.actions.map(a => ({hu:'胡',gang:'杠',peng:'碰'}[a])).join('/');
      const td = state.tileTypes[state.pendingAction.tile];
      avail = `${state.players[state.pendingAction.from].name}打出${td.char}${td.sub}，可${acts}或过`;
    }
  }

  return `手牌: ${hand} (共${p.hand.length}张)
缺门: ${que}
${avail}`;
}

function botThinkUserBlock(state, playerIndex) {
  const p = state.players[playerIndex];
  const hand = p.hand.map(tid => {
    const td = state.tileTypes[tid];
    return `${td.char}${td.sub}(${tid})`;
  }).join(' ');

  const que = p.queSuit ? {w:'萬',t:'條',b:'筒'}[p.queSuit] : '?';
  let opp = '';
  for (let i = 0; i < state.players.length; i++) {
    if (i === playerIndex) continue;
    const op = state.players[i];
    const disc = op.discards.slice(-5).map(tid => {
      const td = state.tileTypes[tid];
      return `${td.char}${td.sub}`;
    }).join(' ');
    opp += `\n${op.name}: ${op.handCount}张手牌 缺${op.queSuit ? {w:'萬',t:'條',b:'筒'}[op.queSuit] : '?'} 弃牌:${disc || '无'}`;
  }

  let sit = '';
  if (state.phase === 'playing' && state.currentPlayer === playerIndex) {
    sit = `轮到你出牌，手上有${p.hand.length}张`;
  } else if (state.phase === 'waiting' && state.pendingAction) {
    const resp = state.pendingAction.responses?.find(r => r.player === playerIndex);
    if (!resp) return null;
    const td = state.tileTypes[state.pendingAction.tile];
    sit = `${state.players[state.pendingAction.from].name}打出${td.char}${td.sub}，你可以: ${resp.actions.join('/')} 或过`;
  }

  return `你是${p.name}。缺${que}。
手牌: ${hand}
${sit}${opp}`;
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
  return (data.choices?.[0]?.message?.content || '').trim();
}

function parseJson(content) {
  try { return JSON.parse(content); } catch {}
  const m = content.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

// ========== 路由 ==========
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
          const userBlock = voiceUserBlock(gameState, 0);
          const content = await callLLM(env, VOICE_SYSTEM, `${userBlock}\n\n玩家说: ${userText}`, { temp: 0.2, useJson: true });
          return Response.json(parseJson(content) || { action: 'unknown' });
        }

        if (url.pathname === '/bot') {
          const { gameState, playerIndex } = body;
          if (!gameState || playerIndex == null) {
            return Response.json({ error: 'Missing gameState or playerIndex' }, { status: 400 });
          }

          const thinkBlock = botThinkUserBlock(gameState, playerIndex);
          if (!thinkBlock) return Response.json({ action: 'pass' });

          // Step 1: LLM 自然语言说出决策
          const naturalSpeech = await callLLM(env, BOT_THINK_SYSTEM, thinkBlock, { temp: 1.5 });

          // Step 2: voice 解析器转 JSON
          const voiceBlock = voiceUserBlock(gameState, playerIndex);
          const parsed = await callLLM(env, VOICE_SYSTEM, `${voiceBlock}\n\n玩家说: ${naturalSpeech}`, { temp: 0.2, useJson: true });
          return Response.json(parseJson(parsed) || { action: 'unknown' });
        }

        return Response.json({ error: 'Unknown endpoint' }, { status: 404 });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  },
};