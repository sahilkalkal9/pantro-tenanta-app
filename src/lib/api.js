import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_ORIGIN = 'https://stayverse-backend-zyl7.onrender.com';
// export const API_ORIGIN = "http://localhost:5000";
const API_BASE_URL = `${API_ORIGIN}/api`;

// Resolves server-relative asset paths (e.g. "/uploads/abc.jpg") into an
// absolute URL usable by <Image source={{ uri }} />. Already-absolute URLs
// are returned untouched.
export function resolveMediaUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function warmupBackend() {
  try {
    await axios.get(`${API_BASE_URL}/health`, { timeout: 20000 });
  } catch (_) {
    // Ignore - silent wake-up ping
  }
}

const TOKEN_KEY = 'pantro_tenant_token';
const USER_KEY = 'pantro_tenant_user';

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
function safeAtob(str) {
  try {
    if (typeof atob === 'function') {
      return atob(str);
    }
  } catch (_) {}
  try {
    let output = '';
    const cleanStr = String(str).replace(/=+$/, '');
    if (cleanStr.length % 4 === 1) return null;
    for (
      let bc = 0, bs = 0, buffer, idx = 0;
      (buffer = cleanStr.charAt(idx++));
      ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
        ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
        : 0
    ) {
      buffer = B64_CHARS.indexOf(buffer);
    }
    return output;
  } catch (_) {
    return null;
  }
}

function decodePayload(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = safeAtob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    return decoded ? JSON.parse(decoded) : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  const payload = decodePayload(token);
  return payload ? typeof payload.exp === 'number' && Date.now() >= payload.exp * 1000 : false;
}

let onUnauthorized = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function handleUnauthorized() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
  if (onUnauthorized) {
    onUnauthorized();
  }
}

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) {
      if (isTokenExpired(token)) {
        await handleUnauthorized();
        return Promise.reject(new Error('Session expired. Please log in again.'));
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await handleUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default api;
