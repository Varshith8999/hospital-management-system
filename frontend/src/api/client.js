import axios from 'axios';

/**
 * Base URL resolution order:
 *  1. window.__APP_CONFIG__.API_URL - injected at container start by the nginx
 *     entrypoint, so one image works in any environment.
 *  2. VITE_API_URL - build-time override for local development.
 *  3. '/api' - same-origin default (nginx proxies it to the backend).
 * No production URL is ever hard-coded.
 */
export const API_BASE_URL =
  (typeof window !== 'undefined' && window.__APP_CONFIG__?.API_URL) ||
  import.meta.env.VITE_API_URL ||
  '/api';

export const TOKEN_KEY = 'hms.token';
export const USER_KEY = 'hms.user';

const memoryStore = new Map();

/** localStorage with an in-memory fallback (private mode / SSR safety). */
export const storage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStore.get(key) ?? null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memoryStore.set(key, value);
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memoryStore.delete(key);
    }
  },
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = storage.get(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    // Normalise every failure into a single readable message.
    let message = data?.message || error.message || 'Something went wrong';
    if (Array.isArray(data?.errors) && data.errors.length) {
      message = data.errors.map((e) => e.message).join(', ');
    }
    if (error.code === 'ECONNABORTED') message = 'The request timed out. Please try again.';
    if (!error.response) message = 'Cannot reach the server. Check your connection.';

    if (status === 401 && typeof onUnauthorized === 'function') onUnauthorized();

    return Promise.reject(Object.assign(new Error(message), { status, details: data?.errors }));
  }
);

export default api;
