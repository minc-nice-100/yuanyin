# PRD: 重构麻将游戏引擎 — 清晰交互逻辑 + 规则插件化

Status: ready-for-agent

## Problem Statement

当前 `app.js` 是一个约 1115 行的单体文件，将游戏引擎、四川麻将规则、AI 决策、DOM 渲染、UI 组件、语音识别全部耦合在一起。所有逻辑通过全局可变 `game` 对象共享状态，任何修改都可能引发连锁反应。添加其他地区麻将规则（如广东麻将、日本立直麻将）需要 fork 整个文件并重写规则逻辑，无法复用引擎和 UI。

## Solution

将单体应用重构为模块化架构，核心拆分为三层：

1. **领域逻辑层**（框架无关）：规则插件 + 游戏状态机 + AI 决策
2. **UI 层**（Svelte 组件）：声明式渲染，响应式状态驱动
3. **协调层**（`main.js`）：将引擎 action result 分发到 UI 更新和 AI 调度

规则通过插件接口注入引擎，四川麻将作为第一个（也是唯一）插件实现。其他地区规则只需实现同一接口即可复用整个引擎和 UI。

## User Stories

1. As a player, I want to play Sichuan Mahjong with the same rules as before, so that the refactored game feels identical to the original
2. As a player, I want the game to handle all action types (peng, gang, hu, pass) correctly, so that I can play a complete game without errors
3. As a player, I want voice commands to work exactly as before, so that I can speak tile names and actions
4. As a player, I want the UI (tile display, action buttons, modals, toast) to look and behave identically, so that I don't notice the refactoring
5. As a developer, I want the game rules to be a standalone plugin module, so that I can add a new regional variant by implementing one interface
6. As a developer, I want the game engine to be a pure state machine with no DOM dependencies, so that I can test it without a browser
7. As a developer, I want the AI decision logic to be separated from the engine, so that I can improve AI strategy without touching game rules
8. As a developer, I want the rendering to be driven by reactive state, so that I don't manually call render functions after every state change
9. As a developer, I want the engine to return structured action results, so that the coordinator can drive game flow predictably
10. As a developer, I want to run the project with a single command (`npm run dev`), so that development setup is trivial
11. As a developer, I want unit tests for the rules plugin and engine, so that I can refactor with confidence
12. As a future developer, I want to read `rules-plugin.js` to understand the contract, so that I can implement a new variant without reading engine code

## Implementation Decisions

### Framework: Svelte 5 + Vite

Svelte chosen over React/Vue because:
- Compiles to vanilla JS with zero runtime — important for a game where bundle size matters
- Reactive declarations (`$state`, `$derived`) eliminate manual render calls
- Scoped CSS per component — existing `styles.css` can be incrementally migrated
- No virtual DOM overhead — direct DOM updates are faster for 60fps game rendering

### Architecture: Three-layer separation

**Layer 1 — Domain Logic (framework-agnostic, pure JS)**
- `config.js`: Constants, SFX system, quick chat phrases
- `utils.js`: `countTiles()`, `shuffle()` — zero domain knowledge
- `rules/rules-plugin.js`: Interface documentation + `validatePlugin()` helper
- `rules/sichuan-rules.js`: Full Sichuan Mahjong rules implementation (~300 lines extracted from monolith)
- `game-engine.js`: State machine factory `createEngine(rulesPlugin)` — returns engine with methods: `startNewGame`, `selectQueMen`, `startTurn`, `discard`, `peng`, `gang`, `hu`, `pass`, `gangDraw`, `aiDiscardAfterAction`
- `ai.js`: AI factory `createAI(rulesPlugin)` — returns `pickQueMen`, `chooseDiscard`, `decideAction`

**Layer 2 — UI (Svelte components)**
- `App.svelte`: Root, screen routing (home ↔ game)
- `HomeScreen.svelte`: Feature cards, start button, background animations
- `GameScreen.svelte`: Game layout container
- `GameTable.svelte`: Opponent displays, center info, discard area
- `HandArea.svelte`: Human hand tiles + exposed sets
- `ActionButtons.svelte`: Peng/Gang/Hu/Pass buttons
- `VoiceArea.svelte`: Voice button + hint text
- `Modals/QueMenModal.svelte`, `SettingsModal.svelte`, `HuModal.svelte`, `EndModal.svelte`
- `Toast.svelte`, `QuickChat.svelte`

**Layer 3 — Coordinator (`main.js`)**
- Imports and instantiates all modules
- Wires DOM events to engine calls
- `processActionResult(result)` reads engine output and drives next step (render, AI schedule, modal show)

### Rules Plugin Interface

The contract every rules plugin must fulfill:

