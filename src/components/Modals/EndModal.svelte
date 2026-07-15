<script>
  let { store, reason, onClose, onReplay } = $props();

  let showEnd = $derived(store.state.phase === 'ended' && !store.state.winResult);

  function replay() {
    onReplay();
    const result = store.startNewGame();
  }
</script>

{#if showEnd}
  <div class="hu-modal show" onclick={onClose} role="dialog">
    <div class="hu-content" onclick={(e) => e.stopPropagation()}>
      <div class="hu-header">{reason || '流局'}</div>
      <button class="hu-replay-btn" onclick={replay}>再来一局</button>
      <button class="hu-close-btn" onclick={onClose}>返回</button>
    </div>
  </div>
{/if}