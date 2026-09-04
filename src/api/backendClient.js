// // Lightweight backend client for the app's own backend
// // Replaces references to external Base44 SDK
// const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// async function requestJson(path, opts = {}) {
//   return request(path, opts);
// }

// async function requestBlob(path, opts = {}) {
//   const headers = opts.headers || {};

//   const res = await fetch(`${API_URL}${path}`, {
//     ...opts,
//     headers,
//     credentials: 'include',
//   });

//   if (!res.ok) {
//     const error = new Error('Request failed');
//     error.status = res.status;
//     try {
//       error.body = await res.text();
//     } catch {
//       error.body = 'Could not read error response body';
//     }
//     throw error;
//   }

//   return res.blob();
// }


// async function request(path, opts = {}) {
//   const headers = opts.headers || {};
//   headers["Content-Type"] = headers["Content-Type"] || "application/json";

//   const res = await fetch(`${API_URL}${path}`, {
//     ...opts,
//     headers,
//     credentials: 'include',
//   });

//   if (!res.ok) {
//     const error = new Error('Request failed');
//     error.status = res.status;
//     try {
//       error.body = await res.json();
//     } catch {
//       try {
//         error.body = await res.text();
//       } catch {
//         error.body = 'Could not read error response body';
//       }
//     }
//     throw error;
//   }

//   if (res.status === 204) return null;
//   return res.json();
// }

// export const apiClient = {
//   health: async () => request('/api/health'),

//   reviews: {
//     list: async () => requestJson('/api/reviews'),
//     create: async (payload) => request('/api/reviews', { method: 'POST', body: JSON.stringify(payload) }),
//   },

//   blog: {
//     list: async (params = {}) => {
//       const search = new URLSearchParams();
//       Object.entries(params).forEach(([key, value]) => {
//         if (value !== undefined && value !== null && value !== '') search.set(key, value);
//       });
//       return requestJson(`/api/blog/posts${search.toString() ? `?${search.toString()}` : ''}`);
//     },
//     getBySlug: async (slug) => requestJson(`/api/blog/posts/${encodeURIComponent(slug)}`),
//   },

//   auth: {
//     logout: async () => request('/api/auth/logout', { method: 'POST' }).catch(() => {}),
//     redirectToLogin: (returnTo) => { window.location.href = `/login?returnTo=${encodeURIComponent(returnTo || '/')}`; },

//    loginViaEmailPassword: async (email, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
//     register: async (payload) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
//     requestPasswordReset: async (email) => request('/api/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) }),
//     resetPassword: async (resetToken, newPassword) => request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ resetToken, newPassword }) }),
//     loginWithProvider: (provider, redirect) => {
//       window.location.href = `/api/auth/provider/${provider}?redirect=${encodeURIComponent(redirect || '/')}`;
//     },

//     me: async () => {
//       try {
//         return await request('/api/auth/me');
//       } catch (error) {
//          if (error?.status !== 401) throw error;
//         await request('/api/auth/refresh', { method: 'POST' });

//         return request('/api/auth/me');
//       }
//     }
//   },

//   entities: {
//     Consultation: {
//       create: async (payload) => request('/api/entities/Consultation', { method: 'POST', body: JSON.stringify(payload) }),
//       list: async () => requestJson('/api/entities/Consultation'),
//       get: async (id) => requestJson(`/api/entities/Consultation/${id}`),
//       update: async (id, payload) => request(`/api/entities/Consultation/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
//       availableSlots: async ({ date, duration = 15 }) => request(`/api/entities/Consultation/available-slots?date=${encodeURIComponent(date)}&duration=${encodeURIComponent(duration)}`),
//     },

//     Service: {
//       list: async () => request('/api/entities/Service'),
//       get: async (id) => request(`/api/entities/Service/${id}`)
//     }
//   },og: {
//    list: async () => requestJson('/api/entities/Service'),
//       get: async (id) => requestJson(`/api/entities/Service/${id}`)
//     }
//   },

