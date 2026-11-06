import { describe, expect, it } from 'vitest';
import migrationRunner from '../migrations/run.js';

const { readMigrationSections } = migrationRunner;

describe('migration SQL parsing', () => {
  it('ignores line comments containing semicolons', () => {
    const migration = readMigrationSections(
      new URL('../migrations/007_payroll_period_finalization.sql', import.meta.url)
    );

    expect(migration.up.some((statement) => statement.includes('INSERT INTO payroll_bonus_rules')))
      .toBe(true);
    expect(migration.up.some((statement) => statement.includes('review and replace')))
      .toBe(false);
  });

  it('provides reversible route optimization schema changes', () => {
    const migration = readMigrationSections(
      new URL('../migrations/011_driver_route_optimization.sql', import.meta.url)
    );

    expect(migration.up.join('\n')).toContain('ADD COLUMN stop_sequence');
    expect(migration.up.join('\n')).toContain('CREATE TABLE driver_route_optimization_history');
    expect(migration.down.join('\n')).toContain('DROP TABLE driver_route_optimization_history');
    expect(migration.down.join('\n')).toContain('DROP COLUMN stop_sequence');
  });

  it('provides reversible pickup ranking settings and persisted explanations', () => {
    const migration = readMigrationSections(
      new URL('../migrations/012_pickup_route_ranking.sql', import.meta.url)
    );

    expect(migration.up.join('\n')).toContain('ADD COLUMN ranking_reason');
    expect(migration.up.join('\n')).toContain('ADD COLUMN pickup_deadline_at');
    expect(migration.up.join('\n')).toContain('PICKUP_FIFO_BUCKET_MINUTES');
    expect(migration.down.join('\n')).toContain('DROP COLUMN ranking_reason');
    expect(migration.down.join('\n')).toContain('DROP COLUMN pickup_deadline_at');
  });

  it('provides a reversible image URL field for chat messages', () => {
    const migration = readMigrationSections(
      new URL('../migrations/013_chat_image_messages.sql', import.meta.url)
    );

    expect(migration.up.join('\n')).toContain('ADD COLUMN image_url');
    expect(migration.down.join('\n')).toContain('DROP COLUMN image_url');
  });
});
