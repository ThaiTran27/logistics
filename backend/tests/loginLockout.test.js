import { describe, expect, it } from 'vitest';
import loginLockout from '../services/loginLockout.js';

const { createLoginLockout, parseLoginLockoutSettings } = loginLockout;

describe('login lockout', () => {
  it('reads bounded lockout settings and applies documented defaults', () => {
    expect(parseLoginLockoutSettings([])).toMatchObject({
      maxFailedAttempts: 5,
      windowMinutes: 15,
      windowMs: 900000
    });
    expect(parseLoginLockoutSettings([
      { setting_key: 'LOGIN_MAX_FAILED_ATTEMPTS', setting_value: '7' },
      { setting_key: 'LOGIN_LOCKOUT_WINDOW_MINUTES', setting_value: '30' }
    ])).toMatchObject({ maxFailedAttempts: 7, windowMinutes: 30, windowMs: 1800000 });
    expect(parseLoginLockoutSettings([
      { setting_key: 'LOGIN_MAX_FAILED_ATTEMPTS', setting_value: '-1' },
      { setting_key: 'LOGIN_LOCKOUT_WINDOW_MINUTES', setting_value: '2000' }
    ])).toMatchObject({ maxFailedAttempts: 5, windowMinutes: 1440 });
  });

  it('locks both IP and normalized account after the configured number of failed logins', () => {
    const lockout = createLoginLockout();
    const params = { ip: '127.0.0.1', identifier: ' Shop@Example.vn ', windowMs: 900000, maxFailedAttempts: 5 };
    for (let attempt = 1; attempt < 5; attempt += 1) {
      expect(lockout.recordFailure({ ...params, now: attempt }).locked).toBe(false);
    }
    expect(lockout.recordFailure({ ...params, now: 5 })).toMatchObject({
      locked: true,
      newlyLockedScopes: ['ip', 'account'],
      retryAfterSeconds: 900
    });
    expect(lockout.check({ ...params, identifier: 'shop@example.vn', now: 6 }))
      .toMatchObject({ locked: true, retryAfterSeconds: 900 });
  });

  it('expires lockouts and can clear the account counter after successful authentication', () => {
    const lockout = createLoginLockout();
    const params = { ip: '127.0.0.1', identifier: 'shop@example.vn', windowMs: 1000, maxFailedAttempts: 1 };
    lockout.recordFailure({ ...params, now: 10 });
    expect(lockout.check({ ...params, now: 500 }).locked).toBe(true);
    expect(lockout.check({ ...params, now: 1010 }).locked).toBe(false);

    lockout.recordFailure({ ...params, now: 2000 });
    lockout.clearAccount(params.identifier);
    expect(lockout.check({ ...params, now: 2001 }).locked).toBe(true);
    expect(lockout.check({ ...params, ip: '127.0.0.2', identifier: params.identifier, now: 2001 }).locked).toBe(false);
  });
});