//   admin: {
//     blog: {
//       list: async () => requestJson('/api/admin/blog/posts'),
//       create: async (payload) => request('/api/admin/blog/posts', { method: 'POST', body: JSON.stringify(payload) }),
//       update: async (id, payload) => request(`/api/admin/blog/posts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
//       remove: async (id) => request(`/api/admin/blog/posts/${id}`, { method: 'DELETE' }),
//     },
//     workers: {
//       list: async () => requestJson('/api/admin/workers'),
//       create: async (payload) => request('/api/admin/workers', { method: 'POST', body: JSON.stringify(payload) }),
//       invite: async (payload) => request('/api/admin/workers/invite', { method: 'POST', body: JSON.stringify(payload) }),
//     },
//     consultations: {
//       list: async (params = {}) => {
//         const search = new URLSearchParams();
//         Object.entries(params).forEach(([key, value]) => {alue !== null && value !== '') search.set(key, value);
//         });
//         return requestJson(`/api/admin/consultations${search.toString() ? `?${search.toString()}` : ''}`);
//       },
//       update: async (id, payload) => request(`/api/entities/Consultation/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
//     },
//     paet: async () => requestJson('/api/admin/payments'),
//       analytics: async () => requestJson('/api/admin/payments/analytics'),
//       markPaid: async (consultationId) => request(`/api/admin/payments/${consultationId}/mark-paid`, { method: 'POST' }),
//       invoiceUrl: (consultationId) => `${API_URL}/api/admin/payments/${consultationId}/invoice.pdf`,
//       receiptUrl: (consultationId) => `${API_URL}/api/admin/payments/${consultationId}/receipt.pdf`,
//       contractUrl: (consultationId) => `${API_URL}/api/admin/payments/${consultationId}/contract.pdf`,
//     },
//     pipeline: {
//       getPreferences: async () => requestJson('/api/admin/pipeline/preferences'),
//       savePreferences: async (order) => request('/api/admin/pipeline/preferences', { method: 'PUT', body: JSON.stringify({ order }) }),
//     },
//     tasks: {
//       list: asyau&l
//       create: async (payload) => request('/api/admin/tasks', { method: 'POST', body: JSON.stringify(payload) }),
//       update: async (id, payload) => request(`/api/admin/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
//     },
//     stats: async () => requestJson('/api/admin/stats'),
// exportt>'pi/admin/audit-logs'),
//     reviews: {
//       list: async () => requestJson('/api/admin/reviews'),
//       patch: async (id, payload) => request(`/api/admin/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
//       remove: async (id) => request(`/api/admin/reviews/${id}`, { method: 'DELETE' }),
//     },
//     documents: {
//       list: async (params = {}) => {
//         const search = new URLSearchParams();
//         Object.entries(params).forEach(([key, value]) => {
//           if (value !== undefined && value !== null && value !== '') search.set(key, value);
//         });
//         return requestJson(`/api/admin/documents${search.toString() ? `?${search.toString()}` : ''}`);
//       },
//       create: async (payload) => request('/api/admin/documents', { method: 'POST', body: JSON.stringify(payload) }),
//       update: async (id, payload) => request(`/api/admin/documents/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
//       versions: async (id) => requestJson(`/api/admin/documents/${id}/versions`),
//       downloadUrl: (id) => `${API_URL}/api/admin/documents/${id}/download`,
//     },
//     inbox: {
//       list: async (params = {}) => {
//         const search = new URLSearchParams();
//         Object.entries(params).forEach(([key, value]) => {
//           if (value !== undefined && value !== null && value !== '') search.set(key, value);
//         });
//         return requestJson(`/api/admin/inbox${search.toString() ? `?${search.toString()}` : ''}`);
//       },
//       send: async (payload) => request('/api/admin/inbox/send', { method: 'POST', body: JSON.stringify(payload) }),
//     },
//     automations: {
//       templates: async () => requestJson('/api/admin/automations/templates'),
//       run: async (payload) => request('/api/admin/automations/run', { method: 'POST', body: JSON.stringify(payload) }),
//     },
//     calendar: {
//       createRecurring: async (payload) => request('/api/admin/calendar/recurring', { method: 'POST', body: JSON.stringify(payload) }),
//       recurringSeries: async (seriesId) => requestJson(`/api/admin/calendar/recurring/${seriesId}`),
//       addRecurringException: async (payload) => request('/api/admin/calendar/recurring/exception', { method: 'POST', body: JSON.stringify(payload) }),
//       syncProviders: async () => requestJson('/api/admin/calendar/sync/providers'),
//       googleConnectUrl: async () => requestJson('/api/admin/calendar/sync/google/connect-url'),
//       pushToProvider: async (payload) => request('/api/admin/calendar/sync/push', { method: 'POST', body: JSON.stringify(payload) }),
//     },
//     ai: {
//       scenarios: async () => requestJson('/api/admin/ai/scenarios'),
//       run: async (payload) => request('/api/admin/ai/run', { method: 'POST', body: JSON.stringify(payload) }),
//     },
//   }
// };
// Lightweight backend client for the app's own backend.
// Replaces references to the external Base44 SDK.

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_URL}${path}`;
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });

  return search.toString();
}

function createRequestError(res, body) {
  const message =
    body?.message ||
    body?.error ||
    `Request failed with status ${res.status}`;

  const error = new Error(message);

  error.status = res.status;
  error.body = body;

  return error;
}

async function parseResponseBody(res) {
  if (res.status === 204) {
    return null;
  }

  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await res.text();
    return text || null;
  } catch {
    return null;
  }
}

async function request(path, opts = {}) {
  const headers = new Headers(opts.headers || {});

  // Add JSON content type only when a body exists
  // and the body is not FormData.
  if (
    opts.body !== undefined &&
    opts.body !== null &&
    !(opts.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(buildUrl(path), {
    ...opts,
    headers,
    credentials: 'include',
  });

  const body = await parseResponseBody(res);

  if (!res.ok) {
    throw createRequestError(res, body);
  }

  return body;
}

async function requestJson(path, opts = {}) {
  return request(path, opts);
}

async function requestBlob(path, opts = {}) {
  const headers = new Headers(opts.headers || {});

  const res = await fetch(buildUrl(path), {
    ...opts,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let body = null;

    try {
      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        body = await res.json();
      } else {
        body = await res.text();
      }
    } catch {
      body = 'Could not read error response body';
    }

    throw createRequestError(res, body);
  }

  return res.blob();
}

export const apiClient = {
  // ============================================================
  // HEALTH
  // ============================================================

  health: async () => {
    return requestJson('/api/health');
  },

  // ============================================================
  // REVIEWS
  // ============================================================

  reviews: {
    list: async () => {
      return requestJson('/api/reviews');
    },

    create: async (payload) => {
      return request('/api/reviews', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  // ============================================================
  // BLOG
  // ============================================================

  blog: {
    list: async (params = {}) => {
      const query = buildQuery(params);

      return requestJson(
        `/api/blog/posts${query ? `?${query}` : ''}`
      );
    },

    getBySlug: async (slug) => {
      return requestJson(
        `/api/blog/posts/${encodeURIComponent(slug)}`
      );
    },
  },

  support: {
    askQuestion: async (payload) => {
      return request('/api/public/questions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  // ============================================================
  // AUTHENTICATION
  // ============================================================

  auth: {
    logout: async () => {
      try {
        await request('/api/auth/logout', {
          method: 'POST',
        });
      } catch {
        // Do not break the UI when the session
        // is already expired.
      }
    },

    redirectToLogin: (returnTo = '/') => {
      window.location.href =
        `/login?returnTo=${encodeURIComponent(returnTo)}`;
    },

    loginViaEmailPassword: async (email, password) => {
      return request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
        }),
      });
    },

    register: async (payload) => {
      return request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    requestPasswordReset: async (email) => {
      return request('/api/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({
          email,
        }),
      });
    },

    resetPassword: async (resetToken, newPassword) => {
      return request('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          resetToken,
          newPassword,
        }),
      });
    },

    loginWithProvider: (provider, redirect = '/') => {
      window.location.href =
        `/api/auth/provider/${encodeURIComponent(provider)}` +
        `?redirect=${encodeURIComponent(redirect)}`;
    },

    me: async () => {
      try {
        return await requestJson('/api/auth/me');
      } catch (error) {
        if (error?.status !== 401) {
          throw error;
        }

        await request('/api/auth/refresh', {
          method: 'POST',
        });

        return requestJson('/api/auth/me');
      }
    },
  },

  // ============================================================
  // ENTITIES
  // ============================================================

  entities: {
    // ----------------------------------------------------------
    // CONSULTATIONS
    // ----------------------------------------------------------

    Consultation: {
      create: async (payload) => {
        return request('/api/entities/Consultation', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },

      list: async () => {
        return requestJson('/api/entities/Consultation');
      },

      get: async (id) => {
        return requestJson(
          `/api/entities/Consultation/${encodeURIComponent(id)}`
        );
      },

      update: async (id, payload) => {
        return request(
          `/api/entities/Consultation/${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }
        );
      },

      availableSlots: async ({ date, duration = 15 }) => {
        return requestJson(
          `/api/entities/Consultation/available-slots` +
            `?date=${encodeURIComponent(date)}` +
            `&duration=${encodeURIComponent(duration)}`
        );
      },
    },

    // ----------------------------------------------------------
    // SERVICES
    // ----------------------------------------------------------

    Service: {
      list: async () => {
        return requestJson('/api/entities/Service');
      },

      get: async (id) => {
        return requestJson(
          `/api/entities/Service/${encodeURIComponent(id)}`
        );
      },
    },
  },

  // ============================================================
  // ADMIN
  // ============================================================

  admin: {
    // ----------------------------------------------------------
    // BLOG
    // ----------------------------------------------------------

    blog: {
      list: async () => {
        return requestJson('/api/admin/blog/posts');
      },

      create: async (payload) => {
        return request('/api/admin/blog/posts', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },

      update: async (id, payload) => {
        return request(
          `/api/admin/blog/posts/${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }
        );
      },

      remove: async (id) => {
        return request(
          `/api/admin/blog/posts/${encodeURIComponent(id)}`,
          {
            method: 'DELETE',
          }
        );
      },
    },

    // ----------------------------------------------------------
    // WORKERS
    // ----------------------------------------------------------

    workers: {
      list: async () => {
        return requestJson('/api/admin/workers');
      },

      create: async (payload) => {
        return request('/api/admin/workers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },

      invite: async (payload) => {
        return request('/api/admin/workers/invite', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
    },

    // ----------------------------------------------------------
    // CONSULTATIONS
    // ----------------------------------------------------------

    consultations: {
      list: async (params = {}) => {
        const query = buildQuery(params);

        return requestJson(
          `/api/admin/consultations${query ? `?${query}` : ''}`
        );
      },

      update: async (id, payload) => {
        return request(
          `/api/entities/Consultation/${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }
        );
      },
    },

    // ----------------------------------------------------------
    // PAYMENTS
    // ----------------------------------------------------------

    payments: {
      list: async () => {
        return requestJson('/api/admin/payments');
      },

      analytics: async () => {
        return requestJson('/api/admin/payments/analytics');
      },

      markPaid: async (consultationId) => {
        return request(
          `/api/admin/payments/${encodeURIComponent(
            consultationId
          )}/mark-paid`,
          {
            method: 'POST',
          }
        );
      },

      invoiceUrl: (consultationId) => {
        return buildUrl(
          `/api/admin/payments/${encodeURIComponent(
            consultationId
          )}/invoice.pdf`
        );
      },

      receiptUrl: (consultationId) => {
        return buildUrl(
          `/api/admin/payments/${encodeURIComponent(
            consultationId
          )}/receipt.pdf`
        );
      },

      contractUrl: (consultationId) => {
        return buildUrl(
          `/api/admin/payments/${encodeURIComponent(
            consultationId
          )}/contract.pdf`
        );
      },

      sendDocument: async (consultationId, payload) => {
        return request(
          `/api/admin/payments/${encodeURIComponent(
            consultationId
          )}/send-document`,
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );
      },
    },

    // ----------------------------------------------------------
    // PIPELINE
    // ----------------------------------------------------------

    pipeline: {
      getPreferences: async () => {
        return requestJson('/api/admin/pipeline/preferences');
      },

      savePreferences: async (order) => {
        return request('/api/admin/pipeline/preferences', {
          method: 'PUT',
          body: JSON.stringify({
            order,
          }),
        });
      },
    },

    // ----------------------------------------------------------
    // TASKS
    // ----------------------------------------------------------

    tasks: {
      list: async (params = {}) => {
        const query = buildQuery(params);

        return requestJson(
          `/api/admin/tasks${query ? `?${query}` : ''}`
        );
      },

      create: async (payload) => {
        return request('/api/admin/tasks', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },

      update: async (id, payload) => {
        return request(
          `/api/admin/tasks/${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }
        );
      },
    },

    // ----------------------------------------------------------
    // STATS
    // ----------------------------------------------------------

    stats: async () => {
      return requestJson('/api/admin/stats');
    },

    // ----------------------------------------------------------
    // AUDIT LOGS
    // ----------------------------------------------------------

    auditLogs: async (params = {}) => {
      const query = buildQuery(params);

      return requestJson(
        `/api/admin/audit-logs${query ? `?${query}` : ''}`
      );
    },

    // ----------------------------------------------------------
    // REVIEWS
    // ----------------------------------------------------------

    reviews: {
      list: async () => {
        return requestJson('/api/admin/reviews');
      },

      patch: async (id, payload) => {
        return request(
          `/api/admin/reviews/${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }
        );
      },

      remove: async (id) => {
        return request(
          `/api/admin/reviews/${encodeURIComponent(id)}`,
          {
            method: 'DELETE',
          }
        );
      },
    },

    // ----------------------------------------------------------
    // DOCUMENTS
    // ----------------------------------------------------------

    documents: {
      list: async (params = {}) => {
        const query = buildQuery(params);

        return requestJson(
          `/api/admin/documents${query ? `?${query}` : ''}`
        );
      },

      create: async (payload) => {
        return request('/api/admin/documents', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },

      update: async (id, payload) => {
        return request(
          `/api/admin/documents/${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }
        );
      },

      versions: async (id) => {
        return requestJson(
          `/api/admin/documents/${encodeURIComponent(id)}/versions`
        );
      },

      downloadUrl: (id) => {
        return buildUrl(
          `/api/admin/documents/${encodeURIComponent(id)}/download`
        );
      },
    },

    // ----------------------------------------------------------
    // INBOX
    // ----------------------------------------------------------

    inbox: {
      list: async (params = {}) => {
        const query = buildQuery(params);

        return requestJson(
          `/api/admin/inbox${query ? `?${query}` : ''}`
        );
      },

      send: async (payload) => {
        return request('/api/admin/inbox/send', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
    },

    // ----------------------------------------------------------
    // AUTOMATIONS
    // ----------------------------------------------------------

    automations: {
      templates: async () => {
        return requestJson('/api/admin/automations/templates');
      },

      run: async (payload) => {
        return request('/api/admin/automations/run', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
    },

    // ----------------------------------------------------------
    // CALENDAR
    // ----------------------------------------------------------

    calendar: {
      createRecurring: async (payload) => {
        return request('/api/admin/calendar/recurring', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },

      recurringSeries: async (seriesId) => {
        return requestJson(
          `/api/admin/calendar/recurring/${encodeURIComponent(
            seriesId
          )}`
        );
      },

      addRecurringException: async (payload) => {
        return request(
          '/api/admin/calendar/recurring/exception',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );
      },

      syncProviders: async () => {
        return requestJson(
          '/api/admin/calendar/sync/providers'
        );
      },

      googleConnectUrl: async () => {
        return requestJson(
          '/api/admin/calendar/sync/google/connect-url'
        );
      },

      pushToProvider: async (payload) => {
        return request('/api/admin/calendar/sync/push', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
    },

    // ----------------------------------------------------------
    // AI
    // ----------------------------------------------------------

    ai: {
      scenarios: async () => {
        return requestJson('/api/admin/ai/scenarios');
      },

      run: async (payload) => {
        return request('/api/admin/ai/run', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
    },
  },
};