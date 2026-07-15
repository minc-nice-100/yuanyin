<script>
  import { getStore } from './gameStore.svelte.js';
  import HomeScreen from './components/HomeScreen.svelte';
  import GameScreen from './components/GameScreen.svelte';
  import Toast from './components/Modals/Toast.svelte';
  import QueMenModal from './components/Modals/QueMenModal.svelte';
  import SettingsModal from './components/Modals/SettingsModal.svelte';
  import HuModal from './components/Modals/HuModal.svelte';
  import EndModal from './components/Modals/EndModal.svelte';
  import QuickChat from './components/Modals/QuickChat.svelte';

  const store = getStore();

  let screen = $state('home');
  let huResult = $state(null);
  let endReason = $state('');

  function goToGame() {
    screen = 'game';
    const result = store.startNewGame();
    if (result.type === 'quemen') {
      // QueMenModal will show automatically
    }
  }

  function goToHome() {
    screen = 'home';
    huResult = null;
    endReason = '';
  }

  // Listen for engine result events
  $effect(() => {
    // Watch for ended state
    const st = store.state;
    if (st.phase === 'ended' && st.winResult) {
      huResult = st.winResult;
    }
  });
</script>

{#if screen === 'home'}
  <HomeScreen onStart={goToGame} />
{:else}
  <GameScreen
    {store}
    onBack={goToHome}
  />
{/if}

<Toast {store} />
<QueMenModal {store} />
<SettingsModal {store} />
<HuModal {store} winResult={huResult} onClose={() => huResult = null} onReplay={goToGame} />
<EndModal {store} reason={endReason} onClose={() => endReason = ''} onReplay={goToGame} />
<QuickChat {store} />