import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('accessToken');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

let refreshing = false, queue = [];
api.interceptors.response.use(res => res, async err => {
  const orig = err.config;
  if (err.response?.status === 401 && err.response?.data?.code === 'TOKEN_EXPIRED' && !orig._retry) {
    if (refreshing) return new Promise((res, rej) => queue.push({ res, rej })).then(t => { orig.headers.Authorization = `Bearer ${t}`; return api(orig); });
    orig._retry = true; refreshing = true;
    try {
      const { data } = await axios.post('/api/auth/refresh-token', { refreshToken: localStorage.getItem('refreshToken') });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      queue.forEach(p => p.res(data.accessToken)); queue = [];
      orig.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(orig);
    } catch { queue.forEach(p => p.rej()); queue = []; localStorage.clear(); window.location.href = '/login'; }
    finally { refreshing = false; }
  }
  return Promise.reject(err);
});

export const authAPI = {
  register:       d => api.post('/auth/register', d),
  login:          d => api.post('/auth/login', d),
  verifyLoginOTP: d => api.post('/auth/login/verify-otp', d),
  logout:         () => api.post('/auth/logout'),
  refreshToken:   d => api.post('/auth/refresh-token', d),
  verifyEmail:    d => api.post('/auth/verify-email', d),
  forgotPassword: d => api.post('/auth/forgot-password', d),
  resetPassword:  d => api.post('/auth/reset-password', d),
  me:             () => api.get('/auth/me'),
};

export const accountAPI = {
  dashboard: ()     => api.get('/accounts/dashboard'),
  balance:   ()     => api.get('/accounts/balance'),
};

export const txAPI = {
  sendOTP:   ()     => api.post('/transactions/otp/send'),
  transfer:  d      => api.post('/transactions/transfer', d),
  history:   p      => api.get('/transactions/history', { params: p }),
  insights:  p      => api.get('/transactions/insights', { params: p }),
  reversal:  d      => api.post('/transactions/reversal/request', d),
};

export const beneAPI = {
  list:   ()  => api.get('/beneficiaries'),
  add:    d   => api.post('/beneficiaries', d),
  remove: id  => api.delete(`/beneficiaries/${id}`),
};

export const profileAPI = {
  get:            ()  => api.get('/profile'),
  update:         d   => api.patch('/profile', d),
  changePassword: d   => api.post('/profile/change-password', d),
};

export const bnplAPI = {
  convert: d => api.post('/bnpl/convert', d),
  plans:   () => api.get('/bnpl/plans'),
};

export const aiAPI = {
  creditScore:    () => api.get('/ai/credit-score'),
  carbonFootprint:() => api.get('/ai/carbon-footprint'),
};

export const stmtAPI = {
  summary:  (y,m) => api.get(`/statements/${y}/${m}/summary`),
  download: (y,m) => api.get(`/statements/${y}/${m}/download`, { responseType:'blob' }),
};

export const schedAPI = {
  list:   ()  => api.get('/scheduled'),
  create: d   => api.post('/scheduled', d),
  cancel: id  => api.delete(`/scheduled/${id}`),
};

export const agentAPI = {
  command:   d  => api.post('/agent/command', d),
  cashflow:  () => api.get('/agent/cashflow'),
};

export const analyticsAPI = {
  get:    p  => api.get('/analytics', { params: p }),
  ledger: p  => api.get('/analytics/ledger', { params: p }),
  geo:    () => api.get('/analytics/geo'),
};

export const sessionAPI = {
  list:      ()  => api.get('/sessions'),
  revoke:    id  => api.delete(`/sessions/${id}`),
  revokeAll: ()  => api.delete('/sessions'),
};

export const kycAPI = {
  upload: fd => api.post('/kyc/upload', fd, { headers:{ 'Content-Type':'multipart/form-data' } }),
  status: () => api.get('/kyc/status'),
};

export const adminAPI = {
  dashboard:       ()      => api.get('/admin/dashboard'),
  users:           p       => api.get('/admin/users', { params: p }),
  freeze:          d       => api.post('/admin/freeze', d),
  unfreeze:        d       => api.post('/admin/unfreeze', d),
  fraudAlerts:     p       => api.get('/admin/fraud/alerts', { params: p }),
  reviewFraud:     (id, d) => api.patch(`/admin/fraud/${id}`, d),
  auditLogs:       p       => api.get('/admin/audit-logs', { params: p }),
  reversals:       ()      => api.get('/admin/reversals'),
  processReversal: d       => api.post('/admin/reversals/process', d),
};

export default api;
