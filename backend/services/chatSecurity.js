'use strict';

const crypto = require('crypto');

function hashChatToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function createGuestChatToken(byteLength = 32) {
  if (!Number.isSafeInteger(byteLength) || byteLength < 32) {
    throw new RangeError('Guest chat tokens must contain at least 32 random bytes.');
  }
  return crypto.randomBytes(byteLength).toString('hex');
}

function isMatchingChatToken(token, tokenHash, expiresAt, now = Date.now()) {
  if (!token || !tokenHash || !expiresAt) return false;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) return false;
  const suppliedHash = Buffer.from(hashChatToken(token), 'hex');
  const storedHash = Buffer.from(String(tokenHash), 'hex');
  return suppliedHash.length === storedHash.length
    && crypto.timingSafeEqual(suppliedHash, storedHash);
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length <= 6) return digits ? '***' : null;
  return `${digits.slice(0, 3)}${'*'.repeat(Math.max(3, digits.length - 6))}${digits.slice(-3)}`;
}

function maskName(name) {
  const value = String(name || '').trim();
  if (!value) return null;
  return `${Array.from(value)[0]}***`;
}

function redactPublicTrackingOrder(order) {
  const safeOrder = { ...order };
  safeOrder.receiver_name = maskName(safeOrder.receiver_name);
  safeOrder.receiver_phone = maskPhone(safeOrder.receiver_phone);
  delete safeOrder.receiver_address;
  delete safeOrder.receiver_lat;
  delete safeOrder.receiver_lng;
  delete safeOrder.shop_address;
  delete safeOrder.shop_lat;
  delete safeOrder.shop_lng;
  delete safeOrder.customer_email;
  delete safeOrder.proof_image;
  if (!/^[A-Z0-9_]{1,50}$/.test(String(safeOrder.fail_reason || ''))) {
    delete safeOrder.fail_reason;
  }
  return safeOrder;
}

function createRateLimiter({ windowMs = 15 * 60 * 1000 } = {}) {
  if (!Number.isSafeInteger(windowMs) || windowMs <= 0) {
    throw new RangeError('Rate limit window must be a positive integer in milliseconds.');
  }
  const buckets = new Map();

  function consume({ scope, ip, resource = '', ipLimit, resourceLimit, now = Date.now() }) {
    const checks = [];
    if (ip && ipLimit) checks.push({ key: `${scope}:ip:${ip}`, limit: ipLimit });
    if (resource && resourceLimit) {
      const resourceHash = crypto.createHash('sha256').update(String(resource).toUpperCase()).digest('hex');
      checks.push({ key: `${scope}:resource:${resourceHash}`, limit: resourceLimit });
    }

    const active = checks.map(({ key, limit }) => {
      const current = buckets.get(key);
      const bucket = current && now - current.startedAt < windowMs
        ? current : { startedAt: now, count: 0 };
      return { key, limit, bucket };
    });
    const exceeded = active.find(({ limit, bucket }) => bucket.count >= limit);
    if (exceeded) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - exceeded.bucket.startedAt)) / 1000))
      };
    }
    for (const { key, bucket } of active) {
      bucket.count += 1;
      buckets.set(key, bucket);
    }
    if (buckets.size > 10000) {
      for (const [key, bucket] of buckets) {
        if (now - bucket.startedAt >= windowMs) buckets.delete(key);
      }
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { consume };
}

function createRateLimitMiddleware({
  limiter, scope, ipLimit, resourceLimit, getResource
}) {
  return (req, res, next) => {
    const result = limiter.consume({
      scope,
      ip: req.ip || req.socket?.remoteAddress,
      resource: getResource(req),
      ipLimit,
      resourceLimit
    });
    if (!result.allowed) {
      res.set('Retry-After', String(result.retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
        retry_after_seconds: result.retryAfterSeconds
      });
    }
    next();
  };
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function chatTokenTtlHours(value = process.env.CHAT_SESSION_TOKEN_TTL_HOURS) {
  const hours = positiveInteger(value, 24);
  return Math.min(hours, 168);
}

module.exports = {
  chatTokenTtlHours,
  createGuestChatToken,
  createRateLimiter,
  createRateLimitMiddleware,
  hashChatToken,
  isMatchingChatToken,
  maskName,
  maskPhone,
  positiveInteger,
  redactPublicTrackingOrder
};
