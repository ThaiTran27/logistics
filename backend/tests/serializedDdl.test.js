import { afterEach, describe, expect, it, vi } from 'vitest';
import serializedDdl from '../utils/serializedDdl.js';

const { serializeDdlQueries } = serializedDdl;

describe('serializeDdlQueries', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs DDL sequentially while allowing reads through immediately', () => {
    const pending = [];
    const query = vi.fn((sql, callback) => {
      pending.push({ sql, callback });
      return { sql };
    });
    const pool = {
      query
    };
    serializeDdlQueries(pool);
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    pool.query('ALTER TABLE orders ADD COLUMN a INT', firstCallback);
    pool.query('ALTER TABLE orders ADD COLUMN b INT', secondCallback);
    pool.query('SELECT 1', vi.fn());

    expect(query).toHaveBeenCalledTimes(2);
    expect(pending[0].sql).toBe('ALTER TABLE orders ADD COLUMN a INT');
    pending[0].callback(null, { affectedRows: 0 });
    expect(query).toHaveBeenCalledTimes(3);
    expect(pending[2].sql).toBe('ALTER TABLE orders ADD COLUMN b INT');
    pending[2].callback(null, { affectedRows: 0 });
    expect(firstCallback).toHaveBeenCalledOnce();
    expect(secondCallback).toHaveBeenCalledOnce();
  });

  it('retries TiDB schema-version conflicts before continuing the DDL queue', () => {
    vi.useFakeTimers();
    let attempts = 0;
    const pool = {
      query: vi.fn((_sql, callback) => {
        attempts += 1;
        if (attempts === 1) {
          callback({ errno: 8028, message: 'schema changed' });
        } else {
          callback(null, { affectedRows: 0 });
        }
      })
    };
    serializeDdlQueries(pool);
    const callback = vi.fn();

    pool.query('ALTER TABLE orders ADD COLUMN a INT', callback);

    expect(attempts).toBe(1);
    vi.advanceTimersByTime(100);
    expect(attempts).toBe(2);
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(null, { affectedRows: 0 });
  });
});
