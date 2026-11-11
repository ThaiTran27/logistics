export const ORDER_WAIT_SLA_MS = 24 * 60 * 60 * 1000;

export const ORDER_STATUSES = Object.freeze({
  pending: {
    label: 'Chờ điều phối lấy',
    color: 'bg-amber-50 text-amber-700 border-amber-200/70',
    dot: 'bg-amber-500'
  },
  picking: {
    label: 'Đang lấy hàng',
    color: 'bg-blue-50 text-blue-700 border-blue-200/70',
    dot: 'bg-blue-500',
    pulse: true
  },
  pickup_failed: {
    label: 'Lấy hàng thất bại',
    color: 'bg-rose-50 text-rose-700 border-rose-200/70',
    dot: 'bg-rose-500'
  },
  picked_up: {
    label: 'Chờ kho tổng nhận',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200/70',
    dot: 'bg-cyan-500'
  },
  at_origin_warehouse: {
    label: 'Đã nhập kho nguồn (luồng cũ)',
    color: 'bg-slate-50 text-slate-700 border-slate-200/70',
    dot: 'bg-slate-400'
  },
  transferring_to_central: {
    label: 'Đang về kho tổng (luồng cũ)',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
    dot: 'bg-indigo-500',
    pulse: true
  },
  at_central_warehouse: {
    label: 'Tại kho tổng · chờ phân giao',
    color: 'bg-violet-50 text-violet-700 border-violet-200/70',
    dot: 'bg-violet-500'
  },
  transferring_to_destination: {
    label: 'Đang tới kho đích (luồng cũ)',
    color: 'bg-slate-50 text-slate-700 border-slate-200/70',
    dot: 'bg-slate-400'
  },
  at_destination_warehouse: {
    label: 'Đã tới kho đích (luồng cũ)',
    color: 'bg-slate-50 text-slate-700 border-slate-200/70',
    dot: 'bg-slate-400'
  },
  delivering: {
    label: 'Đang giao hàng',
    color: 'bg-sky-50 text-sky-700 border-sky-200/70',
    dot: 'bg-sky-500',
    pulse: true
  },
  delivery_failed: {
    label: 'Giao hàng thất bại',
    color: 'bg-rose-50 text-rose-700 border-rose-200/70',
    dot: 'bg-rose-500'
  },
  return_pending: {
    label: 'Chờ phân công hoàn',
    color: 'bg-orange-50 text-orange-700 border-orange-200/70',
    dot: 'bg-orange-500'
  },
  returning: {
    label: 'Đang hoàn về kho tổng',
    color: 'bg-orange-50 text-orange-700 border-orange-200/70',
    dot: 'bg-orange-500',
    pulse: true
  },
  returned: {
    label: 'Đã hoàn về kho tổng',
    color: 'bg-slate-100 text-slate-800 border-slate-300',
    dot: 'bg-slate-500'
  },
  completed: {
    label: 'Giao thành công',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
    dot: 'bg-emerald-500'
  },
  cancelled: {
    label: 'Đã hủy',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    dot: 'bg-gray-400'
  },
  in_warehouse: {
    label: 'Đã nhập kho',
    color: 'bg-purple-50 text-purple-700 border-purple-200/70',
    dot: 'bg-purple-500'
  }
});

export function getOrderStatusLabel(status) {
  return ORDER_STATUSES[status]?.label || 'Trạng thái chưa xác định';
}

export function isOrderWaitOverdue(order, now = Date.now()) {
  const timestamp = Date.parse(order?.updated_at || order?.created_at || '');
  return Number.isFinite(timestamp) && now - timestamp >= ORDER_WAIT_SLA_MS;
}

export function OrderStatusBadge({ status, className = '', showDot = true }) {
  const definition = ORDER_STATUSES[status] || {
    label: getOrderStatusLabel(status),
    color: 'bg-gray-50 text-gray-700 border-gray-200',
    dot: 'bg-gray-400'
  };

  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold tracking-tight shadow-soft-sm ${definition.color} ${className}`}>
      {showDot && (
        <span className="relative flex h-2 w-2">
          {definition.pulse && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${definition.dot}`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${definition.dot}`} />
        </span>
      )}
      <span>{definition.label}</span>
    </span>
  );
}
