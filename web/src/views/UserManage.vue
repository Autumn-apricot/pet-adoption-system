<template>
  <div>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="label">注册用户</div>
        <div class="value">{{ stats.total }}</div>
        <div class="hint">今日新增 {{ stats.todayNew }}</div>
      </div>
      <div class="stat-card">
        <div class="label">管理员</div>
        <div class="value">{{ stats.admins }}</div>
        <div class="hint">拥有后台全部权限</div>
      </div>
      <div class="stat-card">
        <div class="label">已禁用</div>
        <div class="value" :style="{ color: stats.disabled ? '#f56c6c' : undefined }">{{ stats.disabled }}</div>
        <div class="hint">禁用后无法登录</div>
      </div>
    </div>

    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        class="grow"
        placeholder="搜索用户名 / 昵称"
        clearable
        :prefix-icon="Search"
        @keyup.enter="search"
        @clear="search"
      />
      <el-select v-model="query.role" placeholder="全部角色" clearable style="width: 140px" @change="search">
        <el-option label="普通用户" value="user" />
        <el-option label="管理员" value="admin" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="search">查询</el-button>
    </div>

    <div class="panel">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="username" label="用户名" min-width="130" />
        <el-table-column prop="nickname" label="昵称" min-width="130" />
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.role === 'admin' ? 'success' : 'info'" effect="plain">
              {{ row.role === 'admin' ? '管理员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="手机号" width="130">
          <template #default="{ row }">{{ row.phone || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="95">
          <template #default="{ row }">
            <el-tag size="small" :type="userStatus(row.status).type">{{ userStatus(row.status).text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="150">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              text
              :type="Number(row.status) === 1 ? 'warning' : 'success'"
              :disabled="row.role === 'admin'"
              @click="toggleStatus(row)"
            >
              {{ Number(row.status) === 1 ? '禁用' : '启用' }}
            </el-button>
            <el-popconfirm
              title="确定删除该用户吗？该操作不可恢复。"
              confirm-button-text="删除"
              cancel-button-text="取消"
              @confirm="remove(row)"
            >
              <template #reference>
                <el-button size="small" text type="danger" :disabled="row.role === 'admin'">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无用户数据" /></template>
      </el-table>

      <div v-if="total > query.size" class="pager">
        <el-pagination
          layout="total, prev, pager, next, sizes"
          :total="total"
          :current-page="query.page"
          :page-size="query.size"
          :page-sizes="[10, 20, 50]"
          @current-change="onPageChange"
          @size-change="onSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import { userApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { formatDate, userStatus } from '@/utils/dict';

const store = useUserStore();

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const stats = ref({ total: 0, admins: 0, disabled: 0, todayNew: 0 });

const query = reactive({ page: 1, size: 10, keyword: '', role: '' });

async function load() {
  loading.value = true;
  try {
    const [listRes, statsRes] = await Promise.all([
      userApi.list({
        page: query.page,
        size: query.size,
        keyword: query.keyword || undefined,
        role: query.role || undefined,
      }),
      userApi.stats(),
    ]);
    list.value = listRes.data.list;
    total.value = listRes.data.total;
    stats.value = statsRes.data;
  } catch {
    list.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 1;
  load();
}

function onPageChange(p) {
  query.page = p;
  load();
}

function onSizeChange(s) {
  query.size = s;
  query.page = 1;
  load();
}

async function toggleStatus(row) {
  const next = Number(row.status) === 1 ? 0 : 1;
  try {
    await userApi.setStatus(row.id, next);
    ElMessage.success(next === 1 ? '已启用该用户' : '已禁用该用户');
    await load();
  } catch {
    /* 拦截器已提示 */
  }
}

async function remove(row) {
  try {
    await userApi.remove(row.id);
    ElMessage.success('删除成功');
    // 若删掉的正是自己（后端会拦截），这里再兜底刷新一次登录态
    if (row.id === store.profile?.id) store.logout();
    await load();
  } catch {
    /* 拦截器已提示 */
  }
}

onMounted(load);
</script>
