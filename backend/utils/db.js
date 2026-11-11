function invoke(connection, method) {
  return new Promise((resolve, reject) => {
    connection[method]((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function query(connection, sql, parameters = []) {
  return new Promise((resolve, reject) => {
    connection.query(sql, parameters, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

async function withTransaction(pool, callback) {
  if (!pool || typeof pool.getConnection !== 'function') {
    throw new TypeError('withTransaction requires a MySQL pool with getConnection().');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('withTransaction requires a callback.');
  }

  const connection = await new Promise((resolve, reject) => {
    pool.getConnection((error, acquiredConnection) => {
      if (error) reject(error);
      else resolve(acquiredConnection);
    });
  });

  let transactionStarted = false;
  try {
    await invoke(connection, 'beginTransaction');
    transactionStarted = true;
    const result = await callback(connection);
    await invoke(connection, 'commit');
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await invoke(connection, 'rollback');
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Transaction failed and rollback also failed.');
      }
    }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { query, withTransaction };
