export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_ORIGIN = new URL(API_URL).origin;
const NETWORK_ERROR_MESSAGE = 'Không kết nối được máy chủ, vui lòng kiểm tra mạng và thử lại';
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];
const SESSION_KEYS = [
  'access_token',
  'user_id',
  'full_name',
  'role',
  'user_role',
  'warehouse_id',
  'warehouse_type'
];

let redirectingForExpiredSession = false;
let connectionOffline = false;
let retryTimer = null;
let retryAttempt = 0;

function publishConnectionStatus(online) {
  if (connectionOffline === !online) return;
  connectionOffline = !online;
  if (online && retryTimer !== null) {
    window.clearTimeout(retryTimer);
    retryTimer = null;
    retryAttempt = 0;
  }
  window.dispatchEvent(new CustomEvent('api-connection-status', {
    detail: { online }
  }));
}

function scheduleConnectionProbe() {
  if (retryTimer !== null || !connectionOffline || !navigator.onLine) return;
  const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
  retryAttempt += 1;
  retryTimer = window.setTimeout(async () => {
    retryTimer = null;
    try {
      const response = await window.fetch(`${API_URL}/api/docs`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4000)
      });
      if (!response.ok) throw new Error(`API health probe returned ${response.status}`);
      retryAttempt = 0;
      publishConnectionStatus(true);
    } catch {
      scheduleConnectionProbe();
    }
  }, delay);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (!connectionOffline) return;
    retryAttempt = 0;
    scheduleConnectionProbe();
  });
}

function localizeResponseErrors(response) {
  const originalJson = response.json.bind(response);
  response.json = async () => {
    const body = await originalJson();
    if (response.status === 401) {
      return { ...body, message: 'Phiên đăng nhập đã hết hạn' };
    }
    if (response.status >= 500) {
      return { ...body, message: 'Hệ thống đang gặp sự cố, thử lại sau' };
    }
    return body;
  };
  return response;
}

export function resolveApiAssetUrl(value) {
  const assetUrl = String(value || '').trim();
  if (!assetUrl) return '';
  if (/^(?:https?:|data:|blob:)/i.test(assetUrl)) return assetUrl;
  return new URL(assetUrl, API_ORIGIN).toString();
}

export function apiFetch(input, init = {}) {
  const inputUrl = input instanceof Request ? input.url : input;
  const requestUrl = new URL(inputUrl, window.location.href);
  if (!requestUrl.pathname.startsWith('/api/')) {
    return window.fetch(input, init);
  }
  requestUrl.host = new URL(API_URL).host;
  requestUrl.protocol = new URL(API_URL).protocol;

  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  const token = localStorage.getItem('access_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const requestInit = { ...init, headers };
  if (input instanceof Request) {
    requestInit.method = init.method || input.method;
    requestInit.body = init.body === undefined ? input.body : init.body;
  }
  return window.fetch(requestUrl.toString(), requestInit).then((response) => {
    publishConnectionStatus(true);
    retryAttempt = 0;
    const isLoginRequest = ['/api/login', '/api/register'].includes(requestUrl.pathname);
    const hasStoredSession = Boolean(token
      || localStorage.getItem('role')
      || localStorage.getItem('user_role'));
    if (response.status === 401 && hasStoredSession && !isLoginRequest && !redirectingForExpiredSession) {
      redirectingForExpiredSession = true;
      SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
      sessionStorage.setItem('auth_expired_notice', '1');
      window.location.assign('/dang-nhap');
    }
    return localizeResponseErrors(response);
  }).catch((error) => {
    if (init.signal?.aborted || (input instanceof Request && input.signal.aborted)) throw error;
    publishConnectionStatus(false);
    scheduleConnectionProbe();
    throw new Error(NETWORK_ERROR_MESSAGE, { cause: error });
  });
}
