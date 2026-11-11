import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  AlertTriangle, CheckCircle, Clock, MapPin, Package, RefreshCw, Search,
  Settings2, Truck, Users, X, Zap
} from 'lucide-react';
import {
  GOVAP_MAP_CENTER, GOVAP_WARDS, MAP_ATTRIBUTION, MAP_TILE_URL, findGovapWard
} from '../../utils/govapMap.js';
import { isOrderWaitOverdue, OrderStatusBadge } from '../../utils/orderStatus.jsx';
import { apiFetch as fetch } from '../../utils/apiFetch.js';
import markerUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

const markerIcon = new L.Icon({
  iconUrl: markerUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
const routeMarkerIcon = (sequence, mode) => new L.DivIcon({
  className: 'dispatcher-route-marker',
  html: `<span style="display:grid;place-items:center;width:28px;height:28px;border:2px solid white;border-radius:50%;background:${mode === 'pickup' ? '#d97706' : '#2563eb'};color:white;font-weight:900">${sequence}</span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const normalizeArea = (value) => String(value || '')
  .toLocaleLowerCase('vi')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');
const normalizeWard = (value) => normalizeArea(value).replace(/^phuong\s+/, '');

const orderQueue = {
  pickup: {
    label: 'Chờ lấy',
    taskType: 'pickup',
    includes: (order) => order.status === 'pending' && !order.pickup_shipper_id
  },
  delivery: {
    label: 'Chờ giao',
    taskType: 'delivery',
    includes: (order) => ['at_central_warehouse', 'at_destination_warehouse'].includes(order.status)
      && !order.delivery_shipper_id
  },
  failed: {
    label: 'Thất bại',
    includes: (order) => ['pickup_failed', 'delivery_failed'].includes(order.status)
  },
  redelivery: {
    label: 'Chờ giao lại',
    taskType: 'return',
    includes: (order) => order.status === 'return_pending' && !order.return_shipper_id
  },
  sla: {
    includes: (order) => ['pending', 'picked_up', 'at_central_warehouse', 'pickup_failed', 'delivery_failed', 'return_pending'].includes(order.status)
      && (isOrderWaitOverdue(order) || (getWaitingMs(order, Date.now()) || 0) >= 20 * 60 * 60 * 1000)
  }
};

function InvalidateMapSize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const invalidate = () => window.requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    const timer = window.setTimeout(invalidate, 150);
    const observer = new ResizeObserver(invalidate);
    observer.observe(container);
    window.addEventListener('resize', invalidate);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('resize', invalidate);
    };
  }, [map]);
  return null;
}

function getOrderWard(order, taskType) {
  const isPickup = taskType !== 'delivery';
  const address = isPickup
    ? order.shop_address || order.pickup_address || order.origin_address || ''
    : order.receiver_address || order.delivery_address || '';
  const coordinates = findGovapWard(
    isPickup ? order.shop_lat : order.receiver_lat,
    isPickup ? order.shop_lng : order.receiver_lng
  );
  const wardFromAddress = GOVAP_WARDS.features.find(({ properties }) => (
    normalizeArea(address).includes(normalizeArea(properties.name))
  ));
  return wardFromAddress || coordinates || null;
}

function getWaitingMs(order, now) {
  const timestamp = Date.parse(order.updated_at || order.created_at || '');
  return Number.isFinite(timestamp) ? Math.max(0, now - timestamp) : null;
}

function formatWaiting(ms) {
  if (ms === null) return 'Chưa rõ thời gian chờ';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `Chờ ${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  return days ? `Chờ ${days} ngày ${hours % 24} giờ` : `Chờ ${hours} giờ ${minutes % 60} phút`;
}

function getPickupAddress(order) {
  const address = String(order.shop_address || order.pickup_address || order.origin_address || '').trim();
  const ward = getOrderWard(order, 'pickup')?.properties?.name;
  if (!address) return { address: 'Chưa có địa chỉ', ward, missing: true };
  const includesWard = ward && normalizeArea(address).includes(normalizeArea(ward));
  return { address: includesWard || !ward ? address : `${address}, Phường ${ward}`, ward, missing: false };
}

function getTaskForOrder(order) {
  if (order.status === 'pending' || order.status === 'pickup_failed') return 'pickup';
  if (['at_central_warehouse', 'at_destination_warehouse', 'delivery_failed'].includes(order.status)) return 'delivery';
  if (order.status === 'return_pending') return 'return';
  return null;
}

function calcDistanceKm(position, lat, lng) {
  if (!position || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  const radians = (degrees) => degrees * Math.PI / 180;
  const latDiff = radians(Number(lat) - Number(position.lat));
  const lngDiff = radians(Number(lng) - Number(position.lng));
  const a = Math.sin(latDiff / 2) ** 2
    + Math.cos(radians(Number(position.lat))) * Math.cos(radians(Number(lat)))
      * Math.sin(lngDiff / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function OrderSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-label="Đang tải hàng đợi" aria-busy="true">
      {[1, 2, 3].map((row) => (
        <div key={row} className="h-28 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

export default function DispatcherRouteBoard({
  orders = [],
  drivers = [],
  positions = {},
  loading = false,
  error = '',
  profileDrafts = {},
  savingProfileId,
  onRetry,
  onAssign,
  onSaveProfile,
  onProfileDraftChange
}) {
  const [queueTab, setQueueTab] = useState('pickup');
  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState('');
  const [slaOnly, setSlaOnly] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDriverId, setBulkDriverId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [selectedRouteDriver, setSelectedRouteDriver] = useState(null);
  const [selectedDriverRoute, setSelectedDriverRoute] = useState(null);
  const [routeActionBusy, setRouteActionBusy] = useState(false);
  const [routeActionError, setRouteActionError] = useState('');
  const [dispatcherRouteGeometry, setDispatcherRouteGeometry] = useState(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        document.getElementById('dispatcher-order-search')?.focus();
      } else if (event.key === 'Escape') {
        setSearch('');
        setSelectedIds([]);
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const driverById = useMemo(
    () => new Map(drivers.map((driver) => [String(driver.id), driver])),
    [drivers]
  );
  const waitingPickup = orders.filter(orderQueue.pickup.includes);
  const waitingDelivery = orders.filter(orderQueue.delivery.includes);
  const failedOrders = orders.filter(orderQueue.failed.includes);
  const slaOrders = orders.filter((order) => (
    ['pending', 'picked_up', 'at_central_warehouse', 'pickup_failed', 'delivery_failed', 'return_pending'].includes(order.status)
    && (getWaitingMs(order, now) || 0) >= 20 * 60 * 60 * 1000
  ));
  const onlineDrivers = drivers.filter((driver) => {
    const timestamp = Date.parse(positions[driver.id]?.timestamp || '');
    return now > 0 && Number.isFinite(timestamp) && now - timestamp < 15 * 60 * 1000;
  });
  const loadDriverRoute = async (driverId) => {
    setRouteActionBusy(true);
    setRouteActionError('');
    try {
      const response = await fetch(`/api/dispatch/route/${driverId}/today`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không tải được lộ trình tài xế.');
      setSelectedRouteDriver(String(driverId));
      setSelectedDriverRoute(result.data);
    } catch (loadError) {
      setRouteActionError(loadError.message || 'Không tải được lộ trình tài xế.');
    } finally {
      setRouteActionBusy(false);
    }
  };
  const optimizeSelectedRoute = async (driverId) => {
    setRouteActionBusy(true);
    setRouteActionError('');
    try {
      const response = await fetch(`/api/dispatch/route/optimize/${driverId}`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không tối ưu được lộ trình.');
      await loadDriverRoute(driverId);
    } catch (optimizeError) {
      setRouteActionError(optimizeError.message || 'Không tối ưu được lộ trình.');
    } finally {
      setRouteActionBusy(false);
    }
  };

  useEffect(() => {
    const routeStops = selectedDriverRoute?.stops || [];
    if (routeStops.length === 0) return undefined;
    const routeGeometryKey = `${selectedRouteDriver}:${selectedDriverRoute.mode}:${routeStops.map((stop) => stop.stop_ids?.[0]).join(',')}`;
    const finalStop = routeStops[routeStops.length - 1];
    const selectedPosition = positions[selectedRouteDriver];
    const start = selectedPosition
      && Number.isFinite(Number(selectedPosition.lat))
      && Number.isFinite(Number(selectedPosition.lng))
      ? `${selectedPosition.lat},${selectedPosition.lng}`
      : `${GOVAP_MAP_CENTER[0]},${GOVAP_MAP_CENTER[1]}`;
    const query = new URLSearchParams({
      from: start,
      to: `${finalStop.lat},${finalStop.lng}`
    });
    const waypoints = routeStops.slice(0, -1).map((stop) => `${stop.lat},${stop.lng}`).join('|');
    if (waypoints) query.set('via', waypoints);
    const controller = new AbortController();
    fetch(`/api/map/route?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Không tải được hình học tuyến.');
        setDispatcherRouteGeometry({
          key: routeGeometryKey,
          positions: result.data.geometry.coordinates.map(([lng, lat]) => [lat, lng])
        });
      })
      .catch((geometryError) => {
        if (geometryError.name !== 'AbortError') setDispatcherRouteGeometry({ key: routeGeometryKey, positions: [] });
      });
    return () => controller.abort();
  }, [selectedDriverRoute, selectedRouteDriver, positions]);

  const queueItems = useMemo(() => {
    const queue = queueTab === 'sla'
      ? orders.filter((order) => (
        ['pending', 'picked_up', 'at_central_warehouse', 'pickup_failed', 'delivery_failed', 'return_pending'].includes(order.status)
        && (getWaitingMs(order, now) || 0) >= 20 * 60 * 60 * 1000
      ))
      : orders.filter(orderQueue[queueTab].includes);
    const query = normalizeArea(search.trim());
    return queue.filter((order) => {
      const taskType = orderQueue[queueTab].taskType || getTaskForOrder(order);
      const address = taskType === 'delivery' ? order.receiver_address : (order.shop_address || order.pickup_address);
      const ward = getOrderWard(order, taskType)?.properties?.name || '';
      const matchesQuery = !query || normalizeArea([
        order.tracking_code, order.receiver_phone, address, order.shop_phone
      ].join(' ')).includes(query);
      const matchesWard = !wardFilter || ward === wardFilter;
      const matchesSla = !slaOnly || isOrderWaitOverdue(order, now)
        || ((getWaitingMs(order, now) || 0) >= 20 * 60 * 60 * 1000);
      const expectedRole = taskType === 'delivery' ? 'delivery_driver' : 'pickup_driver';
      const hasOnlineSuggestedDriver = !onlineOnly || drivers.some((driver) => {
        const timestamp = Date.parse(positions[driver.id]?.timestamp || '');
        return driver.role === expectedRole
          && now > 0
          && Number.isFinite(timestamp)
          && now - timestamp < 15 * 60 * 1000;
      });
      return matchesQuery && matchesWard && matchesSla && hasOnlineSuggestedDriver;
    });
  }, [drivers, now, onlineOnly, orders, positions, queueTab, search, slaOnly, wardFilter]);

  const suggestedDriver = (order) => {
    const taskType = orderQueue[queueTab].taskType || getTaskForOrder(order);
    if (!taskType || ['pickup_failed', 'delivery_failed'].includes(order.status)) return null;
    const taskRole = taskType === 'delivery' ? 'delivery_driver' : 'pickup_driver';
    const isPickup = taskType !== 'delivery';
    const area = normalizeArea([
      isPickup ? order.shop_address || order.pickup_address : order.receiver_address,
      isPickup ? order.shop_province : order.destination_province
    ].join(' '));
    const ward = getOrderWard(order, taskType)?.properties?.name;
    const targetLat = isPickup ? order.shop_lat : order.receiver_lat;
    const targetLng = isPickup ? order.shop_lng : order.receiver_lng;
    const weight = Number(order.weight_kg || 0);
    const itemValue = Number(order.item_value || 0);
    const amountAtRisk = Math.max(
      itemValue,
      Number(order.cod_amount || 0) + (order.fee_payer === 'receiver' ? Number(order.shipping_fee || 0) : 0)
    );
    const eligible = drivers.filter((driver) => {
      if (driver.role !== taskRole) return false;
      if (onlineOnly) {
        const positionTimestamp = Date.parse(positions[driver.id]?.timestamp || '');
        if (!now || !Number.isFinite(positionTimestamp) || now - positionTimestamp >= 15 * 60 * 1000) return false;
      }
      const load = Number(driver.active_count || 0);
      const payload = Number(driver.active_weight_kg || 0);
      if (load >= Number(driver.max_active_orders || 10) || payload + weight > Number(driver.max_payload_kg || 100)) return false;
      if (taskType === 'delivery') {
        if (Number(driver.max_order_value || 0) > 0 && itemValue > Number(driver.max_order_value)) return false;
        if (amountAtRisk > Number(driver.available_deposit || 0)) return false;
      }
      const zones = String(driver.service_areas || '').split(',').map((value) => normalizeArea(value.trim())).filter(Boolean);
      return !zones.length || zones.some((zone) => area.includes(zone) || normalizeArea(ward).includes(zone));
    });
    eligible.sort((left, right) => {
      const leftLoad = Number(left.active_count || 0) / Math.max(1, Number(left.max_active_orders || 10))
        + Number(left.active_weight_kg || 0) / Math.max(1, Number(left.max_payload_kg || 100));
      const rightLoad = Number(right.active_count || 0) / Math.max(1, Number(right.max_active_orders || 10))
        + Number(right.active_weight_kg || 0) / Math.max(1, Number(right.max_payload_kg || 100));
      const leftPosition = positions[left.id];
      const rightPosition = positions[right.id];
      const leftDistance = calcDistanceKm(leftPosition, targetLat, targetLng) ?? 1000;
      const rightDistance = calcDistanceKm(rightPosition, targetLat, targetLng) ?? 1000;
      return leftLoad + leftDistance / 100 - (rightLoad + rightDistance / 100);
    });
    const driver = eligible[0];
    return driver ? {
      driver,
      distance: calcDistanceKm(positions[driver.id], targetLat, targetLng)
    } : null;
  };

  const toggleSelected = (orderId) => {
    setSelectedIds((current) => current.includes(orderId)
      ? current.filter((id) => id !== orderId)
      : [...current, orderId]);
  };

  const assignBulk = async () => {
    const driver = driverById.get(String(bulkDriverId));
    if (!driver || !selectedIds.length || !onAssign) return;
    const taskType = orderQueue[queueTab].taskType;
    if (!window.confirm(`Phân công ${selectedIds.length} đơn cho ${driver.full_name}?`)) return;
    setBulkBusy(true);
    setBulkMessage('');
    const outcomes = [];
    for (const orderId of selectedIds) {
      const order = queueItems.find((item) => item.id === orderId);
      if (!order) continue;
      try {
        await onAssign(order, driver.id, taskType);
        outcomes.push({ orderId, success: true });
      } catch (assignError) {
        outcomes.push({ orderId, success: false, message: assignError.message });
      }
    }
    const succeeded = outcomes.filter((outcome) => outcome.success).length;
    const failed = outcomes.filter((outcome) => !outcome.success);
    setBulkMessage(`Đã phân công ${succeeded}/${outcomes.length} đơn.${failed.length ? ` Lỗi: ${failed.map((outcome) => outcome.message).filter(Boolean).join('; ')}` : ''}`);
    setSelectedIds([]);
    setBulkBusy(false);
  };

  const toggleWard = (driverId, wardName) => {
    const draft = profileDrafts[driverId] || {};
    const selected = String(draft.service_areas || '').split(',').map((value) => value.trim()).filter(Boolean);
    const exists = selected.some((value) => normalizeWard(value) === normalizeWard(wardName));
    const next = exists
      ? selected.filter((value) => normalizeWard(value) !== normalizeWard(wardName))
      : [...selected, wardName];
    onProfileDraftChange(driverId, { ...draft, service_areas: next.join(', ') });
  };

  const showQueue = (queue, options = {}) => {
    setQueueTab(queue);
    setSlaOnly(Boolean(options.sla));
    setOnlineOnly(Boolean(options.online));
    setSelectedIds([]);
  };

  const kpis = [
    { key: 'pickup', label: 'Chờ lấy tại Shop', count: waitingPickup.length, icon: Package, color: 'amber', action: () => showQueue('pickup') },
    { key: 'delivery', label: 'Chờ giao khách', count: waitingDelivery.length, icon: Truck, color: 'violet', action: () => showQueue('delivery') },
    { key: 'failed', label: 'Giao thất bại cần xử lý', count: failedOrders.length, icon: AlertTriangle, color: 'rose', action: () => showQueue('failed') },
    { key: 'sla', label: 'Quá / sắp quá SLA', count: slaOrders.length, icon: Clock, color: 'orange', action: () => showQueue('sla') },
    { key: 'online', label: 'Tài xế trực tuyến', count: onlineDrivers.length, icon: Users, color: 'emerald', action: () => showQueue(queueTab, { online: true }) }
  ];

  return (
    <section className="space-y-5" aria-label="Phân tuyến tài xế">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Điều phối vận hành</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Gợi ý phân công thông minh</h1>
          <p className="mt-1 text-sm text-slate-700">Hàng đợi và trạng thái tài xế được cập nhật theo thời gian thực.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50">
            <RefreshCw size={16} /> Làm mới
          </button>
          <button type="button" onClick={() => setDrawerOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
            <Settings2 size={16} /> Cấu hình tài xế
          </button>
        </div>
      </header>

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-5">
        {kpis.map(({ key, label, count, icon: Icon, color, action }) => {
          const colorClasses = {
            amber: 'bg-amber-50 text-amber-800',
            violet: 'bg-violet-50 text-violet-800',
            rose: 'bg-rose-50 text-rose-800',
            orange: 'bg-orange-50 text-orange-800',
            emerald: 'bg-emerald-50 text-emerald-800'
          };
          return (
          <button key={key} type="button" onClick={action} className="min-w-[210px] snap-start rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:min-w-0">
            <span className={`inline-flex rounded-xl p-2.5 ${colorClasses[color]}`}><Icon size={20} /></span>
            <span className="mt-3 block text-sm font-semibold text-slate-700">{label}</span>
            <span className="mt-1 block text-2xl font-black text-slate-900">{count}</span>
          </button>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(330px,2fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900">Hàng đợi đơn hàng</h2>
                <p className="text-sm text-slate-700">Gợi ý tài xế phù hợp trực tiếp trên từng đơn.</p>
              </div>
              <button type="button" onClick={() => setSlaOnly((value) => !value)} aria-pressed={slaOnly} className={`rounded-lg border px-3 py-2 text-sm font-bold ${slaOnly ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-slate-300 text-slate-800'}`}>
                {slaOnly ? 'Đang lọc SLA' : 'Lọc đơn sắp/quá SLA'}
              </button>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Loại hàng đợi">
              {Object.entries(orderQueue).filter(([key]) => key !== 'sla').map(([key, queue]) => {
                const count = orders.filter(queue.includes).length;
                return (
                  <button key={key} type="button" role="tab" aria-selected={queueTab === key} onClick={() => showQueue(key)} className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-bold ${queueTab === key ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-slate-700 hover:text-slate-950'}`}>
                    {queue.label} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-800">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_220px]">
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
                <input id="dispatcher-order-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mã vận đơn hoặc SĐT · phím /" className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
              </label>
              <label className="sr-only" htmlFor="dispatcher-ward-filter">Lọc theo phường</label>
              <select id="dispatcher-ward-filter" value={wardFilter} onChange={(event) => setWardFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none">
                <option value="">Tất cả phường</option>
                {GOVAP_WARDS.features.map(({ properties }) => <option key={properties.code} value={properties.name}>{properties.name}</option>)}
              </select>
            </div>
          </div>

          {['pickup', 'delivery', 'redelivery'].includes(queueTab) && selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-emerald-200 bg-emerald-50 p-3">
              <span className="mr-auto text-sm font-bold text-emerald-950">Đã chọn {selectedIds.length} đơn</span>
              <select aria-label="Chọn tài xế phân công nhiều đơn" value={bulkDriverId} onChange={(event) => setBulkDriverId(event.target.value)} className="min-w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
                <option value="">Chọn tài xế</option>
                {drivers.filter((driver) => driver.role === (orderQueue[queueTab].taskType === 'delivery' ? 'delivery_driver' : 'pickup_driver')).map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.full_name}</option>
                ))}
              </select>
              <button type="button" disabled={!bulkDriverId || bulkBusy} onClick={assignBulk} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                {bulkBusy ? 'Đang phân công…' : 'Phân công đã chọn'}
              </button>
              <button type="button" onClick={() => setSelectedIds([])} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-800">Bỏ chọn</button>
            </div>
          )}
          {bulkMessage && <p role="status" className="border-b border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800">{bulkMessage}</p>}
          {error && (
            <div role="alert" className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">
              <span>{error}</span>
              <button type="button" onClick={onRetry} className="rounded-lg border border-rose-300 bg-white px-3 py-2 font-bold text-rose-900">Thử lại</button>
            </div>
          )}
          {loading ? <OrderSkeleton /> : (
            <div className="max-h-[calc(100vh-440px)] space-y-3 overflow-y-auto p-3">
              {!queueItems.length ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center">
                  <CheckCircle className="mx-auto text-emerald-700" size={34} />
                  <p className="mt-3 text-base font-bold text-slate-800">{search || wardFilter || slaOnly ? 'Không có đơn khớp bộ lọc' : 'Không có đơn chờ gom'}</p>
                  <p className="mt-1 text-sm text-slate-700">Đơn mới sẽ xuất hiện tại đây khi được tạo.</p>
                </div>
              ) : queueItems.map((order) => {
                const taskType = orderQueue[queueTab].taskType || getTaskForOrder(order);
                const suggestion = suggestedDriver(order);
                const pickup = getPickupAddress(order);
                const waitMs = getWaitingMs(order, now);
                const overdue = waitMs !== null && waitMs >= 24 * 60 * 60 * 1000;
                const nearSla = waitMs !== null && waitMs >= 20 * 60 * 60 * 1000 && !overdue;
                const address = taskType === 'delivery'
                  ? String(order.receiver_address || '').trim()
                  : pickup.address;
                const addressMissing = taskType === 'delivery' ? !address : pickup.missing;
                const ward = taskType === 'delivery'
                  ? getOrderWard(order, taskType)?.properties?.name
                  : pickup.ward;
                return (
                  <article key={order.id} className={`rounded-xl border p-4 ${overdue ? 'border-rose-300 bg-rose-50/60' : nearSla ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200 bg-white'}`}>
                    <div className="flex flex-wrap items-start gap-3">
                      {taskType && ['pickup', 'delivery', 'redelivery'].includes(queueTab) && <input aria-label={`Chọn đơn ${order.tracking_code}`} type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => toggleSelected(order.id)} className="mt-1 size-4 accent-emerald-700" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-black text-slate-900">{order.tracking_code || `Đơn #${order.id}`}</span>
                          <OrderStatusBadge status={order.status} />
                          {(overdue || nearSla) && (
                            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${overdue ? 'bg-rose-700 text-white' : 'bg-amber-200 text-amber-950'}`}>
                              <Clock size={13} /> {overdue ? 'Quá SLA' : 'Sắp quá SLA'} · {formatWaiting(waitMs)}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-start gap-2">
                          <MapPin className={`mt-0.5 shrink-0 ${pickup.missing && taskType !== 'delivery' ? 'text-rose-700' : 'text-slate-600'}`} size={17} />
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold ${addressMissing ? 'text-rose-800' : 'text-slate-900'}`}>{address || 'Chưa có địa chỉ'}</p>
                              {addressMissing && (
                                <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-rose-800"><AlertTriangle size={14} /> Cần bổ sung địa chỉ lấy/giao hàng</p>
                            )}
                            {ward && <p className="mt-1 text-sm text-slate-700">Phường {ward}</p>}
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-slate-800">
                          Người nhận: <span className="font-semibold">{order.receiver_name || 'Chưa có tên'}</span>
                          {order.receiver_phone && <span className="text-slate-700"> · {order.receiver_phone}</span>}
                        </p>
                      </div>
                    </div>
                    {taskType && !['pickup_failed', 'delivery_failed'].includes(order.status) && (
                      <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-wide text-indigo-900">Gợi ý phân công</p>
                            {suggestion ? (
                              <p className="mt-1 text-sm font-semibold text-indigo-950">
                                {suggestion.driver.full_name}
                                {suggestion.distance !== null && <span className="font-medium"> · {suggestion.distance.toFixed(1)} km</span>}
                                <span className="block text-sm font-medium text-indigo-900">
                                  Đang giữ {suggestion.driver.active_count || 0}/{suggestion.driver.max_active_orders || 10} đơn
                                  · {Number(suggestion.driver.active_weight_kg || 0).toLocaleString('vi-VN')}/{Number(suggestion.driver.max_payload_kg || 100).toLocaleString('vi-VN')} kg
                                </span>
                              </p>
                            ) : <p className="mt-1 text-sm font-semibold text-rose-800">Chưa có tài xế đủ điều kiện hoặc dữ liệu cấu hình.</p>}
                          </div>
                          {suggestion && (
                            <button type="button" onClick={async () => {
                              try {
                                await onAssign(order, suggestion.driver.id, taskType);
                                setBulkMessage(`Đã phân công ${order.tracking_code} cho ${suggestion.driver.full_name}.`);
                              } catch (assignError) {
                                setBulkMessage(assignError.message || 'Không thể phân công đơn.');
                              }
                            }} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-800">
                              <Zap size={15} /> Phân công
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-black text-slate-900">Tài xế trực tuyến</h2>
                <p className="text-sm text-slate-700">Tải công việc và khu vực phụ trách</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-900">{onlineDrivers.length} online</span>
            </div>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {!drivers.length && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Chưa có dữ liệu tài xế.</p>}
              {drivers.map((driver) => {
                const position = positions[driver.id];
                const timestamp = Date.parse(position?.timestamp || '');
                const online = now > 0 && Number.isFinite(timestamp) && now - timestamp < 15 * 60 * 1000;
                const wards = String(driver.service_areas || '').split(',').map((area) => area.trim()).filter(Boolean);
                return (
                  <article key={driver.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-slate-900">{driver.full_name}</p>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${online ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-800'}`}>{online ? 'Trực tuyến' : 'Ngoại tuyến'}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-800">
                      Đang giữ {driver.active_count || 0}/{driver.max_active_orders || 10} đơn
                      · {Number(driver.active_weight_kg || 0).toLocaleString('vi-VN')} kg
                    </p>
                    <p className="mt-1 text-sm text-slate-700">Phường: {wards.length ? wards.join(', ') : 'Chưa giới hạn'}</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => loadDriverRoute(driver.id)} disabled={routeActionBusy} className={`rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${selectedRouteDriver === String(driver.id) ? 'border-indigo-700 bg-indigo-50 text-indigo-900' : 'border-slate-300 text-slate-800'}`}>{selectedRouteDriver === String(driver.id) ? 'Đang xem tuyến' : 'Xem tuyến'}</button>
                      <button type="button" onClick={() => optimizeSelectedRoute(driver.id)} disabled={routeActionBusy} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Tối ưu lại</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          {selectedDriverRoute && (
            <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-black text-indigo-950">Lộ trình {selectedDriverRoute.mode === 'pickup' ? 'lấy hàng' : 'giao hàng'}</h2>
                  <p className="mt-1 text-sm font-semibold text-indigo-900">
                    {(Number(selectedDriverRoute.summary?.total_distance_m || 0) / 1000).toFixed(1)} km · {Math.ceil(Number(selectedDriverRoute.summary?.total_duration_s || 0) / 60)} phút
                    {selectedDriverRoute.summary?.is_estimated ? ' · ước tính' : ' · OSRM'}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedDriverRoute(null)} aria-label="Đóng lộ trình" className="rounded-lg p-1 text-indigo-900"><X size={17} /></button>
              </div>
              {routeActionError && <p role="alert" className="mt-2 text-sm font-bold text-rose-800">{routeActionError}</p>}
              <ol className="mt-3 space-y-2">
                {(selectedDriverRoute.stops || []).map((stop, index) => (
                  <li key={stop.stop_ids[0]} className="rounded-lg bg-white p-3 text-sm">
                    <p className="font-bold text-slate-900">{index + 1}. {(stop.tracking_codes || []).join(', ')}</p>
                    <p className="mt-1 text-slate-700">{stop.address || 'Chưa có địa chỉ'}</p>
                    <p className="mt-1 text-xs font-semibold text-indigo-900">
                      ETA {stop.eta ? new Date(stop.eta).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'đang tính'}
                      · {stop.order_ids.length} đơn
                    </p>
                    {selectedDriverRoute.mode === 'pickup' && stop.ranking_reason && (
                      <p className="mt-1 text-xs font-medium text-slate-700">Ưu tiên: {stop.ranking_reason}</p>
                    )}
                  </li>
                ))}
                {!selectedDriverRoute.stops?.length && <li className="text-sm text-slate-700">Tài xế chưa có điểm dừng đang thực hiện.</li>}
              </ol>
            </section>
          )}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between p-4">
              <div><h2 className="text-lg font-black text-slate-900">Bản đồ tác nghiệp</h2><p className="text-sm text-slate-700">Vị trí tài xế và các điểm trong hàng đợi.</p></div>
              <MapPin size={19} className="text-emerald-800" />
            </div>
            <div className="relative z-0 isolate h-64 w-full overflow-hidden rounded-xl">
              <MapContainer center={GOVAP_MAP_CENTER} zoom={12} style={{ width: '100%', height: '100%' }} className="relative z-0 isolate">
                <InvalidateMapSize />
                <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />
                {dispatcherRouteGeometry?.key === `${selectedRouteDriver}:${selectedDriverRoute?.mode}:${(selectedDriverRoute?.stops || []).map((stop) => stop.stop_ids?.[0]).join(',')}`
                  && dispatcherRouteGeometry.positions.length > 1
                  && <Polyline positions={dispatcherRouteGeometry.positions} pathOptions={{ color: selectedDriverRoute?.mode === 'pickup' ? '#d97706' : '#2563eb', weight: 5 }} />}
                {(selectedDriverRoute?.stops || []).map((stop, index) => (
                  <Marker key={`route-${stop.stop_ids[0]}`} position={[Number(stop.lat), Number(stop.lng)]} icon={routeMarkerIcon(index + 1, selectedDriverRoute.mode)}>
                    <Popup><strong>Điểm {index + 1}</strong><br />{(stop.tracking_codes || []).join(', ')}<br />{stop.address}</Popup>
                  </Marker>
                ))}
                {drivers.map((driver) => {
                  const position = positions[driver.id];
                  if (!position || !Number.isFinite(Number(position.lat)) || !Number.isFinite(Number(position.lng))) return null;
                  return (
                    <Marker key={`driver-${driver.id}`} position={[Number(position.lat), Number(position.lng)]} icon={markerIcon}>
                      <Popup><strong>{driver.full_name}</strong><br />Tài xế · cập nhật {new Date(position.timestamp).toLocaleTimeString('vi-VN')}</Popup>
                    </Marker>
                  );
                })}
                {queueItems.slice(0, 15).map((order) => {
                  const taskType = orderQueue[queueTab].taskType || getTaskForOrder(order);
                  const isPickup = taskType !== 'delivery';
                  const lat = Number(isPickup ? order.shop_lat : order.receiver_lat);
                  const lng = Number(isPickup ? order.shop_lng : order.receiver_lng);
                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                  return (
                    <Marker key={`order-${order.id}`} position={[lat, lng]} icon={markerIcon}>
                      <Popup><strong>{order.tracking_code}</strong><br />{isPickup ? 'Điểm lấy hàng' : 'Điểm giao hàng'}<br />{isPickup ? getPickupAddress(order).address : order.receiver_address}</Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </section>
        </aside>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-[1000] flex justify-end bg-slate-950/50" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDrawerOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="driver-config-title" className="flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h2 id="driver-config-title" className="text-xl font-black text-slate-900">Cấu hình tài xế</h2>
                <p className="mt-1 text-sm text-slate-700">Thay đổi hạn mức sẽ được ghi vào nhật ký kiểm toán.</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Đóng cấu hình tài xế" className="rounded-lg p-2 text-slate-800 hover:bg-slate-100"><X size={22} /></button>
            </header>
            {profileMessage && <p role="status" className="border-b border-slate-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-950">{profileMessage}</p>}
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-black uppercase text-slate-800">
                  <tr><th className="p-3">Tài xế / Tải hiện tại</th><th className="p-3">Đơn tối đa</th><th className="p-3">Tải trọng (kg)</th><th className="p-3">Giá trị tối đa (đ)</th><th className="p-3">Phường phụ trách</th><th className="p-3">Lưu</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {drivers.map((driver) => {
                    const draft = profileDrafts[driver.id] || driver;
                    const selectedAreas = String(draft.service_areas || '').split(',').map((area) => area.trim()).filter(Boolean);
                    return (
                      <tr key={driver.id} className="align-top">
                        <td className="min-w-48 p-3">
                          <p className="font-bold text-slate-900">{driver.full_name}</p>
                          <p className="mt-1 text-sm text-slate-700">{driver.active_count || 0} đơn · {Number(driver.active_weight_kg || 0).toLocaleString('vi-VN')} kg</p>
                        </td>
                        <td className="w-32 p-3"><input aria-label={`Số đơn tối đa ${driver.full_name}`} type="number" min="1" max="100" value={draft.max_active_orders ?? 10} onChange={(event) => onProfileDraftChange(driver.id, { ...draft, max_active_orders: event.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-900" /></td>
                        <td className="w-36 p-3"><input aria-label={`Tải trọng tối đa ${driver.full_name}`} type="number" min="0.1" max="100000" step="0.1" value={draft.max_payload_kg ?? 100} onChange={(event) => onProfileDraftChange(driver.id, { ...draft, max_payload_kg: event.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-900" /></td>
                        <td className="w-44 p-3"><input aria-label={`Giá trị tối đa mỗi đơn ${driver.full_name}`} type="number" min="0" max="10000000000" step="100000" value={draft.max_order_value ?? 0} onChange={(event) => onProfileDraftChange(driver.id, { ...draft, max_order_value: event.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-900" /><span className="mt-1 block text-xs text-slate-700">0 = theo ký quỹ</span></td>
                        <td className="max-w-sm p-3">
                          <div className="flex flex-wrap gap-1.5">
                            {GOVAP_WARDS.features.map(({ properties }) => {
                              const selected = selectedAreas.some((area) => normalizeWard(area) === normalizeWard(properties.name));
                              return (
                                <button key={properties.code} type="button" aria-pressed={selected} onClick={() => toggleWard(driver.id, properties.name)} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${selected ? 'border-emerald-700 bg-emerald-100 text-emerald-950' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'}`}>
                                  {properties.name}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="p-3">
                          <button type="button" disabled={savingProfileId === driver.id} onClick={async () => {
                            if (!window.confirm(`Lưu cấu hình phân tuyến cho ${driver.full_name}?`)) return;
                            setProfileMessage('');
                            const result = await onSaveProfile(driver.id);
                            setProfileMessage(result?.message || 'Đã hoàn tất thao tác lưu.');
                          }} className="whitespace-nowrap rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                            {savingProfileId === driver.id ? 'Đang lưu…' : 'Lưu'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!drivers.length && <tr><td colSpan="6" className="p-8 text-center text-sm font-semibold text-slate-700">Chưa có tài xế đang hoạt động.</td></tr>}
                </tbody>
              </table>
            </div>
            <footer className="border-t border-slate-200 p-4 text-sm text-slate-700">
              Chọn phường bằng chip. Nhấn <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs">Esc</kbd> để đóng.
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
