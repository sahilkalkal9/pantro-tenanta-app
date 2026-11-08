import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ORIGIN } from '../lib/api';
import apiCache from './apiCache';

let socket = null;
let reconnectTimer = null;
let pingTimer = null;
const listeners = new Set();

const TOKEN_KEY = 'pantro_tenant_token';

function getWsUrl() {
  const origin = API_ORIGIN || 'https://api.pantro.in';
  return origin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') + '/ws';
}

export async function initLiveSocket() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    const wsUrl = `${getWsUrl()}?token=${encodeURIComponent(token)}`;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'live_update') {
          // Invalidate cache so fresh data is fetched instantly
          apiCache.clear();
          listeners.forEach((fn) => {
            try { fn(msg); } catch {}
          });
        }
      } catch {}
    };

    socket.onclose = () => {
      clearInterval(pingTimer);
      socket = null;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(initLiveSocket, 5000);
    };

    socket.onerror = () => {
      try { socket.close(); } catch {}
    };
  } catch (err) {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(initLiveSocket, 6000);
  }
}

export function subscribeLiveUpdates(callback) {
  listeners.add(callback);
  initLiveSocket();
  return () => {
    listeners.delete(callback);
  };
}

export default {
  initLiveSocket,
  subscribeLiveUpdates,
};
