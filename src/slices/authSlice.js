import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import { setAuthToken, getAuthToken, removeAuthToken, setUserData, getUserData, removeUserData } from '../lib/storage';

// ── Role gate (web: login/page.js rejects non-tenant accounts) ───────────────
export const ROLE_ACCESS_ERROR = 'This account does not have access to the Tenant portal.';
export const INVALID_RESPONSE_ERROR = 'Invalid response from server. Please try again.';

// ── 30-day inactivity expiry (web: lib/auth.js INACTIVITY_TIMEOUT_MS) ────────
const LAST_ACTIVE_KEY = 'pantro_tenant_last_active';
const INACTIVITY_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000;

function touchLastActive() {
  // Mirror web's touchLastActive(): stamped on every successful auth write.
  AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())).catch(() => {});
}

async function isSessionInactive() {
  try {
    const lastActiveStr = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
    if (!lastActiveStr) return false;
    const lastActive = parseInt(lastActiveStr, 10);
    if (isNaN(lastActive)) return false;
    return Date.now() - lastActive > INACTIVITY_TIMEOUT_MS;
  } catch {
    return false;
  }
}

// Wipe the stored session (token + user + last-active stamp) without navigating.
async function clearSession() {
  await removeAuthToken();
  await removeUserData();
  await AsyncStorage.removeItem(LAST_ACTIVE_KEY).catch(() => {});
  delete api.defaults.headers.common['Authorization'];
}

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  role: null,
};

export const login = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const response = await api.post('/auth/login', credentials);
    const data = response.data.data || response.data;

    // Owner / Tenant / Manager: a password is only the FIRST factor. The backend
    // replies { requiresOtp: true, phone, devOtp } and issues NO token until
    // /auth/verify-otp succeeds. (Super admins receive a token directly.)
    if (!data?.token || data?.requiresOtp) {
      return { requiresOtp: true, phone: data?.phone, devOtp: data?.devOtp };
    }

    const { token, user } = data;
    if (user?.role !== 'tenant') {
      await clearSession();
      return rejectWithValue(ROLE_ACCESS_ERROR);
    }
    await setAuthToken(token);
    await setUserData(user);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    touchLastActive();
    return { token, user };
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Login failed');
  }
});

export const verifyOtp = createAsyncThunk('auth/verifyOtp', async ({ phone, otp }, { rejectWithValue }) => {
  try {
    const response = await api.post('/auth/verify-otp', { phone, otp });
    // Mirror web login/page.js handleVerifyOtp: token || accessToken, user || admin || data
    const data = response.data.data || response.data;
    const token = data?.token || data?.accessToken;
    const user = data?.user || data?.admin || data;

    if (!token || !user) {
      return rejectWithValue(INVALID_RESPONSE_ERROR);
    }
    if (user.role !== 'tenant') {
      await clearSession();
      return rejectWithValue(ROLE_ACCESS_ERROR);
    }

    await setAuthToken(token);
    await setUserData(user);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    touchLastActive();
    return { token, user };
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'OTP verification failed');
  }
});

export const requestOtp = createAsyncThunk('auth/requestOtp', async (phone, { rejectWithValue }) => {
  try {
    const response = await api.post('/auth/request-otp', { phone });
    const data = response.data?.data || response.data;
    if (data?.token && data?.user) {
      // Dev bypass: server issues the token directly — the tenant role gate applies.
      if (data.user.role !== 'tenant') {
        await clearSession();
        return rejectWithValue(ROLE_ACCESS_ERROR);
      }
      await setAuthToken(data.token);
      await setUserData(data.user);
      api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      touchLastActive();
    }
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to send OTP');
  }
});

// Deep-link / query-param auto-login (web: ?token= / ?auth_token= / ?user= on /login).
export const deepLinkLogin = createAsyncThunk(
  'auth/deepLinkLogin',
  async ({ token, user: userJson }, { rejectWithValue }) => {
    try {
      let user = null;
      if (userJson) {
        try {
          user = JSON.parse(decodeURIComponent(userJson));
        } catch (_) {
          user = null;
        }
      }

      await setAuthToken(token);
      if (!user) {
        // Web stores the token too, then the portal layout bounces back to
        // login because no user is present — mirror that by returning unauthenticated.
        return { token, user: null };
      }
      if (user.role !== 'tenant') {
        await clearSession();
        return rejectWithValue(ROLE_ACCESS_ERROR);
      }
      await setUserData(user);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      touchLastActive();
      return { token, user };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const initializeAuth = createAsyncThunk('auth/initialize', async (_, { rejectWithValue }) => {
  try {
    // Web parity (lib/auth.js getToken/getStoredUser): a session idle for more
    // than 30 days is wiped and the user must sign in again.
    if (await isSessionInactive()) {
      await clearSession();
      return { token: null, user: null };
    }
    const token = await getAuthToken();
    const user = await getUserData();
    if (token && user) {
      if (user.role !== 'tenant') {
        await clearSession();
        return { token: null, user: null };
      }
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      touchLastActive();
      return { token, user };
    }
    return { token: null, user: null };
  } catch (error) {
    return rejectWithValue('Auth initialization failed');
  }
});

export const logout = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await api.post('/auth/logout');
  } catch (error) {
    console.warn('Logout API failed:', error);
  }
  await removeAuthToken();
  await removeUserData();
  await AsyncStorage.removeItem(LAST_ACTIVE_KEY).catch(() => {});
  // NOTE: web unregisters the push token ('pantro_push-token') on logout; the
  // mobile app never stores a push token (storage.setPushToken is unused), so
  // there is nothing to clear here.
  delete api.defaults.headers.common['Authorization'];
  return true;
});

export const refreshUserProfile = createAsyncThunk('auth/refreshProfile', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/auth/me');
    const user = response.data.data || response.data;
    await setUserData(user);
    return user;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to refresh profile');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      state.role = action.payload?.role || null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        // Only authenticate when a real token came back. A `requiresOtp`
        // payload means the password was accepted but the OTP step is pending.
        if (action.payload?.token) {
          state.isAuthenticated = true;
          state.token = action.payload.token;
          state.user = action.payload.user;
          state.role = action.payload.user?.role || null;
        }
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(verifyOtp.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.role = action.payload.user?.role || null;
        state.error = null;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(requestOtp.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(requestOtp.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload?.token && action.payload?.user) {
          state.isAuthenticated = true;
          state.token = action.payload.token;
          state.user = action.payload.user;
          state.role = action.payload.user?.role || null;
        }
      })
      .addCase(requestOtp.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(deepLinkLogin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deepLinkLogin.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload?.token && action.payload?.user) {
          state.isAuthenticated = true;
          state.token = action.payload.token;
          state.user = action.payload.user;
          state.role = action.payload.user?.role || null;
        }
        state.error = null;
      })
      .addCase(deepLinkLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(initializeAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload.token && action.payload.user) {
          state.isAuthenticated = true;
          state.token = action.payload.token;
          state.user = action.payload.user;
          state.role = action.payload.user?.role || null;
        } else {
          // No stored session, or it was cleared (30-day inactivity expiry /
          // role mismatch) — drop any persisted auth state so the guards redirect.
          state.isAuthenticated = false;
          state.token = null;
          state.user = null;
          state.role = null;
        }
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.token = null;
        state.user = null;
        state.role = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.token = null;
        state.user = null;
        state.role = null;
        state.error = null;
      })
      .addCase(refreshUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;