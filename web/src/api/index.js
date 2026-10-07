import request from './request';

export const authApi = {
  register: (data) => request.post('/auth/register', data),
  login: (data) => request.post('/auth/login', data),
  profile: () => request.get('/auth/profile'),
  updateProfile: (data) => request.put('/auth/profile', data),
  changePassword: (data) => request.put('/auth/password', data),
};

export const petApi = {
  list: (params) => request.get('/pets', { params }),
  detail: (id) => request.get(`/pets/${id}`),
  categories: () => request.get('/pets/categories'),
  create: (data) => request.post('/pets', data),
  update: (id, data) => request.put(`/pets/${id}`, data),
  remove: (id) => request.delete(`/pets/${id}`),
  stats: () => request.get('/pets/stats'),
};

export const adoptionApi = {
  apply: (data) => request.post('/adoptions', data),
  mine: (params) => request.get('/adoptions/mine', { params }),
  list: (params) => request.get('/adoptions', { params }),
  review: (id, data) => request.put(`/adoptions/${id}/review`, data),
  cancel: (id) => request.delete(`/adoptions/${id}`),
  stats: () => request.get('/adoptions/stats'),
};

export const userApi = {
  list: (params) => request.get('/users', { params }),
  stats: () => request.get('/users/stats'),
  setStatus: (id, status) => request.put(`/users/${id}/status`, { status }),
  remove: (id) => request.delete(`/users/${id}`),
};
