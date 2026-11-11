import { describe, expect, it } from 'vitest';
import security from '../services/chatSecurity.js';

const {
  chatTokenTtlHours,
  createGuestChatToken,
  createRateLimiter,
  createRateLimitMiddleware,
  hashChatToken,
  isMatchingChatToken,
  redactPublicTrackingOrder
} = security;

describe('public chat security', () => {
  it('creates high-entropy guest tokens and validates them in constant time before expiry', () => {
    const token = createGuestChatToken();
    const expiresAt = new Date(Date.now() + 60_000);
    expect(Buffer.from(token, 'hex')).toHaveLength(32);
    expect(isMatchingChatToken(token, hashChatToken(token), expiresAt)).toBe(true);
    expect(isMatchingChatToken('wrong-token', hashChatToken(token), expiresAt)).toBe(false);
    expect(isMatchingChatToken(token, hashChatToken(token), new Date(Date.now() - 1))).toBe(false);
    expect(isMatchingChatToken(token, hashChatToken(token), null)).toBe(false);
    expect(chatTokenTtlHours('999')).toBe(168);
  });

  it('redacts full receiver identity and detailed pickup/delivery locations from tracking data', () => {
    const safe = redactPublicTrackingOrder({
      receiver_name: 'Nguyễn Thị Mai',
      receiver_phone: '0901234567',
      receiver_address: '123 Đường X, Phường 7, Gò Vấp',
      receiver_lat: 10.8,
      receiver_lng: 106.6,
      shop_address: '456 Đường Y, Gò Vấp',
      shop_lat: 10.81,
      shop_lng: 106.61,
      tracking_code: 'VTPTESTVN'
    });
    expect(safe).toMatchObject({
      receiver_name: 'N***',
      receiver_phone: '090****567',
      tracking_code: 'VTPTESTVN'
    });
    expect(safe).not.toHaveProperty('receiver_address');
    expect(safe).not.toHaveProperty('receiver_lat');
    expect(safe).not.toHaveProperty('receiver_lng');
    expect(safe).not.toHaveProperty('shop_address');
    expect(safe).not.toHaveProperty('shop_lat');
    expect(safe).not.toHaveProperty('shop_lng');
    expect(safe).not.toHaveProperty('proof_image');
    expect(safe).not.toHaveProperty('fail_reason');
  });

  it('limits requests by both IP and normalized order key and releases expired windows', () => {
    const limiter = createRateLimiter({ windowMs: 1000 });
    const limits = { scope: 'track', ipLimit: 3, resourceLimit: 1 };
    expect(limiter.consume({ ...limits, ip: '127.0.0.1', resource: 'order-1', now: 10 }).allowed).toBe(true);
    expect(limiter.consume({ ...limits, ip: '127.0.0.2', resource: 'ORDER-1', now: 11 }))
      .toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    expect(limiter.consume({ ...limits, ip: '127.0.0.1', resource: 'order-2', now: 1010 }).allowed).toBe(true);
  });

  it('returns HTTP 429 and Retry-After when the configured quota is exceeded', () => {
    const limiter = createRateLimiter({ windowMs: 60_000 });
    const middleware = createRateLimitMiddleware({
      limiter,
      scope: 'chat',
      ipLimit: 1,
      resourceLimit: 1,
      getResource: (request) => request.body.tracking_code
    });
    const response = {
      statusCode: 200,
      headers: {},
      body: null,
      set(name, value) { this.headers[name] = value; return this; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
    let passed = 0;
    const request = { ip: '127.0.0.1', body: { tracking_code: 'VTP1' } };
    middleware(request, response, () => { passed += 1; });
    middleware(request, response, () => { passed += 1; });
    expect(passed).toBe(1);
    expect(response.statusCode).toBe(429);
    expect(response.headers['Retry-After']).toBeDefined();
    expect(response.body.success).toBe(false);
  });
});
