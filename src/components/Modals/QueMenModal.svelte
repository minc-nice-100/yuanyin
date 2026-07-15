<script>
  let { store } = $props();
  let show = $state(false);

  $effect(() => {
    show = store.state.phase === 'preparing';
  });

  function select(suit) {
    store.selectQueMen(suit);
    show = false;
  }

  // Count tiles per suit for human player
  let counts = $derived.by(() => {
    const c = { w: 0, t: 0, b: 0 };
    if (store.state.players[0]) {
      for (const t of store.state.players[0].hand) {
        const suit = store.rules.tileTypes[t]?.suit;
        if (c[suit] !== undefined) c[suit]++;
      }
    }
    return c;
  });
</script>

{#if show}
  <div class="quemen-modal show" id="quemen-modal">
    <div class="quemen-content">
      <h2 class="quemen-title">选择缺门</h2>
      <p class="quemen-sub">选择要打缺的花色（该花色牌需全部打出才能胡牌）</p>
      <div class="quemen-options">
        <button class="quemen-btn" onclick={() => select('w')}>
          <span class="quemen-char">万</span>
          <span class="quemen-label">万子 ({counts.w}张)</span>
        </button>
        <button class="quemen-btn quemen-green" onclick={() => select('t')}>
          <span class="quemen-char">条</span>
          <span class="quemen-label">条子 ({counts.t}张)</span>
        </button>
        <button class="quemen-btn quemen-blue" onclick={() => select('b')}>
          <span class="quemen-char">筒</span>
          <span class="quemen-label">筒子 ({counts.b}张)</span>
        </button>
      </div>
    </div>
  </div>
{/if}