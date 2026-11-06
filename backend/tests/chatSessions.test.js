import { describe, expect, it } from 'vitest';
import db from '../utils/db.js';
import chatSessions from '../services/chatSessions.js';
import security from '../services/chatSecurity.js';

const { withTransaction } = db;
const { openOrderChatSession } = chatSessions;
const { hashChatToken } = security;

function createPool(existingSession) {
  const state = {
    existing: existingSession ? { ...existingSession } : null,
    inserted: [],
    audits: []
  };
  const connection = {
    beginTransaction(callback) { callback(null); },
    commit(callback) { callback(null); },
    rollback(callback) { callback(null); },
    release() {},
    query(sql, values, callback) {
      const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
      if (normalized.startsWith('select id from orders')) return callback(null, [{ id: 4 }]);
      if (normalized.startsWith('select id, mode, order_id, driver_id')) {
        return callback(null, state.existing ? [{ ...state.existing }] : []);
      }
      if (normalized.startsWith('insert into chat_sessions')) {
        const session = {
          id: state.inserted.length + 20,
          mode: 'live',
          order_id: values[0],
          driver_id: values[1],
          customer_name: values[2],
          status: 'active',
          guest_token_hash: values[4],
          expires_at: values[5]
        };
        state.inserted.push(session);
        return callback(null, { insertId: session.id });
      }
      if (normalized.startsWith('insert into audit_logs')) {
        state.audits.push(values);
        return callback(null, { insertId: state.audits.length });
      }
      callback(new Error(`Unexpected SQL in test: ${normalized}`));
    }
  };
  return {
    state,
    pool: { getConnection(callback) { callback(null, connection); } }
  };
}

const order = { id: 4, tracking_code: 'VTP123VN', delivery_shipper_id: 8 };

describe('opening direct order chat sessions', () => {
  it('creates an isolated new session when tracking details are known but the existing token is absent', async () => {
    const { pool, state } = createPool({
      id: 11,
      mode: 'live',
      order_id: 4,
      driver_id: 8,
      customer_name: 'Recipient',
      customer_phone: '0901234567',
      status: 'active',
      guest_token_hash: hashChatToken('old-secret'),
      expires_at: new Date(Date.now() + 60_000)
    });
    const result = await withTransaction(pool, (conn) => openOrderChatSession(conn, {
      order,
      customerName: 'Recipient',
      customerPhone: '0901234567',
      suppliedToken: '',
      guestToken: 'new-secret',
      expiresAt: new Date(Date.now() + 86_400_000),
      ip: '127.0.0.1'
    }));

    expect(result).toMatchObject({ created: true, session: { id: 20 } });
    expect(state.existing.guest_token_hash).toBe(hashChatToken('old-secret'));
    expect(state.inserted).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0][0]).toBe(20);
    expect(state.audits[0][1]).toContain('"previous_session_id":11');
  });

  it('continues the existing session only when its current unexpired token is supplied', async () => {
    const { pool, state } = createPool({
      id: 11,
      mode: 'live',
      order_id: 4,
      driver_id: 8,
      customer_name: 'Recipient',
      customer_phone: '0901234567',
      status: 'active',
      guest_token_hash: hashChatToken('current-secret'),
      expires_at: new Date(Date.now() + 60_000)
    });
    const result = await withTransaction(pool, (conn) => openOrderChatSession(conn, {
      order,
      customerName: 'Recipient',
      customerPhone: '0901234567',
      suppliedToken: 'current-secret',
      guestToken: 'unused-new-secret',
      expiresAt: new Date(Date.now() + 86_400_000)
    }));

    expect(result).toMatchObject({ created: false, guestToken: 'current-secret', session: { id: 11 } });
    expect(state.inserted).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
  });

  it('uses the order recipient name when the customer only provides a phone number', async () => {
    const { pool, state } = createPool();
    const result = await withTransaction(pool, (conn) => openOrderChatSession(conn, {
      order: { ...order, receiver_name: 'Recipient' },
      customerName: '',
      customerPhone: '0901234567',
      suppliedToken: '',
      guestToken: 'new-secret',
      expiresAt: new Date(Date.now() + 86_400_000)
    }));

    expect(result.session.customer_name).toBe('Recipient');
    expect(state.inserted[0].customer_name).toBe('Recipient');
  });
});
