<script>
  let { store } = $props();
  let R = $derived(store.rules);
  let p = $derived(store.state.players[0]);
</script>

<div class="hand-area" id="hand-area">
  <div class="hand-tiles" id="hand-tiles">
    {#each p.hand as tid, i}
      {@const td = R.tileTypes[tid]}
      <div
        class="hand-tile"
        class:selected={i === store.selectedTile}
        class:drawn-tile={i === store.drawnTileIndex}
        class:que-dim={p.queSuit && td.suit === p.queSuit}
        onclick={() => store.handleTileClick(i)}
        role="button"
        tabindex="0"
      >
        <img class="tile-icon" src={td.icon} alt={td.char + td.sub} draggable="false" />
      </div>
    {/each}
  </div>
</div>