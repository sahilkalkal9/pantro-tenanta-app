import api from '../lib/api';
import { unwrapList, unwrapItem, getErrorMessage } from '../lib/normalize';
import apiCache from './apiCache';

export const tenantService = {
  // In-memory cache accessors for instant screen loading (0ms transitions)
  getCachedDashboard() {
    return apiCache.get('dashboard');
  },
  getCachedRents(params = {}) {
    return apiCache.get(`rents_${JSON.stringify(params)}`);
  },
  getCachedPaymentProofs(params = {}) {
    return apiCache.get(`proofs_${JSON.stringify(params)}`);
  },
  getCachedComplaints(params = {}) {
    return apiCache.get(`complaints_${JSON.stringify(params)}`);
  },
  getCachedNotices(params = {}) {
    return apiCache.get(`notices_${JSON.stringify(params)}`);
  },
  getCachedProfile() {
    return apiCache.get('profile');
  },
  getCachedDues(params = {}) {
    return apiCache.get(`dues_${JSON.stringify(params)}`);
  },
  getCachedNoticePeriod() {
    return apiCache.get('notice_period_requests');
  },
  getCachedNotifications(params = {}) {
    return apiCache.get(`notifications_${JSON.stringify(params)}`);
  },
  getCachedRoomChangeRequests(params = {}) {
    return apiCache.get(`room_change_${JSON.stringify(params)}`);
  },
  getCachedHistory() {
    return apiCache.get('tenant_history');
  },

  async preloadPortalData() {
    // Gentle prefetch of core dashboard & rents in background without locking network thread
    try {
      await Promise.allSettled([
        this.getDashboard(),
        this.getMyRents({ page: 1, limit: 24 }),
      ]);
    } catch (_) {}
  },

  // Dashboard
  async getDashboard(options = {}) {
    const bypassCache = options?.bypassCache || false;
    if (!bypassCache) {
      const cached = apiCache.get('dashboard');
      if (cached && !apiCache.isStale('dashboard', 90000)) {
        return cached;
      }
    }
    const res = await api.get('/dashboard/tenant');
    const unwrapped = unwrapItem(res, 'data');
    if (unwrapped) apiCache.set('dashboard', unwrapped);
    return unwrapped;
  },
  
  // Profile
  async getProfile(options = {}) {
    const bypassCache = options?.bypassCache || false;
    if (!bypassCache) {
      const cached = apiCache.get('profile');
      if (cached && !apiCache.isStale('profile', 120000)) {
        return cached;
      }
    }
    const res = await api.get('/tenant/me');
    const unwrapped = unwrapItem(res, 'data');
    if (unwrapped) apiCache.set('profile', unwrapped);
    return unwrapped;
  },
  
  async updateProfile(data) {
    const res = await api.put('/tenant/profile', data);
    apiCache.invalidate('profile');
    apiCache.invalidate('profile_form');
    apiCache.invalidate('dashboard');
    return unwrapItem(res, 'data');
  },
  
  getCachedProfileForm() {
    return apiCache.get('profile_form');
  },

  async getProfileForm(options = {}) {
    const bypassCache = options?.bypassCache || false;
    if (!bypassCache) {
      const cached = apiCache.get('profile_form');
      if (cached && !apiCache.isStale('profile_form', 120000)) {
        return cached;
      }
    }
    const res = await api.get('/tenant/profile-form');
    const unwrapped = unwrapItem(res, 'data');
    if (unwrapped) apiCache.set('profile_form', unwrapped);
    return unwrapped;
  },
  
  // Rents & Payments
  async getMyRents(params = {}, options = {}) {
    const bypassCache = options?.bypassCache || false;
    const key = `rents_${JSON.stringify(params)}`;
    if (!bypassCache) {
      const cached = apiCache.get(key);
      if (cached && !apiCache.isStale(key, 90000)) {
        return cached;
      }
    }
    const res = await api.get('/tenant/my-rents', { params });
    const unwrapped = unwrapItem(res, 'data');
    if (unwrapped) apiCache.set(key, unwrapped);
    return unwrapped;
  },
  
  async getPaymentInfo() {
    const res = await api.get('/tenant/payment-info');
    return unwrapItem(res, 'data');
  },
  
  async getUpiLink(rentId) {
    const res = await api.get(`/rents/${rentId}/upi-link`);
    return unwrapItem(res, 'data');
  },
  
  async uploadPaymentProof(data) {
    const res = await api.post('/tenant/payment-proofs', data);
    apiCache.invalidate('rents');
    apiCache.invalidate('proofs');
    apiCache.invalidate('dashboard');
    return unwrapItem(res, 'data');
  },
  
  async submitDuesPayment(data) {
    const res = await api.post('/tenant/dues/pay', data);
    apiCache.invalidate('rents');
    apiCache.invalidate('proofs');
    apiCache.invalidate('dashboard');
    return unwrapItem(res, 'data');
  },

  async getDuesUpiLink(items) {
    const res = await api.get('/tenant/dues/upi-link', {
      params: { items: typeof items === 'string' ? items : JSON.stringify(items) },
    });
    return unwrapItem(res, 'data') || res.data;
  },
  
  async getPaymentProofs(params = {}, options = {}) {
    const bypassCache = options?.bypassCache || false;
    const key = `proofs_${JSON.stringify(params)}`;
    if (!bypassCache) {
      const cached = apiCache.get(key);
      if (cached && !apiCache.isStale(key, 90000)) {
        return cached;
      }
    }
    const res = await api.get('/tenant/payment-proofs', { params });
    const unwrapped = unwrapList(res, 'proofs', 'payments', 'records');
    if (unwrapped) apiCache.set(key, unwrapped);
    return unwrapped;
  },

  async replyPaymentProof(id, data) {
    const res = await api.post(`/payment-proofs/${id}/reply`, data);
    apiCache.invalidate('proofs');
    apiCache.invalidate('dashboard');
    return unwrapItem(res, 'data') || res.data;
  },
  
  // Complaints
  async getMyComplaints(params = {}, options = {}) {
    const bypassCache = options?.bypassCache || false;
    const key = `complaints_${JSON.stringify(params)}`;
    if (!bypassCache) {
      const cached = apiCache.get(key);
      if (cached && !apiCache.isStale(key, 90000)) {
        return cached;
      }
    }
    const res = await api.get('/tenant/my-complaints', { params });
    const unwrapped = unwrapList(res, 'complaints', 'data');
    if (unwrapped) apiCache.set(key, unwrapped);
    return unwrapped;
  },
  
  async createComplaint(data) {
    const res = await api.post('/tenant/my-complaints', data);
    apiCache.invalidate('complaints');
    apiCache.invalidate('dashboard');
    return unwrapItem(res, 'complaint', 'data');
  },
  
  async getComplaintById(id) {
    const res = await api.get(`/tenant/my-complaints/${id}`);
    return unwrapItem(res, 'complaint', 'data');
  },
  
  async updateComplaintStatus(id, status) {
    const res = await api.patch(`/tenant/my-complaints/${id}/status`, { status });
    apiCache.invalidate('complaints');
    apiCache.invalidate('dashboard');
    return unwrapItem(res, 'complaint', 'data');
  },
  
  // Notices
  async getMyNotices(params = {}, options = {}) {
    const bypassCache = options?.bypassCache || false;
    const key = `notices_${JSON.stringify(params)}`;
    if (!bypassCache) {
      const cached = apiCache.get(key);
      if (cached && !apiCache.isStale(key, 90000)) {
        return cached;
      }
    }
    const res = await api.get('/tenant/my-notices', { params });
    const unwrapped = unwrapList(res, 'notices', 'data');
    if (unwrapped) apiCache.set(key, unwrapped);
    return unwrapped;
  },
  
  // History
  async getHistory(options = {}) {
    const bypassCache = options?.bypassCache || false;
    if (!bypassCache) {
      const cached = apiCache.get('tenant_history');
      if (cached && !apiCache.isStale('tenant_history', 120000)) {
        return cached;
      }
    }
    const res = await api.get('/tenant/history');
    const unwrapped = unwrapItem(res, 'data');
    if (unwrapped) apiCache.set('tenant_history', unwrapped);
    return unwrapped;
  },
  
  // Notifications
  async getNotifications(params = {}, options = {}) {
    const bypassCache = options?.bypassCache || false;
    const key = `notifications_${JSON.stringify(params)}`;
    if (!bypassCache) {
      const cached = apiCache.get(key);
      if (cached && !apiCache.isStale(key, 90000)) {
        return cached;
      }
    }
    const res = await api.get('/notifications', { params });
    const unwrapped = unwrapList(res, 'notifications', 'data');
    if (unwrapped) apiCache.set(key, unwrapped);
    return unwrapped;
  },

  async getNotificationCounts() {
    const res = await api.get('/notifications/counts');
    return unwrapItem(res, 'data');
  },

  async getRecentNotifications() {
    const res = await api.get('/notifications/recent');
    return unwrapList(res, 'notifications', 'data');
  },
  
  async markNotificationRead(id) {
    const res = await api.patch(`/notifications/${id}/read`);
    apiCache.invalidate('notifications_');
    return res.data;
  },
  
  async markAllNotificationsRead() {
    const res = await api.post('/notifications/read-all');
    apiCache.invalidate('notifications_');
    return res.data;
  },
  
  // Cashfree / UPI
  async getCashfreeConfig() {
    const res = await api.get('/cashfree/config');
    return unwrapItem(res, 'data');
  },
  
  async createCashfreeOrder(data) {
    const res = await api.post('/cashfree/orders', data);
    return unwrapItem(res, 'data');
  },
  
  async verifyCashfreeOrder(data) {
    const res = await api.post('/cashfree/orders/verify', data);
    return unwrapItem(res, 'data');
  },
  
  async getCashfreeOrderStatus(orderId) {
    const res = await api.get(`/cashfree/orders/${orderId}/status`);
    return unwrapItem(res, 'data');
  },
  
  // Pending Payments / Dues
  // NOTE: /pending-payments/my returns an object payload
  // ({ payments, unpaidRents, missingRents, unpaidSecurityDeposit, ... }),
  // so it must be unwrapped as an item — not a list.
  async getMyDues(params = {}, options = {}) {
    const bypassCache = options?.bypassCache || false;
    const key = `dues_${JSON.stringify(params)}`;
    if (!bypassCache) {
      const cached = apiCache.get(key);
      if (cached && !apiCache.isStale(key, 90000)) {
        return cached;
      }
    }
    const res = await api.get('/pending-payments/my', { params });
    const unwrapped = unwrapItem(res, 'data');
    if (unwrapped) apiCache.set(key, unwrapped);
    return unwrapped;
  },

  async getMyPendingPayments(params = {}) {
    const res = await api.get('/pending-payments/my', { params });
    return unwrapList(res, 'pendingPayments', 'data');
  },
  
  async payPendingPayment(id, data) {
    const res = await api.patch(`/pending-payments/${id}/pay`, data);
    return unwrapItem(res, 'pendingPayment', 'data');
  },

  async replyPendingPayment(id, data) {
    const res = await api.post(`/pending-payments/${id}/reply`, data);
    apiCache.invalidate('dues');
    return unwrapItem(res, 'data') || res.data;
  },

  async getDuesPayees() {
    const res = await api.get('/tenant/dues/payees');
    return unwrapList(res, 'payees', 'data') || res.data;
  },

  async initCashPayment(data) {
    const res = await api.post('/tenant/dues/cash/init', data);
    return unwrapItem(res, 'data') || res.data;
  },

  async confirmCashPayment(data) {
    const res = await api.post('/tenant/dues/cash/confirm', data);
    apiCache.invalidate('dues');
    apiCache.invalidate('dashboard');
    return unwrapItem(res, 'data') || res.data;
  },
  
  // Room Change
  async getRoomChangeRequests(params = {}, options = {}) {
    const bypassCache = options?.bypassCache || false;
    const key = `room_change_${JSON.stringify(params)}`;
    if (!bypassCache) {
      const cached = apiCache.get(key);
      if (cached && !apiCache.isStale(key, 90000)) {
        return cached;
      }
    }
    const res = await api.get('/room-change-requests/my', { params });
    const unwrapped = unwrapList(res, 'requests', 'data');
    if (unwrapped) apiCache.set(key, unwrapped);
    return unwrapped;
  },
  
  async createRoomChangeRequest(data) {
    const res = await api.post('/room-change-requests', data);
    apiCache.invalidate('room_change_');
    return unwrapItem(res, 'request', 'data');
  },
  
  // Settings
  async changePassword(data) {
    const res = await api.post('/auth/change-password', data);
    return unwrapItem(res, 'data');
  },
  
  // Transaction History
  // NOTE: Tenant role cannot access GET /transactions (owner/manager only).
  // Tenant payment history is served by getMyPaymentProofs() / getMyRents().

  // Signature
  async getMySignature() {
    const res = await api.get('/tenant/signature');
    return unwrapItem(res, 'data');
  },

  async saveMySignature(data) {
    const res = await api.post('/tenant/signature', data);
    return unwrapItem(res, 'data');
  },

  // KYC
  async initMyKyc(data) {
    const res = await api.post('/tenant/kyc/init', data);
    return unwrapItem(res, 'data') || res.data;
  },

  async completeMyKyc(data) {
    const res = await api.post('/tenant/kyc/complete', data);
    return unwrapItem(res, 'data') || res.data;
  },

  // Notice Period
  async getMyNoticePeriodRequests(options = {}) {
    const bypassCache = options?.bypassCache || false;
    if (!bypassCache) {
      const cached = apiCache.get('notice_period_requests');
      if (cached && !apiCache.isStale('notice_period_requests', 90000)) {
        return cached;
      }
    }
    const res = await api.get('/notice-period');
    const unwrapped = unwrapList(res, 'requests', 'data');
    if (unwrapped) apiCache.set('notice_period_requests', unwrapped);
    return unwrapped;
  },

  async submitNoticePeriodRequest(data) {
    const res = await api.post('/notice-period', data);
    apiCache.invalidate('notice_period_requests');
    apiCache.invalidate('profile');
    apiCache.invalidate('dashboard');
    return unwrapItem(res, 'request', 'data');
  },

  async getPendingRefundConfirmations() {
    const res = await api.get('/notice-period/refund/pending');
    return unwrapList(res, 'refunds', 'data');
  },

  async confirmRefund(id) {
    const res = await api.post(`/notice-period/${id}/confirm-refund`);
    return unwrapItem(res, 'data');
  },

  // Notifications (recent & counts)
  async getNotificationCounts() {
    const res = await api.get('/notifications/counts');
    return unwrapItem(res, 'data') || res.data;
  },

  async getRecentNotifications() {
    const res = await api.get('/notifications/recent');
    return unwrapList(res, 'notifications', 'data');
  },

  async registerDeviceToken(data) {
    const res = await api.post('/notifications/device-token', data);
    return res.data;
  },

  // Reports / statement
  async getPaymentInfoStatements() {
    const res = await api.get('/tenant/payment-info');
    return unwrapItem(res, 'data');
  },
};

export default tenantService;