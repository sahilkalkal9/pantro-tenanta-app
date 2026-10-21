import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_QUEUE_KEY = '@pantro_offline_queue';

const initialState = {
  isOnline: true,
  wasOffline: false,
  syncQueue: [],
  isSyncing: false,
  lastSyncTime: null,
  failedItems: [],
};

export const initializeNetworkListener = createAsyncThunk('offline/initNetwork', async (_, { dispatch }) => {
  const subscription = NetInfo.addEventListener((state) => {
    dispatch(setOnlineStatus(state.isConnected ?? true));
  });
  return subscription;
});

export const loadOfflineQueue = createAsyncThunk('offline/loadQueue', async (_, { rejectWithValue }) => {
  try {
    const queue = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const saveOfflineQueue = createAsyncThunk('offline/saveQueue', async (queue, { rejectWithValue }) => {
  try {
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    return queue;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const addToOfflineQueue = createAsyncThunk('offline/addToQueue', async (action, { getState, rejectWithValue }) => {
  try {
    const { offline } = getState();
    const newItem = {
      id: Date.now().toString(),
      ...action,
      timestamp: Date.now(),
      retries: 0,
    };
    const updatedQueue = [...offline.syncQueue, newItem];
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));
    return newItem;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const processOfflineQueue = createAsyncThunk('offline/processQueue', async (_, { getState, dispatch, rejectWithValue }) => {
  const { offline, auth } = getState();
  if (!offline.isOnline || offline.isSyncing || offline.syncQueue.length === 0) {
    return;
  }
  
  dispatch(setSyncing(true));
  const queue = [...offline.syncQueue];
  const failed = [];
  const api = (await import('../lib/api')).default;
  
  for (const item of queue) {
    try {
      if (item.retries >= 3) {
        failed.push(item);
        continue;
      }
      
      await api.request({
        method: item.method,
        url: item.url,
        data: item.data,
        params: item.params,
      });
      
      // Remove from queue on success
      const updatedQueue = queue.filter((q) => q.id !== item.id);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));
      dispatch(removeFromQueue(item.id));
    } catch (error) {
      // Increment retry count
      const updatedItem = { ...item, retries: item.retries + 1 };
      const updatedQueue = queue.map((q) => q.id === item.id ? updatedItem : q);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));
      dispatch(updateQueueItem(updatedItem));
      
      if (updatedItem.retries >= 3) {
        failed.push(updatedItem);
      }
    }
  }
  
  if (failed.length > 0) {
    dispatch(setFailedItems(failed));
  }
  
  dispatch(setSyncing(false));
  dispatch(setLastSyncTime(Date.now()));
});

export const removeFromQueue = createAsyncThunk('offline/removeFromQueue', async (id, { getState, rejectWithValue }) => {
  try {
    const { offline } = getState();
    const updatedQueue = offline.syncQueue.filter((item) => item.id !== id);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));
    return id;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const updateQueueItem = createAsyncThunk('offline/updateQueueItem', async (item, { getState, rejectWithValue }) => {
  try {
    const { offline } = getState();
    const updatedQueue = offline.syncQueue.map((q) => q.id === item.id ? item : q);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));
    return item;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    setOnlineStatus: (state, action) => {
      const wasOnline = state.isOnline;
      state.isOnline = action.payload;
      
      if (!wasOnline && action.payload) {
        // Came back online
        state.wasOffline = true;
      }
    },
    setSyncing: (state, action) => {
      state.isSyncing = action.payload;
    },
    setLastSyncTime: (state, action) => {
      state.lastSyncTime = action.payload;
    },
    setFailedItems: (state, action) => {
      state.failedItems = action.payload;
    },
    clearFailedItems: (state) => {
      state.failedItems = [];
    },
    clearQueue: (state) => {
      state.syncQueue = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadOfflineQueue.fulfilled, (state, action) => {
        state.syncQueue = action.payload;
      })
      .addCase(addToOfflineQueue.fulfilled, (state, action) => {
        state.syncQueue.push(action.payload);
      })
      .addCase(removeFromQueue.fulfilled, (state, action) => {
        state.syncQueue = state.syncQueue.filter((item) => item.id !== action.payload);
      })
      .addCase(updateQueueItem.fulfilled, (state, action) => {
        state.syncQueue = state.syncQueue.map((q) => q.id === action.payload.id ? action.payload : q);
      })
      .addCase(processOfflineQueue.fulfilled, (state) => {
        // Queue processed
      });
  },
});

export const {
  setOnlineStatus,
  setSyncing,
  setLastSyncTime,
  setFailedItems,
  clearFailedItems,
  clearQueue,
} = offlineSlice.actions;
export default offlineSlice.reducer;