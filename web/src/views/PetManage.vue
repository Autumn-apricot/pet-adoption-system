<template>
  <div>
    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        class="grow"
        placeholder="搜索宠物名称 / 品种 / 描述"
        clearable
        :prefix-icon="Search"
        @keyup.enter="search"
        @clear="search"
      />
      <el-select v-model="query.category" placeholder="全部分类" clearable style="width: 140px" @change="search">
        <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
      </el-select>
      <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 140px" @change="search">
        <el-option label="待领养" value="available" />
        <el-option label="审核中" value="pending" />
        <el-option label="已领养" value="adopted" />
        <el-option label="已下架" value="offline" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="search">查询</el-button>
      <el-button type="success" :icon="Plus" @click="openCreate">新增宠物</el-button>
    </div>

    <div class="panel">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="宠物" min-width="150">
          <template #default="{ row }">
            <div class="pet-cell">
              <span class="avatar">{{ emojiOf(row.category) }}</span>
              <div>
                <div>{{ row.name }}</div>
                <div class="muted" style="font-size: 12px">{{ row.breed || '未填写品种' }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="90" />
        <el-table-column prop="sex" label="性别" width="70" />
        <el-table-column label="年龄" width="100">
          <template #default="{ row }">{{ formatAge(row.age) }}</template>
        </el-table-column>
        <el-table-column label="健康" width="110">
          <template #default="{ row }">{{ row.healthStatus || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="petStatus(row.status).type">{{ row.statusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="viewCount" label="浏览" width="80" />
        <el-table-column label="上架时间" width="150">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openEdit(row)">编辑</el-button>
            <el-popconfirm
              title="删除后该宠物的领养申请也会一并删除，确定吗？"
              confirm-button-text="删除"
              cancel-button-text="取消"
              width="240"
              @confirm="remove(row)"
            >
              <template #reference>
                <el-button size="small" text type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无宠物数据" /></template>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑宠物' : '新增宠物'" width="640px" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
        <el-row :gutter="14">
          <el-col :span="12">
            <el-form-item label="名称" prop="name">
              <el-input v-model="form.name" placeholder="如：小灰" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分类" prop="category">
              <el-select
                v-model="form.category"
                placeholder="可选择已有分类或直接输入"
                filterable
                allow-create
                default-first-option
                style="width: 100%"
              >
                <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="性别" prop="sex">
              <el-radio-group v-model="form.sex">
                <el-radio v-for="s in sexOptions" :key="s" :value="s">{{ s }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="年龄(月)" prop="age">
              <el-input-number v-model="form.age" :min="0" :max="360" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="品种" prop="breed">
              <el-input v-model="form.breed" placeholder="如：中华田园猫" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="体重(kg)" prop="weight">
              <el-input-number v-model="form.weight" :min="0" :max="200" :precision="1" :step="0.5" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="健康状况" prop="healthStatus">
              <el-input v-model="form.healthStatus" placeholder="如：已驱虫、已绝育" maxlength="30" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-select v-model="form.status" style="width: 100%">
                <el-option label="待领养" value="available" />
                <el-option label="审核中" value="pending" />
                <el-option label="已领养" value="adopted" />
                <el-option label="已下架" value="offline" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="图片地址" prop="imageUrl">
              <el-input v-model="form.imageUrl" placeholder="选填，宠物照片的 URL（最长 255 字符）" maxlength="255" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="描述" prop="description">
              <el-input
                v-model="form.description"
                type="textarea"
                :rows="3"
                maxlength="1000"
                show-word-limit
                placeholder="性格、生活习惯、注意事项等"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Search } from '@element-plus/icons-vue';
import { petApi } from '@/api';
import { SEX_OPTIONS, emojiOf, formatAge, formatDate, petStatus } from '@/utils/dict';

const loading = ref(false);
const saving = ref(false);
const list = ref([]);
const total = ref(0);
const categories = ref([]);
const sexOptions = SEX_OPTIONS;

const query = reactive({ page: 1, size: 10, keyword: '', category: '', status: '' });

const dialogVisible = ref(false);
const formRef = ref();
const emptyForm = () => ({
  id: null,
  name: '',
  category: '',
  sex: '公',
  age: 1,
  breed: '',
  weight: undefined,
  healthStatus: '',
  status: 'available',
  imageUrl: '',
  description: '',
});
const form = reactive(emptyForm());

const rules = {
  name: [{ required: true, message: '请输入宠物名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择或输入分类', trigger: 'change' }],
  sex: [{ required: true, message: '请选择性别', trigger: 'change' }],
  age: [{ required: true, message: '请填写年龄', trigger: 'change' }],
};

async function load() {
  loading.value = true;
  try {
    const res = await petApi.list({
      page: query.page,
      size: query.size,
      keyword: query.keyword || undefined,
      category: query.category || undefined,
      status: query.status || undefined,
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

async function loadCategories() {
  try {
    const res = await petApi.categories();
    categories.value = res.data;
  } catch {
    categories.value = [];
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

function openCreate() {
  Object.assign(form, emptyForm());
  dialogVisible.value = true;
}

function openEdit(row) {
  Object.assign(form, {
    ...emptyForm(),
    ...row,
    // 后端 weight 为 DECIMAL，可能是字符串，转成 number 让 InputNumber 正常显示
    weight: row.weight === null || row.weight === undefined ? undefined : Number(row.weight),
  });
  dialogVisible.value = true;
}

function resetForm() {
  formRef.value?.clearValidate();
}

/** 空字符串一律不提交，避免覆盖数据库默认值 */
function buildPayload() {
  const payload = {
    name: form.name.trim(),
    category: String(form.category).trim(),
    sex: form.sex,
    age: Number(form.age),
    status: form.status,
  };
  const optional = {
    breed: form.breed,
    weight: form.weight,
    healthStatus: form.healthStatus,
    imageUrl: form.imageUrl,
    description: form.description,
  };
  Object.entries(optional).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') payload[k] = v;
  });
  return payload;
}

async function save() {
  await formRef.value.validate();
  saving.value = true;
  try {
    if (form.id) {
      await petApi.update(form.id, buildPayload());
      ElMessage.success('修改成功');
    } else {
      await petApi.create(buildPayload());
      ElMessage.success('宠物发布成功');
    }
    dialogVisible.value = false;
    await Promise.all([load(), loadCategories()]);
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false;
  }
}

async function remove(row) {
  try {
    await petApi.remove(row.id);
    ElMessage.success('删除成功');
    await load();
  } catch {
    /* 拦截器已提示 */
  }
}

onMounted(() => {
  load();
  loadCategories();
});
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
