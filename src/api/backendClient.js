// Lightweight backend client for the app's own backend
// Replaces references to external Base44 SDK

const TOKEN_KEY = 'finok_token';

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
}

function setToken(t) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) {}
}

async function requestJson(path, opts = {}) {
  return request(path, opts);
}

async function request(path, opts = {}) {
  const headers = opts.headers || {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(res.statusText || 'Request failed');
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

export const apiClient = {
  auth: {
    setToken: (t) => setToken(t),
    logout: () => setToken(null),
    redirectToLogin: (returnTo) => { window.location.href = `/login?returnTo=${encodeURIComponent(returnTo || '/')}`; },

    loginViaEmailPassword: async (email, password) => {
      const data = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (data?.token) setToken(data.token);
      return data;
    },

    register: async (payload) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    verifyOtp: async (opts) => request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify(opts) }),
    resendOtp: async (email) => request('/api/auth/resend-otp', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: async ({ resetToken, newPassword }) => request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ resetToken, newPassword }) }),

    loginWithProvider: (provider, redirect) => {
      window.location.href = `/api/auth/provider/${provider}?redirect=${encodeURIComponent(redirect || '/')}`;
    },

    me: async () => request('/api/auth/me')
  },

  entities: {
    Consultation: {
      create: async (payload) => request('/api/entities/Consultation', { method: 'POST', body: JSON.stringify(payload) }),
      list: async () => request('/api/entities/Consultation'),
      get: async (id) => request(`/api/entities/Consultation/${id}`),
      update: async (id, payload) => request(`/api/entities/Consultation/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
      availableSlots: async ({ date, duration = 15 }) => request(`/api/entities/Consultation/available-slots?date=${encodeURIComponent(date)}&duration=${encodeURIComponent(duration)}`),
    },

    Service: {
      list: async () => request('/api/entities/Service'),
      get: async (id) => request(`/api/entities/Service/${id}`)
    }
  },

  admin: {
    consultations: {
      list: async (params = {}) => {
        const search = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') search.set(key, value);
        });
        return requestJson(`/api/admin/consultations${search.toString() ? `?${search.toString()}` : ''}`);
      },
      update: async (id, payload) => request(`/api/entities/Consultation/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    },
    stats: async () => requestJson('/api/admin/stats'),
    notifications: async () => requestJson('/api/admin/notifications'),
    auditLogs: async () => requestJson('/api/admin/audit-logs'),
    reviews: {
      list: async () => requestJson('/api/admin/reviews'),
      patch: async (id, payload) => request(`/api/admin/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
      remove: async (id) => request(`/api/admin/reviews/${id}`, { method: 'DELETE' }),
    },
  }
};
