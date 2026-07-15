<script>
  import { QUICK_PHRASES } from '../../config.js';

  let { store } = $props();
  let show = $derived(store.quickChatOpen);

  function send(phrase) {
    store.showToast(`💬 你: ${phrase}`);
    store.toggleQuickChat();
  }
</script>

{#if show}
  <div class="quick-chat">
    {#each QUICK_PHRASES as phrase}
      <button class="quick-chat-btn" onclick={() => send(phrase)}>{phrase}</button>
    {/each}
  </div>
{/if}