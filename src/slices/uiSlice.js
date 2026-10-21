import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  theme: 'light',
  isSidebarOpen: false,
  isLoading: false,
  loadingMessage: '',
  modalStack: [],
  toasts: [],
  selectedPropertyId: null,
  selectedTab: 'dashboard',
  searchQuery: '',
  filters: {},
  toastId: 0,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
    },
    toggleSidebar: (state) => {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
    setSidebarOpen: (state, action) => {
      state.isSidebarOpen = action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload.loading;
      state.loadingMessage = action.payload.message || '';
    },
    pushModal: (state, action) => {
      state.modalStack.push({ id: Date.now(), ...action.payload });
    },
    popModal: (state) => {
      state.modalStack.pop();
    },
    clearModals: (state) => {
      state.modalStack = [];
    },
    addToast: (state, action) => {
      const id = ++state.toastId;
      state.toasts.push({ id, ...action.payload });
    },
    removeToast: (state, action) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    setSelectedProperty: (state, action) => {
      state.selectedPropertyId = action.payload;
    },
    setSelectedTab: (state, action) => {
      state.selectedTab = action.payload;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    resetUI: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setTheme,
  toggleTheme,
  toggleSidebar,
  setSidebarOpen,
  setLoading,
  pushModal,
  popModal,
  clearModals,
  addToast,
  removeToast,
  setSelectedProperty,
  setSelectedTab,
  setSearchQuery,
  setFilters,
  clearFilters,
  resetUI,
} = uiSlice.actions;
export default uiSlice.reducer;