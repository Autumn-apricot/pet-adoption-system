<template>
  <div>
    <header class="site-header">
      <div class="inner">
        <router-link class="brand" to="/">
          <span class="dot">🐾</span>
          <span>宠物领养管理系统</span>
        </router-link>

        <nav class="nav-links">
          <router-link to="/" :class="{ active: $route.name === 'gallery' }">待领养宠物</router-link>
          <router-link
            v-if="store.isLoggedIn"
            to="/my-adoptions"
            :class="{ active: $route.name === 'my-adoptions' }"
          >
            我的申请
          </router-link>
          <router-link v-if="store.isAdmin" to="/admin/dashboard">管理后台</router-link>
        </nav>

        <div class="header-right">
          <template v-if="store.isLoggedIn">
            <el-dropdown @command="onCommand">
              <span class="user-chip">
                <el-avatar :size="28">{{ initial }}</el-avatar>
                <span>{{ store.displayName }}</span>
                <el-tag v-if="store.isAdmin" size="small" type="success" effect="plain">管理员</el-tag>
                <el-icon><ArrowDown /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="my">我的申请</el-dropdown-item>
                  <el-dropdown-item v-if="store.isAdmin" command="admin">管理后台</el-dropdown-item>
                  <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <template v-else>
            <el-button text @click="goLogin">登录</el-button>
            <el-button type="primary" @click="goLogin">注册 / 登录</el-button>
          </template>
        </div>
      </div>
    </header>

    <router-view />

    <footer class="site-footer">
      <div class="inner">
        <span>宠物领养管理系统 · Vue 3 + Element Plus + ECharts</span>
        <span class="muted">后端 Node.js / Express / MySQL · 接口文档见 <a href="/api-docs" target="_blank" rel="noreferrer">/api-docs</a></span>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useUserStore } from '@/stores/user';

const store = useUserStore();
const router = useRouter();
const route = useRoute();

const initial = computed(() => (store.displayName || 'U').slice(0, 1).toUpperCase());

function goLogin() {
  router.push({ name: 'login', query: { redirect: route.fullPath } });
}

function onCommand(cmd) {
  if (cmd === 'logout') {
    store.logout();
    ElMessage.success('已退出登录');
    router.push('/');
    return;
  }
  if (cmd === 'admin') {
    router.push('/admin/dashboard');
    return;
  }
  router.push('/my-adoptions');
}
</script>

<style scoped>
.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  outline: none;
  color: var(--text-main);
}

.site-footer {
  border-top: 1px solid var(--border);
  background: #fff;
  color: var(--text-sub);
  font-size: 12.5px;
}

.site-footer .inner {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  max-width: 1180px;
  margin: 0 auto;
  padding: 16px 20px;
}

.site-footer a {
  color: var(--brand-dark);
}
</style>
