<script>
  let { store } = $props();
  let state = $derived(store.state);

  let showPeng = $derived(state.phase === 'waiting' && state.pendingAction?.responses.some(r => r.player === 0 && r.actions.includes('peng')));
  let showGang = $derived(state.phase === 'waiting' && state.pendingAction?.responses.some(r => r.player === 0 && r.actions.includes('gang')));
  let showHu = $derived(state.phase === 'waiting' && state.pendingAction?.responses.some(r => r.player === 0 && r.actions.includes('hu')));
  let showGuo = $derived(state.phase === 'waiting' && state.pendingAction?.responses.some(r => r.player === 0));

  // Self-actions
  let selfGang = $derived(
    state.phase === 'playing' && state.currentPlayer === 0 &&
    store.rules.getSelfActions(state.players[0].hand, state.players[0].exposed, state.players[0].queSuit)
  );
  let showSelfGang = $derived(selfGang && (selfGang.canAnGang.length > 0 || selfGang.canBuGang.length > 0));
  let showSelfHu = $derived(state.phase === 'playing' && state.currentPlayer === 0 && selfGang?.canZiMo);
  let showSelfGuo = $derived(showSelfGang || showSelfHu);
</script>

<div class="action-buttons" id="action-buttons">
  <button class="action-btn btn-peng" style="display:{showPeng ? '' : 'none'}" onclick={() => store.playerAction('peng')}>碰</button>
  <button class="action-btn btn-gang" style="display:{(showGang || showSelfGang) ? '' : 'none'}" onclick={() => store.playerAction('gang')}>杠</button>
  <button class="action-btn btn-hu" style="display:{(showHu || showSelfHu) ? '' : 'none'}" onclick={() => store.playerAction('hu')}>胡</button>
  <button class="action-btn btn-guo" style="display:{(showGuo || showSelfGuo) ? '' : 'none'}" onclick={() => store.playerAction('pass')}>过</button>
</div>