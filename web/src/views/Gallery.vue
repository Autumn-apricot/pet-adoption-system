<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">待领养宠物</h2>
        <p class="page-desc">浏览在册宠物，点击卡片查看详情并提交领养申请</p>
      </div>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        class="grow"
        placeholder="搜索名称 / 品种 / 描述"
        clearable
        :prefix-icon="Search"
        @keyup.enter="search"
        @clear="search"
      />
      <el-select v-model="query.category" placeholder="全部分类" clearable style="width: 140px" @change="search">
        <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
      </el-select>
      <el-select v-model="query.sex" placeholder="性别不限" clearable style="width: 130px" @change="search">
        <el-option label="公" value="公" />
        <el-option label="母" value="母" />
      </el-select>
      <el-select v-model="query.status" placeholder="状态不限" clearable style="width: 140px" @change="search">
        <el-option label="待领养" value="available" />
        <el-option label="审核中" value="pending" />
        <el-option label="已领养" value="adopted" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="search">查询</el-button>
      <el-button text @click="reset">重置</el-button>
    </div>

    <div v-loading="loading">
      <el-empty v-if="!loading && list.length === 0" description="没有符合条件的宠物" />

      <div v-else class="pet-grid">
        <article v-for="pet in list" :key="pet.id" class="pet-card">
          <div class="pet-cover">
            <img v-if="pet.imageUrl" :src="pet.imageUrl" :alt="pet.name" @error="onImgError" />
            <span v-else>{{ emojiOf(pet.category) }}</span>
            <el-tag class="tag" size="small" :type="petStatus(pet.status).type" effect="dark">
              {{ petStatus(pet.status).text }}
            </el-tag>
          </div>

          <div class="pet-body">
            <h3 class="pet-name">
              {{ pet.name }}
              <el-tag size="small" effect="plain" type="info">{{ pet.category }}</el-tag>
            </h3>
            <div class="pet-meta">
              <span>性别：{{ pet.sex || '-' }}</span>
              <span>年龄：{{ formatAge(pet.age) }}</span>
              <span v-if="pet.breed">品种：{{ pet.breed }}</span>
              <span v-if="pet.weight">体重：{{ pet.weight }} kg</span>
              <span v-if="pet.healthStatus">健康：{{ pet.healthStatus }}</span>
            </div>
            <p class="pet-desc">{{ pet.description || '暂无描述' }}</p>
          </div>

          <div class="pet-actions">
            <span class="muted" style="font-size: 12px">
              <el-icon><View /></el-icon> {{ pet.viewCount }} 次浏览
            </span>
            <el-button type="primary" size="small" @click="openDetail(pet.id)">查看详情</el-button>
          </div>
        </article>
      </div>
    </div>

    <div v-if="total > query.size" class="pager">
      <el-pagination
        layout="total, prev, pager, next, sizes"
        :total="total"
        :current-page="query.page"
        :page-size="query.size"
        :page-sizes="[8, 12, 24]"
        @current-change="onPageChange"
        @size-change="onSizeChange"
      />
    </div>

    <!-- 详情 / 申请弹窗 -->
    <el-dialog v-model="detailVisible" :title="detail ? `宠物详情 · ${detail.name}` : '宠物详情'" width="620px">
      <div v-if="detail" v-loading="detailLoading">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="名称">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="分类">{{ detail.category }}</el-descriptions-item>
          <el-descriptions-item label="品种">{{ detail.breed || '-' }}</el-descriptions-item>
          <el-descriptions-item label="性别">{{ detail.sex || '-' }}</el-descriptions-item>
          <el-descriptions-item label="年龄">{{ formatAge(detail.age) }}</el-descriptions-item>
          <el-descriptions-item label="体重">{{ detail.weight ? `${detail.weight} kg` : '-' }}</el-descriptions-item>
          <el-descriptions-item label="健康状况">{{ detail.healthStatus || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag size="small" :type="petStatus(detail.status).type" effect="plain">
              {{ petStatus(detail.status).text }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">{{ detail.description || '暂无描述' }}</el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">领养申请</el-divider>

        <el-alert
          v-if="detail.status !== 'available'"
          type="warning"
          :closable="false"
          show-icon
          :title="`该宠物当前状态为「${petStatus(detail.status).text}」，暂时无法提交申请`"
        />

        <el-form v-else ref="applyRef" :model="applyForm" :rules="applyRules" label-position="top">
          <el-form-item label="领养理由" prop="reason">
            <el-input
              v-model="applyForm.reason"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              placeholder="介绍一下你的居住环境、养宠经验和照顾计划"
            />
          </el-form-item>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="联系电话" prop="contactPhone">
                <el-input v-model="applyForm.contactPhone" placeholder="11 位手机号" maxlength="11" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="联系地址" prop="address">
                <el-input v-model="applyForm.address" placeholder="如：广州市天河区" maxlength="200" />
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button
          v-if="detail && detail.status === 'available'"
          type="primary"
          :loading="submitting"
          @click="submitApply"
        >
          提交领养申请
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Refresh, Search } from '@element-plus/icons-vue';
import { adoptionApi, petApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { emojiOf, formatAge, petStatus } from '@/utils/dict';

const store = useUserStore();
const router = useRouter();
const route = useRoute();

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const categories = ref([]);

const query = reactive({ page: 1, size: 8, keyword: '', category: '', sex: '', status: '' });

const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref(null);

const submitting = ref(false);
const applyRef = ref();
const applyForm = reactive({ reason: '', contactPhone: '', address: '' });
const applyRules = {
  reason: [
    { required: true, message: '请填写领养理由', trigger: 'blur' },
    { min: 5, message: '请至少填写 5 个字，方便管理员了解情况', trigger: 'blur' },
  ],
  contactPhone: [
    { required: true, message: '请填写联系电话', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
  address: [{ required: true, message: '请填写联系地址', trigger: 'blur' }],
};

async function load() {
  loading.value = true;
  try {
    const res = await petApi.list({ ...query });
    list.value = res.data.list;
    total.value = res.data.total;
    // 页码越界时（如筛选后总数变少）回退一页重查，避免停在空列表
    if (list.value.length === 0 && query.page > 1) {
      query.page = 1;
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
  query.page = 1;
  load();
}

function reset() {
  Object.assign(query, { page: 1, keyword: '', category: '', sex: '', status: '' });
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

function onImgError(e) {
  e.target.style.display = 'none';
}

async function openDetail(id) {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  Object.assign(applyForm, { reason: '', contactPhone: store.profile?.phone || '', address: '' });
  try {
    const res = await petApi.detail(id);
    detail.value = res.data;
    // 详情接口会让浏览量 +1，前端同步刷新列表中的该条数据
    const hit = list.value.find((p) => p.id === id);
    if (hit) hit.viewCount = res.data.viewCount;
  } catch {
    detailVisible.value = false;
  } finally {
    detailLoading.value = false;
  }
}

async function submitApply() {
  if (!store.isLoggedIn) {
    detailVisible.value = false;
    ElMessage.warning('请先登录后再提交领养申请');
    router.push({ name: 'login', query: { redirect: route.fullPath } });
    return;
  }

  await applyRef.value.validate();
  submitting.value = true;
  try {
    await adoptionApi.apply({ petId: detail.value.id, ...applyForm });
    ElMessage.success('领养申请已提交，请等待管理员审核');
    detailVisible.value = false;
    await load();
  } catch {
    /* 拦截器已提示（重复提交会返回 409） */
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  load();
  try {
    const res = await petApi.categories();
    categories.value = res.data;
  } catch {
    categories.value = [];
  }
});
</script>
