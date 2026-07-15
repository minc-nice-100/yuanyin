<script>
  import GameTable from './GameTable.svelte';
  import HandArea from './HandArea.svelte';
  import ActionButtons from './ActionButtons.svelte';
  import VoiceArea from './VoiceArea.svelte';

  let { store, onBack } = $props();
</script>

<div class="screen active" id="game-screen">
  <div class="game-top-bar">
    <button class="back-btn" onclick={onBack} aria-label="返回">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <span class="game-title-text">原音麻将</span>
    <div style="width:24px"></div>
  </div>

  <div class="game-table" id="game-table">
    <GameTable {store} />
  </div>

  <div class="exposed-area-wrap">
    <div class="exposed-area" id="exposed-area">
      {#each store.state.players[0].exposed as g}
        {@const cnt = (g.type.includes('gang') || g.type === 'bugang') ? 4 : 3}
        {#each Array(cnt) as _, i}
          <div class="exposed-tile" class:face-down={g.type === 'angang' && i < 3}>
            <img class="exposed-icon" src={g.type === 'angang' && i < 3 ? store.rules.tileBackIcon : store.rules.tileTypes[g.tile].icon} alt="" draggable="false" />
          </div>
        {/each}
        <div class="exposed-spacer"></div>
      {/each}
    </div>
  </div>

  <HandArea {store} />

  {#if store.actionPrompt}
    <div class="action-prompt">{store.actionPrompt}</div>
  {/if}

  <ActionButtons {store} />

  <VoiceArea {store} />

  <div class="game-bottom-bar">
    <button class="icon-btn" onclick={() => store.toggleQuickChat()} aria-label="快捷短语">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </button>
    <button class="icon-btn" onclick={() => store.toggleSettings()} aria-label="设置">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    </button>
  </div>
</div>