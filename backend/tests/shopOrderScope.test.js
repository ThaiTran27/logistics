import { describe, expect, it } from 'vitest';
import shopOrderScopeModule from '../services/shopOrderScope.js';

const { shopOrderScope } = shopOrderScopeModule;

describe('Shop order data scope', () => {
  it('builds a bound owner predicate for the authenticated Shop only', () => {
    const shopA = shopOrderScope(11);
    const shopB = shopOrderScope(12);
    expect(shopA).toEqual({ predicate: 'o.shop_id = ?', params: [11] });
    expect(shopB).toEqual({ predicate: 'o.shop_id = ?', params: [12] });
    expect(shopA.params).not.toEqual(shopB.params);
  });

  it('rejects invalid identities and unapproved SQL aliases', () => {
    expect(() => shopOrderScope(0)).toThrow();
    expect(() => shopOrderScope(11, 'orders; DROP TABLE users')).toThrow();
  });
});
