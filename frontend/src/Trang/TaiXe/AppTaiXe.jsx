import { apiFetch as fetch } from '../../utils/apiFetch.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { io } from 'socket.io-client';
import { MapPin, Package, CheckCircle, XCircle, LogOut, Navigation, Wallet, UserCircle, Bike, Map, Send, CalendarOff, Camera, AlertTriangle, X, ShieldCheck, House, PackageCheck, Banknote, Siren, Wifi, WifiOff, ScanLine, Route } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import iconMarkerUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
const truckIcon = new L.Icon({
  iconUrl: iconMarkerUrl,
  shadowUrl: iconShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const tinhTongTienCanThu = (order) => Number(order?.cod_amount || 0)
  + (order?.fee_payer === 'receiver' ? Number(order?.shipping_fee || 0) : 0);
const distanceBetween = (first, second) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(Number(second.lat) - Number(first.lat));
  const deltaLongitude = toRadians(Number(second.lng) - Number(first.lng));
  const value = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(Number(first.lat))) * Math.cos(toRadians(Number(second.lat)))
    * Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};
const getDeliveryCoordinates = (order) => {
  if (order.receiver_lat === null || order.receiver_lat === undefined || order.receiver_lat === ''
    || order.receiver_lng === null || order.receiver_lng === undefined || order.receiver_lng === '') return null;
  const lat = Number(order.receiver_lat);
  const lng = Number(order.receiver_lng);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180
    ? { lat, lng }
    : null;
};
const optimizeDeliveryStops = (start, orders) => {
  const remaining = orders
    .map((order) => ({ order, coordinates: getDeliveryCoordinates(order) }))
    .filter((stop) => stop.coordinates);
  const unlocated = orders.filter((order) => !getDeliveryCoordinates(order));
  const optimized = [];
  let current = start;
  let totalDistance = 0;
  while (remaining.length) {
    let nearestIndex = 0;
    let nearestDistance = distanceBetween(current, remaining[0].coordinates);
    for (let index = 1; index < remaining.length; index += 1) {
      const distance = distanceBetween(current, remaining[index].coordinates);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }
    const [next] = remaining.splice(nearestIndex, 1);
    optimized.push(next.order);
    totalDistance += nearestDistance;
    current = next.coordinates;
  }
  return { orders: [...optimized, ...unlocated], totalDistance, optimizedCount: optimized.length };
};

const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('access_token') }
});

