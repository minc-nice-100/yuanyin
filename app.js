// ===== 四川麻将 (成都麻将) 游戏引擎 =====

// --- 配置 ---
const FUNASR_URL = new URLSearchParams(window.location.search).get('asr') || 'ws://127.0.0.1:10095/';

// --- 音效系统 (Web Audio API) ---
let sfxEnabled = true;
const sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSfx(freq, duration = 0.1, type = 'sine', vol = 0.3) {
  if (!sfxEnabled) return;
  const o = sfxCtx.createOscillator();
  const g = sfxCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, sfxCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, sfxCtx.currentTime + duration);
  o.connect(g); g.connect(sfxCtx.destination);
  o.start(); o.stop(sfxCtx.currentTime + duration);
}
const SFX = {
  discard: () => playSfx(800, 0.08, 'sine', 0.2),
  draw: () => playSfx(600, 0.06, 'sine', 0.15),
  peng: () => { playSfx(523, 0.12, 'square', 0.2); setTimeout(() => playSfx(659, 0.12, 'square', 0.2), 80); },
  gang: () => { playSfx(440, 0.1, 'square', 0.25); setTimeout(() => playSfx(554, 0.1, 'square', 0.25), 70); setTimeout(() => playSfx(659, 0.1, 'square', 0.25), 140); },
  hu: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playSfx(f, 0.2, 'sine', 0.3), i * 100)); },
  select: () => playSfx(1200, 0.04, 'sine', 0.1),
};

// --- 牌型定义: 只有饼/条/万, 27种×4=108张 ---
const SUITS = { w: { name: '萬', color: '' }, t: { name: '條', color: 'green' }, b: { name: '筒', color: 'blue' } };
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const RANK_CHARS = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九' };
// Map game suit codes to icon file suffix: w(万)→m, t(条)→s, b(筒)→p
const SUIT_TO_ICON = { w: 'm', t: 's', b: 'p' };
const TILE_TYPES = {};
for (const s of Object.keys(SUITS)) {
  for (const r of RANKS) {
    TILE_TYPES[r + s] = { char: RANK_CHARS[r], sub: SUITS[s].name, color: SUITS[s].color, suit: s, rank: +r, icon: `tiles/Mpt${r}${SUIT_TO_ICON[s]}.png` };
  }
}
const TILE_BACK_ICON = 'tiles/Mpt00.png';

// --- 游戏状态 ---
let game = {
  wall: [], phase: 'idle', currentPlayer: 0,
  lastDiscard: null, lastDiscardFrom: -1,
  selectedTile: -1, drawnTileIndex: -1, canZiMo: false, canAnGang: [], canBuGang: [],
  waitingActions: [], pendingTile: null, pendingFrom: -1,
  players: [
    { name: '你', hand: [], exposed: [], discards: [], queSuit: null, isHuman: true },
    { name: '小明', hand: [], exposed: [], discards: [], queSuit: null, isHuman: false },
    { name: '老王', hand: [], exposed: [], discards: [], queSuit: null, isHuman: false },
    { name: '小红', hand: [], exposed: [], discards: [], queSuit: null, isHuman: false },
  ],
};

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  // 浏览器兼容性检测（页面加载时）
  checkBrowserCompatibility();

  document.getElementById('start-btn').addEventListener('click', transitionToGame);
  document.getElementById('back-btn').addEventListener('click', transitionToHome);
  document.getElementById('btn-peng').addEventListener('click', playerPeng);
  document.getElementById('btn-gang').addEventListener('click', playerGang);
  document.getElementById('btn-hu').addEventListener('click', playerHu);
  document.getElementById('btn-guo').addEventListener('click', playerPass);
  document.getElementById('btn-settings').addEventListener('click', showSettings);
  document.getElementById('btn-chat').addEventListener('click', showQuickChat);

  const vb = document.getElementById('voice-btn');
  vb.addEventListener('click', startVoice);

  // 缺门按钮
  document.querySelectorAll('.quemen-btn').forEach(btn => {
    btn.addEventListener('click', () => selectQueMen(btn.dataset.suit));
  });

  // Feature cards
  document.querySelectorAll('.feature-card').forEach((card, i) => {
    card.style.opacity = '0'; card.style.transform = 'translateY(20px)';
    setTimeout(() => {
      card.style.transition = 'all 0.5s cubic-bezier(0.34,1.56,0.64,1)';
      card.style.opacity = '1'; card.style.transform = 'translateY(0)';
    }, 300 + i * 120);
  });
});

// ========== 浏览器兼容性检测 ==========
function checkBrowserCompatibility() {
  const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const userAgent = navigator.userAgent.toLowerCase();

  // 检测浏览器类型
  const isChrome = /chrome/.test(userAgent) && !/edg/.test(userAgent);
  const isEdge = /edg/.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
  const isFirefox = /firefox/.test(userAgent);

  if (!hasSpeechAPI) {
    let message = '⚠️ 当前浏览器不支持语音识别功能';

    if (isFirefox) {
      message += '\n\n推荐使用：Chrome、Edge 或 Safari 浏览器';
    } else {
      message += '\n\n请更新浏览器或使用 Chrome、Edge 浏览器';
    }

    showWarningBanner(message);
  } else {
    // 支持语音识别，检测 IP 地理位置
    console.log('✅ 浏览器支持语音识别');
    if (isChrome) console.log('检测到 Chrome 浏览器');
    else if (isEdge) console.log('检测到 Edge 浏览器');
    else if (isSafari) console.log('检测到 Safari 浏览器');

    // 检测用户是否在中国大陆
    checkChinaMainlandIP();
  }
}

