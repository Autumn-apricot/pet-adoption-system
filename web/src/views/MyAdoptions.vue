<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">我的领养申请</h2>
        <p class="page-desc">查看申请进度，待审核的申请可以自行撤销</p>
      </div>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <div class="filter-bar">
      <el-radio-group v-model="status" @change="search">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="pending">待审核</el-radio-button>
        <el-radio-button value="approved">已通过</el-radio-button>
        <el-radio-button value="rejected">已拒绝</el-radio-button>
        <el-radio-button value="cancelled">已撤销</el-radio-button>
      </el-radio-group>
      <el-button type="primary" class="to-gallery" @click="$router.push('/')">去挑选宠物</el-button>
    </div>

    <div class="panel">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="id" label="申请号" width="80" />
        <el-table-column label="宠物" min-width="140">
          <template #default="{ row }">
            <div class="pet-cell">
              <span class="avatar">{{ emojiOf(row.petCategory) }}</span>
              <div>
                <div>{{ row.petName || '（已删除）' }}</div>
                <div class="muted" style="font-size: 12px">{{ row.petCategory }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="领养理由" min-width="200" show-overflow-tooltip />
        <el-table-column prop="contactPhone" label="联系电话" width="130" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="adoptionStatus(row.status).type">{{ row.statusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审核意见" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span :class="{ muted: !row.reviewRemark }">{{ row.reviewRemark || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="150">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-popconfirm
              v-if="row.status === 'pending'"
              title="确定撤销这条领养申请吗？"
              confirm-button-text="撤销"
              cancel-button-text="再想想"
              @confirm="cancel(row)"
            >
              <template #reference>
                <el-button size="small" type="danger" text>撤销</el-button>
              </template>
            </el-popconfirm>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="还没有提交过领养申请" />
        </template>
      </el-table>

      <div v-if="total > size" class="pager">
        <el-pagination
          layout="total, prev, pager, next"
          :total="total"
          :current-page="page"
          :page-size="size"
          @current-change="onPageChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { adoptionApi } from '@/api';
import { adoptionStatus, emojiOf, formatDate } from '@/utils/dict';

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const status = ref('');

async function load() {
  loading.value = true;
  try {
    const res = await adoptionApi.mine({ page: page.value, size: size.value, status: status.value || undefined });
    list.value = res.data.list;
    total.value = res.data.total;
    if (list.value.length === 0 && page.value > 1) {
      page.value = 1;
      await load();
    }
  } catch {
    list.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function search() {
  page.value = 1;
  load();
}

function onPageChange(p) {
  page.value = p;
  load();
}

async function cancel(row) {
  try {
    await adoptionApi.cancel(row.id);
    ElMessage.success('已撤销该申请');
    await load();
  } catch {
    /* 拦截器已提示 */
  }
}

onMounted(load);
</script>

<style scoped>
.to-gallery {
  margin-left: auto;
}

.pet-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pet-cell .avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--brand-soft);
  font-size: 17px;
}
</style>
