// ===== 原音麻将 — 静态资源服务 =====
// LLM 代理路由由用户自行通过 Worker Routes 配置

export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};