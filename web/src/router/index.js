import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '@/stores/user';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/',
    component: () => import('@/layout/PublicLayout.vue'),
    children: [
      {
        path: '',
        name: 'gallery',
        component: () => import('@/views/Gallery.vue'),
        meta: { title: '待领养宠物' },
      },
      {
        path: 'my-adoptions',
        name: 'my-adoptions',
        component: () => import('@/views/MyAdoptions.vue'),
        meta: { title: '我的申请', requiresAuth: true },
      },
    ],
  },
  {
    path: '/admin',
    component: () => import('@/layout/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    redirect: '/admin/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '数据看板' },
      },
      {
        path: 'pets',
        name: 'pet-manage',
        component: () => import('@/views/PetManage.vue'),
        meta: { title: '宠物管理' },
      },
      {
        path: 'adoptions',
        name: 'adoption-review',
        component: () => import('@/views/AdoptionReview.vue'),
        meta: { title: '领养审核' },
      },
      {
        path: 'users',
        name: 'user-manage',
        component: () => import('@/views/UserManage.vue'),
        meta: { title: '用户管理' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  const store = useUserStore();
  document.title = to.meta.title ? `${to.meta.title} · 宠物领养管理系统` : '宠物领养管理系统';

  if (to.meta.requiresAuth && !store.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.requiresAdmin && !store.isAdmin) {
    return { name: 'gallery' };
  }
  if (to.name === 'login' && store.isLoggedIn) {
    return store.isAdmin ? { name: 'dashboard' } : { name: 'gallery' };
  }
  return true;
});

export default router;
