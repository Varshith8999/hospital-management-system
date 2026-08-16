import api from './client';

const qs = (params = {}) => {
  const clean = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  return clean.length ? `?${new URLSearchParams(Object.fromEntries(clean))}` : '';
};

export const authApi = {
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data),
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  changePassword: (payload) => api.patch('/auth/change-password', payload).then((r) => r.data),
};

export const dashboardApi = {
  summary: () => api.get('/dashboard').then((r) => r.data),
};

export const patientsApi = {
  list: (params) => api.get(`/patients${qs(params)}`).then((r) => r.data),
  get: (id) => api.get(`/patients/${id}`).then((r) => r.data),
  summary: (id) => api.get(`/patients/${id}/summary`).then((r) => r.data),
  create: (payload) => api.post('/patients', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/patients/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/patients/${id}`).then((r) => r.data),
};

export const doctorsApi = {
  list: (params) => api.get(`/doctors${qs(params)}`).then((r) => r.data),
  get: (id) => api.get(`/doctors/${id}`).then((r) => r.data),
  create: (payload) => api.post('/doctors', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/doctors/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/doctors/${id}`).then((r) => r.data),
  myPatients: (params) => api.get(`/doctors/me/patients${qs(params)}`).then((r) => r.data),
  slots: (id, date) => api.get(`/doctors/${id}/slots${qs({ date })}`).then((r) => r.data),
};

export const nursesApi = {
  list: (params) => api.get(`/nurses${qs(params)}`).then((r) => r.data),
  get: (id) => api.get(`/nurses/${id}`).then((r) => r.data),
  create: (payload) => api.post('/nurses', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/nurses/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/nurses/${id}`).then((r) => r.data),
};

export const departmentsApi = {
  list: (params) => api.get(`/departments${qs(params)}`).then((r) => r.data),
  get: (id) => api.get(`/departments/${id}`).then((r) => r.data),
  create: (payload) => api.post('/departments', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/departments/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/departments/${id}`).then((r) => r.data),
};

export const appointmentsApi = {
  list: (params) => api.get(`/appointments${qs(params)}`).then((r) => r.data),
  get: (id) => api.get(`/appointments/${id}`).then((r) => r.data),
  book: (payload) => api.post('/appointments', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/appointments/${id}`, payload).then((r) => r.data),
  confirm: (id, payload) => api.patch(`/appointments/${id}/confirm`, payload).then((r) => r.data),
  reject: (id, payload) => api.patch(`/appointments/${id}/reject`, payload).then((r) => r.data),
  complete: (id, payload) => api.patch(`/appointments/${id}/complete`, payload).then((r) => r.data),
  cancel: (id, payload) => api.patch(`/appointments/${id}/cancel`, payload).then((r) => r.data),
  reschedule: (id, payload) =>
    api.patch(`/appointments/${id}/reschedule`, payload).then((r) => r.data),
};

export const recordsApi = {
  list: (params) => api.get(`/medical-records${qs(params)}`).then((r) => r.data),
  get: (id) => api.get(`/medical-records/${id}`).then((r) => r.data),
  create: (payload) => api.post('/medical-records', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/medical-records/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/medical-records/${id}`).then((r) => r.data),
};

export const prescriptionsApi = {
  list: (params) => api.get(`/prescriptions${qs(params)}`).then((r) => r.data),
  get: (id) => api.get(`/prescriptions/${id}`).then((r) => r.data),
  create: (payload) => api.post('/prescriptions', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/prescriptions/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/prescriptions/${id}`).then((r) => r.data),
};

export const billsApi = {
  list: (params) => api.get(`/bills${qs(params)}`).then((r) => r.data),
  get: (id) => api.get(`/bills/${id}`).then((r) => r.data),
  create: (payload) => api.post('/bills', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/bills/${id}`, payload).then((r) => r.data),
  pay: (id, payload) => api.patch(`/bills/${id}/pay`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/bills/${id}`).then((r) => r.data),
};

export const usersApi = {
  list: (params) => api.get(`/users${qs(params)}`).then((r) => r.data),
  get: (id) => api.get(`/users/${id}`).then((r) => r.data),
  create: (payload) => api.post('/users', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/users/${id}`, payload).then((r) => r.data),
  setActive: (id, isActive) =>
    api.patch(`/users/${id}/status`, { isActive }).then((r) => r.data),
  remove: (id) => api.delete(`/users/${id}`).then((r) => r.data),
};

export const healthApi = {
  check: () => api.get('/health').then((r) => r.data),
};
