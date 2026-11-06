export const ORDER_WAIT_SLA_MS = 24 * 60 * 60 * 1000;

export const ORDER_STATUSES = Object.freeze({
  pending: { label: 'Chờ điều phối lấy', color: 'bg-amber-100 text-amber-800' },
  picking: { label: 'Đang lấy hàng', color: 'bg-blue-100 text-blue-800' },
  pickup_failed: { label: 'Lấy hàng thất bại', color: 'bg-red-100 text-red-800' },
  picked_up: { label: 'Chờ kho tổng nhận', color: 'bg-cyan-100 text-cyan-800' },
  at_origin_warehouse: { label: 'Đã nhập kho nguồn (luồng cũ)', color: 'bg-slate-100 text-slate-700' },
  transferring_to_central: { label: 'Đang về kho tổng (luồng cũ)', color: 'bg-slate-100 text-slate-700' },
  at_central_warehouse: { label: 'Tại kho tổng · chờ phân giao', color: 'bg-violet-100 text-violet-800' },
  transferring_to_destination: { label: 'Đang tới kho đích (luồng cũ)', color: 'bg-slate-100 text-slate-700' },
  at_destination_warehouse: { label: 'Đã tới kho đích (luồng cũ)', color: 'bg-slate-100 text-slate-700' },
  delivering: { label: 'Đang giao hàng', color: 'bg-indigo-100 text-indigo-800' },
  delivery_failed: { label: 'Giao hàng thất bại', color: 'bg-red-100 text-red-800' },
  return_pending: { label: 'Chờ phân công hoàn', color: 'bg-orange-100 text-orange-800' },
  returning: { label: 'Đang hoàn về kho tổng', color: 'bg-orange-100 text-orange-800' },
  returned: { label: 'Đã hoàn về kho tổng', color: 'bg-slate-200 text-slate-800' },
  completed: { label: 'Giao thành công', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Đã hủy', color: 'bg-gray-200 text-gray-800' },
  in_warehouse: { label: 'Đã nhập kho', color: 'bg-violet-100 text-violet-800' }
});

export function getOrderStatusLabel(status) {
  return ORDER_STATUSES[status]?.label || 'Trạng thái chưa xác định';
}

export function isOrderWaitOverdue(order, now = Date.now()) {
  const timestamp = Date.parse(order?.updated_at || order?.created_at || '');
  return Number.isFinite(timestamp) && now - timestamp >= ORDER_WAIT_SLA_MS;
}

export function OrderStatusBadge({ status, className = '' }) {
  const definition = ORDER_STATUSES[status] || {
    label: getOrderStatusLabel(status),
    color: 'bg-gray-100 text-gray-700'
  };

  return (
    <span className={`inline-flex w-fit items-center rounded-lg px-3 py-1.5 text-xs font-black ${definition.color} ${className}`}>
      {definition.label}
    </span>
  );
}
