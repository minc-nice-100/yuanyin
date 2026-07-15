<script>
  let { store } = $props();
  let show = $derived(store.settingsOpen);
  let sfxOn = $state(true);
  let ttsOn = $state(false);

  function close() {
    store.toggleSettings();
  }
</script>

{#if show}
  <div class="modal-overlay show" onclick={close} role="dialog">
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <h2 class="modal-title">设置</h2>
      <div class="modal-option">
        <span class="modal-option-label">音效</span>
        <div class="toggle-switch on" class:on={sfxOn} onclick={() => { sfxOn = !sfxOn; store.toggleSFX(); }}></div>
      </div>
      <div class="modal-option">
        <span class="modal-option-label">语音播报</span>
        <div class="toggle-switch" class:on={ttsOn} onclick={() => { ttsOn = !ttsOn; store.toggleTTS(); }}></div>
      </div>
      <button class="modal-close-btn" onclick={close}>关闭</button>
    </div>
  </div>
{/if}