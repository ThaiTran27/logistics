import { describe, expect, it } from 'vitest';
import registration from '../services/shopRegistration.js';

const { normalizeShopRegistration } = registration;

describe('Shop account registration input', () => {
  it('normalizes valid account details and only accepts the Shop identity fields', () => {
    expect(normalizeShopRegistration({
      full_name: '  Cửa hàng An Bình ',
      email: ' SHOP@EXAMPLE.COM ',
      phone: '090 123 4567',
      password: 'secure-pass-123',
      shop_address: '  12 Nguyễn Văn Nghi ',
      role: 'director'
    })).toEqual({
      value: {
        fullName: 'Cửa hàng An Bình',
        email: 'shop@example.com',
        phone: '090 123 4567',
        password: 'secure-pass-123',
        shopAddress: '12 Nguyễn Văn Nghi'
      }
    });
  });

  it.each([
    [{ full_name: '', email: 'shop@example.com', phone: '0901234567', password: 'secure-pass' }, 'tên Shop'],
    [{ full_name: 'Shop', email: 'bad-email', phone: '0901234567', password: 'secure-pass' }, 'email'],
    [{ full_name: 'Shop', email: 'shop@example.com', phone: '123', password: 'secure-pass' }, 'số điện thoại'],
    [{ full_name: 'Shop', email: 'shop@example.com', phone: '0901234567', password: 'short' }, 'Mật khẩu']
  ])('rejects invalid registration data', (input, message) => {
    expect(normalizeShopRegistration(input).error).toContain(message);
  });
});
