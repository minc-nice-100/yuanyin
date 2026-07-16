// ===== 原音麻将 — 静态资源 Worker =====
// 所有静态文件由 assets binding 自动服务
export default {
  async fetch(request, env) {
    // Assets binding 自动处理静态文件
    // 未匹配的路径回退到 index.html（SPA 路由）
    try {
      const url = new URL(request.url);
      return await env.ASSETS.fetch(request);
    } catch {
      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
    }
  },
};
