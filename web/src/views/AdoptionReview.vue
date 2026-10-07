<template>
  <div>
    <div class="filter-bar">
      <el-radio-group v-model="query.status" @change="search">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="pending">待审核</el-radio-button>
        <el-radio-button value="approved">已通过</el-radio-button>
        <el-radio-button value="rejected">已拒绝</el-radio-button>
        <el-radio-button value="cancelled">已撤销</el-radio-button>
      </el-radio-group>
      <el-input
        v-model="query.keyword"
        class="grow"
        placeholder="搜索宠物名称 / 申请人"
        clearable
        :prefix-icon="Search"
        @keyup.enter="search"
        @clear="search"
      />
      <el-button type="primary" :icon="Search" @click="search">查询</el-button>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 14px"
      title="审核通过后该宠物状态将变为「已领养」，同一宠物的其它待审申请会被自动拒绝。"
    />

    <div class="panel">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="id" label="申请号" width="80" />
        <el-table-column label="宠物" min-width="140">
          <template #default="{ row }">
            <div class="pet-cell">
              <span class="avatar">{{ emojiOf(row.petCategory) }}</span>
              <div>
                <div>{{ row.petName || '（已删除）' }}</div>
                <el-tag v-if="row.petStatus" size="small" effect="plain" :type="petStatus(row.petStatus).type">
                  {{ petStatus(row.petStatus).text }}
                </el-tag>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="申请人" min-width="130">
          <template #default="{ row }">
            <div>{{ row.applicantName }}</div>
            <div class="muted" style="font-size: 12px">@{{ row.applicantUsername }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="contactPhone" label="联系电话" width="125" />
        <el-table-column prop="address" label="联系地址" min-width="130" show-overflow-tooltip />
        <el-table-column prop="reason" label="领养理由" min-width="180" show-overflow-tooltip />
        <el-table-column label="状态" width="95">
          <template #default="{ row }">
            <el-tag size="small" :type="adoptionStatus(row.status).type">{{ row.statusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审核意见" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span :class="{ muted: !row.reviewRemark }">{{ row.reviewRemark || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="150">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button size="small" text type="success" @click="openReview(row, 'approved')">通过</el-button>
              <el-button size="small" text type="danger" @click="openReview(row, 'rejected')">拒绝</el-button>
            </template>
            <span v-else class="muted">已处理</span>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无领养申请" /></template>
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

    <el-dialog v-model="dialogVisible" :title="decision === 'approved' ? '通过领养申请' : '拒绝领养申请'" width="520px">
      <div v-if="current">
        <el-descriptions :column="1" border size="small" style="margin-bottom: 14px">
          <el-descriptions-item label="宠物">{{ current.petName }}（{{ current.petCategory }}）</el-descriptions-item>
          <el-descriptions-item label="申请人">
            {{ current.applicantName }} · {{ current.contactPhone }}
          </el-descriptions-item>
          <el-descriptions-item label="领养理由">{{ current.reason }}</el-descriptions-item>
        </el-descriptions>

        <el-form label-position="top">
          <el-form-item label="审核意见（选填）">
            <el-input
              v-model="remark"
              type="textarea"
              :rows="3"
              maxlength="255"
              show-word-limit
              :placeholder="decision === 'approved' ? '留空则使用默认意见「恭喜，领养申请已通过」' : '留空则使用默认意见「很抱歉，本次申请未通过」'"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button :type="decision === 'approved' ? 'success' : 'danger'" :loading="saving" @click="confirmReview">
          确认{{ decision === 'approved' ? '通过' : '拒绝' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import { adoptionApi } from '@/api';
import { adoptionStatus, emojiOf, formatDate, petStatus } from '@/utils/dict';

const loading = ref(false);
const saving = ref(false);
const list = ref([]);
const total = ref(0);

const query = reactive({ page: 1, size: 10, status: 'pending', keyword: '' });

const dialogVisible = ref(false);
const current = ref(null);
const decision = ref('approved');
const remark = ref('');

async function load() {
  loading.value = true;
  try {
    const res = await adoptionApi.list({
      page: query.page,
      size: query.size,
      status: query.status || undefined,
      keyword: query.keyword || undefined,
    });
    list.value = res.data.list;
    total.value = res.data.total;
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

function openReview(row, type) {
  current.value = row;
  decision.value = type;
  remark.value = '';
  dialogVisible.value = true;
}

async function confirmReview() {
  saving.value = true;
  try {
    await adoptionApi.review(current.value.id, {
      decision: decision.value,
      reviewRemark: remark.value || undefined,
    });
    ElMessage.success(decision.value === 'approved' ? '已通过该领养申请' : '已拒绝该领养申请');
    dialogVisible.value = false;
    await load();
  } catch {
    /* 拦截器已提示（重复审核会返回 409） */
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
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
