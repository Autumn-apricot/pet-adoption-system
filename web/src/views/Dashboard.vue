<template>
  <div v-loading="loading">
    <div class="stat-grid">
      <div class="stat-card">
        <div class="label">宠物总数</div>
        <div class="value">{{ petStats.total }}</div>
        <div class="hint">今日新增 {{ petStats.todayNew }} · 近 7 天 {{ petStats.weekNew }}</div>
      </div>
      <div class="stat-card">
        <div class="label">待领养</div>
        <div class="value" style="color: var(--brand)">{{ petStats.byStatus.available }}</div>
        <div class="hint">
          审核中 {{ petStats.byStatus.pending }} · 已领养 {{ petStats.byStatus.adopted }}
        </div>
      </div>
      <div class="stat-card">
        <div class="label">领养申请</div>
        <div class="value">{{ adoptionStats.total }}</div>
        <div class="hint">
          待审核 {{ adoptionStats.byStatus.pending }} · 今日新增 {{ adoptionStats.todayNew }}
        </div>
      </div>
      <div class="stat-card">
        <div class="label">申请通过率</div>
        <div class="value" style="color: var(--brand)">{{ adoptionStats.approveRate }}%</div>
        <div class="hint">
          通过 {{ adoptionStats.byStatus.approved }} · 拒绝 {{ adoptionStats.byStatus.rejected }}
        </div>
      </div>
      <div class="stat-card">
        <div class="label">注册用户</div>
        <div class="value">{{ userStats.total }}</div>
        <div class="hint">
          管理员 {{ userStats.admins }} · 已禁用 {{ userStats.disabled }}
        </div>
      </div>
    </div>

    <div class="chart-grid">
      <div class="chart-box">
        <h3>宠物状态分布</h3>
        <div ref="petPieRef" class="chart" />
      </div>
      <div class="chart-box">
        <h3>近 7 天领养申请趋势</h3>
        <div ref="trendRef" class="chart" />
      </div>
      <div class="chart-box">
        <h3>宠物分类分布</h3>
        <div ref="categoryRef" class="chart" />
      </div>
      <div class="chart-box">
        <h3>浏览量 Top 5</h3>
        <div ref="hotRef" class="chart" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import * as echarts from 'echarts';
import { adoptionApi, petApi, userApi } from '@/api';

const loading = ref(false);

const petPieRef = ref();
const trendRef = ref();
const categoryRef = ref();
const hotRef = ref();
const charts = [];

const petStats = ref({ total: 0, todayNew: 0, weekNew: 0, byStatus: {}, byCategory: [], hotPets: [] });
const adoptionStats = ref({ total: 0, todayNew: 0, approveRate: 0, byStatus: {}, trend: [] });
const userStats = ref({ total: 0, admins: 0, disabled: 0, todayNew: 0 });

const STATUS_LABEL = { available: '待领养', pending: '审核中', adopted: '已领养', offline: '已下架' };
const STATUS_COLOR = { available: '#2f9e79', pending: '#e6a23c', adopted: '#909399', offline: '#f56c6c' };

function mount(el, option) {
  if (!el) return;
  const chart = echarts.init(el);
  chart.setOption(option);
  charts.push(chart);
}

function baseGrid() {
  return { left: 12, right: 18, top: 30, bottom: 8, containLabel: true };
}

function renderPetPie() {
  const by = petStats.value.byStatus || {};
  const data = Object.keys(STATUS_LABEL)
    .map((k) => ({ name: STATUS_LABEL[k], value: by[k] || 0, itemStyle: { color: STATUS_COLOR[k] } }))
    .filter((d) => d.value > 0);

  mount(petPieRef.value, {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 只 ({d}%)' },
    legend: { bottom: 0, icon: 'circle' },
    series: [
      {
        type: 'pie',
        radius: ['46%', '68%'],
        center: ['50%', '46%'],
        avoidLabelOverlap: true,
        label: { formatter: '{b}\n{c}' },
        data: data.length ? data : [{ name: '暂无数据', value: 1, itemStyle: { color: '#e4e8ee' } }],
      },
    ],
  });
}

function renderTrend() {
  const trend = adoptionStats.value.trend || [];
  mount(trendRef.value, {
    tooltip: { trigger: 'axis' },
    grid: baseGrid(),
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.map((t) => t.date.slice(5)),
      axisLine: { lineStyle: { color: '#e4e8ee' } },
      axisLabel: { color: '#7b8794' },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f0f2f5' } },
      axisLabel: { color: '#7b8794' },
    },
    series: [
      {
        name: '申请数',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        data: trend.map((t) => t.count),
        itemStyle: { color: '#2f9e79' },
        lineStyle: { width: 3, color: '#2f9e79' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(47,158,121,0.28)' },
            { offset: 1, color: 'rgba(47,158,121,0.02)' },
          ]),
        },
      },
    ],
  });
}

function renderCategory() {
  const rows = (petStats.value.byCategory || []).slice().reverse();
  mount(categoryRef.value, {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 12, right: 28, top: 20, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f0f2f5' } },
      axisLabel: { color: '#7b8794' },
    },
    yAxis: {
      type: 'category',
      data: rows.map((r) => r.category),
      axisLine: { lineStyle: { color: '#e4e8ee' } },
      axisLabel: { color: '#1f2d3d' },
    },
    series: [
      {
        type: 'bar',
        barWidth: 14,
        itemStyle: { color: '#5aa9e6', borderRadius: [0, 6, 6, 0] },
        label: { show: true, position: 'right', color: '#7b8794' },
        data: rows.map((r) => r.count),
      },
    ],
  });
}

function renderHot() {
  const rows = (petStats.value.hotPets || []).slice().reverse();
  mount(hotRef.value, {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 12, right: 28, top: 20, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f0f2f5' } },
      axisLabel: { color: '#7b8794' },
    },
    yAxis: {
      type: 'category',
      data: rows.map((r) => r.name),
      axisLine: { lineStyle: { color: '#e4e8ee' } },
      axisLabel: { color: '#1f2d3d' },
    },
    series: [
      {
        type: 'bar',
        barWidth: 14,
        itemStyle: { color: '#2f9e79', borderRadius: [0, 6, 6, 0] },
        label: { show: true, position: 'right', color: '#7b8794' },
        data: rows.map((r) => r.viewCount),
      },
    ],
  });
}

function onResize() {
  charts.forEach((c) => c.resize());
}

async function load() {
  loading.value = true;
  try {
    const [pet, adoption, user] = await Promise.all([
      petApi.stats(),
      adoptionApi.stats(),
      userApi.stats(),
    ]);
    petStats.value = pet.data;
    adoptionStats.value = adoption.data;
    userStats.value = user.data;

    await nextTick();
    charts.splice(0).forEach((c) => c.dispose());
    renderPetPie();
    renderTrend();
    renderCategory();
    renderHot();
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  charts.forEach((c) => c.dispose());
});
</script>
