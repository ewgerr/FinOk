// Lightweight backend client for the app's own backend
// Replaces references to external Base44 SDK

async function requestJson(path, opts = {}) {
  return request(path, opts);
}

async function requestBlob(path, opts = {}) {
  const headers = opts.headers || {};
  const res = await fetch(path, { ...opts, headers, credentials: 'include' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(res.statusText || 'Request failed');
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return res.blob();
}

async function request(path, opts = {}) {
  const headers = opts.headers || {};
  headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  const res = await fetch(path, { ...opts, headers, credentials: 'include' });
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
  blog: {
    list: async (params = {}) => {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') search.set(key, value);
      });
      return requestJson(`/api/blog/posts${search.toString() ? `?${search.toString()}` : ''}`);
    },
    getBySlug: async (slug) => requestJson(`/api/blog/posts/${encodeURIComponent(slug)}`),
  },

  auth: {
    setToken: () => null,
    logout: async () => {
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } catch {
        // ignore logout transport errors
      }
    },
    redirectToLogin: (returnTo) => { window.location.href = `/login?returnTo=${encodeURIComponent(returnTo || '/')}`; },

    loginViaEmailPassword: async (email, password) => {
      return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    },

    register: async (payload) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    requestPasswordReset: async (email) => request('/api/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) }),
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
    blog: {
      list: async () => requestJson('/api/admin/blog/posts'),
      create: async (payload) => request('/api/admin/blog/posts', { method: 'POST', body: JSON.stringify(payload) }),
      update: async (id, payload) => request(`/api/admin/blog/posts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
      remove: async (id) => request(`/api/admin/blog/posts/${id}`, { method: 'DELETE' }),
    },
    workers: {
      list: async () => requestJson('/api/admin/workers'),
      create: async (payload) => request('/api/admin/workers', { method: 'POST', body: JSON.stringify(payload) }),
      invite: async (payload) => request('/api/admin/workers/invite', { method: 'POST', body: JSON.stringify(payload) }),
    },
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
    payments: {
      list: async () => requestJson('/api/admin/payments'),
      analytics: async () => requestJson('/api/admin/payments/analytics'),
      markPaid: async (consultationId) => request(`/api/admin/payments/${consultationId}/mark-paid`, { method: 'POST' }),
    },
    pipeline: {
      getPreferences: async () => requestJson('/api/admin/pipeline/preferences'),
      savePreferences: async (order) => request('/api/admin/pipeline/preferences', { method: 'PUT', body: JSON.stringify({ order }) }),
    },
    tasks: {
      list: async (params = {}) => {
        const search = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') search.set(key, value);
        });
        return requestJson(`/api/admin/tasks${search.toString() ? `?${search.toString()}` : ''}`);
      },
      create: async (payload) => request('/api/admin/tasks', { method: 'POST', body: JSON.stringify(payload) }),
      update: async (id, payload) => request(`/api/admin/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    },
    stats: async () => requestJson('/api/admin/stats'),
    exportClientsCsv: async () => requestBlob('/api/admin/consultations/export.csv', { headers: { Accept: 'text/csv' } }),
    notifications: async () => requestJson('/api/admin/notifications'),
    auditLogs: async () => requestJson('/api/admin/audit-logs'),
    reviews: {
      list: async () => requestJson('/api/admin/reviews'),
      patch: async (id, payload) => request(`/api/admin/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
      remove: async (id) => request(`/api/admin/reviews/${id}`, { method: 'DELETE' }),
    },
  }
};