function LinehaulDriverApp() {
  const driverName = localStorage.getItem('full_name') || 'Tài xế xe tải';
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const scanBusyRef = useRef(false);
  const activeTrip = trips.find((trip) => String(trip.id) === selectedTripId) || trips[0] || null;
  const activeTripId = activeTrip?.id;
  const activeTripStatus = activeTrip?.status;

  const taiChuyenXe = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/driver/trips');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không tải được chuyến xe.');
      setTrips(data.data || []);
      setSelectedTripId((current) => data.data?.some((trip) => String(trip.id) === current)
        ? current : String(data.data?.[0]?.id || ''));
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Không tải được chuyến xe.');
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(taiChuyenXe, 0);
    const intervalId = window.setInterval(taiChuyenXe, 30000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(intervalId);
    };
  }, [taiChuyenXe]);

  const xacNhanQuetBao = useCallback(async (bagCode) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('http://localhost:5000/api/driver/trips/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bag_code: bagCode })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể xác nhận bao.');
      setNotice(data.message);
      await taiChuyenXe();
      if (data.trip_ready) setScanning(false);
    } catch (scanError) {
      setError(scanError.message || 'Không thể xác nhận bao.');
    } finally {
      setBusy(false);
    }
  }, [taiChuyenXe]);

  useEffect(() => {
    if (!scanning) return undefined;
    let processing = false;
    const scanner = new Html5QrcodeScanner('linehaul-driver-scanner', {
      fps: 8,
      qrbox: { width: 260, height: 160 },
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39
      ],
      rememberLastUsedCamera: false
    }, false);
    scanner.render(async (decodedText) => {
      if (processing || scanBusyRef.current) return;
      processing = true;
      scanBusyRef.current = true;
      try {
        await xacNhanQuetBao(decodedText.trim());
      } finally {
        scanBusyRef.current = false;
      }
      window.setTimeout(() => { processing = false; }, 1000);
    }, () => {});
    return () => scanner.clear().catch((scanError) => console.warn('Không thể dừng camera quét bao:', scanError));
  }, [scanning, xacNhanQuetBao]);

  const batDauChuyen = async () => {
    if (!activeTrip || Number(activeTrip.scanned_bag_count) !== Number(activeTrip.bag_count) || !Number(activeTrip.bag_count)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:5000/api/driver/trips/${activeTrip.id}/start`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể bắt đầu chuyến xe.');
      setNotice(data.message);
      await taiChuyenXe();
    } catch (startError) {
      setError(startError.message || 'Không thể bắt đầu chuyến xe.');
    } finally {
      setBusy(false);
    }
  };

  const baoDaDenKho = async () => {
    if (!activeTrip) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:5000/api/driver/trips/${activeTrip.id}/arrive`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể báo đã đến kho.');
      setNotice(data.message);
      await taiChuyenXe();
    } catch (arrivalError) {
      setError(arrivalError.message || 'Không thể báo đã đến kho.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!activeTripId || activeTripStatus !== 'in_transit' || !navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(async (position) => {
      const { latitude: lat, longitude: lng } = position.coords;
      setCurrentLocation({ lat, lng });
      try {
        const response = await fetch(`http://localhost:5000/api/driver/trips/${activeTripId}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Không gửi được vị trí GPS.');
      } catch (gpsError) {
        setError(gpsError.message || 'Không gửi được vị trí GPS.');
      }
    }, (gpsError) => setError(`Không thể lấy GPS: ${gpsError.message}`), { enableHighAccuracy: true, maximumAge: 10000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeTripId, activeTripStatus]);

  const dangXuat = () => {
    localStorage.clear();
    window.location.href = '/dang-nhap';
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-800 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <header className="rounded-3xl bg-gradient-to-r from-slate-800 to-indigo-800 p-6 text-white shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-sm font-bold text-indigo-200">SMART LOGISTICS · LINE-HAUL</p><h1 className="mt-2 text-2xl font-black">Xin chào, {driverName}</h1><p className="mt-1 text-sm text-slate-300">Ứng dụng tài xế trung chuyển liên kho</p></div>
            <button type="button" onClick={dangXuat} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">Đăng xuất</button>
          </div>
        </header>
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">{notice}</p>}
        <div className="mt-5 flex items-center justify-between"><h2 className="text-xl font-black">Chuyến được phân công</h2><button type="button" onClick={taiChuyenXe} className="rounded-lg bg-white px-4 py-2 text-sm font-bold shadow-sm">Làm mới</button></div>
        {!trips.length ? <p className="mt-4 rounded-2xl bg-white p-6 text-slate-500 shadow-sm">Chưa có chuyến xe được phân công.</p> : (
          <>
            {trips.length > 1 && <label className="mt-4 block text-sm font-bold">Chọn chuyến
              <select value={activeTrip?.id || ''} onChange={(event) => setSelectedTripId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3">
                {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.trip_code} · {trip.source_warehouse_name} → {trip.destination_warehouse_name}</option>)}
              </select>
            </label>}
            {activeTrip && <article className="mt-4 space-y-5 rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-xs font-black uppercase text-indigo-600">{activeTrip.trip_code}</p><h3 className="mt-1 text-xl font-black">{activeTrip.source_warehouse_name} → {activeTrip.destination_warehouse_name}</h3><p className="mt-1 text-sm text-slate-500">{activeTrip.vehicle_plate}</p></div>
                <span className="rounded-full bg-indigo-50 px-3 py-2 text-sm font-black text-indigo-700">{activeTrip.status === 'in_transit' ? 'Đang di chuyển' : activeTrip.status === 'arrived' ? 'Đã đến kho' : 'Chờ bốc hàng'}</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between"><strong>Kiểm tra bao lên xe</strong><span className="font-black text-indigo-700">{activeTrip.scanned_bag_count || 0}/{activeTrip.bag_count || 0}</span></div>
                <div className="mt-3 space-y-2">{(activeTrip.bags || []).map((bag) => <div key={bag.bag_id} className="flex items-center justify-between rounded-lg bg-white p-3 text-sm"><span className="font-mono font-bold">{bag.bag_code}</span><span className={bag.driver_scanned_at ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>{bag.driver_scanned_at ? 'Đã quét' : 'Chưa quét'}</span></div>)}</div>
              </div>
              {['planned', 'loading'].includes(activeTrip.status) && <>
                <button type="button" disabled={busy || Number(activeTrip.scanned_bag_count) >= Number(activeTrip.bag_count)} onClick={() => { setNotice(''); setScanning(true); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-4 font-black text-white disabled:opacity-50"><ScanLine size={18} /> Quét bao lên xe</button>
                <button type="button" disabled={busy || !Number(activeTrip.bag_count) || Number(activeTrip.scanned_bag_count) !== Number(activeTrip.bag_count)} onClick={batDauChuyen} className="w-full rounded-xl bg-emerald-600 px-4 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Bắt đầu khởi hành</button>
              </>}
              {activeTrip.status === 'in_transit' && <div className="space-y-3"><p className="rounded-xl bg-blue-50 p-4 text-sm font-bold text-blue-800">GPS {currentLocation ? `đang gửi · ${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}` : 'đang chờ quyền truy cập vị trí'}.</p><button type="button" disabled={busy} onClick={baoDaDenKho} className="w-full rounded-xl bg-emerald-700 px-4 py-4 font-black text-white disabled:opacity-50">Đã đến kho đích</button></div>}
              {activeTrip.status === 'arrived' && <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Đã báo đến nơi. Chờ thủ kho quét nhận các bao để hoàn tất chuyến xe.</p>}
            </article>}
          </>
        )}
        {scanning && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"><section className="w-full max-w-md rounded-2xl bg-white p-5">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-black">Quét mã bao đã niêm phong</h3><button type="button" onClick={() => setScanning(false)} className="rounded-lg bg-slate-100 px-3 py-2 font-bold">Đóng</button></div>
          <div id="linehaul-driver-scanner" />
        </section></div>}
      </div>
    </main>
  );
}

export default function AppTaiXe() {
  const role = localStorage.getItem('role') || localStorage.getItem('user_role');
  return role === 'linehaul_driver' ? <LinehaulDriverApp /> : <MotorcycleDriverApp />;
}

function MotorcycleDriverApp() {
  const [donHang, setDonHang] = useState([]);
  const [tabHienTai, setTabHienTai] = useState('dashboard');
  const [viTien, setViTien] = useState(0);
  const [tienChoNop, setTienChoNop] = useState(0);
  const [kyQuy, setKyQuy] = useState({ balance: 0, reserved: 0, available: 0 });
  const [dangOnline, setDangOnline] = useState(navigator.onLine);
  const [offlineSyncNotice, setOfflineSyncNotice] = useState('');
  const [showSos, setShowSos] = useState(false);
  const [sosType, setSosType] = useState('vehicle_breakdown');
  const [sosDescription, setSosDescription] = useState('');
  const [sendingSos, setSendingSos] = useState(false);
  const [scanningTripBags, setScanningTripBags] = useState(false);
  const [tripBagNotice, setTripBagNotice] = useState('');
  const [cashSubmitting, setCashSubmitting] = useState(false);
  const [expenseClaims, setExpenseClaims] = useState([]);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseNotice, setExpenseNotice] = useState('');
  const [viTriHienTai, setViTriHienTai] = useState({ lat: 10.762622, lng: 106.660172 }); 
  const [routeInfo, setRouteInfo] = useState(null);
  const [optimizedRouteIds, setOptimizedRouteIds] = useState([]);
  const [optimizedRouteDistance, setOptimizedRouteDistance] = useState(null);
  
  // State cho form nghỉ phép
  const [lyDoNghi, setLyDoNghi] = useState('');
  const [dangGuiNghiPhep, setDangGuiNghiPhep] = useState(false);

  // State cho Modal Xử lý Đơn hàng (Thành công / Thất bại)
  const [modalXuLy, setModalXuLy] = useState({ mo: false, loai: '', don: null });
  const [anhMinhChung, setAnhMinhChung] = useState(null);
  const [anhPreview, setAnhPreview] = useState(null);
  const signatureCanvasRef = useRef(null);
  const [signatureDrawn, setSignatureDrawn] = useState(false);
  const [lyDoHuy, setLyDoHuy] = useState('');
  const [xacNhanTien, setXacNhanTien] = useState(false);
  const [phuongThucCOD, setPhuongThucCOD] = useState('');
  const [dangCapNhat, setDangCapNhat] = useState(false);
  const [donCanQuet, setDonCanQuet] = useState(null);
  const [loiQuetMa, setLoiQuetMa] = useState('');
  const [maOtpGiaoHang, setMaOtpGiaoHang] = useState('');

  const driverId = localStorage.getItem('user_id');
  const driverRole = localStorage.getItem('role') || localStorage.getItem('user_role');
  const isPickupDriver = driverRole === 'pickup_driver';
  const driverTheme = isPickupDriver
    ? {
      header: 'from-amber-500 to-orange-600',
      label: 'text-amber-100',
      wallet: 'bg-amber-50 text-amber-700',
      accent: 'text-amber-300',
      progress: '#f59e0b',
      mission: 'border-amber-100 bg-amber-50',
      missionLabel: 'text-amber-800',
      action: 'bg-amber-600 hover:bg-amber-700'
    }
    : {
      header: 'from-blue-600 to-indigo-600',
      label: 'text-blue-100',
      wallet: 'bg-blue-50 text-blue-600',
      accent: 'text-blue-300',
      progress: '#3b82f6',
      mission: 'border-blue-100 bg-blue-50',
      missionLabel: 'text-blue-800',
      action: 'bg-blue-600 hover:bg-blue-700'
    };
  const driverName = localStorage.getItem('full_name') || 'Tài Xế Giao Nhận';
  const taskRoute = routeInfo?.task_route;
  const diemDi = taskRoute?.origin?.address || (taskRoute?.origin ? `${taskRoute.origin.lat},${taskRoute.origin.lng}` : '10.762622,106.660172');
  const tenKho = routeInfo?.warehouse?.address || 'Kho trung tâm Smart Logistics, TP. Hồ Chí Minh';
  const diemDen = taskRoute?.destination?.address || (taskRoute?.destination ? `${taskRoute.destination.lat},${taskRoute.destination.lng}` : tenKho);
  const urlChiDuong = routeInfo
    ? `https://www.google.com/maps/dir/?api=1&${new URLSearchParams({ origin: diemDi, destination: diemDen, travelmode: 'driving' })}`
    : '';

  const batDauPhatToaDo = useCallback((orderId, trackingCode) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.watchPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setViTriHienTai({ lat, lng });
      socket.emit('driver_update_location', {
        shipper_id: Number(driverId),
        order_id: orderId,
        tracking_code: trackingCode,
        lat,
        lng,
        route_status: 'moving',
        timestamp: new Date()
      });
    }, (error) => console.error('Lỗi GPS:', error), { enableHighAccuracy: true });
  }, [driverId]);

  const taiDuLieu = useCallback(async () => {
    if (!driverId) return;
    try {
      const res = await fetch(`http://localhost:5000/api/orders/shipper/${driverId}`);
      const data = await res.json();
      if (data.success) {
        setDonHang(data.data);
        const activeStatuses = isPickupDriver
          ? ['picking', 'picked_up', 'transferring_to_central', 'transferring_to_destination']
          : ['at_destination_warehouse', 'delivering'];
        const firstActiveOrder = data.data.find(item => activeStatuses.includes(item.status));
        if (firstActiveOrder) {
          const routeRes = await fetch(`http://localhost:5000/api/orders/${firstActiveOrder.id}/route`);
          const routeData = await routeRes.json();
          if (routeData.success) {
            setRouteInfo(routeData.data);
            if (['transferring_to_central', 'transferring_to_destination'].includes(firstActiveOrder.status)) {
              batDauPhatToaDo(firstActiveOrder.id, firstActiveOrder.tracking_code);
            }
          }
        }
      }
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    }
  }, [driverId, isPickupDriver, batDauPhatToaDo]);

  const taiViTien = useCallback(async () => {
    if (!driverId) return;
    try {
      const response = await fetch(`http://localhost:5000/api/driver/wallet/${driverId}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể tải ví COD.');
      setViTien(Number(data.data.cash_on_hand || 0));
      setTienChoNop(Number(data.data.cash_pending_handover || 0));
      setKyQuy({
        balance: Number(data.data.deposit_balance || 0),
        reserved: Number(data.data.reserved_balance || 0),
        available: Number(data.data.available_balance || 0)
      });
    } catch (error) {
      console.error('Không tải được ví tài xế:', error);
    }
  }, [driverId]);

  const taiYeuCauPhuPhi = useCallback(async () => {
    if (!driverId) return;
    const response = await fetch('http://localhost:5000/api/driver/expense-claims');
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Không tải được yêu cầu phụ phí.');
    setExpenseClaims(data.data || []);
  }, [driverId]);

  useEffect(() => {
    const onlineHandler = () => {
      setDangOnline(true);
      navigator.serviceWorker?.controller?.postMessage({
        type: 'SYNC_DRIVER_ACTIONS',
        token: localStorage.getItem('access_token')
      });
    };
    const offlineHandler = () => setDangOnline(false);
    const serviceWorkerMessage = (event) => {
      if (event.data?.type !== 'DRIVER_ACTION_SYNCED') return;
      setOfflineSyncNotice(event.data.success
        ? 'Thao tác đã đồng bộ thành công.'
        : event.data.message || 'Một thao tác offline cần được kiểm tra thủ công.');
      if (event.data.success) taiDuLieu();
    };
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    navigator.serviceWorker?.addEventListener('message', serviceWorkerMessage);
    navigator.serviceWorker?.controller?.postMessage({
      type: 'SYNC_DRIVER_ACTIONS',
      token: localStorage.getItem('access_token')
    });
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
      navigator.serviceWorker?.removeEventListener('message', serviceWorkerMessage);
    };
  }, [taiDuLieu]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      taiViTien();
      taiDuLieu();
    }, 0);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setViTriHienTai({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }

    const orderAssigned = (data) => {
      alert(data.message);
      taiDuLieu(); 
    };
    socket.on(`new_order_assigned_${driverId}`, orderAssigned);

    return () => {
      window.clearTimeout(initialLoad);
      socket.off(`new_order_assigned_${driverId}`, orderAssigned);
    };
  }, [driverId, isPickupDriver, taiDuLieu, taiViTien]);

  const xacNhanDaLayHang = (order) => {
    setLoiQuetMa('');
    setDonCanQuet(order);
  };

  useEffect(() => {
    if (!donCanQuet) return undefined;
    let scanned = false;
    const scanner = new Html5QrcodeScanner('driver-pickup-barcode', {
      fps: 10,
      qrbox: { width: 240, height: 160 },
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13
      ],
      rememberLastUsedCamera: false
    }, false);
    scanner.render(async (decodedText) => {
      if (scanned) return;
      if (decodedText.trim() !== String(donCanQuet.tracking_code).trim()) {
        setLoiQuetMa('Mã quét không khớp với vận đơn đang nhận. Vui lòng quét lại đúng nhãn.');
        return;
      }
      scanned = true;
      try {
        const response = await fetch(`http://localhost:5000/api/orders/${donCanQuet.id}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': `${driverId}-${donCanQuet.id}-picked_up`
          },
          body: JSON.stringify({ status: 'picked_up', user_id: driverId, tracking_code: donCanQuet.tracking_code })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Không thể xác nhận nhận hàng.');
        batDauPhatToaDo(donCanQuet.id, donCanQuet.tracking_code);
        setDonCanQuet(null);
        const routeResponse = await fetch(`http://localhost:5000/api/orders/${donCanQuet.id}/route`);
        const routeResult = await routeResponse.json();
        if (routeResult.success) setRouteInfo(routeResult.data);
        alert(result.offline_queued
          ? 'Đã lưu xác nhận lấy hàng trên thiết bị. Tự động đồng bộ khi mạng quay lại.'
          : 'Đã quét đúng mã vận đơn. Vui lòng bàn giao kiện hàng cho Thủ kho quét nhập.');
        taiDuLieu();
      } catch (error) {
        scanned = false;
        setLoiQuetMa(error.message || 'Lỗi kết nối máy chủ.');
      }
    }, () => {});
    return () => {
      scanner.clear().catch((error) => console.warn('Không thể dừng camera quét mã:', error));
    };
  }, [donCanQuet, driverId, batDauPhatToaDo, taiDuLieu]);

  useEffect(() => {
    if (!scanningTripBags) return undefined;
    let processing = false;
    const scanner = new Html5QrcodeScanner('driver-linehaul-barcode', {
      fps: 8,
      qrbox: { width: 260, height: 150 },
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39
      ],
      rememberLastUsedCamera: false
    }, false);
    scanner.render(async (decodedText) => {
      if (processing) return;
      processing = true;
      try {
        const response = await fetch('http://localhost:5000/api/driver/trips/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driver_id: Number(driverId), bag_code: decodedText.trim() })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Không thể xác nhận bao hàng.');
        setTripBagNotice(data.message);
        if (data.trip_started) {
          setScanningTripBags(false);
          taiDuLieu();
        } else {
          window.setTimeout(() => { processing = false; }, 900);
        }
      } catch (error) {
        setTripBagNotice(error.message || 'Lỗi kết nối máy chủ.');
        window.setTimeout(() => { processing = false; }, 900);
      }
    }, () => {});
    return () => scanner.clear().catch((error) => console.warn('Không thể dừng camera quét bao:', error));
  }, [scanningTripBags, driverId, taiDuLieu]);

  const batDauGiaoHang = async (orderId, trackingCode) => {
    if (!window.confirm('Bắt đầu đi giao đơn này?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivering', user_id: driverId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        batDauPhatToaDo(orderId, trackingCode);
        const routeRes = await fetch(`http://localhost:5000/api/orders/${orderId}/route`);
        const routeData = await routeRes.json();
        if (routeData.success) setRouteInfo(routeData.data);
        alert("🚀 Đã bật GPS đồng bộ lộ trình!");
        taiDuLieu();
      } else {
        alert(data.message || 'Không thể bắt đầu giao hàng.');
      }
    } catch {
      alert('Lỗi cập nhật!');
    }
  };

  const nopTienMat = async () => {
    if (viTien <= 0 || cashSubmitting) return;
    if (!window.confirm(`Gửi yêu cầu nộp ${viTien.toLocaleString()} đ tiền mặt COD cho Kế toán xác nhận?`)) return;
    setCashSubmitting(true);
    try {
      const response = await fetch('http://localhost:5000/api/driver/cash-remittances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: Number(driverId) })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể tạo phiếu nộp tiền.');
      alert(`${data.message} Số tiền: ${Number(data.data.amount).toLocaleString()} đ.`);
      await taiViTien();
    } catch (error) {
      alert(error.message || 'Lỗi kết nối khi nộp tiền.');
    } finally {
      setCashSubmitting(false);
    }
  };

  const guiYeuCauPhuPhi = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setExpenseSubmitting(true);
    setExpenseNotice('');
    try {
      const response = await fetch('http://localhost:5000/api/driver/expense-claims', {
        method: 'POST',
        body: new FormData(form)
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không gửi được biên lai.');
      form.reset();
      setExpenseNotice(data.message);
      await taiYeuCauPhuPhi();
    } catch (error) {
      setExpenseNotice(error.message || 'Lỗi kết nối khi gửi biên lai.');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  useEffect(() => {
    if (tabHienTai !== 'wallet') return;
    taiYeuCauPhuPhi().catch((error) => setExpenseNotice(error.message || 'Không tải được yêu cầu phụ phí.'));
  }, [tabHienTai, taiYeuCauPhuPhi]);

  const guiBaoCaoSuCo = async (event) => {
    event.preventDefault();
    setSendingSos(true);
    try {
      const response = await fetch('http://localhost:5000/api/driver/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: Number(driverId),
          incident_type: sosType,
          description: sosDescription.trim(),
          lat: viTriHienTai.lat,
          lng: viTriHienTai.lng
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể gửi báo cáo sự cố.');
      alert(data.message);
      setShowSos(false);
      setSosDescription('');
    } catch (error) {
      alert(error.message || 'Lỗi kết nối khi gửi báo cáo.');
    } finally {
      setSendingSos(false);
    }
  };

  // Hàm xử lý chọn ảnh
  const xuLyChonAnh = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAnhMinhChung(file);
      setAnhPreview(URL.createObjectURL(file));
    }
  };

  const batDauVeChuKy = (event) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const context = canvas.getContext('2d');
    context.beginPath();
    const x = (event.clientX - bounds.left) * canvas.width / bounds.width;
    const y = (event.clientY - bounds.top) * canvas.height / bounds.height;
    context.fillStyle = '#0f172a';
    context.beginPath();
    context.arc(x, y, 1.5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(x, y);
    canvas.setPointerCapture(event.pointerId);
    setSignatureDrawn(true);
  };

  const veChuKy = (event) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !event.buttons) return;
    const bounds = canvas.getBoundingClientRect();
    const context = canvas.getContext('2d');
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.strokeStyle = '#0f172a';
    context.lineTo(
      (event.clientX - bounds.left) * canvas.width / bounds.width,
      (event.clientY - bounds.top) * canvas.height / bounds.height
    );
    context.stroke();
  };

  const xoaChuKy = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDrawn(false);
  };

  // Hàm Submit Xử Lý (Gửi FormData chứa Ảnh + Trạng thái)
  const xacNhanThaoTac = async (e) => {
    e.preventDefault();
    const { loai, don } = modalXuLy;

    // Validate bắt buộc đối với Báo thất bại
    if (loai === 'returning') {
      if (!lyDoHuy) return alert("Vui lòng chọn hoặc nhập lý do giao thất bại!");
      if (!anhMinhChung) return alert("BẮT BUỘC: Vui lòng chụp ảnh minh chứng!");
    }

    // Validate bắt buộc đối với Giao thành công
    if (loai === 'completed') {
      if (!xacNhanTien) return alert('Vui lòng xác nhận đã thu đủ COD và phí vận chuyển.');
      if (tinhTongTienCanThu(don) > 0 && !['cash', 'bank_transfer'].includes(phuongThucCOD)) {
        return alert('Vui lòng chọn tiền mặt hoặc chuyển khoản.');
      }
      if (!/^\d{4,6}$/.test(maOtpGiaoHang)) return alert('Vui lòng nhập mã OTP giao hàng gồm 4-6 chữ số.');
      if (!anhMinhChung) return alert("BẮT BUỘC: Vui lòng chụp ảnh minh chứng đã giao hàng!");
      if (!signatureDrawn) return alert('Vui lòng lấy chữ ký xác nhận của người nhận.');
    }

    setDangCapNhat(true);
    try {
      const formData = new FormData();
      formData.append('status', loai); // 'completed' hoặc 'returning'
      formData.append('user_id', driverId);
      
      if (anhMinhChung) {
        formData.append('proof_image', anhMinhChung);
      }

      if (loai === 'completed') {
        const signatureCanvas = signatureCanvasRef.current;
        if (!signatureCanvas) {
          setDangCapNhat(false);
          return alert('Không tìm thấy vùng chữ ký. Vui lòng đóng và mở lại xác nhận giao hàng.');
        }
        const signatureBlob = await new Promise((resolve) => signatureCanvas.toBlob(resolve, 'image/png'));
        if (!signatureBlob) {
          setDangCapNhat(false);
          return alert('Không thể tạo ảnh chữ ký. Vui lòng ký lại.');
        }
        formData.append('signature_image', signatureBlob, `signature-${don.id}.png`);
        formData.append('delivery_otp', maOtpGiaoHang);
        formData.append('cod_collected', String(xacNhanTien));
        if (tinhTongTienCanThu(don) > 0) formData.append('cod_payment_method', phuongThucCOD);
      }
      
      if (loai === 'returning') {
        formData.append('fail_reason', lyDoHuy);
      }

      const res = await fetch(`http://localhost:5000/api/orders/${don.id}/status`, {
        method: 'PUT',
        body: formData // Fetch tự động nhận diện FormData và set Content-Type: multipart/form-data
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert(loai === 'completed' ? 'Đã xác nhận giao hàng và thu đủ COD + cước.' : 'Đã ghi nhận chuyển hoàn hàng!');
        dongModal();
        taiDuLieu();
        taiViTien();
      } else {
        alert("Lỗi: " + data.message);
      }
    } catch {
      alert('Lỗi kết nối máy chủ!');
    } finally {
      setDangCapNhat(false);
    }
  };

  const dongModal = () => {
    setModalXuLy({ mo: false, loai: '', don: null });
    setAnhMinhChung(null);
    setAnhPreview(null);
    xoaChuKy();
    setLyDoHuy('');
    setXacNhanTien(false);
    setPhuongThucCOD('');
    setMaOtpGiaoHang('');
  };

  const guiDonNghiPhep = async (e) => {
    e.preventDefault();
    if (!lyDoNghi.trim()) return;
    setDangGuiNghiPhep(true);
    
    try {
      const res = await fetch('http://localhost:5000/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: driverId, reason: lyDoNghi })
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Đã gửi đơn xin nghỉ phép lên phòng Nhân sự chờ duyệt.");
        setLyDoNghi('');
      }
    } catch {
      alert("Lỗi kết nối mạng!");
    } finally {
      setDangGuiNghiPhep(false);
    }
  };

  const dangXuat = () => {
    if (window.confirm("Đăng xuất ca làm việc?")) {
      localStorage.clear();
      window.location.href = '/';
    }
  };

  const donThanhCong = donHang.filter(d => d.status === 'completed');
  const donDangChay = donHang.filter(d => isPickupDriver
    ? ['picking', 'picked_up', 'transferring_to_central', 'transferring_to_destination'].includes(d.status)
    : ['at_destination_warehouse', 'delivering'].includes(d.status));
  const tongTienThuHo = donThanhCong.reduce((sum, item) => sum + tinhTongTienCanThu(item), 0);
  const donHoanTatHomNay = donThanhCong.filter((order) => new Date(order.updated_at).toDateString() === new Date().toDateString()).length;
  const donTrongNgay = donDangChay.length + donHoanTatHomNay;
  const tienDoHomNay = donTrongNgay ? Math.round((donHoanTatHomNay / donTrongNgay) * 100) : 0;
  const nextMission = donDangChay
    .map((order) => {
      const target = isPickupDriver
        ? { lat: order.shop_lat, lng: order.shop_lng }
        : { lat: order.receiver_lat, lng: order.receiver_lng };
      const hasTarget = Number.isFinite(Number(target.lat)) && Number.isFinite(Number(target.lng));
      return { ...order, distance: hasTarget ? distanceBetween(viTriHienTai, target) : Number.POSITIVE_INFINITY };
    })
    .sort((first, second) => first.distance - second.distance)[0];
  const donTheoTuyen = optimizedRouteIds.length
    ? donDangChay
      .map((order, currentIndex) => ({ order, rank: optimizedRouteIds.indexOf(order.id), currentIndex }))
      .sort((first, second) => {
        const firstRank = first.rank < 0 ? Number.MAX_SAFE_INTEGER : first.rank;
        const secondRank = second.rank < 0 ? Number.MAX_SAFE_INTEGER : second.rank;
        return firstRank - secondRank || first.currentIndex - second.currentIndex;
      })
      .map(({ order }) => order)
    : donDangChay;
  const toiUuTuyenGiao = () => {
    const { orders, totalDistance, optimizedCount } = optimizeDeliveryStops(viTriHienTai, donDangChay);
    if (!optimizedCount) {
      alert('Các đơn hiện tại chưa có tọa độ người nhận hợp lệ để sắp xếp tuyến.');
      return;
    }
    setOptimizedRouteIds(orders.map((order) => order.id));
    setOptimizedRouteDistance(totalDistance);
  };
  return (
    <div className="bg-slate-100 min-h-screen flex justify-center font-sans text-slate-800">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className={`bg-gradient-to-r ${driverTheme.header} p-6 rounded-b-[32px] shadow-lg text-white sticky top-0 z-50`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-full backdrop-blur-sm">
                <Bike size={22} />
              </div>
              <div>
                <p className={`${driverTheme.label} text-[10px] font-bold uppercase tracking-wider`}>{isPickupDriver ? 'TÀI XẾ NHẬN HÀNG' : 'TÀI XẾ GIAO HÀNG'}</p>
                <h2 className="font-black text-base">{driverName}</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${dangOnline ? 'bg-emerald-400/20 text-emerald-100' : 'bg-red-400/20 text-red-100'}`}>{dangOnline ? <Wifi size={13} /> : <WifiOff size={13} />}{dangOnline ? 'ONLINE' : 'OFFLINE'}</span>
              <button type="button" onClick={() => setShowSos(true)} className="rounded-full bg-red-500 p-2 text-white shadow-lg shadow-red-900/20" aria-label="Báo cáo sự cố SOS"><Siren size={18} /></button>
              <button onClick={dangXuat} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors" aria-label="Đăng xuất">
                <LogOut size={18} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between text-slate-800">
            <div className="flex items-center gap-3">
              <div className={`${driverTheme.wallet} p-2.5 rounded-xl`}>
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase">COD TIỀN MẶT ĐANG GIỮ</p>
                <h3 className="font-black text-lg text-slate-800">{viTien.toLocaleString()} đ</h3>
              </div>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto pb-28">
          {routeInfo && (isPickupDriver ? ['picking', 'picked_up', 'transferring_to_central', 'transferring_to_destination'].includes(routeInfo.status) : ['at_destination_warehouse', 'delivering'].includes(routeInfo.status)) && (
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{taskRoute?.label || 'Lộ trình vận chuyển'}</p>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">{isPickupDriver ? 'Lấy hàng / trung chuyển' : 'Giao hàng'}</span>
              </div>
              <div className="h-36 overflow-hidden rounded-2xl border border-slate-200">
                <iframe
                  title="Driver route map"
                  className="h-full w-full border-0"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(diemDen)}&z=14&output=embed`}
                />
              </div>
              <div className="mt-3 space-y-2">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Điểm đi</p>
                  <p className="mt-1 text-xs font-medium text-slate-700">{diemDi}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{diemDi}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Điểm đến</p>
                  <p className="mt-1 text-xs font-medium text-slate-700">{diemDen}</p>
                </div>
                <a href={urlChiDuong} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">
                  <Navigation size={16} /> Mở chỉ đường
                </a>
              </div>
            </div>
          )}
          
          {tabHienTai === 'dashboard' && (
            <div className="space-y-5 p-5">
              <section className={`flex items-center gap-4 rounded-2xl border p-4 ${driverTheme.mission}`}>
                <div className="rounded-xl bg-white p-3 text-slate-700 shadow-sm"><PackageCheck size={22} /></div>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-wider ${driverTheme.missionLabel}`}>{isPickupDriver ? 'Chặng nhận hàng' : 'Chặng giao hàng'}</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">{isPickupDriver ? 'Nhận kiện từ cửa hàng và bàn giao đúng kho.' : 'Nhận kiện tại kho đích và giao trực tiếp cho người nhận.'}</p>
                </div>
              </section>
              <section className="flex items-center gap-5 rounded-[28px] bg-slate-900 p-5 text-white shadow-lg">
                <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${driverTheme.progress} ${tienDoHomNay * 3.6}deg, #334155 0deg)` }}>
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-slate-900 text-center">
                    <span><strong className="block text-2xl">{tienDoHomNay}%</strong><small className="text-[9px] text-slate-400">HÔM NAY</small></span>
                  </div>
                </div>
                <div><p className={`text-xs font-black uppercase tracking-wider ${driverTheme.accent}`}>Tiến độ hoàn thành</p><h3 className="mt-2 text-xl font-black">{donHoanTatHomNay}/{donTrongNgay} đơn</h3><p className="mt-1 text-xs text-slate-400">Cố lên, hoàn thành các nhiệm vụ còn lại!</p></div>
              </section>
              <section className={`rounded-2xl border p-4 ${driverTheme.mission}`}>
                <div className="flex items-center justify-between"><p className={`text-xs font-black uppercase tracking-wider ${driverTheme.missionLabel}`}>{isPickupDriver ? 'Điểm nhận tiếp theo · Gần bạn nhất' : 'Điểm giao tiếp theo · Gần bạn nhất'}</p><Navigation size={16} className={isPickupDriver ? 'text-amber-600' : 'text-blue-600'} /></div>
                {offlineSyncNotice && <p role="status" className="mb-3 rounded-lg bg-amber-100 p-3 text-xs font-bold text-amber-800">{offlineSyncNotice}</p>}
                {nextMission ? <div className="mt-3">
                  <h3 className="font-black text-slate-800">{nextMission.tracking_code}</h3>
                  <p className="mt-1 text-sm text-slate-600">{isPickupDriver ? nextMission.shop_address : nextMission.receiver_address}</p>
                  <p className={`mt-1 text-xs font-bold ${driverTheme.missionLabel}`}>{Number.isFinite(nextMission.distance) ? `${nextMission.distance.toFixed(1)} km từ vị trí gần nhất` : 'Vị trí địa chỉ chưa có'}</p>
                  <button type="button" onClick={() => setTabHienTai('thu-gom')} className={`mt-3 rounded-lg px-4 py-2 text-sm font-bold text-white ${driverTheme.action}`}>Mở nhiệm vụ</button>
                </div> : <p className="mt-3 text-sm text-slate-600">Chưa có nhiệm vụ đang chờ. Hệ thống sẽ cập nhật khi Điều phối giao đơn.</p>}
              </section>
              <button type="button" onClick={() => setShowSos(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 p-4 font-black text-white shadow-md"><Siren size={19} /> SOS · Báo sự cố khẩn cấp</button>
              <button type="button" onClick={() => setTabHienTai('bando')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700"><Map size={17} /> Mở bản đồ vị trí GPS</button>
            </div>
          )}

          {tabHienTai === 'thu-gom' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-black text-base text-slate-800 flex items-center gap-2 mb-1">
                  <Navigation className="text-blue-600" size={18} /> {isPickupDriver ? 'Đơn cần lấy' : 'Đơn cần giao'} ({donDangChay.length})
                </h3>
                {!isPickupDriver && donDangChay.length > 1 && (
                  <button type="button" onClick={toiUuTuyenGiao} className="flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black text-white">
                    <Route size={14} /> Tối ưu đường đi
                  </button>
                )}
              </div>
              {optimizedRouteIds.length > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-indigo-50 p-3 text-xs text-indigo-800">
                  <span>Tuyến đã sắp xếp · ước tính {optimizedRouteDistance.toFixed(1)} km theo đường chim bay</span>
                  <button type="button" onClick={() => { setOptimizedRouteIds([]); setOptimizedRouteDistance(null); }} className="font-black underline">Xóa</button>
                </div>
              )}

              {donDangChay.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center mt-10">
                  <Package size={48} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-700 font-bold">Bạn đã hoàn thành tuyến đường.</p>
                  <p className="text-xs text-slate-400 mt-1">Đang chờ Điều phối viên chia đơn mới...</p>
                </div>
              ) : (
                donTheoTuyen.map((don) => (
                  <div key={don.id} className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden relative">
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${don.status === 'picking' ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
                    <div className="p-5 pl-6">
                      <div className="flex justify-between items-center mb-3 border-b border-slate-50 pb-2">
                        <span className="font-black text-slate-800">{don.tracking_code}</span>
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${don.status === 'picking' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                          {{
                            picking: 'Đang đến Shop',
                            picked_up: 'Đã lấy hàng',
                            transferring_to_central: 'Điều chuyển về kho tổng',
                            transferring_to_destination: 'Điều chuyển về kho con đích',
                            at_destination_warehouse: 'Chờ xuất phát giao',
                            delivering: 'Đang giao'
                          }[don.status]}
                        </span>
                      </div>
                      <div className="space-y-2.5 mb-4 text-sm">
                        <div className="flex items-start gap-2.5">
                          <UserCircle size={16} className="text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-bold text-slate-800">{isPickupDriver ? taskRoute?.label || 'Nhiệm vụ lấy hàng / trung chuyển' : don.receiver_name}</p>
                              {!isPickupDriver && <a href={`tel:${don.receiver_phone}`} className="text-blue-600 font-bold text-xs">{don.receiver_phone}</a>}
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <MapPin size={16} className="text-orange-400 mt-0.5 shrink-0" />
                          <p className="text-slate-600 text-xs leading-relaxed">{isPickupDriver ? diemDen : don.receiver_address}</p>
                        </div>
                        {!isPickupDriver && <div className="bg-slate-50 p-2.5 rounded-xl space-y-1.5 text-xs">
                          <div className="flex justify-between"><span className="font-bold text-slate-500">COD hàng:</span><span>{Number(don.cod_amount || 0).toLocaleString()} đ</span></div>
                          <div className="flex justify-between"><span className="font-bold text-slate-500">Cước vận chuyển:</span><span>{Number(don.shipping_fee || 0).toLocaleString()} đ</span></div>
                          <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="font-black text-slate-700">Tổng cần thu:</span><span className="font-black text-red-500 text-sm">{tinhTongTienCanThu(don).toLocaleString()} đ</span></div>
                        </div>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {don.status === 'picking' ? (
                          <button onClick={() => xacNhanDaLayHang(don)} className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md shadow-blue-200">
                            Mở camera quét mã nhận hàng
                          </button>
                        ) : don.status === 'picked_up' || don.status === 'transferring_to_central' || don.status === 'transferring_to_destination' ? (
                          <p className="col-span-2 rounded-xl bg-amber-50 px-3 py-3 text-center text-xs font-bold text-amber-700">{don.status === 'picked_up' ? 'Đã lấy tại Shop, chờ kho con quét nhận.' : 'Đang trung chuyển, kho nhận sẽ quét khi hàng đến.'}</p>
                        ) : don.status === 'at_destination_warehouse' ? (
                          <button onClick={() => batDauGiaoHang(don.id, don.tracking_code)} className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md shadow-blue-200">
                            Nhận hàng tại kho con và bắt đầu giao
                          </button>
                        ) : (
                          <>
                            <button 
                              onClick={() => setModalXuLy({ mo: true, loai: 'completed', don })} 
                              className="bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1"
                            >
                              <CheckCircle size={14} /> Giao Tới Nơi
                            </button>
                            <button 
                              onClick={() => setModalXuLy({ mo: true, loai: 'returning', don })} 
                              className="bg-red-50 text-red-500 font-bold py-3 rounded-xl text-xs border border-red-100 flex items-center justify-center gap-1"
                            >
                              <XCircle size={14} /> Báo Thất Bại
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tabHienTai === 'bando' && (
            <div className="h-[calc(100vh-220px)] w-full flex flex-col">
              <div className="p-3 bg-blue-50 border-b border-blue-100 text-center text-xs font-bold text-blue-700">🛰️ GPS đang đồng bộ liên tục.</div>
              <MapContainer center={[viTriHienTai.lat, viTriHienTai.lng]} zoom={15} style={{ flex: 1, width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                <Marker position={[viTriHienTai.lat, viTriHienTai.lng]} icon={truckIcon}><Popup><div className="font-bold">Bạn đang ở đây</div></Popup></Marker>
              </MapContainer>
            </div>
          )}

          {tabHienTai === 'handover' && (
            <div className="space-y-4 p-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">Trung chuyển Line-haul</p>
                <h2 className="mt-2 text-lg font-black text-slate-800">Quét mã bao nhận từ kho</h2>
                <p className="mt-1 text-sm text-slate-500">Tài xế xác nhận từng bao đã xếp lên xe. Chuyến bắt đầu sau khi quét đủ toàn bộ bao.</p>
                <button type="button" onClick={() => { setTripBagNotice(''); setScanningTripBags(true); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-black text-white"><ScanLine size={18} /> Mở camera quét bao</button>
                {tripBagNotice && <p role="status" className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm font-bold text-indigo-800">{tripBagNotice}</p>}
              </section>
              {scanningTripBags && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-4"><section className="w-full max-w-md rounded-2xl bg-white p-5">
                <div className="mb-4 flex items-center justify-between"><h3 className="font-black">Quét mã bao Line-haul</h3><button type="button" onClick={() => setScanningTripBags(false)} className="rounded-full bg-slate-100 p-2"><X size={18} /></button></div>
                <div id="driver-linehaul-barcode" />
                {tripBagNotice && <p role="alert" className="mt-3 rounded-lg bg-blue-50 p-3 text-sm font-bold text-blue-800">{tripBagNotice}</p>}
              </section></div>}
            </div>
          )}

          {tabHienTai === 'wallet' && (
            <div className="space-y-4 p-5">
              <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">Ký quỹ bảo đảm đơn COD</p>
                <h2 className="mt-2 text-3xl font-black text-indigo-700">{kyQuy.balance.toLocaleString()} đ</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <p className="rounded-lg bg-indigo-50 p-3 text-indigo-800">Đang giữ: <strong>{kyQuy.reserved.toLocaleString()} đ</strong></p>
                  <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">Khả dụng: <strong>{kyQuy.available.toLocaleString()} đ</strong></p>
                </div>
                <p className="mt-3 text-xs text-slate-500">Ký quỹ được Kế toán cập nhật sau khi xác nhận nhận tiền. Phần đang giữ sẽ được giải phóng khi đơn được chuyển khoản, hoàn hàng hoặc kế toán xác nhận đã nhận COD tiền mặt.</p>
                {kyQuy.available <= 0 && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-800">Ký quỹ khả dụng đã hết; Kế toán cần xác nhận nạp thêm để nhận đơn COD mới.</p>}
              </section>
              <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">Ví COD tiền mặt</p>
                <h2 className="mt-2 text-3xl font-black text-emerald-700">{viTien.toLocaleString()} đ</h2>
                <p className="mt-2 text-sm text-slate-500">Đang chờ Kế toán xác nhận: {tienChoNop.toLocaleString()} đ</p>
                <button type="button" disabled={cashSubmitting || viTien <= 0 || !dangOnline} onClick={nopTienMat} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><Banknote size={18} />{cashSubmitting ? 'Đang gửi yêu cầu...' : 'Yêu cầu nộp tiền mặt'}</button>
                {!dangOnline && <p className="mt-2 text-xs font-semibold text-amber-700">Cần có kết nối mạng để lập phiếu nộp tiền.</p>}
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5"><p className="font-black text-slate-800">Tổng COD và cước đã thu hôm nay</p><p className="mt-2 text-2xl font-black text-red-600">{tongTienThuHo.toLocaleString()} đ</p></section>
              <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
                <h3 className="font-black text-slate-800">Gửi phụ phí và biên lai</h3>
                <p className="mt-1 text-sm text-slate-500">Kế toán duyệt khoản hợp lệ và cộng vào bảng lương tháng phát sinh.</p>
                {expenseNotice && <p role="status" className="mt-3 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-800">{expenseNotice}</p>}
                <form onSubmit={guiYeuCauPhuPhi} className="mt-4 space-y-3">
                  <select name="expense_type" required className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm">
                    <option value="toll">Phí cầu đường</option><option value="parking">Phí gửi xe</option><option value="fuel">Nhiên liệu</option><option value="other">Khác</option>
                  </select>
                  <input name="amount" type="number" required min="1" max="10000000" step="0.01" placeholder="Số tiền (tối đa 10.000.000đ)" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
                  <textarea name="note" required minLength={5} maxLength={500} rows={2} placeholder="Mô tả khoản chi" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
                  <input name="receipt_image" type="file" required accept="image/jpeg,image/png,image/webp" className="w-full text-sm" />
                  <button type="submit" disabled={expenseSubmitting || !dangOnline} className="w-full rounded-xl bg-orange-600 px-4 py-3 font-black text-white disabled:opacity-50">{expenseSubmitting ? 'Đang gửi...' : 'Gửi Kế toán duyệt'}</button>
                  {!dangOnline && <p className="text-xs font-semibold text-amber-700">Cần kết nối mạng để tải ảnh biên lai.</p>}
                </form>
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="mb-3 flex items-center justify-between"><h4 className="font-bold text-slate-700">Lịch sử yêu cầu</h4><button type="button" onClick={() => taiYeuCauPhuPhi().catch((error) => setExpenseNotice(error.message))} className="text-sm font-bold text-blue-700">Làm mới</button></div>
                  <div className="space-y-2">
                    {expenseClaims.map((claim) => <article key={claim.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <div className="flex justify-between gap-2"><strong>{({ toll: 'Cầu đường', parking: 'Gửi xe', fuel: 'Nhiên liệu', other: 'Khác' })[claim.expense_type]}</strong><strong>{Number(claim.amount).toLocaleString()} đ</strong></div>
                      <p className="mt-1 text-slate-600">{claim.note}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">Trạng thái: {claim.status === 'pending' ? 'Chờ duyệt' : claim.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}{claim.review_note ? ` · ${claim.review_note}` : ''}</p>
                    </article>)}
                    {!expenseClaims.length && <p className="text-sm text-slate-500">Chưa có yêu cầu phụ phí.</p>}
                  </div>
                </div>
              </section>
            </div>
          )}

          {tabHienTai === 'canhan' && (
            <div className="p-6 space-y-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <p className="font-bold text-slate-800 text-sm mb-3">Thống kê ca trực</p>
                <div className="flex justify-between py-2 border-b border-slate-50 text-sm">
                  <span className="text-slate-500">Đã giao thành công</span>
                  <span className="font-black text-emerald-500">{donThanhCong.length} đơn</span>
                </div>
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-slate-500">Tổng đã thu (COD + cước)</span>
                  <span className="font-black text-red-500">{tongTienThuHo.toLocaleString()} đ</span>
                </div>
              </div>

              {/* KHU VỰC GỬI ĐƠN NGHỈ PHÉP */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mt-4">
                <p className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-3">
                  <CalendarOff size={18} className="text-rose-500"/> Gửi đơn xin nghỉ phép
                </p>
                <form onSubmit={guiDonNghiPhep}>
                  <textarea 
                    required rows="3"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-rose-400 focus:bg-white transition-colors resize-none mb-3"
                    placeholder="Nhập lý do nghỉ phép, ngày dự kiến nghỉ..."
                    value={lyDoNghi}
                    onChange={(e) => setLyDoNghi(e.target.value)}
                  ></textarea>
                  <button 
                    disabled={dangGuiNghiPhep}
                    className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {dangGuiNghiPhep ? 'Đang gửi...' : <><Send size={16}/> Gửi Yêu Cầu Cho HR</>}
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM NAVIGATION */}
        <div className="absolute bottom-0 left-0 z-50 flex w-full items-center justify-around border-t border-slate-100 bg-white px-1 py-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)]">
          {[
            { id: 'dashboard', label: 'Trang chủ', Icon: House },
            { id: 'thu-gom', label: 'Thu gom', Icon: Package },
            { id: 'handover', label: 'Bàn giao', Icon: PackageCheck },
            { id: 'wallet', label: 'Đối soát', Icon: Banknote },
            { id: 'canhan', label: 'Cá nhân', Icon: UserCircle }
          ].map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => setTabHienTai(id)} className={`flex min-w-0 flex-1 flex-col items-center gap-1 py-1 ${tabHienTai === id ? 'font-bold text-blue-600' : 'font-medium text-slate-400'}`}>
              <Icon size={20} /><span className="text-[9px] uppercase">{label}</span>
            </button>
          ))}
        </div>

        {/* ========================================================= 
            MODAL XỬ LÝ (CHỤP ẢNH & BÁO CÁO) DÀNH CHO APP TÀI XẾ 
            ========================================================= */}
        {donCanQuet && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-lg">Quét mã nhận hàng</h3>
                  <p className="text-xs text-slate-500">Đơn {donCanQuet.tracking_code}</p>
                </div>
                <button onClick={() => setDonCanQuet(null)} className="rounded-full bg-slate-100 p-2 text-slate-600"><X size={18} /></button>
              </div>
              <div id="driver-pickup-barcode" />
              {loiQuetMa && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{loiQuetMa}</p>}
              <p className="mt-3 text-xs text-slate-500">Chỉ trạng thái vận đơn khớp mới được xác nhận nhận hàng.</p>
            </div>
          </div>
        )}
        {showSos && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/80 p-4">
            <form onSubmit={guiBaoCaoSuCo} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-black text-red-700"><Siren size={20} /> Báo cáo sự cố</h3><button type="button" onClick={() => setShowSos(false)} className="rounded-full bg-slate-100 p-2"><X size={18} /></button></div>
              <label className="block text-sm font-bold text-slate-600">Loại sự cố
                <select value={sosType} onChange={(event) => setSosType(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3">
                  <option value="accident">Tai nạn</option><option value="vehicle_breakdown">Hỏng xe</option><option value="traffic">Tắc đường</option><option value="other">Khác</option>
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-600">Mô tả và hỗ trợ cần thiết
                <textarea required maxLength={2000} value={sosDescription} onChange={(event) => setSosDescription(event.target.value)} rows={3} placeholder="Mô tả ngắn gọn tình huống..." className="mt-2 w-full rounded-lg border border-slate-200 p-3" />
              </label>
              <p className="text-xs text-slate-500">Vị trí GPS hiện tại sẽ được gửi kèm khi báo cáo.</p>
              <button type="submit" disabled={sendingSos} className="w-full rounded-xl bg-red-600 px-4 py-3 font-black text-white disabled:opacity-50">{sendingSos ? 'Đang gửi...' : 'Gửi SOS đến Trung tâm'}</button>
            </form>
          </div>
        )}
        {modalXuLy.mo && (
          <div className="fixed inset-0 bg-slate-900/80 z-[100] flex flex-col justify-end">
            <div className="bg-white w-full rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom-full duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className={`font-black text-xl flex items-center gap-2 ${modalXuLy.loai === 'completed' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {modalXuLy.loai === 'completed' ? <CheckCircle /> : <AlertTriangle />}
                  {modalXuLy.loai === 'completed' ? 'Xác Nhận Thành Công' : 'Báo Cáo Thất Bại'}
                </h3>
                <button onClick={dongModal} className="bg-slate-100 p-2 rounded-full text-slate-500"><X size={20}/></button>
              </div>

              <form onSubmit={xacNhanThaoTac} className="space-y-5">
                
                {/* 1. MỤC DÀNH CHO THẤT BẠI: LÝ DO */}
                {modalXuLy.loai === 'returning' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Chọn lý do giao thất bại (*)</label>
                    <select 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 outline-none focus:border-red-400 text-sm font-medium"
                      value={lyDoHuy}
                      onChange={(e) => setLyDoHuy(e.target.value)}
                    >
                      <option value="">-- Nhấp để chọn lý do --</option>
                      <option value="Khách không nghe máy (Đã gọi 3 lần)">Khách không nghe máy (Đã gọi 3 lần)</option>
                      <option value="Sai địa chỉ / Không tìm thấy nhà">Sai địa chỉ / Không tìm thấy nhà</option>
                      <option value="Khách đổi ý không nhận hàng">Khách đổi ý không nhận hàng</option>
                      <option value="Hàng hóa bị móp méo, khách từ chối">Hàng hóa bị hỏng, khách từ chối</option>
                    </select>
                  </div>
                )}

                {/* 2. MỤC DÀNH CHO THÀNH CÔNG: XÁC NHẬN VÀ CHỌN HÌNH THỨC COD */}
                {modalXuLy.loai === 'completed' && (
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                    <label className="mb-3 block text-xs font-black uppercase text-emerald-800" htmlFor="delivery-otp">Mã OTP khách hàng cung cấp (*)</label>
                    <input
                      id="delivery-otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      pattern="[0-9]{4,6}"
                      required
                      value={maOtpGiaoHang}
                      onChange={(event) => setMaOtpGiaoHang(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="mb-4 w-full rounded-xl border border-emerald-200 bg-white p-3 text-center text-2xl font-black tracking-[0.5em]"
                      placeholder="••••"
                    />
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="checkTien"
                        className="w-6 h-6 mt-0.5 accent-emerald-500 rounded"
                        checked={xacNhanTien}
                        onChange={(e) => setXacNhanTien(e.target.checked)}
                      />
                      <label htmlFor="checkTien" className="text-sm">
                        <p className="font-bold text-emerald-800">Xác nhận đã thu đủ số tiền cần thu</p>
                        <p className="font-black text-red-600 text-lg">{tinhTongTienCanThu(modalXuLy.don).toLocaleString()} VNĐ</p>
                      </label>
                    </div>
                    <div className="ml-9 mt-2 space-y-1 text-xs text-emerald-800">
                      <div className="flex justify-between"><span>COD hàng</span><span>{Number(modalXuLy.don?.cod_amount || 0).toLocaleString()} VNĐ</span></div>
                      <div className="flex justify-between"><span>Phí vận chuyển ({modalXuLy.don?.fee_payer === 'receiver' ? 'người nhận trả' : 'người gửi trả'})</span><span>{modalXuLy.don?.fee_payer === 'receiver' ? Number(modalXuLy.don?.shipping_fee || 0).toLocaleString() : '0'} VNĐ</span></div>
                      <div className="flex justify-between border-t border-emerald-200 pt-1 font-black"><span>Tổng cần thu</span><span>{tinhTongTienCanThu(modalXuLy.don).toLocaleString()} VNĐ</span></div>
                    </div>
                    {tinhTongTienCanThu(modalXuLy.don) > 0 && (
                      <fieldset className="mt-4 border-t border-emerald-200 pt-3">
                        <legend className="mb-2 text-xs font-black uppercase text-emerald-800">Hình thức thanh toán</legend>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'cash', label: 'Tiền mặt' },
                            { value: 'bank_transfer', label: 'Chuyển khoản' }
                          ].map((method) => (
                            <label key={method.value} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-bold ${phuongThucCOD === method.value ? 'border-emerald-500 bg-white text-emerald-800' : 'border-emerald-100 bg-emerald-50/50 text-slate-600'}`}>
                              <input
                                type="radio"
                                name="cod_payment_method"
                                value={method.value}
                                checked={phuongThucCOD === method.value}
                                onChange={(event) => setPhuongThucCOD(event.target.value)}
                                className="accent-emerald-600"
                              />
                              {method.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}
                    <div className="mt-4 border-t border-emerald-200 pt-3">
                      <div className="mb-2 flex items-center justify-between">
                        <label htmlFor="recipient-signature" className="text-xs font-black uppercase text-emerald-800">Chữ ký người nhận (*)</label>
                        <button type="button" onClick={xoaChuKy} className="text-xs font-bold text-slate-500 underline">Xóa chữ ký</button>
                      </div>
                      <canvas
                        id="recipient-signature"
                        ref={signatureCanvasRef}
                        width={600}
                        height={180}
                        onPointerDown={batDauVeChuKy}
                        onPointerMove={veChuKy}
                        className="h-36 w-full touch-none rounded-lg border border-emerald-200 bg-white"
                        aria-label="Vùng ký xác nhận của người nhận"
                      />
                      <p className="mt-1 text-[11px] text-emerald-800">Người nhận ký trực tiếp trên màn hình. Chữ ký được tải lên cùng ảnh minh chứng khi có kết nối mạng.</p>
                    </div>
                  </div>
                )}

                {/* 3. BẮT BUỘC CHỤP ẢNH MINH CHỨNG */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Ảnh chụp bằng chứng (*)</label>
                  {!anhPreview ? (
                    <div className="relative w-full h-32 border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl flex flex-col items-center justify-center overflow-hidden">
                      <Camera className="text-blue-500 mb-2" size={32} />
                      <span className="text-sm font-bold text-blue-600">Mở Camera Chụp Ảnh</span>
                      {/* Cú pháp capture="environment" sẽ tự động mở Camera mặt sau trên điện thoại */}
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        onChange={xuLyChonAnh}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <img src={anhPreview} alt="Preview" className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                      <button 
                        type="button"
                        onClick={() => { setAnhMinhChung(null); setAnhPreview(null); }}
                        className="absolute top-2 right-2 bg-slate-900/60 text-white p-2 rounded-full"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-2 italic">
                    {modalXuLy.loai === 'completed' 
                      ? "Ghi chú: Vui lòng chụp rõ kiện hàng đặt tại địa chỉ khách."
                      : "Ghi chú: Chụp ảnh cuộc gọi nhỡ hoặc chụp địa chỉ nhà khóa kín."}
                  </p>
                </div>

                {/* NÚT SUBMIT */}
                <button 
                  type="submit" 
                  disabled={dangCapNhat}
                  className={`w-full font-black py-4 rounded-xl text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                    modalXuLy.loai === 'completed' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {dangCapNhat ? 'ĐANG ĐỒNG BỘ...' : (
                    <><ShieldCheck size={20}/> GỬI BÁO CÁO VỀ TRUNG TÂM</>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}