import api from './api';

export const authService = {
  login: (email, password) => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    return api.post('/api/auth/login', form);
  },
  me: () => api.get('/api/auth/me'),
  logout: () => api.post('/api/auth/logout'),
};

export const cameraService = {
  list: () => api.get('/api/cameras/'),
  create: (data) => api.post('/api/cameras/', data),
  update: (id, data) => api.put(`/api/cameras/${id}`, data),
  delete: (id) => api.delete(`/api/cameras/${id}`),
};

export const workerService = {
  list: () => api.get('/api/workers/'),
  create: (data) => api.post('/api/workers/', data),
  update: (id, data) => api.put(`/api/workers/${id}`, data),
  delete: (id) => api.delete(`/api/workers/${id}`),
};

export const locationService = {
  list: () => api.get('/api/locations/'),
  create: (data) => api.post('/api/locations/', data),
};

export const detectionService = {
  status: () => api.get('/api/detection/status'),
  analyzeImage: (formData) => api.post('/api/detection/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  analyzeVideo: (formData) => api.post('/api/detection/video', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  }),
};

export const violationService = {
  list: (params) => api.get('/api/violations/', { params }),
  get: (id) => api.get(`/api/violations/${id}`),
  delete: (id) => api.delete(`/api/violations/${id}`),
};

export const incidentService = {
  list: (params) => api.get('/api/incidents/', { params }),
  get: (id) => api.get(`/api/incidents/${id}`),
  update: (id, data) => api.put(`/api/incidents/${id}`, data),
  assign: (id, assigned_to) => api.patch(`/api/incidents/${id}/assign`, null, { params: { assigned_to } }),
  delete: (id) => api.delete(`/api/incidents/${id}`),
};

export const analyticsService = {
  overview: () => api.get('/api/analytics/overview'),
  trends: (days = 30) => api.get('/api/analytics/violations/trends', { params: { days } }),
  ppeBreakdown: (days = 30) => api.get('/api/analytics/ppe/breakdown', { params: { days } }),
  cameraStats: () => api.get('/api/analytics/cameras/stats'),
  workerStats: (days = 30) => api.get('/api/analytics/workers/stats', { params: { days } }),
  hourlyViolations: (days = 30) => api.get('/api/analytics/violations/hourly', { params: { days } }),
};

export const reportService = {
  daily: () => api.get('/api/reports/daily'),
  weekly: () => api.get('/api/reports/weekly'),
  monthly: () => api.get('/api/reports/monthly'),
};

export const userService = {
  list: () => api.get('/api/users/'),
  create: (data) => api.post('/api/users/', data),
  update: (id, data) => api.put(`/api/users/${id}`, data),
  delete: (id) => api.delete(`/api/users/${id}`),
};

export const notificationService = {
  list: () => api.get('/api/notifications/'),
  markRead: (id) => api.post(`/api/notifications/${id}/read`),
  markAllRead: () => api.post('/api/notifications/read-all'),
};
