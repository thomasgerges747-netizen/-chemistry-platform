/* عميل واجهة برمجة التطبيقات — يتعامل مع الجلسات و CSRF وحالات الخطأ */
let csrfToken = null;

export const setCsrf = (token) => {
  csrfToken = token || null;
};
export const getCsrf = () => csrfToken;

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload || null;
  }
}

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const headers = { Accept: raw ? '*/*' : 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('تعذّر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.', 0);
  }

  if (raw) {
    if (!response.ok) throw new ApiError('تعذّر تنزيل الملف', response.status);
    return response.blob();
  }

  let payload = null;
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    payload = await response.json().catch(() => null);
  }

  if (!response.ok) {
    throw new ApiError(payload?.error || 'حدث خطأ غير متوقع، حاول مرة أخرى', response.status, payload);
  }
  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  patch: (path, body) => request(path, { method: 'PATCH', body: body ?? {} }),
  del: (path) => request(path, { method: 'DELETE' }),
  blob: (path) => request(path, { raw: true }),
};

export const auth = {
  login: (identifier, password, role) => request('/auth/login', { method: 'POST', body: { identifier, password, role } }),
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  logout: () => request('/auth/logout', { method: 'POST', body: {} }),
  me: () => request('/auth/me'),
  changePassword: (current, next) => request('/auth/password', { method: 'POST', body: { current, next } }),
};
