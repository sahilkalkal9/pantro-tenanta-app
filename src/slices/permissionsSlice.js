import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Platform, PermissionsAndroid } from 'react-native';

const EXPO_PERMISSION_HANDLERS = {
  notifications: {
    request: async () => require('expo-notifications').requestPermissionsAsync(),
    check: async () => require('expo-notifications').getPermissionsAsync(),
  },
};

const isGranted = (result) => result?.granted === true || result?.status === 'granted';

const requestExpoPermission = async (permission) => {
  try {
    const handler = EXPO_PERMISSION_HANDLERS[permission];
    if (!handler) return false;
    return isGranted(await handler.request());
  } catch (error) {
    console.warn(`expo-permissions unavailable for ${permission}:`, error);
    return false;
  }
};

const checkExpoPermission = async (permission) => {
  try {
    const handler = EXPO_PERMISSION_HANDLERS[permission];
    if (!handler) return false;
    return isGranted(await handler.check());
  } catch (error) {
    console.warn(`expo-permissions unavailable for ${permission}:`, error);
    return false;
  }
};

const PERMISSIONS = {
  CAMERA: 'camera',
  LOCATION: 'location',
  STORAGE: 'storage',
  NOTIFICATIONS: 'notifications',
  SMS_READ: 'sms_read',
  SMS_RECEIVE: 'sms_receive',
  SMS_SEND: 'sms_send',
  CONTACTS: 'contacts',
};

const initialState = {
  granted: {},
  denied: {},
  requested: {},
  isRequestingAll: false,
  allRequested: false,
};

export const requestAllPermissions = createAsyncThunk('permissions/requestAll', async (_, { dispatch, rejectWithValue }) => {
  const results = {};
  
  try {
    if (Platform.OS === 'android') {
      // Only permissions declared in app.json -> requesting undeclared ones
      // makes requestMultiple reject and blocks the legitimate prompts.
      const perms = [
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      ].filter(Boolean);
      
      const granted = await PermissionsAndroid.requestMultiple(perms);
      Object.entries(granted).forEach(([perm, status]) => {
        const key = perm.split('.').pop().toLowerCase();
        results[key] = status === PermissionsAndroid.RESULTS.GRANTED;
      });
    } else {
      const expoPerms = ['camera', 'location', 'storage', 'notifications', 'contacts'];
      const grantedStatuses = await Promise.all(
        expoPerms.map(async (perm) => [perm, await requestExpoPermission(perm)])
      );
      grantedStatuses.forEach(([key, granted]) => {
        results[key] = granted;
      });
    }
    
    return results;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const checkPermission = createAsyncThunk('permissions/check', async (permission, { rejectWithValue }) => {
  try {
    let granted = false;
    
    if (Platform.OS === 'android') {
      const permMap = {
        camera: PermissionsAndroid.PERMISSIONS.CAMERA,
        location: PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        storage: PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        sms_read: PermissionsAndroid.PERMISSIONS.READ_SMS,
        sms_receive: PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        sms_send: PermissionsAndroid.PERMISSIONS.SEND_SMS,
        contacts: PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        notifications: PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      };
      
      if (permMap[permission]) {
        granted = await PermissionsAndroid.check(permMap[permission]);
      }
    } else {
      granted = await checkExpoPermission(permission);
    }
    
    return { permission, granted };
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const requestPermission = createAsyncThunk('permissions/request', async (permission, { rejectWithValue }) => {
  try {
    let granted = false;
    
    if (Platform.OS === 'android') {
      const permMap = {
        camera: PermissionsAndroid.PERMISSIONS.CAMERA,
        location: PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        storage: PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        sms_read: PermissionsAndroid.PERMISSIONS.READ_SMS,
        sms_receive: PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        sms_send: PermissionsAndroid.PERMISSIONS.SEND_SMS,
        contacts: PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        notifications: PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      };
      
      if (permMap[permission]) {
        granted = (await PermissionsAndroid.request(permMap[permission])) === PermissionsAndroid.RESULTS.GRANTED;
      }
    } else {
      granted = await requestExpoPermission(permission);
    }
    
    return { permission, granted };
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

const permissionsSlice = createSlice({
  name: 'permissions',
  initialState: {
    granted: {},
    denied: {},
    requested: {},
    isRequestingAll: false,
    allRequested: false,
  },
  reducers: {
    setPermission: (state, action) => {
      const { permission, granted } = action.payload;
      if (granted) {
        state.granted[permission] = true;
        delete state.denied[permission];
      } else {
        state.denied[permission] = true;
        delete state.granted[permission];
      }
      state.requested[permission] = true;
    },
    resetPermissions: (state) => {
      state.granted = {};
      state.denied = {};
      state.requested = {};
      state.allRequested = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(requestAllPermissions.pending, (state) => {
        state.isRequestingAll = true;
      })
      .addCase(requestAllPermissions.fulfilled, (state, action) => {
        state.isRequestingAll = false;
        state.allRequested = true;
        Object.entries(action.payload).forEach(([perm, granted]) => {
          if (granted) {
            state.granted[perm] = true;
            delete state.denied[perm];
          } else {
            state.denied[perm] = true;
            delete state.granted[perm];
          }
          state.requested[perm] = true;
        });
      })
      .addCase(requestAllPermissions.rejected, (state) => {
        state.isRequestingAll = false;
      })
      .addCase(checkPermission.fulfilled, (state, action) => {
        const { permission, granted } = action.payload;
        if (granted) {
          state.granted[permission] = true;
          delete state.denied[permission];
        } else {
          state.denied[permission] = true;
          delete state.granted[permission];
        }
        state.requested[permission] = true;
      })
      .addCase(requestPermission.fulfilled, (state, action) => {
        const { permission, granted } = action.payload;
        if (granted) {
          state.granted[permission] = true;
          delete state.denied[permission];
        } else {
          state.denied[permission] = true;
          delete state.granted[permission];
        }
        state.requested[permission] = true;
      });
  },
});

export const { setPermission, resetPermissions } = permissionsSlice.actions;
export default permissionsSlice.reducer;