import { describe, expect, it, vi } from 'vitest';
import db from '../utils/db.js';

const { withTransaction } = db;

function createMockPool() {
  const connection = {
    beginTransaction: vi.fn((callback) => callback(null)),
    commit: vi.fn((callback) => callback(null)),
    rollback: vi.fn((callback) => callback(null)),
    release: vi.fn()
  };
  const pool = {
    getConnection: vi.fn((callback) => callback(null, connection))
  };
  return { connection, pool };
}

describe('withTransaction', () => {
  it('commits successful work and releases the connection', async () => {
    const { connection, pool } = createMockPool();
    const result = await withTransaction(pool, async (transactionConnection) => {
      expect(transactionConnection).toBe(connection);
      return 'done';
    });

    expect(result).toBe('done');
    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it('rolls back failed work, rethrows the error, and releases the connection', async () => {
    const { connection, pool } = createMockPool();
    const failure = new Error('query failed');

    await expect(withTransaction(pool, async () => {
      throw failure;
    })).rejects.toBe(failure);

    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });
});
