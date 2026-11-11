function isDemoModeEnabled(environment = process.env) {
  const nodeEnvironment = String(environment.NODE_ENV || '').trim().toLowerCase();
  const databaseName = String(environment.DB_NAME || 'smart_logistics_v2');
  const isProductionDatabase = /(^|[_-])prod(uction)?([_-]|$)/i.test(databaseName);

  return ['development', 'demo'].includes(nodeEnvironment)
    && environment.DEMO_MODE === 'true'
    && !isProductionDatabase;
}

module.exports = { isDemoModeEnabled };
