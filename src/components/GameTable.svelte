<script>
  let { store } = $props();
  let R = $derived(store.rules);
  let state = $derived(store.state);
  const names = ['你', '小明', '老王', '小红'];
</script>

<!-- 上家 -->
<div class="player player-top" id="player-top">
  <div class="player-info-top">
    <div class="avatar-wrap">
      <div class="avatar avatar-top">👨</div>
    </div>
    <div class="player-meta">
      <span class="player-name-badge">{names[1]}</span>
      <span class="tile-count" id="count-top">{state.players[1].hand.length}张</span>
    </div>
  </div>
  <div class="opponent-tiles top-tiles" id="top-tiles">
    {#each state.players[1].hand as _}
      <div class="opp-tile">
        <img class="opp-tile-icon" src={R.tileBackIcon} alt="" draggable="false" />
      </div>
    {/each}
    {#if state.players[1].exposed.length > 0}
      <div class="opp-gap"></div>
    {/if}
    {#each state.players[1].exposed as g}
      {@const cnt = (g.type.includes('gang') || g.type === 'bugang') ? 4 : 3}
      {#each Array(cnt) as _, i}
        <div class="opp-tile opp-exposed" class:face-down={g.type === 'angang' && i < 3}>
          <img class="opp-tile-icon" src={g.type === 'angang' && i < 3 ? R.tileBackIcon : R.tileTypes[g.tile].icon} alt="" draggable="false" />
        </div>
      {/each}
      <div class="opp-set-gap"></div>
    {/each}
  </div>
</div>

<!-- 左家 -->
<div class="player player-left" id="player-left">
  <div class="player-info-side">
    <div class="avatar-wrap">
      <div class="avatar avatar-left">👴</div>
    </div>
    <div class="player-meta">
      <span class="player-name-badge name-orange">{names[2]}</span>
      <span class="tile-count" id="count-left">{state.players[2].hand.length}张</span>
    </div>
  </div>
  <div class="opponent-tiles left-tiles" id="left-tiles">
    {#each state.players[2].hand as _}
      <div class="opp-tile">
        <img class="opp-tile-icon" src={R.tileBackIcon} alt="" draggable="false" />
      </div>
    {/each}
    {#if state.players[2].exposed.length > 0}
      <div class="opp-gap"></div>
    {/if}
    {#each state.players[2].exposed as g}
      {@const cnt = (g.type.includes('gang') || g.type === 'bugang') ? 4 : 3}
      {#each Array(cnt) as _, i}
        <div class="opp-tile opp-exposed" class:face-down={g.type === 'angang' && i < 3}>
          <img class="opp-tile-icon" src={g.type === 'angang' && i < 3 ? R.tileBackIcon : R.tileTypes[g.tile].icon} alt="" draggable="false" />
        </div>
      {/each}
      <div class="opp-set-gap"></div>
    {/each}
  </div>
</div>

<!-- 右家 -->
<div class="player player-right" id="player-right">
  <div class="player-info-side">
    <div class="avatar-wrap">
      <div class="avatar avatar-right">👩</div>
    </div>
    <div class="player-meta">
      <span class="player-name-badge name-pink">{names[3]}</span>
      <span class="tile-count" id="count-right">{state.players[3].hand.length}张</span>
    </div>
  </div>
  <div class="opponent-tiles right-tiles" id="right-tiles">
    {#each state.players[3].hand as _}
      <div class="opp-tile">
        <img class="opp-tile-icon" src={R.tileBackIcon} alt="" draggable="false" />
      </div>
    {/each}
    {#if state.players[3].exposed.length > 0}
      <div class="opp-gap"></div>
    {/if}
    {#each state.players[3].exposed as g}
      {@const cnt = (g.type.includes('gang') || g.type === 'bugang') ? 4 : 3}
      {#each Array(cnt) as _, i}
        <div class="opp-tile opp-exposed" class:face-down={g.type === 'angang' && i < 3}>
          <img class="opp-tile-icon" src={g.type === 'angang' && i < 3 ? R.tileBackIcon : R.tileTypes[g.tile].icon} alt="" draggable="false" />
        </div>
      {/each}
      <div class="opp-set-gap"></div>
    {/each}
  </div>
</div>

<!-- 中央信息 -->
<div class="center-info" id="center-info">
  <div class="turn-indicator" id="turn-indicator">
    {state.phase === 'ended' ? '游戏结束' : `${names[state.currentPlayer]} 的回合`}
  </div>
  <div class="remaining-tiles">
    剩余 <span class="score-number" id="remaining-count">{state.wall.length}</span> 张
  </div>
</div>

<!-- 弃牌区 -->
<div class="discard-area" id="discard-area">
  {#each state.players as p, pi}
    {#each p.discards as tid, di}
      {@const td = R.tileTypes[tid]}
      <div class="discard-tile" class:last-discard={state.lastDiscard?.from === pi && di === p.discards.length - 1 && tid === state.lastDiscard?.tile}>
        <img class="discard-icon" src={td.icon} alt={td.char + td.sub} draggable="false" />
      </div>
    {/each}
  {/each}
</div>