'use strict';

const { query } = require('../utils/db');
const { hashChatToken, isMatchingChatToken } = require('./chatSecurity');

async function openOrderChatSession(conn, {
  order, customerName, customerPhone, suppliedToken, guestToken, expiresAt, ip = null
}) {
  await query(conn, 'SELECT id FROM orders WHERE id = ? FOR UPDATE', [Number(order.id)]);
  const sessions = await query(
    conn,
    `SELECT id, mode, order_id, driver_id, customer_name, customer_phone, status,
        guest_token_hash, expires_at
     FROM chat_sessions
     WHERE order_id = ? AND driver_id = ?
     ORDER BY id DESC FOR UPDATE`,
    [Number(order.id), Number(order.delivery_shipper_id)]
  );
  const existing = sessions.find((session) => session.status !== 'closed') || null;
  const previousSession = sessions[0] || null;
  if (existing && isMatchingChatToken(
    suppliedToken, existing.guest_token_hash, existing.expires_at
  )) {
    const { guest_token_hash: ignoredHash, ...session } = existing;
    return { created: false, session, guestToken: suppliedToken };
  }

  const inserted = await query(
    conn,
    `INSERT INTO chat_sessions
      (mode, order_id, driver_id, customer_name, customer_phone, guest_token_hash, status, expires_at)
     VALUES ('live', ?, ?, ?, ?, ?, 'active', ?)`,
    [Number(order.id), Number(order.delivery_shipper_id), customerName || order.receiver_name || 'Khách hàng', customerPhone,
      hashChatToken(guestToken), expiresAt]
  );
  const sessionId = Number(inserted.insertId);
  if (previousSession) {
    await query(
      conn,
      `INSERT INTO audit_logs
        (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
       VALUES (NULL, 'guest', 'chat.session.create_after_existing', 'chat_session', ?, ?, ?, ?)`,
      [sessionId, JSON.stringify({
          previous_session_id: Number(previousSession.id),
          previous_status: previousSession.status
      }), JSON.stringify({
        session_id: sessionId,
        order_id: Number(order.id),
        driver_id: Number(order.delivery_shipper_id)
      }), ip]
    );
  }
  return {
    created: true,
    guestToken,
    session: {
      id: sessionId,
      mode: 'live',
      order_id: Number(order.id),
      driver_id: Number(order.delivery_shipper_id),
      customer_name: customerName || order.receiver_name || 'Khách hàng',
      status: 'active',
      expires_at: expiresAt
    }
  };
}

module.exports = { openOrderChatSession };
