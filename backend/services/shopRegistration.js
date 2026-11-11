function normalizeShopRegistration(input = {}) {
  const fullName = String(input.full_name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const phone = String(input.phone || '').trim();
  const password = typeof input.password === 'string' ? input.password : '';
  const shopAddress = String(input.shop_address || '').trim();

  if (!fullName || fullName.length > 255) {
    return { error: 'Vui lòng nhập tên Shop hoặc người đại diện hợp lệ.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    return { error: 'Địa chỉ email không hợp lệ.' };
  }
  if (!/^[+\d][\d\s().-]{7,18}$/.test(phone)) {
    return { error: 'Vui lòng nhập số điện thoại hợp lệ.' };
  }
  if (password.length < 8 || password.length > 128) {
    return { error: 'Mật khẩu cần có từ 8 đến 128 ký tự.' };
  }
  if (shopAddress.length > 1000) {
    return { error: 'Địa chỉ Shop không được vượt quá 1000 ký tự.' };
  }

  return {
    value: {
      fullName,
      email,
      phone,
      password,
      shopAddress: shopAddress || null
    }
  };
}

module.exports = { normalizeShopRegistration };
