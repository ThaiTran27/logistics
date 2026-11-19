import { describe, expect, it } from 'vitest';
import mysqlConfig from '../utils/mysqlConfig.js';

const { createMysqlConfig } = mysqlConfig;

describe('MySQL connection configuration', () => {
  it('uses local MySQL defaults without TLS', () => {
    expect(createMysqlConfig({})).toEqual({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'smart_logistics_v2'
    });
  });

  it('enables verified TLS and the configured port for TiDB', () => {
    expect(createMysqlConfig({
      DB_HOST: 'tidb.example.com',
      DB_PORT: '4000',
      DB_USER: 'app',
      DB_PASSWORD: 'secret',
      DB_NAME: 'smart_logistics_v2',
      DB_SSL: 'true'
    })).toEqual({
      host: 'tidb.example.com',
      port: 4000,
      user: 'app',
      password: 'secret',
      database: 'smart_logistics_v2',
      ssl: { rejectUnauthorized: true }
    });
  });

  it('rejects invalid port and TLS values', () => {
    expect(() => createMysqlConfig({ DB_PORT: 'not-a-port' }))
      .toThrow('DB_PORT phải là số nguyên từ 1 đến 65535.');
    expect(() => createMysqlConfig({ DB_SSL: 'sometimes' }))
      .toThrow('DB_SSL chỉ nhận giá trị true hoặc false.');
  });
});