// 检测是否为中国大陆 IP
function checkChinaMainlandIP() {
  console.log('开始检测 IP 地理位置...');

  fetch('https://ipapi.co/json/', {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  })
    .then(res => {
      console.log('IP API 响应状态:', res.status);
      if (!res.ok) throw new Error('API 请求失败');
      return res.json();
    })
    .then(data => {
      console.log('IP 位置检测结果:', data.country_name, data.city, 'Code:', data.country_code);

      // 检测是否为中国大陆
      if (data.country_code === 'CN') {
        console.log('检测到中国大陆 IP，显示警告');
        const message = '⚠️ 检测到您在中国大陆\n\n浏览器内置语音识别依赖 Google 服务，可能无法使用\n\n建议：部署本地 FunASR 服务或使用 VPN';
        showWarningBanner(message, 15000);
      } else {
        console.log('非中国大陆 IP，无需提示');
      }
    })
    .catch(err => {
      console.warn('IP 检测失败，跳过地理位置提示:', err);
      // 静默失败，不影响用户体验
    });
}

// 显示警告横幅
function showWarningBanner(message, duration = 10000) {
  setTimeout(() => {
    const warning = document.createElement('div');
    warning.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 152, 0, 0.95);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      max-width: 90%;
      text-align: center;
      white-space: pre-line;
    `;
    warning.textContent = message;
    document.body.appendChild(warning);

    // 自动消失
    setTimeout(() => warning.remove(), duration);
  }, 1000);
}

// ========== 画面切换 ==========
function transitionToGame() {
  document.getElementById('home-screen').classList.remove('active');
  setTimeout(() => {
    document.getElementById('game-screen').classList.add('active');
    startNewGame();
  }, 300);
}
function transitionToHome() {
  document.getElementById('game-screen').classList.remove('active');
  setTimeout(() => document.getElementById('home-screen').classList.add('active'), 300);
}

// ========== 开始新游戏 ==========
function startNewGame() {
  // 构建牌墙
  game.wall = [];
  for (const id of Object.keys(TILE_TYPES)) for (let i = 0; i < 4; i++) game.wall.push(id);
  shuffle(game.wall);

  // 发牌
  for (const p of game.players) { p.hand = []; p.exposed = []; p.discards = []; p.queSuit = null; }
  for (let i = 0; i < 13; i++) for (let p = 0; p < 4; p++) game.players[p].hand.push(game.wall.pop());
  for (const p of game.players) sortHand(p.hand);

  game.phase = 'idle'; game.currentPlayer = 0; game.selectedTile = -1; game.drawnTileIndex = -1;
  game.lastDiscard = null; game.canZiMo = false; game.canAnGang = []; game.canBuGang = [];
  game.waitingActions = [];
  renderGame();
  showToast('请选择缺门花色');
  setTimeout(() => {
    game.phase = 'queMen';
    // Count tiles per suit
    const counts = { w: 0, t: 0, b: 0 };
    for (const t of game.players[0].hand) counts[TILE_TYPES[t].suit]++;
    document.querySelectorAll('.quemen-btn').forEach(btn => {
      const suit = btn.dataset.suit;
      const label = btn.querySelector('.quemen-label');
      const names = { w: '萬子', t: '條子', b: '筒子' };
      label.textContent = `${names[suit]} (${counts[suit]}张)`;
    });
    document.getElementById('quemen-modal').classList.add('show');
    // AI选缺门
    for (let i = 1; i < 4; i++) game.players[i].queSuit = aiPickQue(game.players[i].hand);
  }, 600);
}

// ========== 缺门 ==========
function aiPickQue(hand) {
  const c = { w: 0, t: 0, b: 0 };
  for (const t of hand) c[TILE_TYPES[t].suit]++;
  return Object.entries(c).sort((a, b) => a[1] - b[1])[0][0];
}

function selectQueMen(suit) {
  game.players[0].queSuit = suit;
  document.getElementById('quemen-modal').classList.remove('show');
  showToast(`缺门: ${SUITS[suit].name}子`);
  game.phase = 'playing';
  game.currentPlayer = 0;
  startTurn();
}

// ========== 回合管理 ==========
function startTurn() {
  if (game.phase === 'ended') return;
  if (game.wall.length === 0) { endGame('流局 - 牌堆已空'); return; }

  const p = game.players[game.currentPlayer];
  const drawn = game.wall.pop();
  p.hand.push(drawn);

  if (p.isHuman) {
    checkSelfActions();
    sortHand(p.hand);
    game.drawnTileIndex = p.hand.lastIndexOf(drawn);
    game.phase = 'playing';
    renderGame();
    showToast(`摸牌: ${TILE_TYPES[drawn].char}${TILE_TYPES[drawn].sub}`);
    SFX.draw();
  } else {
    sortHand(p.hand);
    renderGame();
    setTimeout(() => aiTurn(game.currentPlayer), 800);
  }
}

function nextTurn() {
  game.currentPlayer = (game.currentPlayer + 1) % 4;
  startTurn();
}

// ========== 自身可选操作检查 ==========
function checkSelfActions() {
  const p = game.players[0];
  const counts = countTiles(p.hand);

  // 暗杠
  game.canAnGang = [];
  for (const [tile, cnt] of Object.entries(counts)) {
    if (cnt === 4) game.canAnGang.push(tile);
  }

  // 补杠
  game.canBuGang = [];
  for (const g of p.exposed) {
    if (g.type === 'peng' && p.hand.includes(g.tile)) game.canBuGang.push(g.tile);
  }

  // 自摸
  game.canZiMo = canWin(p.hand, p.queSuit);
  renderActionButtons();
}

// ========== 人类出牌 ==========
function handleTileClick(index) {
  if (game.phase !== 'playing' || game.currentPlayer !== 0) return;
  if (game.selectedTile === index) {
    humanDiscard(index);
  } else {
    game.selectedTile = index;
    SFX.select();
    renderPlayerHand();
  }
}

function humanDiscard(index) {
  const p = game.players[0];
  if (index < 0 || index >= p.hand.length) return;
  const tile = p.hand.splice(index, 1)[0];
  p.discards.push(tile);
  game.lastDiscard = tile; game.lastDiscardFrom = 0;
  game.selectedTile = -1;
  game.drawnTileIndex = -1;
  game.canZiMo = false; game.canAnGang = []; game.canBuGang = [];
  showToast(`出牌: ${TILE_TYPES[tile].char}${TILE_TYPES[tile].sub}`);
  SFX.discard();
  sortHand(p.hand);
  renderGame();
  setTimeout(() => afterDiscard(tile, 0), 500);
}

// ========== AI回合 ==========
function aiTurn(pi) {
  if (game.phase === 'ended') return;
  const p = game.players[pi];
  const counts = countTiles(p.hand);

  // 暗杠
  for (const [tile, cnt] of Object.entries(counts)) {
    if (cnt === 4 && TILE_TYPES[tile].suit !== p.queSuit) {
      doAnGang(pi, tile); return;
    }
  }
  // 补杠
  for (const g of p.exposed) {
    if (g.type === 'peng' && p.hand.includes(g.tile)) {
      doBuGang(pi, g.tile); return;
    }
  }
  // 自摸
  if (canWin(p.hand, p.queSuit)) { doHu(pi, null, true); return; }

  // 出牌
  const di = aiChooseDiscard(p);
  const tile = p.hand.splice(di, 1)[0];
  p.discards.push(tile);
  game.lastDiscard = tile; game.lastDiscardFrom = pi;
  const td = TILE_TYPES[tile];
  showToast(`${p.name} 出牌: ${td.char}${td.sub}`);
  sortHand(p.hand);
  renderGame();
  setTimeout(() => afterDiscard(tile, pi), 500);
}

function aiChooseDiscard(p) {
  // 优先出缺门牌
  for (let i = 0; i < p.hand.length; i++) {
    if (TILE_TYPES[p.hand[i]].suit === p.queSuit) return i;
  }
  // 出孤张
  const counts = countTiles(p.hand);
  let best = 0, bestScore = 99;
  for (let i = 0; i < p.hand.length; i++) {
    const td = TILE_TYPES[p.hand[i]];
    let score = counts[p.hand[i]];
    const prev = (td.rank > 1) ? (td.rank - 1) + td.suit : null;
    const next = (td.rank < 9) ? (td.rank + 1) + td.suit : null;
    if (prev && counts[prev]) score += 1;
    if (next && counts[next]) score += 1;
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return best;
}

// ========== 出牌后检查 ==========
function afterDiscard(tile, fromPI) {
  if (game.phase === 'ended') return;

  // 检查人类玩家能否碰/杠/胡
  if (fromPI !== 0) {
    const actions = [];
    const h = game.players[0].hand;
    const c = countTiles(h);
    if (canWin([...h, tile], game.players[0].queSuit)) actions.push('hu');
    if (c[tile] === 3) actions.push('gang');
    if (c[tile] >= 2) actions.push('peng');
    if (actions.length > 0) {
      game.phase = 'waitAction';
      game.waitingActions = actions;
      game.pendingTile = tile;
      game.pendingFrom = fromPI;
      // Show prompt
      const td = TILE_TYPES[tile];
      const pName = game.players[fromPI].name;
      const actText = actions.map(a=>({hu:'胡',gang:'杠',peng:'碰'}[a])).join('/');
      showActionPrompt(`${pName}打出 ${td.char}${td.sub}，可以${actText}`);
      renderActionButtons();
      return;
    }
  }

  // 检查AI
  for (let i = 1; i < 4; i++) {
    if (i === fromPI) continue;
    const h = game.players[i].hand;
    const c = countTiles(h);
    if (canWin([...h, tile], game.players[i].queSuit)) { doHu(i, tile, false); return; }
    if (c[tile] === 3) { doZhiGang(i, tile, fromPI); return; }
    if (c[tile] >= 2) { doPeng(i, tile, fromPI); return; }
  }

  nextTurn();
}

// ========== 碰 ==========
function playerPeng() {
  if (!game.waitingActions.includes('peng')) return;
  doPeng(0, game.pendingTile, game.pendingFrom);
}

function doPeng(pi, tile, fromPI) {
  const p = game.players[pi];
  let rm = 0;
  p.hand = p.hand.filter(t => { if (t === tile && rm < 2) { rm++; return false; } return true; });
  const d = game.players[fromPI].discards;
  const idx = d.lastIndexOf(tile); if (idx >= 0) d.splice(idx, 1);
  p.exposed.push({ type: 'peng', tile });
  sortHand(p.hand);
  game.currentPlayer = pi;
  game.phase = 'playing'; game.waitingActions = [];
  showToast(`${p.name} 碰！${TILE_TYPES[tile].char}${TILE_TYPES[tile].sub}`);
  SFX.peng();
  renderGame();

  if (p.isHuman) { checkSelfActions(); renderActionButtons(); }
  else { setTimeout(() => { aiDiscardAfterAction(pi); }, 600); }
}

// ========== 杠 ==========
function playerGang() {
  if (game.phase === 'waitAction' && game.waitingActions.includes('gang')) {
    doZhiGang(0, game.pendingTile, game.pendingFrom);
  } else if (game.phase === 'playing' && game.canAnGang.length > 0) {
    doAnGang(0, game.canAnGang[0]);
  } else if (game.phase === 'playing' && game.canBuGang.length > 0) {
    doBuGang(0, game.canBuGang[0]);
  }
}

function doZhiGang(pi, tile, fromPI) {
  const p = game.players[pi];
  let rm = 0;
  p.hand = p.hand.filter(t => { if (t === tile && rm < 3) { rm++; return false; } return true; });
  const d = game.players[fromPI].discards;
  const idx = d.lastIndexOf(tile); if (idx >= 0) d.splice(idx, 1);
  p.exposed.push({ type: 'zhigang', tile });
  sortHand(p.hand);
  game.currentPlayer = pi; game.phase = 'playing'; game.waitingActions = [];
  showToast(`${p.name} 杠！${TILE_TYPES[tile].char}${TILE_TYPES[tile].sub} (直杠)`);
  SFX.gang();
  renderGame();
  setTimeout(() => gangDraw(pi), 600);
}

function doAnGang(pi, tile) {
  const p = game.players[pi];
  p.hand = p.hand.filter(t => t !== tile);
  p.exposed.push({ type: 'angang', tile });
  sortHand(p.hand);
  showToast(`${p.name} 暗杠！`);
  SFX.gang();
  renderGame();
  setTimeout(() => gangDraw(pi), 600);
}

function doBuGang(pi, tile) {
  const p = game.players[pi];
  const idx = p.hand.indexOf(tile); if (idx >= 0) p.hand.splice(idx, 1);
  for (const g of p.exposed) { if (g.type === 'peng' && g.tile === tile) { g.type = 'bugang'; break; } }
  sortHand(p.hand);
  showToast(`${p.name} 补杠！${TILE_TYPES[tile].char}${TILE_TYPES[tile].sub}`);
  SFX.gang();
  renderGame();
  setTimeout(() => gangDraw(pi), 600);
}

function gangDraw(pi) {
  if (game.wall.length === 0) { endGame('流局'); return; }
  const p = game.players[pi];
  const drawn = game.wall.pop();
  p.hand.push(drawn);
  sortHand(p.hand);
  renderGame();
  if (p.isHuman) { checkSelfActions(); game.phase = 'playing'; renderGame(); }
  else { setTimeout(() => aiTurn(pi), 600); }
}

// ========== 胡 ==========
function playerHu() {
  if (game.phase === 'waitAction' && game.waitingActions.includes('hu')) {
    doHu(0, game.pendingTile, false);
  } else if (game.phase === 'playing' && game.canZiMo) {
    doHu(0, null, true);
  }
}

function doHu(pi, tile, isSelfDraw) {
  const p = game.players[pi];
  let hand = [...p.hand];
  if (tile) hand.push(tile);
  if (tile) { const d = game.players[game.lastDiscardFrom]?.discards; if (d) { const i = d.lastIndexOf(tile); if (i >= 0) d.splice(i, 1); } }

  const fan = calcFan(hand, p.exposed, isSelfDraw);
  const score = Math.pow(2, Math.min(fan, 3));
  const info = isSelfDraw ? '自摸' : '点炮';

  game.phase = 'ended'; game.waitingActions = [];
  SFX.hu();
  celebrateWin();
  renderGame();
  showHuModal(p.name, hand, p.exposed, fan, score, info, tile);
}

// ========== 过 ==========
function playerPass() {
  game.phase = 'playing'; game.waitingActions = [];
  renderActionButtons();
  // 继续检查AI
  for (let i = 1; i < 4; i++) {
    if (i === game.pendingFrom) continue;
    const h = game.players[i].hand, c = countTiles(h);
    if (canWin([...h, game.pendingTile], game.players[i].queSuit)) { doHu(i, game.pendingTile, false); return; }
    if (c[game.pendingTile] === 3) { doZhiGang(i, game.pendingTile, game.pendingFrom); return; }
    if (c[game.pendingTile] >= 2) { doPeng(i, game.pendingTile, game.pendingFrom); return; }
  }
  nextTurn();
}

function aiDiscardAfterAction(pi) {
  const p = game.players[pi];
  const di = aiChooseDiscard(p);
  const tile = p.hand.splice(di, 1)[0];
  p.discards.push(tile);
  game.lastDiscard = tile; game.lastDiscardFrom = pi;
  sortHand(p.hand); renderGame();
  setTimeout(() => afterDiscard(tile, pi), 500);
}

// ========== 胡牌判定 ==========
function canWin(hand, queSuit) {
  if (!queSuit) return false;
  for (const t of hand) if (TILE_TYPES[t].suit === queSuit) return false;
  if (hand.length % 3 !== 2) return false;
  if (hand.length === 14 && isSevenPairs(hand)) return true;
  return canDecompose(hand);
}

function isSevenPairs(hand) {
  const c = countTiles(hand);
  return Object.values(c).every(v => v === 2 || v === 4) && hand.length === 14;
}

function canDecompose(hand) {
  const c = countTiles(hand);
  for (const tile of Object.keys(c)) {
    if (c[tile] >= 2) {
      c[tile] -= 2;
      if (canFormSets(c)) { c[tile] += 2; return true; }
      c[tile] += 2;
    }
  }
  return false;
}

function canFormSets(counts) {
  const tileOrder = Object.keys(TILE_TYPES);
  let first = null;
  for (const t of tileOrder) { if (counts[t] > 0) { first = t; break; } }
  if (!first) return true;
  const td = TILE_TYPES[first];
  // 刻子
  if (counts[first] >= 3) {
    counts[first] -= 3;
    if (canFormSets(counts)) { counts[first] += 3; return true; }
    counts[first] += 3;
  }
  // 顺子
  if (td.rank <= 7) {
    const n1 = (td.rank + 1) + td.suit, n2 = (td.rank + 2) + td.suit;
    if ((counts[n1] || 0) > 0 && (counts[n2] || 0) > 0) {
      counts[first]--; counts[n1]--; counts[n2]--;
      if (canFormSets(counts)) { counts[first]++; counts[n1]++; counts[n2]++; return true; }
      counts[first]++; counts[n1]++; counts[n2]++;
    }
  }
  return false;
}

// ========== 番数计算 ==========
function calcFan(hand, exposed, isSelfDraw) {
  let fan = 0;
  if (isSelfDraw) fan++;
  if (isAllTriplets(hand)) fan++;
  if (isOneSuit(hand, exposed)) fan += 2;
  if (hand.length === 14 && isSevenPairs(hand)) fan += 2;
  // 根: count gangs
  fan += exposed.filter(g => g.type.includes('gang')).length;
  return Math.min(fan, 3);
}

function isAllTriplets(hand) {
  const c = countTiles(hand);
  for (const t of Object.keys(c)) {
    if (c[t] >= 2) {
      c[t] -= 2;
      if (canFormTripletsOnly({ ...c })) { c[t] += 2; return true; }
      c[t] += 2;
    }
  }
  return false;
}
function canFormTripletsOnly(c) {
  for (const [t, v] of Object.entries(c)) {
    if (v > 0) { if (v < 3) return false; c[t] -= 3; const r = canFormTripletsOnly(c); c[t] += 3; return r; }
  }
  return true;
}
function isOneSuit(hand, exposed) {
  const suits = new Set();
  for (const t of hand) suits.add(TILE_TYPES[t].suit);
  for (const g of exposed) suits.add(TILE_TYPES[g.tile].suit);
  return suits.size === 1;
}

// ========== 渲染 ==========
function renderGame() {
  renderPlayerHand();
  renderExposed();
  renderOpponents();
  renderCenter();
  renderDiscards();
  renderActionButtons();
}

function renderPlayerHand() {
  const el = document.getElementById('hand-tiles');
  el.innerHTML = '';
  const p = game.players[0];
  p.hand.forEach((tid, i) => {
    const td = TILE_TYPES[tid];
    const div = document.createElement('div');
    div.className = 'hand-tile';
    if (i === game.selectedTile) div.classList.add('selected');
    if (i === game.drawnTileIndex) div.classList.add('drawn-tile');
    if (p.queSuit && td.suit === p.queSuit) div.classList.add('que-dim');

    const img = document.createElement('img');
    img.className = 'tile-icon';
    img.src = td.icon;
    img.alt = td.char + td.sub;
    img.draggable = false;
    div.appendChild(img);
    div.addEventListener('click', () => handleTileClick(i));
    el.appendChild(div);
  });
}

function renderExposed() {
  const el = document.getElementById('exposed-area');
  el.innerHTML = '';
  for (const g of game.players[0].exposed) {
    const cnt = g.type.includes('gang') || g.type === 'bugang' ? 4 : 3;
    for (let i = 0; i < cnt; i++) {
      const div = document.createElement('div');
      div.className = 'exposed-tile';
      if (g.type === 'angang' && i < 3) {
        div.classList.add('face-down');
        const img = document.createElement('img'); img.className = 'exposed-icon'; img.src = TILE_BACK_ICON; img.draggable = false;
        div.appendChild(img);
      } else {
        const td = TILE_TYPES[g.tile];
        const img = document.createElement('img'); img.className = 'exposed-icon'; img.src = td.icon; img.draggable = false;
        div.appendChild(img);
      }
      el.appendChild(div);
    }
    // spacer
    const sp = document.createElement('div'); sp.className = 'exposed-spacer'; el.appendChild(sp);
  }
}

function renderOpponents() {
  const positions = [
    { pi: 1, tilesEl: 'top-tiles', countEl: 'count-top' },
    { pi: 2, tilesEl: 'left-tiles', countEl: 'count-left' },
    { pi: 3, tilesEl: 'right-tiles', countEl: 'count-right' },
  ];
  for (const pos of positions) {
    const p = game.players[pos.pi];
    const el = document.getElementById(pos.tilesEl);
    el.innerHTML = '';
    // Update tile count
    document.getElementById(pos.countEl).textContent = `${p.hand.length}张`;
    // Face-down hand tiles
    for (let i = 0; i < p.hand.length; i++) {
      const d = document.createElement('div'); d.className = 'opp-tile';
      const img = document.createElement('img'); img.className = 'opp-tile-icon'; img.src = TILE_BACK_ICON; img.draggable = false;
      d.appendChild(img);
      el.appendChild(d);
    }
    // Exposed sets (碰/杠) - separated, only middle tile shows face
    if (p.exposed.length > 0) {
      const gap = document.createElement('div'); gap.className = 'opp-gap'; el.appendChild(gap);
    }
    for (const g of p.exposed) {
      const cnt = g.type.includes('gang') || g.type === 'bugang' ? 4 : 3;
      const td = TILE_TYPES[g.tile];
      for (let i = 0; i < cnt; i++) {
        const d = document.createElement('div');
        d.className = 'opp-tile opp-exposed';
        if (g.type === 'angang' && i < 3) {
          d.classList.add('face-down');
          const img = document.createElement('img'); img.className = 'opp-tile-icon'; img.src = TILE_BACK_ICON; img.draggable = false;
          d.appendChild(img);
        } else {
          const img = document.createElement('img'); img.className = 'opp-tile-icon'; img.src = td.icon; img.draggable = false;
          d.appendChild(img);
        }
        el.appendChild(d);
      }
      const sg = document.createElement('div'); sg.className = 'opp-set-gap'; el.appendChild(sg);
    }
  }
}

function renderCenter() {
  document.getElementById('remaining-count').textContent = game.wall.length;
  // Update turn indicator
  const names = ['你', '小明', '老王', '小红'];
  const ti = document.getElementById('turn-indicator');
  if (ti) ti.textContent = game.phase === 'ended' ? '游戏结束' : `${names[game.currentPlayer]} 的回合`;
}

function renderDiscards() {
  const el = document.getElementById('discard-area');
  el.innerHTML = '';
  for (let pi = 0; pi < game.players.length; pi++) {
    const p = game.players[pi];
    for (let di = 0; di < p.discards.length; di++) {
      const tid = p.discards[di];
      const td = TILE_TYPES[tid];
      const div = document.createElement('div');
      div.className = 'discard-tile';
      // Highlight the last discarded tile
      if (pi === game.lastDiscardFrom && di === p.discards.length - 1 && tid === game.lastDiscard) {
        div.classList.add('last-discard');
      }
      const img = document.createElement('img');
      img.className = 'discard-icon';
      img.src = td.icon;
      img.alt = td.char + td.sub;
      img.draggable = false;
      div.appendChild(img);
      el.appendChild(div);
    }
  }
}

function renderActionButtons() {
  const btnP = document.getElementById('btn-peng');
  const btnG = document.getElementById('btn-gang');
  const btnH = document.getElementById('btn-hu');
  const btnGuo = document.getElementById('btn-guo');

  if (game.phase === 'waitAction') {
    btnP.style.display = game.waitingActions.includes('peng') ? '' : 'none';
    btnG.style.display = game.waitingActions.includes('gang') ? '' : 'none';
    btnH.style.display = game.waitingActions.includes('hu') ? '' : 'none';
    btnGuo.style.display = '';
    btnP.disabled = false; btnG.disabled = false; btnH.disabled = false;
  } else if (game.phase === 'playing' && game.currentPlayer === 0) {
    btnP.style.display = 'none';
    btnG.style.display = (game.canAnGang.length > 0 || game.canBuGang.length > 0) ? '' : 'none';
    btnH.style.display = game.canZiMo ? '' : 'none';
    btnGuo.style.display = (game.canAnGang.length > 0 || game.canBuGang.length > 0 || game.canZiMo) ? '' : 'none';
    btnG.disabled = false; btnH.disabled = false;
  } else {
    btnP.style.display = 'none'; btnG.style.display = 'none';
    btnH.style.display = 'none'; btnGuo.style.display = 'none';
  }
}

// ========== 工具函数 ==========
function countTiles(hand) {
  const c = {};
  for (const t of hand) c[t] = (c[t] || 0) + 1;
  return c;
}
function sortHand(hand) {
  const order = Object.keys(TILE_TYPES);
  hand.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
function endGame(reason) {
  game.phase = 'ended'; game.waitingActions = [];
  showToast(`游戏结束: ${reason}`);
  renderGame();
  // Show replay button
  showEndModal(reason);
}

// ========== 庆祝动画 ==========
function celebrateWin() {
  if (!document.getElementById('confetti-style')) {
    const s = document.createElement('style'); s.id = 'confetti-style';
    s.textContent = `@keyframes confettiFall{0%{opacity:1;transform:scale(0) translateY(0) rotate(0)}50%{opacity:1;transform:scale(1.5) translateY(-30px) rotate(180deg)}100%{opacity:0;transform:scale(.5) translateY(60px) rotate(360deg)}}`;
    document.head.appendChild(s);
  }
  const table = document.getElementById('game-table');
  for (let i = 0; i < 20; i++) {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;width:8px;height:8px;background:${['#c8a96e', '#e87ca0', '#4A9D5B', '#7EC8E3', '#f5d5a0'][i % 5]};border-radius:50%;left:${Math.random() * 100}%;top:${Math.random() * 100}%;z-index:30;pointer-events:none;animation:confettiFall 1.5s ease-out forwards;`;
    table.appendChild(d); setTimeout(() => d.remove(), 1500);
  }
}

