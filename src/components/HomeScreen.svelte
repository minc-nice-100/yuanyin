<script>
  let { onStart } = $props();
</script>

<div class="screen active" id="home-screen">
  <div class="bg-tiles">
    <div class="bg-tile bg-tile-1">万</div>
    <div class="bg-tile bg-tile-2">条</div>
    <div class="bg-tile bg-tile-3">筒</div>
    <div class="bg-tile bg-tile-4">九</div>
    <div class="bg-tile bg-tile-5">麻</div>
  </div>

  <div class="home-content">
    <div class="app-icon-wrap">
      <div class="app-icon">
        <span>麻</span>
      </div>
    </div>
    <h1 class="app-title">原音麻将</h1>
    <p class="app-subtitle">— 康复训练 · 轻松有趣 —</p>

    <div class="feature-cards">
      <div class="feature-card">
        <div class="feature-icon voice-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#e87ca0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </div>
        <div class="feature-text">
          <h3>语音出牌</h3>
          <p>说话即可控制碰、杠、胡、出牌</p>
        </div>
      </div>
      <div class="feature-card">
        <div class="feature-icon multiplayer-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c8a96e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="feature-text">
          <h3>三人 AI 对战</h3>
          <p>与三位 AI 玩家对战，练习麻将技巧</p>
        </div>
      </div>
      <div class="feature-card">
        <div class="feature-icon tracking-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4A9D5B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="feature-text">
          <h3>康复训练</h3>
          <p>适合语言康复训练，边玩边练</p>
        </div>
      </div>
    </div>

    <button class="start-btn" onclick={onStart}>
      <span>开始游戏</span>
    </button>
    <p class="footer-text">原音 · 康复训练</p>
  </div>
</div>