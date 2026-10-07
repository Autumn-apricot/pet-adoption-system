<template>
  <el-container class="admin-shell">
    <el-aside width="212px" class="admin-aside">
      <div class="logo">
        <span class="dot">🐾</span>
        <span>领养管理后台</span>
      </div>
      <el-menu :default-active="activeMenu" router class="admin-menu">
        <el-menu-item index="/admin/dashboard">
          <el-icon><DataLine /></el-icon>
          <span>数据看板</span>
        </el-menu-item>
        <el-menu-item index="/admin/pets">
          <el-icon><Files /></el-icon>
          <span>宠物管理</span>
        </el-menu-item>
        <el-menu-item index="/admin/adoptions">
          <el-icon><DocumentChecked /></el-icon>
          <span>领养审核</span>
        </el-menu-item>
        <el-menu-item index="/admin/users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header height="60px" class="admin-header">
        <span class="title">{{ $route.meta.title || '管理后台' }}</span>
        <div class="right">
          <el-button text @click="$router.push('/')">
            <el-icon><View /></el-icon>
            <span>前台首页</span>
          </el-button>
          <el-divider direction="vertical" />
          <span class="muted">{{ store.displayName }}</span>
          <el-button text type="danger" @click="logout">退出</el-button>
        </div>
      </el-header>

      <el-main class="admin-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useUserStore } from '@/stores/user';

const store = useUserStore();
const router = useRouter();
const route = useRoute();

const activeMenu = computed(() => route.path);

function logout() {
  store.logout();
  ElMessage.success('已退出登录');
  router.push({ name: 'login' });
}
</script>

<style scoped>
.admin-menu {
  border-right: none;
}
/* 顶部品牌色块在 layout 中复用公共样式 */
.logo .dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--brand);
  color: #fff;
  font-size: 15px;
}
</style>
