import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const backendDirectory = fileURLToPath(new URL('..', import.meta.url));

describe('server startup configuration', () => {
  it('stops with a clear error when JWT_SECRET is missing', () => {
    const result = spawnSync(
      process.execPath,
      ['-e', "process.env.JWT_SECRET = ''; require('./server.js')"],
      { cwd: backendDirectory, encoding: 'utf8' }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Thiếu JWT_SECRET');
    expect(result.stdout).not.toContain('Backend Server');
  }, 30000);
});
