const ORDER_TABLE_ALIASES = new Set(['o']);

function shopOrderScope(shopId, alias = 'o') {
  const normalizedShopId = Number(shopId);
  if (!Number.isSafeInteger(normalizedShopId) || normalizedShopId <= 0) {
    throw new RangeError('An authenticated Shop ID is required.');
  }
  if (!ORDER_TABLE_ALIASES.has(alias)) {
    throw new RangeError('Unsupported orders table alias.');
  }
  return {
    predicate: `${alias}.shop_id = ?`,
    params: [normalizedShopId]
  };
}

module.exports = { shopOrderScope };
