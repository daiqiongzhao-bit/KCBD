import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { permission } from './directives/permission';
import './styles/index.css';
// 手动引入命令式 API 的样式（unplugin 按需引入只对组件标签生效，
// ElMessage / ElMessageBox / ElNotification / ElLoading 等需显式 import）
import 'element-plus/theme-chalk/el-message.css';
import 'element-plus/theme-chalk/el-message-box.css';
import 'element-plus/theme-chalk/el-notification.css';
import 'element-plus/theme-chalk/el-loading.css';
// 显式引入分页器样式：unplugin 按需在某些构建场景下未能正确注入，
// 缺少时页码会退化为浏览器默认垂直列表（带黑点）
import 'element-plus/theme-chalk/el-pagination.css';

// 仅注册实际用到的图标（全量注册 ~300 个图标会占 ~1MB，
// 按需注册后 vendor 包体积大幅下降，加快首屏加载）
import {
  AlarmClock,
  ArrowDown,
  Bell,
  Box,
  Close,
  Document,
  DocumentChecked,
  Expand,
  Fold,
  Present,
  Goods,
  Histogram,
  Loading,
  Lock,
  Odometer,
  PieChart,
  Refresh,
  RefreshLeft,
  Setting,
  Upload,
  UploadFilled,
  User,
  Warning,
} from '@element-plus/icons-vue';

// 前端版本号（强刷仍看到旧版时，对照此版本判断是否加载了最新代码）
// 更新方式：修改 APP_VERSION 字符串 + 重新 build 部署
const APP_VERSION = 'V0.0.14';
console.info(
  `%c[库存对账系统] 前端版本 ${APP_VERSION}  %c如看到旧版请 Ctrl+Shift+R 强刷`,
  'color:#5b6cff;font-weight:bold',
  'color:#909399',
);

const app = createApp(App);
app.use(createPinia());
app.use(router);
// 暴露版本到 window 方便在 DevTools console 验证：`window.__APP_VERSION`
(window as unknown as { __APP_VERSION?: string }).__APP_VERSION = APP_VERSION;
// Element Plus 组件/API 由 unplugin 按需自动引入（见 vite.config.mts），
// 此处仅注册项目实际使用的图标（模板中 <component :is="icon" /> 动态渲染依赖全局注册）
const icons = {
  AlarmClock,
  ArrowDown,
  Bell,
  Box,
  Close,
  Document,
  DocumentChecked,
  Expand,
  Fold,
  Present,
  Goods,
  Histogram,
  Loading,
  Lock,
  Odometer,
  PieChart,
  Refresh,
  RefreshLeft,
  Setting,
  Upload,
  UploadFilled,
  User,
  Warning,
};
for (const [key, component] of Object.entries(icons)) {
  app.component(key, component as never);
}
app.directive('permission', permission);
app.mount('#app');
