<script>
  let { store, winResult, onClose, onReplay } = $props();
  let show = $derived(!!winResult);
  let details = $derived(winResult ? store.rules.getFanDetails(winResult.hand, winResult.exposed, winResult.isSelfDraw) : []);

  function replay() {
    onClose();
    onReplay();
  }
</script>

{#if show && winResult}
  <div class="hu-modal show" onclick={onClose} role="dialog">
    <div class="hu-content" onclick={(e) => e.stopPropagation()}>
      <div class="hu-header">🎉 {winResult.name} {winResult.method}！</div>

      <div class="hu-tiles-wrap">
        {#each winResult.exposed as g}
          {@const cnt = (g.type.includes('gang') || g.type === 'bugang') ? 4 : 3}
          {#each Array(cnt) as _}
            <div class="hu-tile">
              <img class="hu-icon" src={store.rules.tileTypes[g.tile].icon} alt="" draggable="false" />
            </div>
          {/each}
          <div class="hu-sep"></div>
        {/each}
        {#each [...winResult.hand].sort((a, b) => { const o = Object.keys(store.rules.tileTypes); return o.indexOf(a) - o.indexOf(b); }) as tid}
          <div class="hu-tile" class:hu-win-tile={winResult.winTile && tid === winResult.winTile}>
            <img class="hu-icon" src={store.rules.tileTypes[tid].icon} alt="" draggable="false" />
          </div>
        {/each}
      </div>

      <div class="hu-fan-info">
        <div class="hu-fan-details">{details.length > 0 ? details.join(' · ') : '素胡 0番'}</div>
        <div class="hu-score">{winResult.fan}番 · {winResult.score}倍</div>
      </div>

      <button class="hu-replay-btn" onclick={replay}>再来一局</button>
      <button class="hu-close-btn" onclick={onClose}>确定</button>
    </div>
  </div>
{/if}