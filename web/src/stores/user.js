import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api';

const TOKEN_KEY = 'pet_token';
const PROFILE_KEY = 'pet_profile';

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || '');
  const profile = ref(safeParse(localStorage.getItem(PROFILE_KEY)));

  const isLoggedIn = computed(() => Boolean(token.value));
  const isAdmin = computed(() => profile.value?.role === 'admin');
  const displayName = computed(() => profile.value?.nickname || profile.value?.username || '');

  function safeParse(raw) {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function persist() {
    if (token.value) localStorage.setItem(TOKEN_KEY, token.value);
    else localStorage.removeItem(TOKEN_KEY);

    if (profile.value) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile.value));
    else localStorage.removeItem(PROFILE_KEY);
  }

  async function login(form) {
    const res = await authApi.login(form);
    token.value = res.data.token;
    profile.value = res.data.user;
    persist();
    return res.data.user;
  }

  async function refresh() {
    if (!token.value) return null;
    const res = await authApi.profile();
    profile.value = res.data;
    persist();
    return res.data;
  }

  function logout() {
    token.value = '';
    profile.value = null;
    persist();
  }

  return { token, profile, isLoggedIn, isAdmin, displayName, login, refresh, logout };
});
