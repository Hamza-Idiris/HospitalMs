import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('hms_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
api.interceptors.response.use((r) => r, (err) => {
  if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) {
    localStorage.removeItem('hms_token');
    if (location.pathname !== '/login') location.href = '/login';
  }
  return Promise.reject(err);
});
export const errMsg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong';
export const get = (url, params) => api.get(url, { params }).then((r) => r.data);
// Open an authenticated file (images/PDF) in a new tab
export async function openFile(hospitalId, name) {
  const res = await api.get(`/files/${hospitalId}/${name}`, { responseType: 'blob' });
  window.open(URL.createObjectURL(res.data), '_blank');
}
