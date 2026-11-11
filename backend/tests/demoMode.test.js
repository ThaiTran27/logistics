import { describe, expect, it } from 'vitest';
import demoMode from '../services/demoMode.js';

const { isDemoModeEnabled } = demoMode;

describe('demo mode security settings', () => {
  it('enables demo mode only with explicit non-production configuration', () => {
    expect(isDemoModeEnabled({
      NODE_ENV: 'development',
      DEMO_MODE: 'true',
      DB_NAME: 'smart_logistics_v2'
    })).toBe(true);
    expect(isDemoModeEnabled({
      NODE_ENV: 'demo',
      DEMO_MODE: 'true',
      DB_NAME: 'logistics_demo'
    })).toBe(true);
  });

  it.each([
    [{ NODE_ENV: 'production', DEMO_MODE: 'true', DB_NAME: 'logistics' }],
    [{ NODE_ENV: 'development', DEMO_MODE: 'false', DB_NAME: 'logistics' }],
    [{ NODE_ENV: 'development', DEMO_MODE: 'true', DB_NAME: 'logistics_prod' }],
    [{ NODE_ENV: 'development', DEMO_MODE: 'true', DB_NAME: 'logistics-production' }]
  ])('keeps demo mode disabled for unsafe or incomplete configuration: %o', (environment) => {
    expect(isDemoModeEnabled(environment)).toBe(false);
  });
});
