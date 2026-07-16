# 原音麻将 — 部署说明

## 产物

`dist/` 目录是完整的静态前端，丢到任意静态托管即可。

## 部署方式

### Cloudflare Workers（推荐）

不用写 `worker.js`，Wrangler 自动检测 `dist/`：

```bash
npx wrangler deploy
```

### Cloudflare Pages

```bash
npx wrangler pages deploy dist/
```

### 任意静态托管

把 `dist/` 里的文件全部上传就行，Nginx、Vercel、Netlify 都行。

## LLM 代理（可选）

不配也能玩，AI 走启发式、语音走关键词匹配。

如果需要 LLM 增强，把 `llm-proxy/` 部署到同域：

```bash
cd llm-proxy
npx wrangler secret put LLM_ENDPOINT  # https://api.deepseek.com/v1/chat/completions
npx wrangler secret put LLM_API_KEY   # sk-xxx
npx wrangler deploy
```

前端会自动调同域的 `/voice` 和 `/bot`，不需要额外配置。

## 本地开发

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 产物输出到 dist/
```