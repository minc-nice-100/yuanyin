<script>
  let { store } = $props();
  let pressed = $state(false);
  let s = $derived(store.state);

  let canAct = $derived(
    (s.phase === 'playing' && s.currentPlayer === 0) ||
    (s.phase === 'waiting' && s.pendingAction?.responses?.some(r => r.player === 0))
  );

  function handlePointerDown(e) {
    e.preventDefault();
    if (!canAct) {
      store.showToast('还没轮到你呢');
      return;
    }
    if (!store.voice) {
      store.initVoice({
        showToast: (msg) => store.showToast(msg),
      });
    }
    store.voice.press();
    pressed = true;
  }

  function handlePointerUp(e) {
    e.preventDefault();
    pressed = false;
    if (store.voice) {
      store.voice.release();
    }
  }

  function handlePointerLeave(e) {
    if (pressed) {
      pressed = false;
      if (store.voice) {
        store.voice.release();
      }
    }
  }
</script>

<div class="voice-area" id="voice-area">
  <p class="voice-hint">{pressed ? '正在听...' : (canAct ? '按住说话并出牌' : '等待中...')}</p>
  <button
    class="voice-btn"
    class:pressed
    class:disabled={!canAct}
    id="voice-btn"
    onpointerdown={handlePointerDown}
    onpointerup={handlePointerUp}
    onpointerleave={handlePointerLeave}
    aria-label="按住说话并出牌"
  >
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
  </button>
</div>