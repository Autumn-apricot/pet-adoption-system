import axios from 'axios';
import { ElMessage } from 'element-plus';

const service = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

let unauthorizedHandler = null;

/** 由 main.js 注入，用于在 401 时清理登录态并跳回登录页，避免此处直接 import router 造成循环依赖 */
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

service.interceptors.request.use((config) => {
  const token = localStorage.getItem('pet_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

service.interceptors.response.use(
  (response) => {
    const body = response.data;
    // 后端统一返回 { code, message, data }，code 非 200 视为业务失败
    if (body && typeof body.code === 'number' && body.code !== 200) {
      ElMessage.error(body.message || '请求失败');
      return Promise.reject(new Error(body.message || '请求失败'));
    }
    return body;
  },
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || '网络异常';

    if (status === 401) {
      if (unauthorizedHandler) unauthorizedHandler();
      ElMessage.error('登录状态已失效，请重新登录');
    } else if (status === 403) {
      ElMessage.error(message || '没有操作权限');
    } else {
      ElMessage.error(message);
    }
    return Promise.reject(error);
  }
);

export default service;
