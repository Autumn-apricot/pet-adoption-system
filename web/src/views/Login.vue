<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="head">
        <span class="logo-badge">🐾</span>
        <h1>宠物领养管理系统</h1>
        <p>登录后可提交领养申请，管理员可进入后台审核</p>
      </div>

      <el-tabs v-model="tab" stretch>
        <el-tab-pane label="登录" name="login">
          <el-form ref="loginRef" :model="loginForm" :rules="loginRules" label-position="top" @submit.prevent>
            <el-form-item label="用户名" prop="username">
              <el-input v-model="loginForm.username" placeholder="请输入用户名" clearable>
                <template #prefix><el-icon><User /></el-icon></template>
              </el-input>
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="请输入密码"
                show-password
                @keyup.enter="submitLogin"
              >
                <template #prefix><el-icon><Lock /></el-icon></template>
              </el-input>
            </el-form-item>
            <el-button type="primary" class="submit" :loading="loading" @click="submitLogin">
              登录
            </el-button>
          </el-form>

          <div class="tip">
            演示管理员：<b>admin / admin123</b><br />
            演示普通用户：<b>alice / 123456</b>（已提交过申请，可在「我的申请」中查看）
          </div>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <el-form ref="regRef" :model="regForm" :rules="regRules" label-position="top" @submit.prevent>
            <el-form-item label="用户名" prop="username">
              <el-input v-model="regForm.username" placeholder="3-20 位字母、数字或下划线" clearable />
            </el-form-item>
            <el-form-item label="昵称" prop="nickname">
              <el-input v-model="regForm.nickname" placeholder="选填，默认与用户名相同" clearable />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input v-model="regForm.password" type="password" placeholder="6-32 位" show-password />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirm">
              <el-input
                v-model="regForm.confirm"
                type="password"
                placeholder="再次输入密码"
                show-password
                @keyup.enter="submitRegister"
              />
            </el-form-item>
            <el-button type="primary" class="submit" :loading="loading" @click="submitRegister">
              注册并登录
            </el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { authApi } from '@/api';
import { useUserStore } from '@/stores/user';

const store = useUserStore();
const router = useRouter();
const route = useRoute();

const tab = ref('login');
const loading = ref(false);

const loginRef = ref();
const loginForm = reactive({ username: '', password: '' });
const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

const regRef = ref();
const regForm = reactive({ username: '', nickname: '', password: '', confirm: '' });
const regRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]{3,20}$/, message: '需为 3-20 位字母、数字或下划线', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度需为 6-32 位', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value, cb) => (value === regForm.password ? cb() : cb(new Error('两次输入的密码不一致'))),
      trigger: 'blur',
    },
  ],
};

function redirectAfterLogin() {
  const target = route.query.redirect;
  if (typeof target === 'string' && target.startsWith('/')) {
    router.replace(target);
    return;
  }
  router.replace(store.isAdmin ? '/admin/dashboard' : '/');
}

async function submitLogin() {
  await loginRef.value.validate();
  loading.value = true;
  try {
    const user = await store.login({ username: loginForm.username, password: loginForm.password });
    ElMessage.success(`欢迎回来，${user.nickname || user.username}`);
    redirectAfterLogin();
  } catch {
    /* 错误提示已由 axios 拦截器统一处理 */
  } finally {
    loading.value = false;
  }
}

async function submitRegister() {
  await regRef.value.validate();
  loading.value = true;
  try {
    await authApi.register({
      username: regForm.username,
      password: regForm.password,
      nickname: regForm.nickname || undefined,
    });
    const user = await store.login({ username: regForm.username, password: regForm.password });
    ElMessage.success(`注册成功，欢迎 ${user.nickname || user.username}`);
    redirectAfterLogin();
  } catch {
    /* 忽略，拦截器已提示 */
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.logo-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--brand-soft);
  font-size: 26px;
}

.submit {
  width: 100%;
  margin-top: 4px;
}
</style>
