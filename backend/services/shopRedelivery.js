const { query } = require('../utils/db');
const { OrderTransitionError, transitionOrder } = require('./orderStateMachine');

async function reviewShopRedeliveryRequest(conn, {
  orderId, status, reviewNote = '', actor, ip = null
}) {
  if (!Number.isSafeInteger(Number(orderId)) || Number(orderId) <= 0) {
    throw new OrderTransitionError('INVALID_ORDER_ID', 'Mã đơn hàng không hợp lệ.', 400);
  }
  if (!['approved', 'rejected'].includes(status)) {
    throw new OrderTransitionError('INVALID_REVIEW_STATUS', 'Trạng thái duyệt không hợp lệ.', 400);
  }
  if (!actor || !Number.isSafeInteger(Number(actor.id)) || Number(actor.id) <= 0
    || !['fleet_manager', 'director'].includes(String(actor.role))) {
    throw new OrderTransitionError('FORBIDDEN_TRANSITION', 'Bạn không có quyền xử lý yêu cầu giao lại.', 403);
  }
  const note = String(reviewNote || '').trim();
  if (note.length > 1000 || status === 'rejected' && note.length < 5) {
    throw new OrderTransitionError(
      'INVALID_REVIEW_NOTE',
      status === 'rejected'
        ? 'Khi từ chối cần ghi rõ lý do (5–1000 ký tự).'
        : 'Ghi chú duyệt không được vượt quá 1000 ký tự.',
      400
    );
  }

  const requests = await query(
    conn,
    `SELECT r.order_id, r.shop_id, r.status AS request_status, r.request_note,
      o.status AS order_status, o.tracking_code, o.delivery_attempts
     FROM shop_redelivery_requests r
     JOIN orders o ON o.id = r.order_id AND o.shop_id = r.shop_id
     WHERE r.order_id = ? FOR UPDATE`,
    [Number(orderId)]
  );
  if (!requests.length) {
    throw new OrderTransitionError('REDELIVERY_REQUEST_NOT_FOUND', 'Không tìm thấy yêu cầu giao lại.', 404);
  }
  const request = requests[0];
  if (request.request_status !== 'pending') {
    throw new OrderTransitionError('REDELIVERY_REQUEST_NOT_PENDING', 'Yêu cầu giao lại không còn chờ xử lý.');
  }
  if (request.order_status !== 'returning') {
    throw new OrderTransitionError(
      'ORDER_NOT_ELIGIBLE_FOR_REDELIVERY',
      `Không thể xử lý yêu cầu: đơn đang ở trạng thái "${request.order_status}", cần trạng thái "returning".`
    );
  }

  let deliveryAttempts = Number(request.delivery_attempts || 0);
  if (status === 'approved') {
    const result = await transitionOrder(conn, {
      orderId: Number(orderId),
      toStatus: 'at_central_warehouse',
      actor,
      note: `Duyệt Shop giao lại. ${note || request.request_note}`
    });
    deliveryAttempts = Number(result.order.delivery_attempts || 0);
  }

  const updateResult = await query(
    conn,
    `UPDATE shop_redelivery_requests
     SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, review_note = ?
     WHERE order_id = ? AND status = 'pending'`,
    [status, Number(actor.id), note || null, Number(orderId)]
  );
  if (!updateResult.affectedRows) {
    throw new OrderTransitionError('REDELIVERY_REQUEST_NOT_PENDING', 'Yêu cầu vừa được xử lý bởi người khác.');
  }

  const oldValue = {
    request_status: request.request_status,
    order_status: request.order_status,
    delivery_attempts: Number(request.delivery_attempts || 0)
  };
  const newValue = {
    request_status: status,
    order_status: status === 'approved' ? 'at_central_warehouse' : request.order_status,
    delivery_attempts: deliveryAttempts,
    review_note: note || null
  };
  await query(
    conn,
    `INSERT INTO audit_logs
      (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
     VALUES (?, ?, ?, 'shop_redelivery_request', ?, ?, ?, ?)`,
    [Number(actor.id), actor.role, `shop_redelivery.${status}`, String(orderId),
      JSON.stringify(oldValue), JSON.stringify(newValue), ip]
  );

  const decisionText = status === 'approved' ? 'đã được duyệt' : 'bị từ chối';
  const shopMessage = `Yêu cầu giao lại đơn ${request.tracking_code} ${decisionText}.${note ? ` Ghi chú: ${note}` : ''}`;
  await query(
    conn,
    'INSERT INTO notifications (recipient_user_id, order_id, title, message) VALUES (?, ?, ?, ?)',
    [Number(request.shop_id), Number(orderId), 'Cập nhật yêu cầu giao lại', shopMessage]
  );

  const dispatchers = await query(
    conn,
    `SELECT id FROM users
     WHERE status = 'active' AND role IN ('fleet_manager', 'director')
     ORDER BY id`
  );
  const dispatcherMessage = status === 'approved'
    ? `Đơn ${request.tracking_code} được duyệt giao lại và đang chờ phân công tại kho tổng.`
    : `Yêu cầu giao lại đơn ${request.tracking_code} đã bị từ chối.`;
  for (const dispatcher of dispatchers) {
    await query(
      conn,
      'INSERT INTO notifications (recipient_user_id, order_id, title, message) VALUES (?, ?, ?, ?)',
      [Number(dispatcher.id), Number(orderId), 'Cập nhật yêu cầu giao lại', dispatcherMessage]
    );
  }

  return {
    status,
    orderStatus: newValue.order_status,
    deliveryAttempts,
    notifications: [
      { userId: Number(request.shop_id), orderId: Number(orderId), title: 'Cập nhật yêu cầu giao lại', message: shopMessage },
      ...dispatchers.map((dispatcher) => ({
        userId: Number(dispatcher.id),
        orderId: Number(orderId),
        title: 'Cập nhật yêu cầu giao lại',
        message: dispatcherMessage
      }))
    ]
  };
}

module.exports = { reviewShopRedeliveryRequest };
