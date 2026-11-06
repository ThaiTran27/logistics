import { API_URL, apiFetch as fetch } from '../../utils/apiFetch.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import QRCode from 'react-qr-code';
import { io } from 'socket.io-client';
import { MapPin, Package, PackageCheck, CheckCircle, XCircle, LogOut, Navigation, Wallet, UserCircle, Bike, Map as MapIcon, Send, CalendarOff, Camera, AlertTriangle, X, ShieldCheck, House, Banknote, Siren, Wifi, WifiOff, ScanLine, Route, Truck, MessageCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { GOVAP_MAP_CENTER, MAP_ATTRIBUTION, MAP_TILE_URL } from '../../utils/govapMap.js';
import { OrderStatusBadge } from '../../utils/orderStatus.jsx';

import iconMarkerUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import DriverOrderChat from '../../Layouts/DriverOrderChat.jsx';
const truckIcon = new L.Icon({
  iconUrl: iconMarkerUrl,
  shadowUrl: iconShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
const routeStopIcon = (sequence, mode) => new L.DivIcon({
  className: 'route-stop-marker',
  html: `<span style="display:grid;place-items:center;width:30px;height:30px;border:2px solid white;border-radius:50%;background:${mode === 'pickup' ? '#d97706' : '#2563eb'};color:white;font-weight:900;box-shadow:0 1px 5px #334155">${sequence}</span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const tinhTongTienCanThu = (order) => Number(order?.cod_amount || 0)
  + (order?.fee_payer === 'receiver' ? Number(order?.shipping_fee || 0) : 0);
const MAX_EVIDENCE_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_EVIDENCE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function prepareEvidenceImage(file) {
  if (!ACCEPTED_EVIDENCE_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Ảnh cần có định dạng JPG, PNG hoặc WEBP.');
  }

  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    image.close();
    throw new Error('Thiết bị không thể xử lý ảnh chụp.');
  }
  try {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  } finally {
    image.close();
  }

  for (const quality of [0.82, 0.68, 0.54, 0.4]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= MAX_EVIDENCE_IMAGE_BYTES) {
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'evidence';
      return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
    }
  }
  throw new Error('Ảnh quá lớn, vui lòng chụp lại hoặc chọn ảnh nhỏ hơn 8 MB.');
}

const tinhTienTheoHangDaQuet = (order, quantities = {}) => {
  const items = order?.order_items;
  if (!Array.isArray(items) || items.length === 0) return tinhTongTienCanThu(order);
  const cod = items
    .filter((item) => item.direction === 'outbound')
    .reduce((total, item) => total
      + (Number(quantities[item.id] || 0) * Number(item.unit_cod_amount || 0)), 0);
  const deliveredCount = items
    .filter((item) => item.direction === 'outbound')
    .reduce((total, item) => total + Number(quantities[item.id] || 0), 0);
  return cod + (deliveredCount > 0 && order?.fee_payer === 'receiver'
    ? Number(order?.shipping_fee || 0)
    : 0);
};
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
const socket = io(API_URL, {
  auth: { token: localStorage.getItem('access_token') }
});

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

function LinehaulDriverApp({ disabled = false }) {
  if (disabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-md rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-black text-slate-800">Tuyến liên kho đã tắt</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Hệ thống hiện chỉ vận hành giao nhận trong 6 phường Gò Vấp qua một kho tổng.</p>
        </div>
      </div>
    );
  }
  return <LinehaulDriverAppContent />;
}

function LinehaulDriverAppContent() {
  const driverName = localStorage.getItem('full_name') || 'Tài xế xe tải';
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [manualBagCode, setManualBagCode] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const scanBusyRef = useRef(false);
  const activeTrip = trips.find((trip) => String(trip.id) === selectedTripId) || trips[0] || null;
  const activeTripId = activeTrip?.id;
  const activeTripStatus = activeTrip?.status;
  const destinationCoordinates = activeTrip
    && Number.isFinite(Number(activeTrip.destination_lat))
    && Number.isFinite(Number(activeTrip.destination_lng))
    && activeTrip.destination_lat !== null && activeTrip.destination_lat !== ''
    && activeTrip.destination_lng !== null && activeTrip.destination_lng !== ''
    ? [Number(activeTrip.destination_lat), Number(activeTrip.destination_lng)]
    : null;
  const currentCoordinates = currentLocation ? [currentLocation.lat, currentLocation.lng] : null;

  const taiChuyenXe = useCallback(async () => {
    try {
      const response = await fetch('/api/driver/trips');
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
      const response = await fetch('/api/driver/trips/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bag_code: bagCode })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể xác nhận bao.');
      setNotice(data.message);
      await taiChuyenXe();
      if (data.trip_ready) setScanning(false);
      return true;
    } catch (scanError) {
      setError(scanError.message || 'Không thể xác nhận bao.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [taiChuyenXe]);

  const xacNhanMaBaoThuCong = async (event) => {
    event.preventDefault();
    const bagCode = manualBagCode.trim();
    if (!bagCode || busy) return;
    if (await xacNhanQuetBao(bagCode)) setManualBagCode('');
  };

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
      const response = await fetch(`/api/driver/trips/${activeTrip.id}/start`, { method: 'POST' });
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
      const response = await fetch(`/api/driver/trips/${activeTrip.id}/arrive`, { method: 'POST' });
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
        const response = await fetch(`/api/driver/trips/${activeTripId}/location`, {
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
    <main className="min-h-screen bg-slate-100 p-4 pb-10 text-slate-800 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <header className="rounded-3xl bg-gradient-to-r from-slate-800 to-indigo-800 p-6 text-white shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-sm font-bold text-indigo-200">SMART LOGISTICS · LINE-HAUL</p><h1 className="mt-2 text-2xl font-black">Xin chào, {driverName}</h1><p className="mt-1 text-sm text-slate-300">Ứng dụng tài xế trung chuyển liên kho</p></div>
            <button type="button" onClick={dangXuat} className="shrink-0 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">Đăng xuất</button>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
            <div className="rounded-xl bg-white/10 p-3"><strong className="block text-xl">{trips.length}</strong>Chuyến đang giao</div>
            <div className="rounded-xl bg-white/10 p-3"><strong className="block text-xl">{trips.filter((trip) => trip.status === 'in_transit').length}</strong>Đang di chuyển</div>
            <div className="rounded-xl bg-white/10 p-3"><strong className="block text-xl">{trips.reduce((sum, trip) => sum + Number(trip.bag_count || 0), 0)}</strong>Bao hàng</div>
          </div>
        </header>
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">{notice}</p>}
        <div className="mt-5 flex items-center justify-between"><h2 className="text-xl font-black">Chuyến được phân công</h2><button type="button" onClick={taiChuyenXe} className="rounded-lg bg-white px-4 py-2 text-sm font-bold shadow-sm">Làm mới</button></div>
        {!trips.length ? <div className="mt-4 rounded-2xl bg-white p-8 text-center shadow-sm"><Truck size={36} className="mx-auto text-slate-300" /><p className="mt-3 font-bold text-slate-700">Chưa có chuyến xe được phân công</p><p className="mt-1 text-sm text-slate-500">Các chuyến mới sẽ xuất hiện tại đây sau khi điều phối viên phân công.</p></div> : (
          <>
            {trips.length > 1 && <label className="mt-4 block text-sm font-bold">Chọn chuyến
              <select value={activeTrip?.id || ''} onChange={(event) => setSelectedTripId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3">
                {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.trip_code} · {trip.source_warehouse_name} → {trip.destination_warehouse_name}</option>)}
              </select>
            </label>}
            {activeTrip && <article className="mt-4 space-y-5 rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-xs font-black uppercase text-indigo-600">{activeTrip.trip_code}</p><h3 className="mt-1 text-xl font-black">{activeTrip.source_warehouse_name} → {activeTrip.destination_warehouse_name}</h3><p className="mt-1 text-sm text-slate-500">{activeTrip.vehicle_plate}</p></div>
                <span className={`rounded-full px-3 py-2 text-sm font-black ${activeTrip.status === 'in_transit' ? 'bg-blue-100 text-blue-800' : activeTrip.status === 'arrived' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{activeTrip.status === 'in_transit' ? 'Đang di chuyển' : activeTrip.status === 'arrived' ? 'Đã đến kho' : 'Chờ bốc hàng'}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs font-bold uppercase text-slate-500">Tổng số bao</p><p className="mt-1 text-lg font-black">{activeTrip.bag_count || 0} bao</p></div>
                <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs font-bold uppercase text-slate-500">Tổng tải trọng</p><p className="mt-1 text-lg font-black">{Number(activeTrip.total_weight_kg || 0).toLocaleString('vi-VN')} / {Number(activeTrip.max_payload_kg || 0).toLocaleString('vi-VN')} kg</p></div>
                <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs font-bold uppercase text-slate-500">Biển số xe</p><p className="mt-1 text-lg font-black">{activeTrip.vehicle_plate}</p></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Kho xuất phát</p><p className="mt-1 font-bold">{activeTrip.source_warehouse_name}</p><p className="mt-1 text-sm text-slate-500">{activeTrip.source_warehouse_address || 'Chưa có địa chỉ kho'}</p></div>
                <div className="rounded-xl bg-indigo-50 p-4"><p className="text-xs font-black uppercase text-indigo-600">Kho nhận hàng</p><p className="mt-1 font-bold text-indigo-950">{activeTrip.destination_warehouse_name}</p><p className="mt-1 text-sm text-indigo-800">{activeTrip.destination_warehouse_address || 'Chưa có địa chỉ kho'}</p>{destinationCoordinates && <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-700"><MapPin size={14} /> {destinationCoordinates[0].toFixed(5)}, {destinationCoordinates[1].toFixed(5)}</p>}</div>
              </div>
              {destinationCoordinates && <div className="relative z-0 isolate overflow-hidden rounded-xl border border-slate-200">
                <MapContainer key={activeTrip.id} center={currentCoordinates || destinationCoordinates} zoom={currentCoordinates ? 11 : 13} scrollWheelZoom={false} className="relative z-0 h-56 w-full rounded-xl sm:h-64">
                  <InvalidateMapSize />
                  <TileLayer attribution={MAP_ATTRIBUTION} url={MAP_TILE_URL} />
                  <Marker position={destinationCoordinates} icon={truckIcon}><Popup>{activeTrip.destination_warehouse_name}</Popup></Marker>
                  {currentCoordinates && <><Marker position={currentCoordinates} icon={truckIcon}><Popup>Vị trí xe hiện tại</Popup></Marker><Polyline positions={[currentCoordinates, destinationCoordinates]} pathOptions={{ color: '#4f46e5', weight: 4, dashArray: '8 8' }} /></>}
                </MapContainer>
                <p className="bg-white px-3 py-2 text-xs text-slate-500">{currentCoordinates ? 'Đường thẳng tham khảo giữa vị trí xe và kho đích; mở bản đồ để xem tuyến đường.' : 'Vị trí kho đích; cần bật GPS để xem vị trí xe trên bản đồ.'}</p>
              </div>}
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between"><strong>Kiểm tra bao lên xe</strong><span className="font-black text-indigo-700">{activeTrip.scanned_bag_count || 0}/{activeTrip.bag_count || 0}</span></div>
                <div className="mt-3 space-y-2">{(activeTrip.bags || []).map((bag) => <div key={bag.bag_id} className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 text-sm"><span><span className="font-mono font-bold">{bag.bag_code}</span><small className="mt-1 block text-slate-500">{bag.order_count} đơn · {Number(bag.weight_kg || 0).toLocaleString('vi-VN')} kg</small></span><span className={bag.driver_scanned_at ? 'shrink-0 font-bold text-emerald-700' : 'shrink-0 font-bold text-amber-700'}>{bag.driver_scanned_at ? 'Đã quét' : 'Chưa quét'}</span></div>)}</div>
              </div>
              {['planned', 'loading'].includes(activeTrip.status) && <>
                <form onSubmit={xacNhanMaBaoThuCong} className="space-y-2">
                  <label htmlFor="manual-linehaul-bag-code" className="block text-sm font-bold">Không quét được? Nhập mã bao</label>
                  <div className="flex gap-2">
                    <input id="manual-linehaul-bag-code" type="text" value={manualBagCode} onChange={(event) => setManualBagCode(event.target.value)} placeholder="Nhập mã bao" autoCapitalize="characters" autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono uppercase outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                    <button type="submit" disabled={busy || !manualBagCode.trim() || Number(activeTrip.scanned_bag_count) >= Number(activeTrip.bag_count)} className="shrink-0 rounded-xl bg-slate-800 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Xác nhận</button>
                  </div>
                </form>
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
  return role === 'linehaul_driver' ? <LinehaulDriverApp disabled /> : <MotorcycleDriverApp />;
}

function MotorcycleDriverApp() {
  const [donHang, setDonHang] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersLoadError, setOrdersLoadError] = useState('');
  const [chatOrder, setChatOrder] = useState(null);
  const [tabHienTai, setTabHienTai] = useState('dashboard');
  const [viTien, setViTien] = useState(0);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletLoadError, setWalletLoadError] = useState('');
  const [tienChoNop, setTienChoNop] = useState(0);
  const [kyQuy, setKyQuy] = useState({ balance: 0, reserved: 0, available: 0 });
  const [thuNhapThamKhao, setThuNhapThamKhao] = useState(null);
  const [dangOnline, setDangOnline] = useState(navigator.onLine);
  const [apiDisconnected, setApiDisconnected] = useState(false);
  const [offlineSyncNotice, setOfflineSyncNotice] = useState('');
  const [showSos, setShowSos] = useState(false);
  const [sosType, setSosType] = useState('vehicle_breakdown');
  const [sosOrderId, setSosOrderId] = useState('');
  const [sosDescription, setSosDescription] = useState('');
  const [sosEvidence, setSosEvidence] = useState(null);
  const [sosEvidencePreview, setSosEvidencePreview] = useState('');
  const [cameraTarget, setCameraTarget] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const cameraVideoRef = useRef(null);
  const [sendingSos, setSendingSos] = useState(false);
  const [scanningTripBags, setScanningTripBags] = useState(false);
  const [tripBagNotice, setTripBagNotice] = useState('');
  const [cashSubmitting, setCashSubmitting] = useState(false);
  const [expenseClaims, setExpenseClaims] = useState([]);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseNotice, setExpenseNotice] = useState('');
  const [viTriHienTai, setViTriHienTai] = useState({ lat: GOVAP_MAP_CENTER[0], lng: GOVAP_MAP_CENTER[1] });
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeRequestResult, setRouteRequestResult] = useState(null);
  const [driverRouteGeometry, setDriverRouteGeometry] = useState(null);
  const [driverRoute, setDriverRoute] = useState({});
  const [routeLoadError, setRouteLoadError] = useState('');
  const [routeReorderBusy, setRouteReorderBusy] = useState(false);
  const [draggedStopId, setDraggedStopId] = useState(null);
  
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
  const [ghiChuXuLy, setGhiChuXuLy] = useState('');
  const [submitErrors, setSubmitErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [deliveryScanQuantities, setDeliveryScanQuantities] = useState({});
  const [returnScanQuantities, setReturnScanQuantities] = useState({});
  const [scanItemMode, setScanItemMode] = useState(false);
  const [itemScanMessage, setItemScanMessage] = useState('');
  const deliveryScanQuantitiesRef = useRef({});
  const returnScanQuantitiesRef = useRef({});

  useEffect(() => {
    if (!cameraTarget || !cameraStream || !cameraVideoRef.current) return undefined;
    const video = cameraVideoRef.current;
    video.srcObject = cameraStream;
    video.play().catch(() => {
      if (cameraTarget) alert('Không thể bật camera. Vui lòng kiểm tra quyền truy cập camera của trình duyệt.');
    });
    return () => {
      video.srcObject = null;
      cameraStream.getTracks().forEach((track) => track.stop());
    };
  }, [cameraTarget, cameraStream]);
  const [failureReasonCodes, setFailureReasonCodes] = useState({ PICKUP: [], DELIVERY: [] });
  const [reasonCodeError, setReasonCodeError] = useState('');
  const [xacNhanTien, setXacNhanTien] = useState(false);
  const [phuongThucCOD, setPhuongThucCOD] = useState('');
  const [dangCapNhat, setDangCapNhat] = useState(false);
  const [donCanQuet, setDonCanQuet] = useState(null);
  const [loiQuetMa, setLoiQuetMa] = useState('');
  const [maVanDonNhapTay, setMaVanDonNhapTay] = useState('');
  const [dangXacNhanMaQuet, setDangXacNhanMaQuet] = useState(false);
  const pickupScanBusyRef = useRef(false);
  const itemScanBusyRef = useRef(false);
  const formRef = useRef(null);
  const submitLockRef = useRef(false);

  const driverId = localStorage.getItem('user_id');
  const driverRole = localStorage.getItem('role') || localStorage.getItem('user_role');
  const isPickupDriver = driverRole === 'pickup_driver';
  const failureReasonGroup = modalXuLy.loai === 'pickup_failed' ? 'PICKUP' : 'DELIVERY';
  const selectedFailureReason = failureReasonCodes[failureReasonGroup]
    .find((reason) => reason.code === lyDoHuy);
  const resetFormErrors = () => {
    setSubmitErrors({});
    setSubmitError('');
    setGhiChuXuLy('');
    setLyDoHuy('');
    setSignatureDrawn(false);
    setAnhMinhChung(null);
    setAnhPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };
  const moModalGiaoHang = (don) => {
    resetFormErrors();
    const items = Array.isArray(don.order_items) ? don.order_items : [];
    const deliveryQuantities = Object.fromEntries(
      items.filter((item) => item.direction === 'outbound').map((item) => [item.id, ''])
    );
    const returnQuantities = Object.fromEntries(
      items.filter((item) => item.direction === 'exchange_in').map((item) => [item.id, ''])
    );
    deliveryScanQuantitiesRef.current = deliveryQuantities;
    returnScanQuantitiesRef.current = returnQuantities;
    setDeliveryScanQuantities(deliveryQuantities);
    setReturnScanQuantities(returnQuantities);
    setItemScanMessage('');
    setScanItemMode(false);
    setModalXuLy({ mo: true, loai: 'completed', don });
  };
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
  const diemDi = taskRoute?.origin?.address || (taskRoute?.origin ? `${taskRoute.origin.lat},${taskRoute.origin.lng}` : `${GOVAP_MAP_CENTER[0]},${GOVAP_MAP_CENTER[1]}`);
  const tenKho = routeInfo?.warehouse?.address || 'Kho trung tâm Smart Logistics, TP. Hồ Chí Minh';
  const diemDen = taskRoute?.destination?.address || (taskRoute?.destination ? `${taskRoute.destination.lat},${taskRoute.destination.lng}` : tenKho);
  const routeOrigin = taskRoute?.origin;
  const routeDestination = taskRoute?.destination;
  const originLat = Number(routeOrigin?.lat);
  const originLng = Number(routeOrigin?.lng);
  const destinationLat = Number(routeDestination?.lat);
  const destinationLng = Number(routeDestination?.lng);
  const routeRequestKey = `${originLat},${originLng};${destinationLat},${destinationLng}`;
  const currentRouteResult = routeRequestResult?.key === routeRequestKey ? routeRequestResult : null;
  const directions = currentRouteResult?.directions || null;
  const directionsError = currentRouteResult?.error || '';
  const routeGeometry = directions?.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || [];

  useEffect(() => {
    Promise.all(['PICKUP', 'DELIVERY'].map(async (group) => {
      const response = await fetch(`/api/reason-codes?group_type=${group}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || `Không tải được lý do ${group}.`);
      return [group, result.data || []];
    })).then((groups) => {
      setFailureReasonCodes(Object.fromEntries(groups));
      setReasonCodeError('');
    }).catch((error) => setReasonCodeError(error.message || 'Không tải được danh sách lý do.'));
  }, []);

  useEffect(() => {
    if (!Number.isFinite(originLat) || !Number.isFinite(originLng)
      || !Number.isFinite(destinationLat) || !Number.isFinite(destinationLng)) {
      return undefined;
    }
    const controller = new AbortController();
    fetch(`${API_URL}/api/map/route?from=${originLat},${originLng}&to=${destinationLat},${destinationLng}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Không lấy được chỉ đường.');
        setRouteRequestResult({ key: routeRequestKey, directions: result.data, error: '' });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setRouteRequestResult({
            key: routeRequestKey,
            directions: null,
            error: error.message || 'Không kết nối được dịch vụ chỉ đường nội bộ.'
          });
        }
      });
    return () => controller.abort();
  }, [originLat, originLng, destinationLat, destinationLng, routeRequestKey]);

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

  const taiLoTrinh = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/driver/route/today`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không tải được lộ trình.');
      setDriverRoute(result.data || {});
      setRouteLoadError('');
      return result.data || {};
    } catch (error) {
      setRouteLoadError(error.message || 'Không tải được lộ trình.');
      throw error;
    }
  }, []);

  const taiDuLieu = useCallback(async () => {
    if (!driverId) {
      setOrdersLoading(false);
      setOrdersLoadError('Không tìm thấy tài khoản tài xế trong phiên đăng nhập. Hãy đăng nhập lại.');
      return;
    }
    setOrdersLoading(true);
    setOrdersLoadError('');
    try {
      const res = await fetch(`/api/orders/shipper/${driverId}`);
      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.data)) {
        throw new Error(data.message || 'Không tải được danh sách đơn hàng.');
      }
      setDonHang(data.data);
      await taiLoTrinh().catch((routeError) => console.error('Không tải được lộ trình tài xế:', routeError));
      const activeStatuses = isPickupDriver
        ? ['picking', 'picked_up', 'transferring_to_central', 'transferring_to_destination']
        : ['at_central_warehouse', 'at_destination_warehouse', 'delivering', 'returning'];
      const firstActiveOrder = data.data.find((item) => activeStatuses.includes(item.status));
      if (firstActiveOrder) {
        const routeRes = await fetch(`/api/orders/${firstActiveOrder.id}/route`);
        const routeData = await routeRes.json();
        if (routeRes.ok && routeData.success) {
          setRouteInfo(routeData.data || null);
          if (['transferring_to_central', 'transferring_to_destination', 'returning'].includes(firstActiveOrder.status)) {
            batDauPhatToaDo(firstActiveOrder.id, firstActiveOrder.tracking_code);
          }
        }
      }
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
      setOrdersLoadError(error.message || 'Không tải được dữ liệu tài xế.');
    } finally {
      setOrdersLoading(false);
    }
  }, [driverId, isPickupDriver, batDauPhatToaDo, taiLoTrinh]);

  const doiThuTuLoTrinh = useCallback(async (mode, stopIds) => {
    const reason = window.prompt('Lý do đổi thứ tự điểm dừng:');
    if (!reason?.trim()) return;
    setRouteReorderBusy(true);
    try {
      const response = await fetch(`${API_URL}/api/driver/route/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, ordered_stop_ids: stopIds, override_reason: reason.trim() })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không lưu được thứ tự tuyến.');
      await taiLoTrinh();
    } catch (error) {
      window.alert(error.message || 'Không lưu được thứ tự tuyến.');
    } finally {
      setRouteReorderBusy(false);
      setDraggedStopId(null);
    }
  }, [taiLoTrinh]);

  const taiViTien = useCallback(async () => {
    if (!driverId) {
      setWalletLoading(false);
      setWalletLoadError('Không tìm thấy tài khoản tài xế trong phiên đăng nhập.');
      return;
    }
    setWalletLoading(true);
    setWalletLoadError('');
    try {
      const response = await fetch(`/api/driver/wallet/${driverId}`);
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
      setWalletLoadError(error.message || 'Không tải được số dư COD.');
    } finally {
      setWalletLoading(false);
    }
  }, [driverId]);

  const taiThuNhapThamKhao = useCallback(async () => {
    if (!driverId) return;
    try {
      const response = await fetch(`${API_URL}/api/driver/payroll/estimate`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không tải được thu nhập tham khảo.');
      setThuNhapThamKhao(data.data);
    } catch (error) {
      console.error('Không tải được thu nhập tham khảo:', error);
    }
  }, [driverId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void taiThuNhapThamKhao(); }, 0);
    return () => window.clearTimeout(timer);
  }, [taiThuNhapThamKhao]);

  const taiYeuCauPhuPhi = useCallback(async () => {
    if (!driverId) return;
    const response = await fetch('/api/driver/expense-claims');
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
    const apiConnectionHandler = (event) => {
      const online = Boolean(event.detail?.online);
      setApiDisconnected(!online);
      if (online) {
        void taiViTien();
        void taiDuLieu();
      }
    };
    const serviceWorkerMessage = (event) => {
      if (event.data?.type !== 'DRIVER_ACTION_SYNCED') return;
      setOfflineSyncNotice(event.data.success
        ? 'Thao tác đã đồng bộ thành công.'
        : event.data.message || 'Một thao tác offline cần được kiểm tra thủ công.');
      if (event.data.success) taiDuLieu();
    };
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    window.addEventListener('api-connection-status', apiConnectionHandler);
    navigator.serviceWorker?.addEventListener('message', serviceWorkerMessage);
    navigator.serviceWorker?.controller?.postMessage({
      type: 'SYNC_DRIVER_ACTIONS',
      token: localStorage.getItem('access_token')
    });
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
      window.removeEventListener('api-connection-status', apiConnectionHandler);
      navigator.serviceWorker?.removeEventListener('message', serviceWorkerMessage);
    };
  }, [taiDuLieu, taiViTien]);

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
    const routeUpdated = () => taiLoTrinh().catch((error) => console.error('Không tải được tuyến mới:', error));
    socket.on(`new_order_assigned_${driverId}`, orderAssigned);
    socket.on('driver_route_updated', routeUpdated);

    return () => {
      window.clearTimeout(initialLoad);
      socket.off(`new_order_assigned_${driverId}`, orderAssigned);
      socket.off('driver_route_updated', routeUpdated);
    };
  }, [driverId, isPickupDriver, taiDuLieu, taiViTien, taiLoTrinh]);

  const xacNhanDaLayHang = (order) => {
    setLoiQuetMa('');
    setMaVanDonNhapTay('');
    setDonCanQuet(order);
  };

  const xacNhanMaVanDon = useCallback(async (decodedText) => {
    if (!donCanQuet || pickupScanBusyRef.current) return;
    const scannedCode = String(decodedText || '').trim().toUpperCase();
    const expectedCode = String(donCanQuet.tracking_code || '').trim().toUpperCase();
    if (!scannedCode) {
      setLoiQuetMa('Không đọc được mã. Hãy thử lại hoặc nhập mã vận đơn bên dưới.');
      return;
    }
    if (scannedCode !== expectedCode) {
      setLoiQuetMa('Mã quét không khớp với vận đơn đang nhận. Vui lòng quét lại đúng nhãn.');
      return;
    }

    pickupScanBusyRef.current = true;
    setDangXacNhanMaQuet(true);
    setLoiQuetMa('');
    try {
      const response = await fetch(`/api/orders/${donCanQuet.id}/status`, {
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
      setMaVanDonNhapTay('');
      const routeResponse = await fetch(`/api/orders/${donCanQuet.id}/route`);
      const routeResult = await routeResponse.json();
      if (routeResult.success) setRouteInfo(routeResult.data);
      alert(result.offline_queued
        ? 'Đã lưu xác nhận lấy hàng trên thiết bị. Tự động đồng bộ khi mạng quay lại.'
        : 'Đã xác nhận đúng mã vận đơn. Vui lòng bàn giao kiện hàng cho Thủ kho quét nhập.');
      taiDuLieu();
    } catch (error) {
      setLoiQuetMa(error.message || 'Lỗi kết nối máy chủ.');
    } finally {
      pickupScanBusyRef.current = false;
      setDangXacNhanMaQuet(false);
    }
  }, [donCanQuet, driverId, batDauPhatToaDo, taiDuLieu]);

  useEffect(() => {
    if (!donCanQuet) return undefined;
    let active = true;
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
      if (active) await xacNhanMaVanDon(decodedText);
    }, () => {});
    return () => {
      active = false;
      scanner.clear().catch((error) => console.warn('Không thể dừng camera quét mã:', error));
    };
  }, [donCanQuet, xacNhanMaVanDon]);

  useEffect(() => {
    if (!scanItemMode || !modalXuLy.mo || modalXuLy.loai !== 'completed' || !modalXuLy.don) return undefined;
    let active = true;
    const scanner = new Html5QrcodeScanner('driver-order-item-scanner', {
      fps: 8,
      qrbox: { width: 220, height: 160 },
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39
      ],
      rememberLastUsedCamera: false
    }, false);
    scanner.render((decodedText) => {
      if (!active || itemScanBusyRef.current) return;
      itemScanBusyRef.current = true;
      const match = decodedText.trim().match(/^ORDER_ITEM:(\d+):(\d+):(OUT|IN)$/);
      const orderId = Number(modalXuLy.don.id);
      const itemId = Number(match?.[2]);
      const direction = match?.[3] === 'OUT' ? 'outbound' : 'exchange_in';
      const item = modalXuLy.don.order_items.find((entry) => Number(entry.id) === itemId
        && entry.direction === direction);
      if (!match || Number(match[1]) !== orderId || !item) {
        setItemScanMessage('Mã không thuộc đơn hàng hoặc không đúng chiều giao/thu hồi.');
      } else if (direction === 'outbound') {
        const count = Number(deliveryScanQuantitiesRef.current[item.id] || 0);
        if (count >= Number(item.quantity)) {
          setItemScanMessage(`Đã quét đủ số lượng giao "${item.item_name}".`);
        } else {
          const next = { ...deliveryScanQuantitiesRef.current, [item.id]: String(count + 1) };
          deliveryScanQuantitiesRef.current = next;
          setDeliveryScanQuantities(next);
          setItemScanMessage(`Đã quét giao ${count + 1}/${item.quantity}: ${item.item_name}.`);
        }
      } else {
        const count = Number(returnScanQuantitiesRef.current[item.id] || 0);
        if (count >= Number(item.quantity)) {
          setItemScanMessage(`Đã quét đủ số lượng thu hồi "${item.item_name}".`);
        } else {
          const next = { ...returnScanQuantitiesRef.current, [item.id]: String(count + 1) };
          returnScanQuantitiesRef.current = next;
          setReturnScanQuantities(next);
          setItemScanMessage(`Đã quét thu hồi ${count + 1}/${item.quantity}: ${item.item_name}.`);
        }
      }
      window.setTimeout(() => { itemScanBusyRef.current = false; }, 1000);
    }, () => {});
    return () => {
      active = false;
      scanner.clear().catch((error) => console.error('Không thể dừng camera quét mặt hàng:', error));
    };
  }, [scanItemMode, modalXuLy.mo, modalXuLy.loai, modalXuLy.don]);

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
        const response = await fetch('/api/driver/trips/scan', {
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
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivering', user_id: driverId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        batDauPhatToaDo(orderId, trackingCode);
        const routeRes = await fetch(`/api/orders/${orderId}/route`);
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
    const today = new Date().toISOString().slice(0, 10);
    const workDate = window.prompt('Ngày làm việc của các đơn COD cần nộp (YYYY-MM-DD):', today);
    if (workDate === null) return;
    setCashSubmitting(true);
    try {
      const expectedResponse = await fetch(
        `/api/driver/cash-remittances/expected?work_date=${encodeURIComponent(workDate)}`
      );
      const expectedData = await expectedResponse.json();
      if (!expectedResponse.ok || !expectedData.success) {
        throw new Error(expectedData.message || 'Không tính được số COD phải nộp trong ngày.');
      }
      const expected = BigInt(String(expectedData.data.expected_amount || '0'));
      if (expected <= 0n || !expectedData.data.order_count) {
        throw new Error('Không có đơn COD tiền mặt chưa nộp trong ngày làm việc này.');
      }
      const actualAmount = window.prompt(
        `Số tiền phải nộp ${expected.toLocaleString('vi-VN')} đ cho ${expectedData.data.order_count} đơn. Nhập số nguyên VND không dấu phân cách:`,
        expected.toString()
      );
      if (actualAmount === null) return;
      const normalizedActual = actualAmount.trim();
      if (!/^\d+$/.test(normalizedActual)) {
        throw new Error('Số tiền thực nộp không hợp lệ.');
      }
      const actualValue = BigInt(normalizedActual);
      let varianceReason = '';
      if (actualValue !== expected) {
        const reason = window.prompt('Nhập lý do chênh lệch tiền nộp (ít nhất 5 ký tự):', '');
        if (reason === null) return;
        varianceReason = reason.trim();
        if (varianceReason.length < 5) throw new Error('Lý do chênh lệch cần tối thiểu 5 ký tự.');
      }
      if (!window.confirm(`Gửi phiếu nộp ${actualValue.toLocaleString('vi-VN')} đ cho Kế toán xác nhận?`)) return;
      const response = await fetch('/api/driver/cash-remittances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: Number(driverId),
          work_date: workDate,
          actual_amount: actualValue.toString(),
          variance_reason: varianceReason
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể tạo phiếu nộp tiền.');
      alert(`${data.message} Thực nộp: ${BigInt(data.data.actualAmount).toLocaleString('vi-VN')} đ; phải nộp: ${BigInt(data.data.expectedAmount).toLocaleString('vi-VN')} đ.`);
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
      const response = await fetch('/api/driver/expense-claims', {
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
    const timer = window.setTimeout(() => {
      taiYeuCauPhuPhi().catch((error) => setExpenseNotice(error.message || 'Không tải được yêu cầu phụ phí.'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tabHienTai, taiYeuCauPhuPhi]);

  const guiBaoCaoSuCo = async (event) => {
    event.preventDefault();
    setSendingSos(true);
    try {
      const formData = new FormData();
      formData.append('driver_id', String(Number(driverId)));
      formData.append('order_id', sosOrderId ? String(Number(sosOrderId)) : '');
      formData.append('incident_type', sosType);
      formData.append('description', sosDescription.trim());
      formData.append('lat', String(viTriHienTai.lat));
      formData.append('lng', String(viTriHienTai.lng));
      if (sosEvidence) formData.append('evidence_image', sosEvidence);
      const response = await fetch('/api/driver/incidents', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể gửi báo cáo sự cố.');
      alert(data.message);
      setShowSos(false);
      setSosDescription('');
      setSosOrderId('');
      setSosEvidence(null);
      setSosEvidencePreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return '';
      });
    } catch (error) {
      alert(error.message || 'Lỗi kết nối khi gửi báo cáo.');
    } finally {
      setSendingSos(false);
    }
  };

  const moCamera = async (target) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      return alert('Thiết bị hoặc trình duyệt này không hỗ trợ camera trực tiếp. Hãy mở ứng dụng bằng HTTPS hoặc localhost.');
    }
    try {
      setCameraTarget(target);
      setCameraStream(await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } }
      }));
    } catch (error) {
      setCameraTarget(null);
      setCameraStream(null);
      alert(error.name === 'NotAllowedError'
        ? 'Bạn chưa cấp quyền camera. Hãy cho phép camera trong cài đặt trình duyệt rồi thử lại.'
        : 'Không thể mở camera trên thiết bị này. Vui lòng kiểm tra camera và thử lại.');
    }
  };

  const dongCamera = () => {
    setCameraTarget(null);
    setCameraStream(null);
  };

  const chupAnhTrucTiep = async () => {
    const video = cameraVideoRef.current;
    if (!video?.videoWidth || !video.videoHeight || !cameraTarget) {
      return alert('Camera chưa sẵn sàng. Vui lòng đợi một chút rồi chụp lại.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return alert('Không thể xử lý ảnh từ camera trên thiết bị này.');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((imageBlob) => {
          if (imageBlob) resolve(imageBlob);
          else reject(new Error('Không thể tạo ảnh từ camera.'));
        }, 'image/jpeg', 0.92);
      });
      const file = new File([blob], 'camera-evidence.jpg', { type: 'image/jpeg' });
      const preparedFile = await prepareEvidenceImage(file);
      const previewUrl = URL.createObjectURL(preparedFile);
      if (cameraTarget === 'sos') {
        setSosEvidence(preparedFile);
        setSosEvidencePreview((current) => {
          if (current) URL.revokeObjectURL(current);
          return previewUrl;
        });
      } else {
        setAnhMinhChung(preparedFile);
        xoaLoiTruong('proof');
        setAnhPreview((current) => {
          if (current) URL.revokeObjectURL(current);
          return previewUrl;
        });
      }
      dongCamera();
    } catch (error) {
      alert(error.message || 'Không thể chụp ảnh bằng camera.');
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
    xoaLoiTruong('signature');
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

  const hienLoiTruong = (field, message) => {
    setSubmitErrors({ [field]: message });
    requestAnimationFrame(() => {
      const fieldElement = formRef.current?.querySelector(`[data-form-field="${field}"]`);
      fieldElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fieldElement?.focus?.({ preventScroll: true });
    });
  };

  const xoaLoiTruong = (field) => {
    setSubmitErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const xacNhanThaoTac = async (event) => {
    event.preventDefault();
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setDangCapNhat(true);
    setSubmitErrors({});
    setSubmitError('');
    const { loai, don } = modalXuLy;
    const validationError = (field, message) => Object.assign(new Error(message), { field });

    try {
      if (['pickup_failed', 'delivery_failed'].includes(loai)) {
        if (!lyDoHuy || !selectedFailureReason) {
          throw validationError('reason', 'Vui lòng chọn mã lý do hợp lệ.');
        }
        if (Number(selectedFailureReason.require_evidence) === 1 && !anhMinhChung) {
          throw validationError('proof', 'Lý do này yêu cầu chụp ảnh bằng chứng.');
        }
      }

      if (loai === 'completed') {
        const items = Array.isArray(don.order_items) ? don.order_items : [];
        if (!items.length) {
          throw validationError('items', 'Đơn hàng chưa tải được danh sách mặt hàng.');
        }
        const outboundItems = items.filter((item) => item.direction === 'outbound');
        const exchangeItems = items.filter((item) => item.direction === 'exchange_in');
        const isValidScan = (item, quantity) => quantity !== ''
          && Number.isSafeInteger(Number(quantity))
          && Number(quantity) >= 0
          && Number(quantity) <= Number(item.quantity);
        if (outboundItems.some((item) => !isValidScan(item, deliveryScanQuantities[item.id]))) {
          throw validationError('items', 'Vui lòng nhập số lượng đã quét giao hợp lệ cho từng mặt hàng.');
        }
        if (!outboundItems.some((item) => Number(deliveryScanQuantities[item.id]) > 0)) {
          throw validationError('items', 'Cần xác nhận giao ít nhất một mặt hàng.');
        }
        if (exchangeItems.some((item) => !isValidScan(item, returnScanQuantities[item.id])
          || Number(returnScanQuantities[item.id]) !== Number(item.quantity))) {
          throw validationError('items', 'Đơn đổi trả cần xác nhận quét thu hồi đủ số lượng hàng cũ.');
        }
        const amountToCollect = tinhTienTheoHangDaQuet(don, deliveryScanQuantities);
        if (amountToCollect > 0 && !xacNhanTien) {
          throw validationError('cod', 'Vui lòng xác nhận đã thu đủ COD và phí vận chuyển.');
        }
        if (amountToCollect > 0 && !['cash', 'bank_transfer'].includes(phuongThucCOD)) {
          throw validationError('payment', 'Vui lòng chọn tiền mặt hoặc chuyển khoản.');
        }
        if (!anhMinhChung || anhMinhChung.size <= 0) {
          throw validationError('proof', 'Vui lòng chụp ảnh bằng chứng giao hàng.');
        }
        if (!signatureDrawn) {
          throw validationError('signature', 'Người nhận chưa ký.');
        }
      }

      let evidenceLocation;
      try {
        if (!navigator.geolocation) throw new Error('unsupported');
        evidenceLocation = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            }),
            reject,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });
      } catch {
        throw validationError('gps', 'Chưa lấy được vị trí GPS. Hãy bật quyền vị trí và thử lại.');
      }

      const formData = new FormData();
      formData.append('status', loai);
      formData.append('user_id', driverId);
      formData.append('lat', String(evidenceLocation.lat));
      formData.append('lng', String(evidenceLocation.lng));

      if (anhMinhChung) formData.append('proof_image', anhMinhChung, anhMinhChung.name);
      if (loai === 'completed') {
        const hasExchangeItems = don.order_items.some((item) => item.direction === 'exchange_in');
        const deliveredItems = Object.entries(deliveryScanQuantities).map(([itemId, quantity]) => ({
          order_item_id: Number(itemId),
          quantity: Number(quantity)
        }));
        const collectedItems = Object.entries(returnScanQuantities).map(([itemId, quantity]) => ({
          order_item_id: Number(itemId),
          quantity: Number(quantity)
        }));
        formData.append('delivered_items', JSON.stringify(deliveredItems));
        if (hasExchangeItems) formData.append('collected_items', JSON.stringify(collectedItems));

        const signatureCanvas = signatureCanvasRef.current;
        if (!signatureCanvas) throw validationError('signature', 'Không tìm thấy vùng ký. Vui lòng mở lại xác nhận giao hàng.');
        const signatureBlob = await new Promise((resolve) => signatureCanvas.toBlob(resolve, 'image/png'));
        if (!signatureBlob || signatureBlob.size <= 0) {
          throw validationError('signature', 'Không tạo được ảnh chữ ký. Vui lòng ký lại.');
        }
        formData.append('signature_image', signatureBlob, `signature-${don.id}.png`);
        const amountToCollect = tinhTienTheoHangDaQuet(don, deliveryScanQuantities);
        formData.append('cod_collected', String(amountToCollect > 0 && xacNhanTien));
        if (amountToCollect > 0) formData.append('cod_payment_method', phuongThucCOD);
      }

      if (['pickup_failed', 'delivery_failed'].includes(loai)) {
        formData.append('reason_code', lyDoHuy);
        formData.append('fail_reason', [selectedFailureReason.description, ghiChuXuLy.trim()]
          .filter(Boolean).join(' — '));
      }

      const response = await fetch(`/api/orders/${don.id}/status`, {
        method: 'PUT',
        body: formData
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Máy chủ trả về phản hồi không hợp lệ. Vui lòng thử lại.');
      }
      if (!response.ok || !data.success) {
        const message = String(data.message || '');
        if (/reason.?code|lý do/i.test(message)) {
          throw validationError('reason', 'Mã lý do không hợp lệ hoặc không còn áp dụng cho đơn này.');
        }
        if (/photo|image|ảnh|bằng chứng/i.test(message)) {
          throw validationError('proof', 'Máy chủ chưa nhận được ảnh bằng chứng. Vui lòng chụp lại.');
        }
        if (/signature|chữ ký/i.test(message)) {
          throw validationError('signature', 'Máy chủ chưa nhận được chữ ký. Vui lòng ký lại.');
        }
        if (/lat|lng|gps|tọa độ|coordinates/i.test(message)) {
          throw validationError('gps', 'Chưa lấy được vị trí GPS hợp lệ. Hãy bật quyền vị trí và thử lại.');
        }
        throw new Error(message.includes('Không') || message.includes('Vui lòng')
          ? message
          : 'Không thể cập nhật đơn hàng. Vui lòng thử lại.');
      }

      alert(loai === 'completed' ? 'Đã xác nhận giao hàng thành công.' : (data.message || 'Đã ghi nhận báo cáo giao hàng.'));
      dongModal();
      await Promise.all([taiDuLieu(), taiViTien()]);
    } catch (error) {
      if (error.field) {
        hienLoiTruong(error.field, error.message);
      } else {
        setSubmitError(error.message || 'Không thể gửi báo cáo. Vui lòng thử lại.');
      }
    } finally {
      submitLockRef.current = false;
      setDangCapNhat(false);
    }
  };

  const dongModal = () => {
    dongCamera();
    setModalXuLy({ mo: false, loai: '', don: null });
    setAnhMinhChung(null);
    setAnhPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    xoaChuKy();
    setLyDoHuy('');
    setXacNhanTien(false);
    setPhuongThucCOD('');
    setDeliveryScanQuantities({});
    setReturnScanQuantities({});
    deliveryScanQuantitiesRef.current = {};
    returnScanQuantitiesRef.current = {};
    setScanItemMode(false);
    setItemScanMessage('');
  };

  const guiDonNghiPhep = async (e) => {
    e.preventDefault();
    if (!lyDoNghi.trim()) return;
    setDangGuiNghiPhep(true);
    
    try {
      const res = await fetch('/api/hr/leave', {
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
    : ['at_central_warehouse', 'at_destination_warehouse', 'delivering', 'returning'].includes(d.status));
  const tongTienThuHo = donThanhCong.reduce((sum, item) => sum + tinhTongTienCanThu(item), 0);
  const donHoanTatHomNay = donThanhCong.filter((order) => new Date(order.updated_at).toDateString() === new Date().toDateString()).length;
  const donTrongNgay = donDangChay.length + donHoanTatHomNay;
  const tienDoHomNay = donTrongNgay ? Math.round((donHoanTatHomNay / donTrongNgay) * 100) : 0;
  const routeMode = isPickupDriver ? 'pickup' : 'delivery';
  const activeDriverRoute = driverRoute[routeMode] || {};
  const routeStops = useMemo(() => activeDriverRoute.stops || [], [activeDriverRoute.stops]);
  const nextRouteStop = activeDriverRoute.next_stop || routeStops[0] || null;
  const routeGeometryKey = `${routeMode}:${routeStops.map((stop) => stop.stop_ids?.[0]).join(',')}`;
  useEffect(() => {
    if (!routeStops.length) return undefined;
    const destination = routeStops[routeStops.length - 1];
    const via = routeStops.slice(0, -1)
      .map((stop) => `${stop.lat},${stop.lng}`).join('|');
    const query = new URLSearchParams({
      from: `${GOVAP_MAP_CENTER[0]},${GOVAP_MAP_CENTER[1]}`,
      to: `${destination.lat},${destination.lng}`
    });
    if (via) query.set('via', via);
    const controller = new AbortController();
    fetch(`${API_URL}/api/map/route?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Không thể tải tuyến đường OSRM.');
        setDriverRouteGeometry({
          key: routeGeometryKey,
          positions: result.data.geometry.coordinates.map(([lng, lat]) => [lat, lng])
        });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setDriverRouteGeometry({ key: routeGeometryKey, positions: [] });
          console.error('Không thể tải hình học tuyến:', error);
        }
      });
    return () => controller.abort();
  }, [routeGeometryKey, routeStops]);
  const nextMission = donDangChay
    .map((order) => {
      const target = isPickupDriver
        ? { lat: order.shop_lat, lng: order.shop_lng }
        : order.status === 'returning'
        ? { lat: order.shop_lat, lng: order.shop_lng }
        : getDeliveryCoordinates(order) || {};
      const hasTarget = Number.isFinite(Number(target.lat)) && Number.isFinite(Number(target.lng));
      return { ...order, distance: hasTarget ? distanceBetween(viTriHienTai, target) : Number.POSITIVE_INFINITY };
    })
    .sort((first, second) => first.distance - second.distance)[0];
  const routeOrderByOrderId = new Map(routeStops.flatMap((stop) => (
    (stop.order_ids || []).map((orderId) => [Number(orderId), Number(stop.stop_sequence)])
  )));
  const donTheoTuyen = [...donDangChay].sort((first, second) => {
    const firstOrder = routeOrderByOrderId.get(Number(first.id)) || Number.MAX_SAFE_INTEGER;
    const secondOrder = routeOrderByOrderId.get(Number(second.id)) || Number.MAX_SAFE_INTEGER;
    return firstOrder - secondOrder || Number(first.route_order || 0) - Number(second.route_order || 0);
  });
  const handleRouteStopDrop = (targetStopId) => {
    if (!draggedStopId || draggedStopId === targetStopId || routeReorderBusy) return;
    const ordered = routeStops.map((stop) => stop.stop_ids[0]);
    const fromIndex = ordered.indexOf(Number(draggedStopId));
    const toIndex = ordered.indexOf(Number(targetStopId));
    if (fromIndex < 0 || toIndex < 0) return;
    ordered.splice(toIndex, 0, ordered.splice(fromIndex, 1)[0]);
    doiThuTuLoTrinh(routeMode, ordered);
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
              <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${dangOnline && !apiDisconnected ? 'bg-emerald-400/20 text-emerald-100' : 'bg-red-400/20 text-red-100'}`}>{dangOnline && !apiDisconnected ? <Wifi size={13} /> : <WifiOff size={13} />}{dangOnline && !apiDisconnected ? 'ONLINE' : 'OFFLINE'}</span>
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
                {walletLoadError && !apiDisconnected
                  ? <p className="mt-1 text-sm font-semibold text-rose-700" role="alert">{walletLoadError}</p>
                  : <h3 className="font-black text-lg text-slate-800">{walletLoading ? 'Đang tải...' : `${viTien.toLocaleString()} đ`}</h3>}
              </div>
            </div>
            {walletLoadError && !apiDisconnected && (
              <button type="button" onClick={() => { void taiViTien(); }} disabled={walletLoading} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                Thử lại
              </button>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto pb-28">
          {apiDisconnected && (
            <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm font-bold text-amber-950" role="status" aria-live="polite">
              <WifiOff size={16} /> Đang mất kết nối
            </div>
          )}
          {ordersLoading && donHang.length === 0 && (
            <div className="space-y-3 p-4" role="status" aria-live="polite" aria-busy="true">
              <p className="text-sm font-bold text-slate-700">Đang tải đơn hàng và lộ trình...</p>
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          )}
          {ordersLoadError && !apiDisconnected && (
            <div className="m-4 rounded-2xl border border-rose-200 bg-rose-50 p-4" role="alert">
              <p className="font-bold text-rose-900">{ordersLoadError}</p>
              <button
                type="button"
                onClick={() => { void taiDuLieu(); }}
                disabled={ordersLoading}
                className="mt-3 rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {ordersLoading ? 'Đang thử lại...' : 'Thử lại'}
              </button>
            </div>
          )}
          {routeLoadError && !apiDisconnected && (
            <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4" role="alert">
              <p className="font-bold text-amber-900">Không tải được lộ trình: {routeLoadError}</p>
              <button
                type="button"
                onClick={() => {
                  void taiLoTrinh().catch((error) => console.error('Không thể thử tải lại lộ trình:', error));
                }}
                className="mt-3 rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white"
              >
                Thử lại lộ trình
              </button>
            </div>
          )}
          {((routeInfo && (isPickupDriver ? ['picking', 'picked_up', 'transferring_to_central', 'transferring_to_destination'].includes(routeInfo.status) : ['at_central_warehouse', 'at_destination_warehouse', 'delivering'].includes(routeInfo.status))) || routeStops.length > 0) && (
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{taskRoute?.label || 'Lộ trình vận chuyển'}</p>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">{isPickupDriver ? 'Lấy hàng / trung chuyển' : 'Giao hàng'}</span>
              </div>
              <div className="relative z-0 isolate h-56 w-full overflow-hidden rounded-2xl sm:h-64">
              <MapContainer
                center={[Number.isFinite(originLat) ? originLat : Number(routeStops[0]?.lat || GOVAP_MAP_CENTER[0]), Number.isFinite(originLng) ? originLng : Number(routeStops[0]?.lng || GOVAP_MAP_CENTER[1])]}
                zoom={15}
                scrollWheelZoom
                className="relative z-0 h-full w-full rounded-2xl border border-slate-200"
              >
                <InvalidateMapSize />
                <TileLayer attribution={MAP_ATTRIBUTION} url={MAP_TILE_URL} />
                {driverRouteGeometry?.key === routeGeometryKey && driverRouteGeometry.positions.length > 1
                  && <Polyline positions={driverRouteGeometry.positions} pathOptions={{ color: isPickupDriver ? '#d97706' : '#2563eb', weight: 5 }} />}
                {routeGeometry.length > 1 && <Polyline positions={routeGeometry} pathOptions={{ color: '#2563eb', weight: 5 }} />}
                {routeStops.map((stop, index) => (
                  <Marker key={`route-stop-${stop.stop_ids[0]}`} position={[Number(stop.lat), Number(stop.lng)]} icon={routeStopIcon(index + 1, routeMode)}>
                    <Popup><strong>Điểm {index + 1}</strong><br />{(stop.tracking_codes || []).join(', ')}<br />{stop.address}</Popup>
                  </Marker>
                ))}
                {Number.isFinite(originLat) && Number.isFinite(originLng) && <Marker position={[originLat, originLng]} icon={truckIcon}><Popup>Điểm đi</Popup></Marker>}
                {Number.isFinite(destinationLat) && Number.isFinite(destinationLng) && <Marker position={[destinationLat, destinationLng]} icon={truckIcon}><Popup>Điểm đến</Popup></Marker>}
              </MapContainer>
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
                {directions && <p className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                  Lộ trình nội bộ: {(directions.distance_m / 1000).toFixed(1)} km · khoảng {Math.ceil(directions.duration_s / 60)} phút
                </p>}
                {directionsError && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">{directionsError}</p>}
                {directions?.steps?.length > 0 && (
                  <ol className="max-h-48 space-y-2 overflow-y-auto rounded-xl bg-white p-3">
                    {directions.steps.map((step, index) => (
                      <li key={`${index}-${step.instruction}`} className="flex gap-2 text-xs text-slate-700">
                        <span className="font-black text-blue-700">{index + 1}.</span>
                        <span>{step.instruction} · {step.distance_m >= 1000 ? `${(step.distance_m / 1000).toFixed(1)} km` : `${Math.round(step.distance_m)} m`}</span>
                      </li>
                    ))}
                  </ol>
                )}
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
              <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Thu nhập hôm nay (ước tính)</p>
                    <p className="mt-1 text-2xl font-black text-emerald-900">
                      {thuNhapThamKhao ? `${BigInt(thuNhapThamKhao.estimated_income || '0').toLocaleString('vi-VN')} đ` : '—'}
                    </p>
                  </div>
                  <Wallet className="text-emerald-600" size={24} />
                </div>
                <p className="mt-2 text-xs text-emerald-800">Chỉ mang tính tham khảo; tiền lương chính thức được xác nhận khi chốt kỳ.</p>
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
                <div className="flex items-center justify-between"><p className={`text-xs font-black uppercase tracking-wider ${driverTheme.missionLabel}`}>Điểm kế tiếp trong lộ trình</p><Navigation size={16} className={isPickupDriver ? 'text-amber-600' : 'text-blue-600'} /></div>
                {offlineSyncNotice && <p role="status" className="mb-3 rounded-lg bg-amber-100 p-3 text-xs font-bold text-amber-800">{offlineSyncNotice}</p>}
                {nextRouteStop ? <div className="mt-3">
                  <h3 className="font-black text-slate-800">{(nextRouteStop.tracking_codes || []).join(', ')}</h3>
                  <p className="mt-1 text-sm text-slate-600">{nextRouteStop.address || 'Chưa có địa chỉ'}</p>
                  <p className={`mt-1 text-xs font-bold ${driverTheme.missionLabel}`}>
                    ETA {nextRouteStop.eta ? new Date(nextRouteStop.eta).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'đang tính'}
                    · {Number(nextRouteStop.order_ids?.length || 0)} đơn
                    · COD {Number(nextRouteStop.cod_to_collect || 0).toLocaleString('vi-VN')} đ
                  </p>
                  {routeMode === 'pickup' && nextRouteStop.ranking_reason && (
                    <p className="mt-1 text-xs font-medium text-slate-700">Ưu tiên: {nextRouteStop.ranking_reason}</p>
                  )}
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${nextRouteStop.lat},${nextRouteStop.lng}`} target="_blank" rel="noreferrer" className={`mt-3 inline-flex rounded-lg px-4 py-2 text-sm font-bold text-white ${driverTheme.action}`}>Chỉ đường</a>
                  <button type="button" onClick={() => setTabHienTai('thu-gom')} className={`mt-3 rounded-lg px-4 py-2 text-sm font-bold text-white ${driverTheme.action}`}>Mở nhiệm vụ</button>
                </div> : nextMission ? <div className="mt-3">
                  <h3 className="font-black text-slate-800">{nextMission.tracking_code}</h3>
                  <p className="mt-1 text-sm text-slate-600">{isPickupDriver || nextMission.status === 'returning' ? nextMission.shop_address : nextMission.receiver_address}</p>
                  <p className={`mt-1 text-xs font-bold ${driverTheme.missionLabel}`}>{Number.isFinite(nextMission.distance) ? `${nextMission.distance.toFixed(1)} km từ vị trí gần nhất` : 'Vị trí địa chỉ chưa có'}</p>
                  <button type="button" onClick={() => setTabHienTai('thu-gom')} className={`mt-3 rounded-lg px-4 py-2 text-sm font-bold text-white ${driverTheme.action}`}>Mở nhiệm vụ</button>
                </div> : <p className="mt-3 text-sm text-slate-600">Chưa có nhiệm vụ đang chờ. Hệ thống sẽ cập nhật khi Điều phối giao đơn.</p>}
              </section>
              <button type="button" onClick={() => setShowSos(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 p-4 font-black text-white shadow-md"><Siren size={19} /> SOS · Báo sự cố khẩn cấp</button>
              <button type="button" onClick={() => setTabHienTai('bando')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700"><MapIcon size={17} /> Mở bản đồ vị trí GPS</button>
            </div>
          )}

          {tabHienTai === 'thu-gom' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-black text-base text-slate-800 flex items-center gap-2 mb-1">
                  <Navigation className="text-blue-600" size={18} /> {isPickupDriver ? 'Đơn cần lấy' : 'Đơn cần giao'} ({donDangChay.length})
                </h3>
                {routeReorderBusy && <span className="text-xs font-bold text-indigo-700">Đang lưu thứ tự...</span>}
              </div>
              {routeStops.length > 0 && (
                <section className="space-y-2 rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                    <span>{activeDriverRoute.summary?.is_estimated ? 'Tuyến ước tính' : 'Tuyến theo OSRM'} · {(Number(activeDriverRoute.summary?.total_distance_m || 0) / 1000).toFixed(1)} km · {Math.ceil(Number(activeDriverRoute.summary?.total_duration_s || 0) / 60)} phút</span>
                    <Route size={16} />
                  </div>
                  {routeStops.map((stop, index) => (
                    <article
                      key={stop.stop_ids[0]}
                      draggable={!routeReorderBusy}
                      onDragStart={() => setDraggedStopId(String(stop.stop_ids[0]))}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleRouteStopDrop(stop.stop_ids[0])}
                      onDragEnd={() => setDraggedStopId(null)}
                      className={`rounded-xl border bg-white p-3 ${index === 0 ? 'border-indigo-400 shadow-sm' : 'border-slate-200'} ${draggedStopId === String(stop.stop_ids[0]) ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-black text-white">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900">{(stop.tracking_codes || []).join(', ')}</p>
                          <p className="mt-1 text-xs text-slate-700">{stop.address || 'Chưa có địa chỉ'}</p>
                          <p className="mt-1 text-xs font-semibold text-indigo-800">
                            ETA {stop.eta ? new Date(stop.eta).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'đang tính'}
                            · {stop.order_ids.length} đơn · COD {Number(stop.cod_to_collect || 0).toLocaleString('vi-VN')} đ
                          </p>
                          {routeMode === 'pickup' && stop.ranking_reason && (
                            <p className="mt-1 text-xs font-medium text-slate-700">Ưu tiên: {stop.ranking_reason}</p>
                          )}
                        </div>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`} target="_blank" rel="noreferrer" aria-label="Chỉ đường đến điểm dừng" className="rounded-lg bg-indigo-100 p-2 text-indigo-800"><Navigation size={16} /></a>
                      </div>
                    </article>
                  ))}
                  <p className="text-[11px] text-indigo-800">Kéo điểm dừng để đổi thứ tự; hệ thống sẽ yêu cầu nhập lý do và lưu nhật ký.</p>
                </section>
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
                    <div className="absolute top-0 left-0 h-full w-1.5 bg-slate-300"></div>
                    <div className="p-5 pl-6">
                      <div className="flex justify-between items-center mb-3 border-b border-slate-50 pb-2">
                        <span className="font-black text-slate-800">{don.tracking_code}{don.route_order ? <span className="ml-2 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700">Điểm {don.route_order}</span> : null}</span>
                        <OrderStatusBadge status={don.status} />
                      </div>
                      <p className="mb-3 text-[11px] font-semibold text-slate-500">
                        Lần lấy thất bại: {Number(don.pickup_attempts || 0)} · Lần giao tính lượt: {Number(don.delivery_attempts || 0)}
                      </p>
                      <div className="space-y-2.5 mb-4 text-sm">
                        <div className="flex items-start gap-2.5">
                          <UserCircle size={16} className="text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-bold text-slate-800">{isPickupDriver ? taskRoute?.label || 'Nhiệm vụ lấy hàng / trung chuyển' : don.status === 'returning' ? 'Hoàn hàng về Shop' : don.receiver_name}</p>
                              {!isPickupDriver && <a href={`tel:${don.status === 'returning' ? don.shop_phone : don.receiver_phone}`} className="text-blue-600 font-bold text-xs">{don.status === 'returning' ? don.shop_phone : don.receiver_phone}</a>}
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <MapPin size={16} className="text-orange-400 mt-0.5 shrink-0" />
                          <p className="text-slate-600 text-xs leading-relaxed">{isPickupDriver ? diemDen : don.status === 'returning' ? don.shop_address : don.receiver_address}</p>
                        </div>
                        {!isPickupDriver && don.status !== 'returning' && <div className="bg-slate-50 p-2.5 rounded-xl space-y-1.5 text-xs">
                          <div className="flex justify-between"><span className="font-bold text-slate-500">COD hàng:</span><span>{Number(don.cod_amount || 0).toLocaleString()} đ</span></div>
                          <div className="flex justify-between"><span className="font-bold text-slate-500">Cước vận chuyển:</span><span>{Number(don.shipping_fee || 0).toLocaleString()} đ</span></div>
                          <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="font-black text-slate-700">Tổng cần thu:</span><span className="font-black text-red-500 text-sm">{tinhTongTienCanThu(don).toLocaleString()} đ</span></div>
                        </div>}
                      </div>
                      {!isPickupDriver && ['at_central_warehouse', 'at_destination_warehouse', 'delivering', 'completed'].includes(don.status) && (
                        <button type="button" onClick={() => setChatOrder(don)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 py-2.5 text-xs font-black text-blue-700 hover:bg-blue-100">
                          <MessageCircle size={15} /> Nhắn trực tiếp người nhận
                        </button>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        {don.status === 'picking' ? (
                          <>
                            <button onClick={() => xacNhanDaLayHang(don)} className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md shadow-blue-200">
                              Mở camera quét mã nhận hàng
                            </button>
                            <button onClick={() => { resetFormErrors(); setModalXuLy({ mo: true, loai: 'pickup_failed', don }); }} className="col-span-2 rounded-xl border border-red-100 bg-red-50 py-3 text-xs font-bold text-red-600">
                              Báo lấy hàng thất bại
                            </button>
                          </>
                        ) : don.status === 'returning' ? (
                          <p className="col-span-2 rounded-xl bg-orange-50 px-3 py-3 text-center text-xs font-bold text-orange-700">Mang hàng hoàn về kho tổng để quét nhận.</p>
                        ) : don.status === 'picked_up' || don.status === 'transferring_to_central' || don.status === 'transferring_to_destination' ? (
                          <p className="col-span-2 rounded-xl bg-amber-50 px-3 py-3 text-center text-xs font-bold text-amber-700">{don.status === 'picked_up' ? 'Đã lấy tại Shop, chờ kho tổng Gò Vấp quét nhận.' : 'Đang trung chuyển, kho nhận sẽ quét khi hàng đến.'}</p>
                        ) : ['at_central_warehouse', 'at_destination_warehouse'].includes(don.status) ? (
                          <button onClick={() => batDauGiaoHang(don.id, don.tracking_code)} className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md shadow-blue-200">
                            {don.status === 'at_destination_warehouse' ? 'Nhận hàng tại kho đích và bắt đầu giao' : 'Nhận hàng tại kho tổng và bắt đầu giao'}
                          </button>
                        ) : don.status === 'delivering' ? (
                          <>
                            <button 
                              onClick={() => moModalGiaoHang(don)}
                              className="bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1"
                            >
                              <CheckCircle size={14} /> Giao Tới Nơi
                            </button>
                            <button 
                              onClick={() => { resetFormErrors(); setModalXuLy({ mo: true, loai: 'delivery_failed', don }); }}
                              className="bg-red-50 text-red-500 font-bold py-3 rounded-xl text-xs border border-red-100 flex items-center justify-center gap-1"
                            >
                              <XCircle size={14} /> Báo Thất Bại
                            </button>
                          </>
                        ) : don.status === 'completed' ? (
                          <p className="col-span-2 rounded-xl bg-emerald-50 px-3 py-3 text-center text-xs font-bold text-emerald-800">
                            Đơn đã giao thành công. Không thể gửi thêm kết quả giao hàng.
                          </p>
                        ) : ['delivery_failed', 'return_pending'].includes(don.status) ? (
                          <p className="col-span-2 rounded-xl bg-orange-50 px-3 py-3 text-center text-xs font-bold text-orange-800">
                            {don.status === 'delivery_failed' ? 'Giao hàng thất bại, chờ điều phối xử lý.' : 'Đơn đang chờ phân công hoàn về Shop.'}
                          </p>
                        ) : null}
                      </div>
                      {chatOrder && <DriverOrderChat order={chatOrder} onClose={() => setChatOrder(null)} />}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tabHienTai === 'bando' && (
            <div className="relative z-0 isolate flex h-[calc(100vh-220px)] w-full flex-col">
              <div className="p-3 bg-blue-50 border-b border-blue-100 text-center text-xs font-bold text-blue-700">🛰️ GPS đang đồng bộ liên tục.</div>
              <MapContainer center={[viTriHienTai.lat, viTriHienTai.lng]} zoom={15} style={{ flex: 1, width: '100%' }}>
                <InvalidateMapSize />
                <TileLayer attribution={MAP_ATTRIBUTION} url={MAP_TILE_URL}/>
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
                <button type="button" disabled={cashSubmitting || viTien <= 0 || !dangOnline || apiDisconnected} onClick={nopTienMat} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><Banknote size={18} />{cashSubmitting ? 'Đang gửi yêu cầu...' : 'Yêu cầu nộp tiền mặt'}</button>
                {(!dangOnline || apiDisconnected) && <p className="mt-2 text-xs font-semibold text-amber-700">Cần có kết nối mạng để lập phiếu nộp tiền.</p>}
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
                  <input name="amount" type="number" required min="1" max="10000000" step="1" placeholder="Số tiền nguyên VND (tối đa 10.000.000đ)" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
                  <textarea name="note" required minLength={5} maxLength={500} rows={2} placeholder="Mô tả khoản chi" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
                  <input name="receipt_image" type="file" required accept="image/jpeg,image/png,image/webp" className="w-full text-sm" />
                  <button type="submit" disabled={expenseSubmitting || !dangOnline || apiDisconnected} className="w-full rounded-xl bg-orange-600 px-4 py-3 font-black text-white disabled:opacity-50">{expenseSubmitting ? 'Đang gửi...' : 'Gửi Kế toán duyệt'}</button>
                  {(!dangOnline || apiDisconnected) && <p className="text-xs font-semibold text-amber-700">Cần kết nối mạng để tải ảnh biên lai.</p>}
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
              <form
                className="mt-4 space-y-2 border-t border-slate-100 pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  xacNhanMaVanDon(maVanDonNhapTay);
                }}
              >
                <label htmlFor="pickup-tracking-code" className="block text-sm font-bold text-slate-700">
                  Camera không quét được? Nhập mã vận đơn hoặc dùng máy quét USB/Bluetooth
                </label>
                <div className="flex gap-2">
                  <input
                    id="pickup-tracking-code"
                    type="text"
                    autoComplete="off"
                    value={maVanDonNhapTay}
                    onChange={(event) => setMaVanDonNhapTay(event.target.value)}
                    placeholder={donCanQuet.tracking_code}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!maVanDonNhapTay.trim() || dangXacNhanMaQuet}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {dangXacNhanMaQuet ? 'Đang xác nhận...' : 'Xác nhận'}
                  </button>
                </div>
              </form>
              <p className="mt-3 text-xs text-slate-500">Chỉ mã vận đơn đang hiển thị ở trên mới được xác nhận nhận hàng.</p>
            </div>
          </div>
        )}
        {showSos && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/80 p-4">
            <form onSubmit={guiBaoCaoSuCo} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-black text-red-700"><Siren size={20} /> Báo cáo sự cố</h3><button type="button" onClick={() => {
                dongCamera();
                setShowSos(false);
                setSosEvidence(null);
                setSosEvidencePreview((current) => {
                  if (current) URL.revokeObjectURL(current);
                  return '';
                });
              }} className="rounded-full bg-slate-100 p-2"><X size={18} /></button></div>
              <label className="block text-sm font-bold text-slate-600">Loại sự cố
                <select value={sosType} onChange={(event) => setSosType(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3">
                  <option value="accident">Tai nạn</option><option value="vehicle_breakdown">Hỏng xe</option><option value="traffic">Tắc đường</option><option value="wrong_item">Giao nhầm hàng</option><option value="customer_absent">Khách không có nhà</option><option value="damaged_goods">Hàng hóa hư hỏng</option><option value="lost_goods">Thất lạc hàng hóa</option><option value="other">Khác</option>
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-600">Đơn hàng liên quan (nếu có)
                <select value={sosOrderId} onChange={(event) => setSosOrderId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3">
                  <option value="">Không chọn đơn hàng</option>
                  {donDangChay.map((order) => <option key={order.id} value={order.id}>{order.tracking_code || `Đơn #${order.id}`} — {order.receiver_name || order.shop_name || 'Đơn đang giao'}</option>)}
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-600">Mô tả và hỗ trợ cần thiết
                <textarea required maxLength={2000} value={sosDescription} onChange={(event) => setSosDescription(event.target.value)} rows={3} placeholder="Mô tả ngắn gọn tình huống..." className="mt-2 w-full rounded-lg border border-slate-200 p-3" />
              </label>
              <div>
                <p className="mb-2 text-sm font-bold text-slate-600">Ảnh sự cố gửi về Trung tâm (không bắt buộc)</p>
                {sosEvidencePreview ? (
                  <div className="relative">
                    <img src={sosEvidencePreview} alt="Ảnh sự cố đã chọn" className="max-h-52 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain" />
                    <button type="button" onClick={() => {
                      setSosEvidence(null);
                      setSosEvidencePreview((current) => {
                        if (current) URL.revokeObjectURL(current);
                        return '';
                      });
                    }} aria-label="Xóa ảnh sự cố" className="absolute right-2 top-2 rounded-full bg-slate-900/75 p-2 text-white">
                      <X size={16} />
                    </button>
                  </div>
                ) : cameraTarget === 'sos' ? (
                  <div className="space-y-2">
                    <video ref={cameraVideoRef} autoPlay playsInline muted className="max-h-64 w-full rounded-xl bg-black object-contain" />
                    <div className="flex gap-2">
                      <button type="button" onClick={chupAnhTrucTiep} className="flex-1 rounded-lg bg-red-600 px-3 py-2 font-bold text-white">Chụp ảnh</button>
                      <button type="button" onClick={dongCamera} className="rounded-lg bg-slate-200 px-3 py-2 font-bold text-slate-700">Đóng camera</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => moCamera('sos')} className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-red-200 bg-red-50 text-sm font-bold text-red-700">
                    <Camera size={24} />
                    Mở camera chụp ảnh sự cố
                  </button>
                )}
                <p className="mt-1 text-xs text-slate-500">Camera mở trực tiếp trong ứng dụng; ảnh sẽ được nén trước khi gửi.</p>
              </div>
              <p className="text-xs text-slate-500">Vị trí GPS hiện tại sẽ được gửi kèm khi báo cáo.</p>
              <button type="submit" disabled={sendingSos || !dangOnline || apiDisconnected} className="w-full rounded-xl bg-red-600 px-4 py-3 font-black text-white disabled:opacity-50">{sendingSos ? 'Đang gửi...' : 'Gửi SOS đến Trung tâm'}</button>
              {(!dangOnline || apiDisconnected) && <p className="text-xs font-semibold text-amber-700">Cần kết nối mạng để gửi báo cáo và ảnh đến Trung tâm.</p>}
            </form>
          </div>
        )}
        {modalXuLy.mo && (
          <div className="fixed inset-0 z-[1000] flex flex-col justify-end bg-slate-900/80">
            <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 pb-10 animate-in slide-in-from-bottom-full duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className={`font-black text-xl flex items-center gap-2 ${modalXuLy.loai === 'completed' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {modalXuLy.loai === 'completed' ? <CheckCircle /> : <AlertTriangle />}
                  {modalXuLy.loai === 'completed' ? 'Xác Nhận Thành Công' : 'Báo Cáo Thất Bại'}
                </h3>
                <button onClick={() => { dongCamera(); dongModal(); }} className="bg-slate-100 p-2 rounded-full text-slate-500"><X size={20}/></button>
              </div>

              <form ref={formRef} onSubmit={xacNhanThaoTac} className="space-y-5">
                {submitError && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
                    <p>{submitError}</p>
                    <button
                      type="button"
                      onClick={() => formRef.current?.requestSubmit()}
                      disabled={dangCapNhat}
                      className="mt-2 rounded-lg bg-red-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                    >
                      {dangCapNhat ? 'Đang gửi...' : 'Thử gửi lại'}
                    </button>
                  </div>
                )}
                
                {/* 1. MỤC DÀNH CHO THẤT BẠI: LÝ DO */}
                {['pickup_failed', 'delivery_failed'].includes(modalXuLy.loai) && (
                  <div data-form-field="reason" tabIndex={-1}>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      {failureReasonGroup === 'PICKUP' ? 'Chọn lý do lấy hàng thất bại (*)' : 'Chọn lý do giao thất bại (*)'}
                    </label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 outline-none focus:border-red-400 text-sm font-medium"
                      value={lyDoHuy}
                      onChange={(e) => { setLyDoHuy(e.target.value); xoaLoiTruong('reason'); }}
                    >
                      <option value="">-- Nhấp để chọn lý do --</option>
                      {failureReasonCodes[failureReasonGroup].map((reason) => (
                        <option key={reason.code} value={reason.code}>{reason.description}</option>
                      ))}
                    </select>
                    {submitErrors.reason && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{submitErrors.reason}</p>}
                    {reasonCodeError && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{reasonCodeError}</p>}
                    {Number(selectedFailureReason?.require_evidence) === 1 && <p className="mt-2 text-xs font-semibold text-red-600">Mã lý do này yêu cầu ảnh minh chứng.</p>}
                    <label className="mt-3 block text-sm font-semibold text-slate-700">
                      Ghi chú bổ sung (nếu có)
                      <textarea
                        value={ghiChuXuLy}
                        onChange={(event) => setGhiChuXuLy(event.target.value)}
                        maxLength={1000}
                        rows={2}
                        placeholder="Mô tả thêm tình huống để trung tâm xử lý..."
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                      />
                    </label>
                  </div>
                )}

                {/* 2. MỤC DÀNH CHO THÀNH CÔNG: XÁC NHẬN VÀ CHỌN HÌNH THỨC COD */}
                {modalXuLy.loai === 'completed' && (
                  <>
                  <section data-form-field="items" tabIndex={-1} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-black text-slate-800">Xác nhận mặt hàng đã quét</h4>
                        <p className="mt-1 text-xs text-slate-500">Quét QR từng dòng hàng hoặc nhập số lượng đã quét.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setItemScanMessage('');
                          setScanItemMode((current) => !current);
                        }}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white"
                      >
                        {scanItemMode ? 'Tắt camera quét' : 'Mở camera quét QR'}
                      </button>
                    </div>
                    {scanItemMode && <div id="driver-order-item-scanner" className="mt-3 overflow-hidden rounded-lg bg-white" />}
                    {itemScanMessage && <p role="status" className="mt-2 text-sm font-bold text-blue-700">{itemScanMessage}</p>}
                    {submitErrors.items && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{submitErrors.items}</p>}
                    <div className="mt-3 space-y-3">
                      {modalXuLy.don.order_items.filter((item) => item.direction === 'outbound').map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-white p-3">
                          <div className="min-w-0">
                            <span className="block truncate text-sm font-bold text-slate-700">{item.item_name}</span>
                            <span className="text-xs text-slate-500">Hàng giao · tối đa {item.quantity}</span>
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs font-bold text-blue-700">Hiện mã QR mặt hàng</summary>
                              <div className="mt-2 inline-block rounded bg-white p-2">
                                <QRCode value={`ORDER_ITEM:${modalXuLy.don.id}:${item.id}:OUT`} size={96} />
                              </div>
                            </details>
                          </div>
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            step="1"
                            value={deliveryScanQuantities[item.id] ?? ''}
                            onChange={(event) => {
                              const next = { ...deliveryScanQuantitiesRef.current, [item.id]: event.target.value };
                              deliveryScanQuantitiesRef.current = next;
                              setDeliveryScanQuantities(next);
                              xoaLoiTruong('items');
                            }}
                            className="w-24 rounded-lg border border-slate-200 p-2 text-center font-bold"
                            aria-label={`Số lượng giao đã quét: ${item.item_name}`}
                          />
                        </div>
                      ))}
                      {modalXuLy.don.order_items.filter((item) => item.direction === 'exchange_in').map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-amber-900">{item.item_name}</span>
                            <span className="text-xs text-amber-700">Hàng đổi trả cần thu hồi · {item.quantity}</span>
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs font-bold text-amber-800">Hiện mã QR thu hồi</summary>
                              <div className="mt-2 inline-block rounded bg-white p-2">
                                <QRCode value={`ORDER_ITEM:${modalXuLy.don.id}:${item.id}:IN`} size={96} />
                              </div>
                            </details>
                          </span>
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            step="1"
                            value={returnScanQuantities[item.id] ?? ''}
                            onChange={(event) => {
                              const next = { ...returnScanQuantitiesRef.current, [item.id]: event.target.value };
                              returnScanQuantitiesRef.current = next;
                              setReturnScanQuantities(next);
                              xoaLoiTruong('items');
                            }}
                            className="w-24 rounded-lg border border-amber-200 bg-white p-2 text-center font-bold"
                            aria-label={`Số lượng hàng đổi trả đã quét: ${item.item_name}`}
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <div data-form-field="cod" tabIndex={-1} className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                    {tinhTienTheoHangDaQuet(modalXuLy.don, deliveryScanQuantities) > 0 ? (
                      <>
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            id="checkTien"
                            className="w-6 h-6 mt-0.5 accent-emerald-500 rounded"
                            checked={xacNhanTien}
                            onChange={(e) => { setXacNhanTien(e.target.checked); xoaLoiTruong('cod'); }}
                          />
                          <label htmlFor="checkTien" className="text-sm">
                            <p className="font-bold text-emerald-800">Xác nhận đã thu đủ số tiền cần thu</p>
                            <p className="font-black text-red-600 text-lg">{tinhTienTheoHangDaQuet(modalXuLy.don, deliveryScanQuantities).toLocaleString()} VNĐ</p>
                          </label>
                        </div>
                        <div className="ml-9 mt-2 space-y-1 text-xs text-emerald-800">
                          <div className="flex justify-between"><span>COD hàng đã quét giao</span><span>{(tinhTienTheoHangDaQuet(modalXuLy.don, deliveryScanQuantities) - (modalXuLy.don?.fee_payer === 'receiver' ? Number(modalXuLy.don?.shipping_fee || 0) : 0)).toLocaleString()} VNĐ</span></div>
                          <div className="flex justify-between"><span>Phí vận chuyển ({modalXuLy.don?.fee_payer === 'receiver' ? 'người nhận trả' : 'người gửi trả'})</span><span>{modalXuLy.don?.fee_payer === 'receiver' ? Number(modalXuLy.don?.shipping_fee || 0).toLocaleString() : '0'} VNĐ</span></div>
                          <div className="flex justify-between border-t border-emerald-200 pt-1 font-black"><span>Tổng cần thu</span><span>{tinhTienTheoHangDaQuet(modalXuLy.don, deliveryScanQuantities).toLocaleString()} VNĐ</span></div>
                        </div>
                      <fieldset data-form-field="payment" tabIndex={-1} className="mt-4 border-t border-emerald-200 pt-3">
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
                                onChange={(event) => { setPhuongThucCOD(event.target.value); xoaLoiTruong('payment'); }}
                                className="accent-emerald-600"
                              />
                              {method.label}
                            </label>
                          ))}
                        </div>
                        {submitErrors.payment && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{submitErrors.payment}</p>}
                      </fieldset>
                      {submitErrors.cod && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{submitErrors.cod}</p>}
                      </>
                    ) : (
                      <p className="text-sm font-bold text-emerald-800">Đơn này không cần thu COD hoặc cước từ người nhận.</p>
                    )}
                    <div data-form-field="signature" tabIndex={-1} className="mt-4 border-t border-emerald-200 pt-3">
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
                      {submitErrors.signature && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{submitErrors.signature}</p>}
                      <p className="mt-1 text-[11px] text-emerald-800">Người nhận ký trực tiếp trên màn hình. Chữ ký được tải lên cùng ảnh minh chứng khi có kết nối mạng.</p>
                    </div>
                  </div>
                  </>
                )}

                {/* 3. BẮT BUỘC CHỤP ẢNH MINH CHỨNG */}
                <div data-form-field="proof" tabIndex={-1}>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Ảnh chụp bằng chứng {modalXuLy.loai === 'completed' || Number(selectedFailureReason?.require_evidence) === 1 ? '(*)' : '(nếu có)'}
                  </label>
                  {!anhPreview && cameraTarget === 'delivery' ? (
                    <div className="space-y-2">
                      <video ref={cameraVideoRef} autoPlay playsInline muted className="h-40 w-full rounded-xl bg-black object-contain" />
                      <div className="flex gap-2">
                        <button type="button" onClick={chupAnhTrucTiep} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 font-bold text-white">Chụp ảnh</button>
                        <button type="button" onClick={dongCamera} className="rounded-lg bg-slate-200 px-3 py-2 font-bold text-slate-700">Đóng camera</button>
                      </div>
                    </div>
                  ) : !anhPreview ? (
                    <div className="relative w-full h-32 border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl flex flex-col items-center justify-center overflow-hidden">
                      <Camera className="text-blue-500 mb-2" size={32} />
                      <button type="button" onClick={() => moCamera('delivery')} className="absolute inset-0 flex items-center justify-center text-sm font-bold text-blue-600">
                        Mở Camera Chụp Ảnh
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <img src={anhPreview} alt="Preview" className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                      <button 
                        type="button"
                        onClick={() => {
                          setAnhMinhChung(null);
                          setAnhPreview((current) => {
                            if (current) URL.revokeObjectURL(current);
                            return null;
                          });
                        }}
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

                <div data-form-field="gps" tabIndex={-1} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-700">Vị trí GPS sẽ được ghi cùng báo cáo để xác minh điểm xử lý.</p>
                  {submitErrors.gps && <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{submitErrors.gps}</p>}
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