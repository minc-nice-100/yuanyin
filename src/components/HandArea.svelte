<script>
  let { store } = $props();
  let R = $derived(store.rules);
  let p = $derived(store.state.players[0]);
  let s = $derived(store.state);

  let isMyTurn = $derived(
    s.phase === 'playing' && s.currentPlayer === 0
  );
  let isWaiting = $derived(
    s.phase === 'waiting' && s.pendingAction?.responses?.some(r => r.player === 0)
  );
</script>

<div class="hand-area" class:disabled={!isMyTurn} id="hand-area">
  <div class="hand-tiles" id="hand-tiles">
    {#each p.hand as tid, i}
      {@const td = R.tileTypes[tid]}
      <div
        class="hand-tile"
        class:selected={i === store.selectedTile}
        class:drawn-tile={i === store.drawnTileIndex}
        class:que-dim={p.queSuit && td.suit === p.queSuit}
        class:non-interactive={!isMyTurn}
        onclick={isMyTurn ? () => store.handleTileClick(i) : undefined}
        role="button"
        tabindex={isMyTurn ? 0 : -1}
      >
        <img class="tile-icon" src={td.icon} alt={td.char + td.sub} draggable="false" />
      </div>
    {/each}
  </div>
</div>