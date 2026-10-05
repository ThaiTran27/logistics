const API_ORIGIN = new URL(import.meta.env.VITE_API_URL || 'http://localhost:5000').origin;

export function resolveApiAssetUrl(value) {
  const assetUrl = String(value || '').trim();
  if (!assetUrl) return '';
  if (/^(?:https?:|data:|blob:)/i.test(assetUrl)) return assetUrl;
  return new URL(assetUrl, API_ORIGIN).toString();
}

export function apiFetch(input, init = {}) {
  const requestUrl = new URL(input instanceof Request ? input.url : input, window.location.href);
  if (requestUrl.origin !== API_ORIGIN || !requestUrl.pathname.startsWith('/api/')) {
    return window.fetch(input, init);
  }

  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  const token = localStorage.getItem('access_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return window.fetch(input, { ...init, headers });
}