```
meta: { name, displayName, handSize, requiresQueMen }
tileTypes: Record<string, { char, sub, color, suit, rank, icon }>
tileBackIcon: string
buildDeck(): string[]
sortHand(hand): void
canWin(hand, queSuit?): boolean
calcFan(hand, exposed, isSelfDraw): number
calcScore(fan): number
getFanDetails(hand, exposed, isSelfDraw): string[]
getSelfActions(hand, exposed, queSuit): { canZiMo, canAnGang, canBuGang }
getResponseActions(hand, discardTile, queSuit): string[]
getAIPriority(): string[]
```

### State Machine

States: `idle → preparing → playing ⇄ waiting → ended`

- `idle`: Game not started, home screen visible
- `preparing`: Pre-game setup (Sichuan: que-men selection). If `requiresQueMen` is false, skip to `playing`
- `playing`: Current player has drawn, must discard. Self-actions (angang, bugang, zimo) checked first
- `waiting`: A tile was discarded. Other players may respond (peng/gang/hu). If no responses, advance to next turn
- `ended`: A player won (hu) or wall is empty (liuju)

### Engine Action Result

Every engine method returns `{ ok, phase, message, sound, nextAction, playerIndex }`. `nextAction` drives the coordinator: `'startTurn'`, `'aiTurn'`, `'waitForResponse'`, `'gangDraw'`, `null`.

### Migration: Side-by-side, not rip-and-replace

- Phase 1: Set up Svelte + Vite, verify dev server works
- Phase 2: Extract domain logic (rules, engine, AI) as pure JS modules
- Phase 3: Build Svelte UI components, wire in `main.js`
- Phase 4: Replace `index.html` script tags, verify against original behavior
- `app.js` kept as reference, not loaded in production

### Existing files preserved as-is

- `tiles/` — all tile icon PNGs
- `funasr-client.js` — loaded as classic script, sets `window.FunASRClient` and `window.NativeSpeechClient`
- `styles.css` — global CSS variables, reset, and base styles retained; component styles in `.svelte` files

## Testing Decisions

### What makes a good test

- Tests verify behavior through public interfaces, not implementation details
- Expected values come from independent sources (known-good literal, worked example, spec), not recomputed the same way as the code
- One test = one behavior specification

### Seams under test

1. **`sichuan-rules.js`** — every method on the rules plugin interface
   - `buildDeck()`: 108 tiles, correct distribution
   - `sortHand()`: Correct ordering by suit then rank
   - `canWin()`: Normal hand, seven pairs, que-suit blocking, incomplete hand
   - `calcFan()`: Each fan source, fan cap at 3
   - `getSelfActions()`: AnGang (4 of a kind), BuGang (add to peng), ZiMo detection
   - `getResponseActions()`: Peng (2 of same), Gang (3 of same), Hu detection
   - `getFanDetails()`: Correct text breakdown

2. **`game-engine.js`** — state machine transitions
   - `startNewGame()`: Correct initial state (4 players × 13 tiles, 108 wall, phase)
   - `selectQueMen()`: Phase transition after all players selected
   - `startTurn()`: Draw tile, hand size increases
   - `discard()`: Hand -1, discards +1, waiting phase triggered
   - `peng()`: Hand -2, exposed +1, currentPlayer changes
   - `gang()` (直杠/暗杠/补杠): Correct state for each gang type
   - `hu()`: Phase → ended, winResult populated
   - `pass()`: Response removal, next-turn fallthrough

3. **`ai.js`** — decision logic
   - `pickQueMen()`: Selects suit with fewest tiles
   - `chooseDiscard()`: Prioritizes que-suit tiles, then lonely tiles

### Test framework

Vitest (bundled with Vite ecosystem). Tests located at `src/**/*.test.js` alongside source files.

### Prior art

No existing tests in the codebase. These will be the first.

## Out of Scope

- Multiplayer networking (currently local-only, single human vs 3 AI)
- Additional regional rule variants (the interface enables them, but only Sichuan is implemented)
- Accessibility improvements beyond the existing voice control
- Mobile responsive layout changes (current layout works on mobile, no changes planned)
- Score tracking across multiple rounds
- In-game chat beyond the existing quick phrases
- Replacing `funasr-client.js` (kept as-is, classic script)
- Migrating all 1502 lines of `styles.css` into Svelte components (only the CSS needed by new components is added; the rest stays as global styles)

## Further Notes

- The `funasr-client.js` remains a classic `<script>` tag (not an ES module) because it sets `window.FunASRClient` and `window.NativeSpeechClient` which are accessed by the voice module. It loads synchronously before the ES module entry point.
- ES modules are deferred by default, so `DOMContentLoaded` wrapping is unnecessary in `main.js`.
- The `renderer.js` module in the original plan is absorbed into Svelte components — no separate renderer module needed.
- Tile images use `object-fit: fill` for pixel-perfect rendering at small sizes — this CSS property must be preserved in Svelte component styles.
- The confetti celebration animation is implemented as a Svelte action or inline style injection, matching the original `celebrateWin()` behavior.