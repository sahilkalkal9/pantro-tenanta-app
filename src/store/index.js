import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import authSlice from '../slices/authSlice';
import permissionsSlice from '../slices/permissionsSlice';
import uiSlice from '../slices/uiSlice';
import offlineSlice from '../slices/offlineSlice';
import { setUnauthorizedHandler } from '../lib/api';

const rootReducer = combineReducers({
  auth: authSlice,
  permissions: permissionsSlice,
  ui: uiSlice,
  offline: offlineSlice,
});

const persistConfig = {
  key: 'pantro-tenant',
  version: 1,
  storage: AsyncStorage,
  whitelist: ['auth', 'permissions'],
  blacklist: ['ui', 'offline'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      immutableCheck: false,
    }),
});

setUnauthorizedHandler(() => {
  store.dispatch({ type: 'auth/logout/fulfilled' });
});

export const persistor = persistStore(store);
