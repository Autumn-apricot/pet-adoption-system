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
app.use(router);

Object.entries(ElementPlusIconsVue).forEach(([name, component]) => {
  app.component(name, component);
});

setUnauthorizedHandler(() => {
  const store = useUserStore(pinia);
  store.logout();
  router.push({ name: 'login' });
});

app.mount('#app');
