const DDL_QUERY_PATTERN = /^\s*(?:ALTER|CREATE|DROP|RENAME|TRUNCATE)\b/i;
const TIDB_RETRY_DELAYS_MS = [100, 300, 700, 1500];

function isRetryableTiDBSchemaError(error) {
  return error?.errno === 8028
    || error?.sqlMessage?.includes('Information schema is changed during the execution');
}

function serializeDdlQueries(pool) {
  const query = pool.query.bind(pool);
  const queue = [];
  let running = false;

  function runNext() {
    if (running || queue.length === 0) return;
    running = true;
    const args = queue.shift();
    const callbackIndex = args.findLastIndex
      ? args.findLastIndex((value) => typeof value === 'function')
      : args.length - 1;
    const callback = typeof args[callbackIndex] === 'function' ? args[callbackIndex] : null;
    if (!callback) args.push(null);
    const resolvedCallbackIndex = callback ? callbackIndex : args.length - 1;
    let attempt = 0;

    const execute = () => {
      const requestArgs = [...args];
      requestArgs[resolvedCallbackIndex] = function onComplete(error, ...results) {
        if (error && isRetryableTiDBSchemaError(error) && attempt < TIDB_RETRY_DELAYS_MS.length) {
          const delay = TIDB_RETRY_DELAYS_MS[attempt];
          attempt += 1;
          setTimeout(execute, delay);
          return;
        }

        try {
          if (callback) callback.call(this, error, ...results);
          else if (error) console.error('Lệnh DDL khởi động thất bại:', error);
        } finally {
          running = false;
          runNext();
        }
      };

      try {
        query(...requestArgs);
      } catch (error) {
        requestArgs[resolvedCallbackIndex](error);
      }
    };

    execute();
  }

  pool.query = function serializedQuery(sql, ...args) {
    if (typeof sql !== 'string' || !DDL_QUERY_PATTERN.test(sql)) {
      return query(sql, ...args);
    }

    queue.push([sql, ...args]);
    runNext();
    return undefined;
  };

  return pool;
}

module.exports = { serializeDdlQueries };