// ========== 设置弹窗 ==========
let ttsEnabled = false;
function showSettings() {
  let ov = document.querySelector('.modal-overlay');
  if (!ov) {
    ov = document.createElement('div'); ov.className = 'modal-overlay';
    ov.innerHTML = `<div class="modal-content"><h2 class="modal-title">设置</h2><div class="modal-option"><span class="modal-option-label">音效</span><div class="toggle-switch on" data-setting="sfx"></div></div><div class="modal-option"><span class="modal-option-label">语音播报</span><div class="toggle-switch" data-setting="tts"></div></div><button class="modal-close-btn">关闭</button></div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll('.toggle-switch').forEach(s => s.addEventListener('click', () => {
      s.classList.toggle('on');
      if (s.dataset.setting === 'sfx') sfxEnabled = s.classList.contains('on');
      if (s.dataset.setting === 'tts') ttsEnabled = s.classList.contains('on');
    }));
    ov.querySelector('.modal-close-btn').addEventListener('click', () => ov.classList.remove('show'));
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('show'); });
  }
  ov.classList.add('show');
}

// ========== 快捷短语 ==========
const QUICK_PHRASES = ['不急慢慢来', '快点出牌', '厉害！', '再想想', '运气好', '下把加油'];
function showQuickChat() {
  let panel = document.querySelector('.quick-chat');
  if (panel) { panel.remove(); return; }
  panel = document.createElement('div');
  panel.className = 'quick-chat';
  QUICK_PHRASES.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'quick-chat-btn';
    btn.textContent = p;
    btn.addEventListener('click', () => { showToast(`💬 你: ${p}`); panel.remove(); });
    panel.appendChild(btn);
  });
  document.getElementById('game-screen').appendChild(panel);
  setTimeout(() => { document.addEventListener('click', function dismiss(e) { if (!panel.contains(e.target)) { panel.remove(); document.removeEventListener('click', dismiss); } }, { once: true }); }, 0);
}

// ========== Toast ==========
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.remove('show'), 2000);
  if (ttsEnabled && window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance(msg.replace(/[🎉💬]/g, ''));
    u.lang = 'zh-CN'; u.rate = 1.2;
    window.speechSynthesis.speak(u);
  }
}

// ========== 胡牌结果弹窗 ==========
function showHuModal(name, hand, exposed, fan, score, method, winTile) {
  // Remove old modal
  document.querySelector('.hu-modal')?.remove();

  const modal = document.createElement('div');
  modal.className = 'hu-modal';

  // Build tiles HTML
  let tilesHtml = '';
  // Exposed sets first
  for (const g of exposed) {
    const td = TILE_TYPES[g.tile];
    const cnt = g.type.includes('gang') || g.type === 'bugang' ? 4 : 3;
    const label = g.type === 'peng' ? '碰' : '杠';
    for (let i = 0; i < cnt; i++) {
      tilesHtml += `<div class="hu-tile"><img class="hu-icon" src="${td.icon}" draggable="false"></div>`;
    }
    tilesHtml += '<div class="hu-sep"></div>';
  }
  // Hand tiles
  const sorted = [...hand]; sortHand(sorted);
  for (const tid of sorted) {
    const td = TILE_TYPES[tid];
    const isWin = winTile && tid === winTile;
    tilesHtml += `<div class="hu-tile${isWin ? ' hu-win-tile' : ''}"><img class="hu-icon" src="${td.icon}" draggable="false"></div>`;
  }

  // Fan details
  let fanDetails = [];
  if (method === '自摸') fanDetails.push('自摸 +1番');
  if (isAllTriplets(hand)) fanDetails.push('对对和 +1番');
  if (isOneSuit(hand, exposed)) fanDetails.push('清一色 +2番');
  if (hand.length === 14 && isSevenPairs(hand)) fanDetails.push('七对子 +2番');
  const gangCnt = exposed.filter(g => g.type.includes('gang')).length;
  if (gangCnt > 0) fanDetails.push(`根×${gangCnt} +${gangCnt}番`);
  if (fanDetails.length === 0) fanDetails.push('素胡 0番');

  modal.innerHTML = `
    <div class="hu-content">
      <div class="hu-header">🎉 ${name} ${method}！</div>
      <div class="hu-tiles-wrap">${tilesHtml}</div>
      <div class="hu-fan-info">
        <div class="hu-fan-details">${fanDetails.join(' · ')}</div>
        <div class="hu-score">${fan}番 · ${score}倍</div>
      </div>
      <button class="hu-close-btn" onclick="this.closest('.hu-modal').remove()">确定</button>
      <button class="hu-replay-btn" onclick="this.closest('.hu-modal').remove(); startNewGame()">再来一局</button>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
}

function showEndModal(reason) {
  document.querySelector('.hu-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'hu-modal';
  modal.innerHTML = `
    <div class="hu-content">
      <div class="hu-header">${reason}</div>
      <button class="hu-replay-btn" onclick="this.closest('.hu-modal').remove(); startNewGame()">再来一局</button>
      <button class="hu-close-btn" onclick="this.closest('.hu-modal').remove()">返回</button>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
}

// ========== 操作提示横幅 ==========
function showActionPrompt(msg) {
  let el = document.querySelector('.action-prompt');
  if (!el) {
    el = document.createElement('div');
    el.className = 'action-prompt';
    const btns = document.getElementById('action-buttons');
    btns.parentNode.insertBefore(el, btns);
  }
  el.innerHTML = msg;
  el.style.display = '';
}

function hideActionPrompt() {
  const el = document.querySelector('.action-prompt');
  if (el) el.style.display = 'none';
}

// Override playerPass/playerPeng/playerGang/playerHu to also hide prompt
const _origPass = playerPass;
playerPass = function() { hideActionPrompt(); _origPass(); };

// ========== 语音识别 (FunASR WebSocket) ==========
let asrClient = null;
let useNativeFallback = false;

function initVoiceRecognition() {
  if (!asrClient) {
    if (useNativeFallback) {
      asrClient = new window.NativeSpeechClient();
    } else {
      // 连接 FunASR 服务（可通过 URL 参数 ?asr=ws://host:port/ 覆盖）
      asrClient = new window.FunASRClient(FUNASR_URL);
    }
    
    asrClient.onConnect = () => {
      document.getElementById('voice-btn').classList.add('recording');
      document.querySelector('.voice-hint').textContent = '正在听...';
      const typeStr = useNativeFallback ? '内置' : 'FunASR';
      showToast(`${typeStr}语音连接成功，请说话`);
    };
    
    asrClient.onDisconnect = () => {
      document.getElementById('voice-btn').classList.remove('recording');
      document.querySelector('.voice-hint').textContent = '按住说话并出牌';
    };
    
    asrClient.onError = (err) => {
      if (!useNativeFallback && err.includes('连接失败')) {
        showToast('FunASR连接失败，正在为您切换为浏览器内置语音...');
        useNativeFallback = true;
        if (asrClient) {
          asrClient.stop();
          asrClient = null;
        }
        // 当 FunASR 连接失败时，自动重试加载降级方案
        setTimeout(() => startVoice(), 800);
      } else {
        showToast(err);
      }
    };
    
    asrClient.onResult = (text, isFinal) => {
      if (text) {
        showToast(`识别: ${text}`);
        handleVoiceCommand(text);
        
        if (isFinal) {
          asrClient.stop();
        }
      }
    };
  }
  return asrClient;
}

function startVoice() {
  // 浏览器兼容性检测
  if (useNativeFallback || (!asrClient && !window.FunASRClient)) {
    const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!hasSpeechAPI) {
      showToast('当前浏览器不支持语音识别，请使用 Chrome、Edge 或 Safari 浏览器', 5000);
      return;
    }
  }

  const client = initVoiceRecognition();
  if (client.isRecording) {
    client.stop(); // 再次点击停止录音
  } else {
    client.start();
  }
}

function handleVoiceCommand(text) {
  // 全局指令匹配
  if (text.includes('开始') || text.includes('开始游戏')) {
    if (game.phase === 'idle') {
      transitionToGame();
      return;
    }
  }

  if (game.phase === 'waitAction') { // 别人出牌，等待我碰杠胡
    if (text.includes('碰')) {
      if (game.waitingActions.includes('peng')) playerPeng();
      else showToast('当前无法碰牌');
      return;
    }
    if (text.includes('杠')) {
      if (game.waitingActions.includes('gang')) playerGang();
      else showToast('当前无法杠牌');
      return;
    }
    if (text.includes('胡')) {
      if (game.waitingActions.includes('hu')) playerHu();
      else showToast('当前无法胡牌');
      return;
    }
    if (text.includes('过') || text.includes('不要')) {
      playerPass();
      return;
    }
  } else if (game.phase === 'playing' && game.currentPlayer === 0) { // 我的出牌回合
    if (text.includes('胡')) {
      if (game.canZiMo) playerHu();
      else showToast('当前无法自摸');
      return;
    }
    if (text.includes('杠')) { // 检查是否有暗杠或加杠
      const actions = [...game.canAnGang, ...game.canBuGang];
      if (actions.length > 0) {
        // 如果有多个杠，自动选第一个（可以通过语音具体张数优化）
        playerGang();
      } else {
        showToast('当前没有可以杠的牌');
      }
      return;
    }

    // Map spoken text to tile IDs (出牌)
    const numMap = {'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,
      '1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9};
    const suitMap = {'万':'w','萬':'w','条':'t','條':'t','筒':'b','饼':'b'};

    let num = null, suit = null;
    for (const [k,v] of Object.entries(numMap)) { if (text.includes(k)) num = v; }
    for (const [k,v] of Object.entries(suitMap)) { if (text.includes(k)) suit = v; }

    if (num && suit) {
      const tileId = num + suit;
      const idx = game.players[0].hand.indexOf(tileId);
      if (idx >= 0) {
        humanDiscard(idx);
      } else {
        showToast(`手中没有 ${TILE_TYPES[tileId]?.char || ''}${TILE_TYPES[tileId]?.sub || ''}`);
      }
    } else {
      showToast('请说"碰/杠/胡"或"二筒"等牌名');
    }
  } else {
    showToast('当前无法进行该操作');
  }
}
