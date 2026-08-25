import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

export default defineConfig({
  plugins: [
    vue(),
    // 注入登录骨架屏：HTML 一到达立即渲染，JS 加载前用户已看到登录界面框架
    {
      name: 'inject-login-skeleton',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          // 1) 在 <head> 注入骨架屏 CSS（含背景/卡片/shimmer/spin 动画）
          const skCss = `
    <style id="sk-css">
      html,body{margin:0;padding:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;background:linear-gradient(135deg,#eef1ff 0%,#f6f1ff 55%,#e9fbf3 100%);overflow:hidden}
      #app{height:100%;display:flex;align-items:center;justify-content:center}
      .sk{width:360px;padding:36px 32px;background:rgba(255,255,255,.7);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.6);border-radius:14px;box-shadow:0 8px 32px rgba(91,108,255,.1);text-align:center}
      .sk-logo{font-size:22px;font-weight:700;background:linear-gradient(135deg,#5b6cff,#ff9ecb);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:6px}
      .sk-sub{font-size:12px;color:#909399;margin-bottom:22px;letter-spacing:1px}
      .sk-f{height:40px;border-radius:6px;background:linear-gradient(90deg,#eef0f5 0%,#f7f8fa 50%,#eef0f5 100%);background-size:200% 100%;animation:sk-sh 1.4s ease-in-out infinite;margin-bottom:14px}
      .sk-b{height:40px;width:100%;border-radius:6px;background:linear-gradient(135deg,#5b6cff 0%,#7a8aff 100%);position:relative;overflow:hidden}
      .sk-b::after{content:'';position:absolute;top:0;left:-100%;width:50%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);animation:sk-si 1.6s linear infinite}
      .sk-d{position:absolute;top:50%;left:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:sk-sp .7s linear infinite}
      @keyframes sk-sh{0%{background-position:200% 0}100%{background-position:-200% 0}}
      @keyframes sk-si{0%{left:-100%}100%{left:200%}}
      @keyframes sk-sp{to{transform:rotate(360deg)}}
    </style>`;
          // 2) 在 #app 内插入骨架屏（构建时 vite 会清空 #app 内容，pre 钩子必须在 vite 之前）
          const skHtml =
            '<div class="sk" id="app-skeleton" aria-label="加载中">' +
            '<div class="sk-logo">库存对账系统</div>' +
            '<div class="sk-sub">Inventory Reconciliation</div>' +
            '<div class="sk-f"></div><div class="sk-f"></div>' +
            '<div class="sk-b"><div class="sk-d"></div></div></div>';
          // 注入到 head 和 body
          return html
            .replace(/<head>/, '<head>' + skCss)
            .replace(/<div id="app"><\/div>/, '<div id="app">' + skHtml + '</div>');
        },
      },
    },
    // Element Plus 按需自动引入（组件 + 命令式 API + 对应样式）
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-echarts': ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
          'vendor-axios': ['axios'],
          'vendor-xlsx': ['xlsx'],
        },
      },
    },
  },
});
