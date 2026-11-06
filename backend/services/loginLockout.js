const crypto = require('crypto');

const DEFAULT_LOGIN_LOCKOUT = Object.freeze({
  maxFailedAttempts: 5,
  windowMinutes: 15
});

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseLoginLockoutSettings(rows = []) {
  const values = new Map(rows.map(({ setting_key, setting_value }) => [setting_key, setting_value]));
  const maxFailedAttempts = Math.min(
    positiveInteger(values.get('LOGIN_MAX_FAILED_ATTEMPTS'), DEFAULT_LOGIN_LOCKOUT.maxFailedAttempts),
    100
  );
  const windowMinutes = Math.min(
    positiveInteger(values.get('LOGIN_LOCKOUT_WINDOW_MINUTES'), DEFAULT_LOGIN_LOCKOUT.windowMinutes),
    1440
  );
  return {
    maxFailedAttempts,
    windowMinutes,
    windowMs: windowMinutes * 60 * 1000
  };
}

function createLoginLockout() {
  const attempts = new Map();

  function keyFor(scope, value) {
    const digest = crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
    return `${scope}:${digest}`;
  }

  function currentEntry(key, now, windowMs) {
    const current = attempts.get(key);
    if (!current || now - current.startedAt >= windowMs && now >= current.lockedUntil) {
      return { startedAt: now, count: 0, lockedUntil: 0 };
    }
    return current;
  }

  function check({ ip, identifier, now = Date.now(), windowMs }) {
    const result = { locked: false, retryAfterSeconds: 0 };
    for (const key of [keyFor('ip', ip), keyFor('account', identifier)]) {
      const entry = currentEntry(key, now, windowMs);
      if (entry.lockedUntil > now) {
        result.locked = true;
        result.retryAfterSeconds = Math.max(
          result.retryAfterSeconds,
          Math.ceil((entry.lockedUntil - now) / 1000)
        );
      }
    }
    return result;
  }

  function recordFailure({ ip, identifier, now = Date.now(), windowMs, maxFailedAttempts }) {
    const newlyLockedScopes = [];
    const retryAfterSeconds = Math.ceil(windowMs / 1000);
    for (const [scope, value] of [['ip', ip], ['account', identifier]]) {
      const key = keyFor(scope, value);
      const entry = currentEntry(key, now, windowMs);
      if (entry.lockedUntil > now) continue;
      entry.count += 1;
      if (entry.count >= maxFailedAttempts) {
        entry.lockedUntil = now + windowMs;
        newlyLockedScopes.push(scope);
      }
      attempts.set(key, entry);
    }
    return { locked: newlyLockedScopes.length > 0, newlyLockedScopes, retryAfterSeconds };
  }

  function clearAccount(identifier) {
    attempts.delete(keyFor('account', identifier));
  }

  return { check, recordFailure, clearAccount };
}

module.exports = {
  DEFAULT_LOGIN_LOCKOUT,
  createLoginLockout,
  parseLoginLockoutSettings
};
