import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';

import 'element-plus/dist/index.css';
import './styles/main.css';

import App from './App.vue';
import router from './router';
import { setUnauthorizedHandler } from './api/request';
import { useUserStore } from './stores/user';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(ElementPlus, { locale: zhCn });

Object.entries(ElementPlusIconsVue).forEach(([name, component]) => {
  app.component(name, component);
});

setUnauthorizedHandler(() => {
  useUserStore(pinia).logout();
  router.push({ name: 'login' });
});

/**
 * 挂载前先补齐登录态。
 *
 * localStorage 里可能只剩 token 而没有用户资料（被部分清理、或由外部脚本只写入 token）。
 * 必须在 app.use(router) 之前完成：vue-router 4 的首次导航在 install 阶段就已经开始，
 * 如果等到 mount 之后再补，路由守卫拿到的 profile 还是空的，
 * 会把管理员误判成普通用户、重定向回前台首页。
 *
 * 资料拉取失败（token 失效）时按未登录处理，由守卫正常跳转登录页。
 */
async function start() {
  const store = useUserStore(pinia);
  if (store.isLoggedIn && !store.profile) {
    try {
      await store.refresh();
    } catch {
      /* 拦截器已提示并清理登录态 */
    }
  }
  app.use(router);
  app.mount('#app');
}

start();
