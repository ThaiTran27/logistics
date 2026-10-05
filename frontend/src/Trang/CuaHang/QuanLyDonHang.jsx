import { apiFetch as fetch } from '../../utils/apiFetch.js';
import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import { io } from 'socket.io-client';
import * as XLSX from 'xlsx';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Store, PackagePlus, ListOrdered, Wallet, LogOut, User, Phone, MapPin, DollarSign, Clock, Truck, CheckCircle, AlertCircle, PackageSearch, Scale, Calculator, Eye, X, Box, MapPinned, Printer, Camera, Zap, ShieldAlert, Navigation, Bell, FileSpreadsheet, Download, Upload, KeyRound, Webhook, Copy, RotateCw } from 'lucide-react';
import Barcode from 'react-barcode';

import iconMarkerUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import hcmcLegacyBoundaryRaw from '../../../../shared/hcmc-legacy-boundary.geojson?raw';

const HCMC_BOUNDARY = JSON.parse(hcmcLegacyBoundaryRaw).features[0].geometry;
const HCMC_MAP_BOUNDS = L.geoJSON(HCMC_BOUNDARY).getBounds();
const HCMC_NOMINATIM_VIEWBOX = `${HCMC_MAP_BOUNDS.getWest()},${HCMC_MAP_BOUNDS.getNorth()},${HCMC_MAP_BOUNDS.getEast()},${HCMC_MAP_BOUNDS.getSouth()}`;
const HCMC_BOUNDARY_STYLE = { color: '#2563eb', weight: 2, fillOpacity: 0.03 };
const HCMC_DISTRICTS = [
  'Quận 1', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 6', 'Quận 7',
  'Quận 8', 'Quận 10', 'Quận 11', 'Quận 12', 'Quận Bình Tân',
  'Quận Bình Thạnh', 'Quận Gò Vấp', 'Quận Phú Nhuận', 'Quận Tân Bình',
  'Quận Tân Phú', 'Thành phố Thủ Đức', 'Huyện Bình Chánh', 'Huyện Cần Giờ',
  'Huyện Củ Chi', 'Huyện Hóc Môn', 'Huyện Nhà Bè', 'Quận 2', 'Quận 9'
];
const BULK_ORDER_LIMIT = 500;
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const BULK_ORDER_HEADERS = [
  'shop_address', 'shop_province', 'shop_lat', 'shop_lng',
  'receiver_name', 'receiver_phone', 'receiver_address', 'receiver_lat', 'receiver_lng',
  'customer_email', 'cod_amount', 'weight_kg', 'length', 'width', 'height',
  'item_value', 'service_fee', 'distance_km', 'destination_province',
  'fee_payer', 'service_type', 'is_fragile', 'is_remote_area'
];
const normalizeImportHeader = (value) => String(value || '')
  .trim()
  .toLocaleLowerCase('vi')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9]/g, '');

const isPointInRing = (longitude, latitude, ring) => {
  let isInside = false;
  for (let currentIndex = 0, previousIndex = ring.length - 1; currentIndex < ring.length; previousIndex = currentIndex++) {
    const [currentLongitude, currentLatitude] = ring[currentIndex];
    const [previousLongitude, previousLatitude] = ring[previousIndex];
    const crossProduct = (longitude - currentLongitude) * (previousLatitude - currentLatitude)
      - (latitude - currentLatitude) * (previousLongitude - currentLongitude);
    if (Math.abs(crossProduct) < 1e-10
      && longitude >= Math.min(currentLongitude, previousLongitude)
      && longitude <= Math.max(currentLongitude, previousLongitude)
      && latitude >= Math.min(currentLatitude, previousLatitude)
      && latitude <= Math.max(currentLatitude, previousLatitude)) {
      return true;
    }
    if ((currentLatitude > latitude) !== (previousLatitude > latitude)
      && longitude < ((previousLongitude - currentLongitude) * (latitude - currentLatitude))
        / (previousLatitude - currentLatitude) + currentLongitude) {
      isInside = !isInside;
    }
  }
  return isInside;
};
const isWithinHcmcBoundary = (lat, lng) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return HCMC_BOUNDARY.coordinates.some(([outerRing, ...innerRings]) => (
    isPointInRing(longitude, latitude, outerRing)
      && !innerRings.some((innerRing) => isPointInRing(longitude, latitude, innerRing))
  ));
};

const shopMarkerIcon = new L.Icon({
  iconUrl: iconMarkerUrl,
  shadowUrl: iconShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const liveDriverIcon = new L.Icon({
  iconUrl: iconMarkerUrl,
  shadowUrl: iconShadowUrl,
  iconSize: [30, 48],
  iconAnchor: [15, 48]
});

function FitTrackingMap({ route, driverLocation }) {
  const map = useMap();

  useEffect(() => {
    const points = [route?.warehouse, route?.pickup, route?.delivery, driverLocation]
      .filter((point) => Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng)))
      .map((point) => [Number(point.lat), Number(point.lng)]);

    if (points.length > 0) {
      map.fitBounds(points, { padding: [28, 28], maxZoom: 14 });
    }
  }, [driverLocation, map, route]);

  return null;
}

function LiveTrackingMap({ route, driverLocation }) {
  const routePoints = [route?.pickup, route?.warehouse, route?.delivery]
    .filter((point) => Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng)))
    .map((point) => [Number(point.lat), Number(point.lng)]);
  const mapCenter = routePoints[0] || [10.762622, 106.660172];

  return (
    <MapContainer center={mapCenter} zoom={13} scrollWheelZoom className="h-72 w-full rounded-2xl">
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitTrackingMap route={route} driverLocation={driverLocation} />
      {routePoints.length > 1 && <Polyline positions={routePoints} pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.75, dashArray: '8 8' }} />}
      {route?.pickup && <Marker position={[Number(route.pickup.lat), Number(route.pickup.lng)]} icon={shopMarkerIcon}><Popup><strong>Điểm lấy hàng</strong></Popup></Marker>}
      {route?.warehouse && <Marker position={[Number(route.warehouse.lat), Number(route.warehouse.lng)]} icon={shopMarkerIcon}><Popup><strong>{route.warehouse.label}</strong><br />{route.warehouse.address}</Popup></Marker>}
      {route?.delivery && <Marker position={[Number(route.delivery.lat), Number(route.delivery.lng)]} icon={shopMarkerIcon}><Popup><strong>Điểm giao hàng</strong></Popup></Marker>}
      {driverLocation && <Marker position={[Number(driverLocation.lat), Number(driverLocation.lng)]} icon={liveDriverIcon}><Popup><strong>Tài xế đang di chuyển</strong><br />Cập nhật: {new Date(driverLocation.updated_at || driverLocation.timestamp).toLocaleTimeString('vi-VN')}</Popup></Marker>}
    </MapContainer>
  );
}

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click: (event) => {
      if (isWithinHcmcBoundary(event.latlng.lat, event.latlng.lng)) {
        onSelect(event.latlng.lat, event.latlng.lng);
      }
    }
  });
  return null;
}

function HcmcBoundaryOverlay() {
  return <GeoJSON data={HCMC_BOUNDARY} style={HCMC_BOUNDARY_STYLE} interactive={false} />;
}

function RecenterMap({ value }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([value.lat, value.lng], 13, { duration: 1.2 });
  }, [value.lat, value.lng, map]);
  return null;
}

function ShopMapPicker({ value, onSelect }) {
  return (
    <MapContainer center={[value.lat, value.lng]} zoom={13} maxBounds={HCMC_MAP_BOUNDS} maxBoundsViscosity={1} scrollWheelZoom={true} className="h-64 w-full rounded-xl border border-slate-200">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <HcmcBoundaryOverlay />
      <RecenterMap value={value} />
      <MapClickHandler onSelect={onSelect} />
      <Marker position={[value.lat, value.lng]} icon={shopMarkerIcon} />
    </MapContainer>
  );
}

function MapClickHandlerReceiver({ onSelect }) {
  useMapEvents({
    click: (event) => {
      if (isWithinHcmcBoundary(event.latlng.lat, event.latlng.lng)) {
        onSelect(event.latlng.lat, event.latlng.lng);
      }
    }
  });

  return null;
}

export default function QuanLyDonHang() {
  const [donHang, setDonHang] = useState([]);
  const [form, setForm] = useState({ 
    shop_address: '',
    shop_province: 'Thành phố Hồ Chí Minh',
    shop_lat: 10.762622,
    shop_lng: 106.660172,
    shop_location_verified: false,
    receiver_name: '', 
    receiver_phone: '', 
    customer_email: '',
    receiver_address: '', 
    receiver_lat: null,
    receiver_lng: null,
    receiver_location_verified: false,
    destination_province: 'Quận 1',
    cod_amount: '',
    weight_kg: '1',
    length: '10',
    width: '10',
    height: '10',
    item_value: '0',
    service_fee: '0',
    distance_km: '5',
    is_remote_area: false,
    service_type: 'standard',
    vehicle_type: 'motorbike',
    fee_payer: 'sender',
    is_fragile: false
  });
  const [vehicleSelectionMode, setVehicleSelectionMode] = useState('automatic');
  const [showShopMap, setShowShopMap] = useState(false);
  const [showReceiverMap, setShowReceiverMap] = useState(false);
  const [shopMapSearch, setShopMapSearch] = useState('');
  const [shopSuggestions, setShopSuggestions] = useState([]);
  const [receiverMapSearch, setReceiverMapSearch] = useState('');
  const [receiverSuggestions, setReceiverSuggestions] = useState([]);
  
  const [shippingFee, setShippingFee] = useState(0);
  const [chargeableWeight, setChargeableWeight] = useState(0); // Trọng lượng tính cước cuối cùng
  const [tabHienTai, setTabHienTai] = useState('taodon');
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [shopApiKeys, setShopApiKeys] = useState([]);
  const [shopWebhook, setShopWebhook] = useState({ target_url: '', enabled: false, secret_configured: false });
  const [apiKeyName, setApiKeyName] = useState('');
  const [revealedCredential, setRevealedCredential] = useState(null);
  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [integrationError, setIntegrationError] = useState('');
  const [integrationMessage, setIntegrationMessage] = useState('');
  const [rmaOrders, setRmaOrders] = useState([]);
  const [rmaBusy, setRmaBusy] = useState(false);
  const [rmaLoading, setRmaLoading] = useState(false);
  const [rmaError, setRmaError] = useState('');
  const [rmaMessage, setRmaMessage] = useState('');
  const [thongBaoShop, setThongBaoShop] = useState([]);
  
  const [donHangDangChon, setDonHangDangChon] = useState(null);
  const [modalMo, setModalMo] = useState(false);
  const [routeTheoDoi, setRouteTheoDoi] = useState(null);
  const [viTriTaiXe, setViTriTaiXe] = useState(null);
  
  // State quản lý việc in phiếu
  const [phieuIn, setPhieuIn] = useState(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const requiresTruck = Number(form.weight_kg) > 100
    || (Number(form.length) * Number(form.width) * Number(form.height)) > 1000000;
  
  const shopId = localStorage.getItem('user_id');
  const shopName = localStorage.getItem('full_name') || 'Cửa Hàng Đối Tác';

  const taiCauHinhTichHop = useCallback(async () => {
    setIntegrationBusy(true);
    setIntegrationError('');
    try {
      const response = await fetch(`${API_URL}/api/shop/integrations`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không tải được cấu hình tích hợp.');
      setShopApiKeys(result.data.api_keys || []);
      setShopWebhook(result.data.webhook || { target_url: '', enabled: false, secret_configured: false });
    } catch (error) {
      setIntegrationError(error.message || 'Không tải được cấu hình tích hợp.');
    } finally {
      setIntegrationBusy(false);
    }
  }, []);

  useEffect(() => {
    if (tabHienTai === 'integrations') taiCauHinhTichHop();
  }, [tabHienTai, taiCauHinhTichHop]);

  const taiDanhSachRma = useCallback(async () => {
    setRmaLoading(true);
    setRmaError('');
    try {
      const response = await fetch(`${API_URL}/api/shop/rma`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không tải được hồ sơ hàng hoàn.');
      setRmaOrders(result.data || []);
    } catch (error) {
      setRmaError(error.message || 'Không tải được hồ sơ hàng hoàn.');
    } finally {
      setRmaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tabHienTai === 'rma') taiDanhSachRma();
  }, [tabHienTai, taiDanhSachRma]);

  const guiYeuCauGiaoLai = async (event, order) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setRmaBusy(true);
    setRmaError('');
    setRmaMessage('');
    try {
      const response = await fetch(`${API_URL}/api/shop/rma/${order.id}/redelivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: formData.get('note'),
          customer_confirmed: formData.get('customer_confirmed') === 'on'
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không gửi được yêu cầu giao lại.');
      setRmaMessage(result.message);
      await taiDanhSachRma();
    } catch (error) {
      setRmaError(error.message || 'Không gửi được yêu cầu giao lại.');
    } finally {
      setRmaBusy(false);
    }
  };

  const createShopApiKey = async (event) => {
    event.preventDefault();
    setIntegrationBusy(true);
    setIntegrationError('');
    setIntegrationMessage('');
    try {
      const response = await fetch(`${API_URL}/api/shop/integrations/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: apiKeyName })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không tạo được API key.');
      setRevealedCredential({ label: `API key · ${result.data.name}`, value: result.data.api_key });
      setApiKeyName('');
      await taiCauHinhTichHop();
      setIntegrationMessage(result.message);
    } catch (error) {
      setIntegrationError(error.message || 'Không tạo được API key.');
    } finally {
      setIntegrationBusy(false);
    }
  };

  const revokeShopApiKey = async (key) => {
    if (!window.confirm(`Thu hồi API key "${key.name}"? Hệ thống đang tích hợp bằng key này sẽ không thể tạo đơn nữa.`)) return;
    setIntegrationBusy(true);
    setIntegrationError('');
    setIntegrationMessage('');
    try {
      const response = await fetch(`${API_URL}/api/shop/integrations/keys/${key.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không thu hồi được API key.');
      setRevealedCredential(null);
      await taiCauHinhTichHop();
      setIntegrationMessage(result.message);
    } catch (error) {
      setIntegrationError(error.message || 'Không thu hồi được API key.');
    } finally {
      setIntegrationBusy(false);
    }
  };

  const saveShopWebhook = async (event) => {
    event.preventDefault();
    setIntegrationBusy(true);
    setIntegrationError('');
    setIntegrationMessage('');
    try {
      const response = await fetch(`${API_URL}/api/shop/integrations/webhook`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_url: shopWebhook.target_url })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không lưu được webhook.');
      await taiCauHinhTichHop();
      setIntegrationMessage(result.message);
    } catch (error) {
      setIntegrationError(error.message || 'Không lưu được webhook.');
    } finally {
      setIntegrationBusy(false);
    }
  };

  const createWebhookSecret = async () => {
    setIntegrationBusy(true);
    setIntegrationError('');
    setIntegrationMessage('');
    try {
      const response = await fetch(`${API_URL}/api/shop/integrations/webhook/secret`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không tạo được signing secret.');
      setRevealedCredential({ label: 'Webhook signing secret', value: result.data.secret });
      await taiCauHinhTichHop();
      setIntegrationMessage(result.message);
    } catch (error) {
      setIntegrationError(error.message || 'Không tạo được signing secret.');
    } finally {
      setIntegrationBusy(false);
    }
  };

  const copyCredential = async () => {
    if (!revealedCredential) return;
    try {
      await navigator.clipboard.writeText(revealedCredential.value);
      setIntegrationMessage('Đã sao chép thông tin bí mật.');
    } catch {
      setIntegrationError('Không thể truy cập clipboard. Hãy chọn và sao chép nội dung trong ô bên dưới.');
    }
  };

  const downloadBulkTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([BULK_ORDER_HEADERS]);
    worksheet['!cols'] = BULK_ORDER_HEADERS.map((header) => ({ wch: Math.max(header.length + 3, 18) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Don hang');
    XLSX.writeFile(workbook, 'mau-import-don-hang.xlsx');
  };

  const validateBulkOrder = (source, rowNumber) => {
    const order = Object.fromEntries(BULK_ORDER_HEADERS.map((header) => [header, source[header] ?? '']));
    const errors = [];
    const requiredText = [
      ['shop_address', 'Thiếu địa chỉ Shop'],
      ['receiver_name', 'Thiếu tên người nhận'],
      ['receiver_phone', 'Thiếu số điện thoại'],
      ['receiver_address', 'Thiếu địa chỉ người nhận']
    ];
    requiredText.forEach(([field, label]) => {
      if (!String(order[field] || '').trim()) errors.push(label);
    });

    order.receiver_phone = String(order.receiver_phone || '').trim().replace(/[\s().-]/g, '');
    if (/^84\d{9,10}$/.test(order.receiver_phone)) {
      order.receiver_phone = `0${order.receiver_phone.slice(2)}`;
    } else if (/^\d{9}$/.test(order.receiver_phone)) {
      order.receiver_phone = `0${order.receiver_phone}`;
    }
    if (order.receiver_phone && !/^0\d{9,10}$/.test(order.receiver_phone)) {
      errors.push('Số điện thoại phải có 10-11 chữ số và bắt đầu bằng 0');
    }
    order.customer_email = String(order.customer_email || '').trim();
    if (order.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.customer_email)) {
      errors.push('Email người nhận không hợp lệ');
    }

    const parseNumber = (field, label, { required = false, positive = false, fallback = null } = {}) => {
      const raw = order[field];
      if (raw === '' || raw === null || raw === undefined) {
        if (required) errors.push(`Thiếu ${label}`);
        else if (fallback !== null) order[field] = fallback;
        return null;
      }
      const value = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'));
      if (!Number.isFinite(value) || value < 0 || (positive && value <= 0)) {
        errors.push(`${label} không hợp lệ`);
        return null;
      }
      order[field] = value;
      return value;
    };
    const shopLat = parseNumber('shop_lat', 'vĩ độ Shop', { required: true });
    const shopLng = parseNumber('shop_lng', 'kinh độ Shop', { required: true });
    const receiverLat = parseNumber('receiver_lat', 'vĩ độ người nhận', { required: true });
    const receiverLng = parseNumber('receiver_lng', 'kinh độ người nhận', { required: true });
    const weight = parseNumber('weight_kg', 'cân nặng', { required: true, positive: true });
    const length = parseNumber('length', 'chiều dài', { required: true, positive: true });
    const width = parseNumber('width', 'chiều rộng', { required: true, positive: true });
    const height = parseNumber('height', 'chiều cao', { required: true, positive: true });
    parseNumber('cod_amount', 'COD', { fallback: 0 });
    parseNumber('item_value', 'giá trị hàng', { fallback: 0 });
    parseNumber('service_fee', 'phí dịch vụ', { fallback: 0 });
    parseNumber('distance_km', 'khoảng cách', { positive: true, fallback: 5 });

    if (shopLat !== null && (shopLat > 90 || shopLat < -90) || shopLng !== null && (shopLng > 180 || shopLng < -180)) {
      errors.push('Tọa độ Shop ngoài giới hạn');
    } else if (shopLat !== null && shopLng !== null && !isWithinHcmcBoundary(shopLat, shopLng)) {
      errors.push('Vị trí Shop ngoài vùng phục vụ TP. Hồ Chí Minh');
    }
    if (receiverLat !== null && (receiverLat > 90 || receiverLat < -90) || receiverLng !== null && (receiverLng > 180 || receiverLng < -180)) {
      errors.push('Tọa độ người nhận ngoài giới hạn');
    } else if (receiverLat !== null && receiverLng !== null && !isWithinHcmcBoundary(receiverLat, receiverLng)) {
      errors.push('Vị trí người nhận ngoài vùng phục vụ TP. Hồ Chí Minh');
    }
    if (weight !== null && length !== null && width !== null && height !== null
      && (weight > 100 || length * width * height > 1000000)) {
      order.vehicle_type = 'truck';
    }
    order.shop_province = String(order.shop_province || 'Thành phố Hồ Chí Minh').trim();
    order.destination_province = String(order.destination_province || 'Quận 1').trim();
    order.service_type = String(order.service_type || 'standard').trim().toLowerCase();
    order.fee_payer = String(order.fee_payer || 'sender').trim().toLowerCase();
    if (!['economy', 'standard', 'express'].includes(order.service_type)) errors.push('Loại dịch vụ phải là economy, standard hoặc express');
    if (!['sender', 'receiver'].includes(order.fee_payer)) errors.push('fee_payer phải là sender hoặc receiver');
    const parseBoolean = (value, label) => {
      const normalized = String(value ?? '').trim().toLowerCase();
      if (!normalized || ['false', '0', 'no', 'khong', 'không'].includes(normalized)) return false;
      if (['true', '1', 'yes', 'co', 'có'].includes(normalized)) return true;
      errors.push(`${label} phải là true/false`);
      return false;
    };
    order.is_fragile = parseBoolean(order.is_fragile, 'is_fragile');
    order.is_remote_area = parseBoolean(order.is_remote_area, 'is_remote_area');
    order.rowNumber = rowNumber;
    return { order, errors };
  };

  const parseBulkFile = async (file) => {
    setBulkError('');
    setBulkRows([]);
    setBulkFileName(file?.name || '');
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setBulkError('Chỉ chấp nhận file .xlsx, .xls hoặc .csv.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setBulkError('File import không được vượt quá 10 MB.');
      return;
    }
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('File không có trang tính dữ liệu.');
      const [headerRow, ...dataRows] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
      if (!headerRow?.length) throw new Error('Không tìm thấy hàng tiêu đề trong file.');
      const headerIndices = new Map(headerRow.map((header, index) => [normalizeImportHeader(header), index]));
      const missingHeaders = BULK_ORDER_HEADERS
        .filter((header) => !['customer_email', 'service_fee', 'item_value', 'distance_km', 'shop_province', 'destination_province', 'fee_payer', 'service_type', 'is_fragile', 'is_remote_area'].includes(header))
        .filter((header) => !headerIndices.has(normalizeImportHeader(header)));
      if (missingHeaders.length) throw new Error(`Thiếu cột bắt buộc: ${missingHeaders.join(', ')}`);
      const nonEmptyRows = dataRows.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
      if (!nonEmptyRows.length) throw new Error('File chưa có dòng đơn hàng nào.');
      if (nonEmptyRows.length > BULK_ORDER_LIMIT) throw new Error(`Mỗi lần chỉ nhập tối đa ${BULK_ORDER_LIMIT} đơn hàng.`);

      setBulkRows(nonEmptyRows.map((row, index) => {
        const source = Object.fromEntries(BULK_ORDER_HEADERS.map((header) => {
          const columnIndex = headerIndices.get(normalizeImportHeader(header));
          return [header, columnIndex === undefined ? '' : row[columnIndex]];
        }));
        const { order, errors } = validateBulkOrder(source, index + 2);
        return { rowNumber: index + 2, order, errors, status: errors.length ? 'invalid' : 'ready', result: '' };
      }));
    } catch (error) {
      setBulkError(error.message || 'Không đọc được file import.');
    }
  };

  const importBulkOrders = async () => {
    const readyRows = bulkRows.filter((row) => row.status === 'ready');
    if (!readyRows.length) {
      setBulkError('Không có dòng hợp lệ để tạo đơn.');
      return;
    }
    setBulkBusy(true);
    setBulkError('');
    const queue = [...readyRows];
    const worker = async () => {
      while (queue.length) {
        const currentRow = queue.shift();
        if (!currentRow) return;
        setBulkRows((currentRows) => currentRows.map((row) => (
          row.rowNumber === currentRow.rowNumber ? { ...row, status: 'creating', result: '' } : row
        )));
        try {
          const response = await fetch(`${API_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentRow.order)
          });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.message || 'Không tạo được đơn.');
          setBulkRows((currentRows) => currentRows.map((row) => (
            row.rowNumber === currentRow.rowNumber
              ? { ...row, status: 'success', result: `${data.tracking_code} · ${Number(data.shipping_fee || 0).toLocaleString('vi-VN')} đ` }
              : row
          )));
        } catch (error) {
          setBulkRows((currentRows) => currentRows.map((row) => (
            row.rowNumber === currentRow.rowNumber ? { ...row, status: 'failed', result: error.message || 'Lỗi kết nối.' } : row
          )));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, () => worker()));
    setBulkBusy(false);
    taiDuLieu();
  };

  useEffect(() => {
    const orderId = donHangDangChon?.id;
    if (!modalMo || !orderId) return undefined;

    let socket;
    const taiRoute = async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/${orderId}/route`);
        const data = await res.json();
        if (data.success) {
          setRouteTheoDoi(data.data);
          setViTriTaiXe(data.data.driver_location || null);
        }
      } catch (error) {
        console.error('Lỗi tải lộ trình vận đơn:', error);
      }
    };

    taiRoute();
    socket = io(API_URL, {
      auth: { token: localStorage.getItem('access_token') }
    });
    socket.emit('join_order_tracking', { order_id: orderId });
    socket.on('driver_location_changed', (data) => {
      if (String(data?.order_id) !== String(orderId)) return;
      setViTriTaiXe({
        lat: Number(data.lat),
        lng: Number(data.lng),
        timestamp: data.timestamp
      });
    });

    return () => {
      socket.disconnect();
      setRouteTheoDoi(null);
      setViTriTaiXe(null);
    };
  }, [donHangDangChon?.id, modalMo]);

  const taiDuLieu = async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        // Lọc đúng đơn hàng của Shop đang đăng nhập, tránh lộ dữ liệu
        const donCuaShop = data.data.filter(d => String(d?.shop_id) === String(shopId));
        setDonHang(donCuaShop); 
      } else {
        setDonHang([]);
      }
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
      setDonHang([]);
    }
  };

  const taiThongBao = async () => {
    if (!shopId) return;
    try {
      const res = await fetch(`${API_URL}/api/notifications/${shopId}`);
      const data = await res.json();
      if (data.success) setThongBaoShop(data.data || []);
    } catch (error) {
      console.error('Lỗi tải thông báo:', error);
    }
  };

  const calculateDistanceKm = (lat1, lng1, lat2, lng2) => {
    const toRad = (value) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  };

  const determineVehicleType = ({ weight_kg, length, width, height, distance_km }) => {
    const actualWeight = Number(weight_kg) || 0;
    const volume = Number(length) * Number(width) * Number(height);
    const dist = Number(distance_km) || 0;

    if (dist > 180 || actualWeight > 100 || volume > 1000000) return 'truck';
    if (dist > 80 || actualWeight > 25 || volume > 300000) return 'van';
    return 'motorbike';
  };

  useEffect(() => {
    taiDuLieu();
    taiThongBao();
    const socket = io(API_URL, {
      auth: { token: localStorage.getItem('access_token') }
    });
    socket.on('order_status_changed', (data) => {
      setDonHang((currentOrders) => currentOrders.map((order) => (
        String(order.id) === String(data?.order_id)
          ? { ...order, status: data.status }
          : order
      )));
    });
    socket.on(`notification_new_${shopId}`, taiThongBao);
    return () => socket.disconnect();
  }, [shopId]);

  const danhDauDaDoc = async (notification) => {
    if (!notification.is_read) {
      await fetch(`${API_URL}/api/notifications/${notification.id}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: shopId })
      });
      setThongBaoShop((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: 1 } : item));
    }
    if (notification.order_id) setTabHienTai('danhsach');
  };

  // [LOGIC MỚI CHUẨN VIETTEL POST] Thuật toán tính phí ship tự động
  useEffect(() => {
    const actualWeight = parseFloat(form.weight_kg) || 0;
    const l = parseFloat(form.length) || 0;
    const w = parseFloat(form.width) || 0;
    const h = parseFloat(form.height) || 0;
    const isRemote = Boolean(form.is_remote_area);
    const isFragile = form.is_fragile;

    const destinationCenter =
      form.receiver_lat && form.receiver_lng
        ? { lat: Number(form.receiver_lat), lng: Number(form.receiver_lng) }
        : { lat: 10.762622, lng: 106.660172 };

    const autoDistance = Math.max(
      1,
      Math.round(
        calculateDistanceKm(Number(form.shop_lat), Number(form.shop_lng), Number(destinationCenter.lat), Number(destinationCenter.lng))
      )
    );

    const autoVehicleType = determineVehicleType({
      weight_kg: actualWeight,
      length: l,
      width: w,
      height: h,
      distance_km: autoDistance
    });
    const effectiveVehicleType = requiresTruck ? 'truck' : vehicleSelectionMode === 'automatic' ? autoVehicleType : form.vehicle_type;
    const selectedVehicleType = effectiveVehicleType;

    setForm(prev => {
      const nextDistance = String(autoDistance);
      const nextVehicle = requiresTruck ? 'truck' : vehicleSelectionMode === 'automatic' ? autoVehicleType : prev.vehicle_type;
      const shouldUpdate = Number(prev.distance_km) !== autoDistance || prev.vehicle_type !== nextVehicle || prev.is_remote_area !== isRemote;
      if (!shouldUpdate) return prev;
      return {
        ...prev,
        distance_km: nextDistance,
        vehicle_type: nextVehicle,
        is_remote_area: isRemote
      };
    });

    const volumetricWeight = (l * w * h) / 5000;
    const finalWeight = Math.max(actualWeight, volumetricWeight);
    setChargeableWeight(finalWeight);

    const baseFee = { economy: 18000, standard: 28000, express: 45000 }[form.service_type] || 28000;
    const serviceFactor = { economy: 0.88, standard: 1, express: 1.5 }[form.service_type] || 1;
    const distanceFee = Math.max(0, autoDistance - 5) * 1700;
    const weightFee = finalWeight > 2 ? Math.ceil((finalWeight - 2) / 0.5) * 4500 : 0;
    const remoteFee = isRemote ? 22000 : 0;
    const fragileFee = isFragile ? 12000 : 0;
    const vehicleFactor = { motorbike: 1, van: 1.5, truck: 2.5 }[selectedVehicleType] || 1;
    const total = Math.round((baseFee + distanceFee + weightFee + remoteFee + fragileFee) * serviceFactor * vehicleFactor / 1000) * 1000;
    setShippingFee(total);
  }, [
    form.shop_lat,
    form.shop_lng,
    form.receiver_lat,
    form.receiver_lng,
    form.shop_province,
    form.destination_province,
    form.fee_payer,
    form.weight_kg,
    form.length,
    form.width,
    form.height,
    form.item_value,
    form.service_type,
    form.vehicle_type,
    form.is_remote_area,
    form.is_fragile,
    vehicleSelectionMode,
    requiresTruck,
  ]);

  const layCuocPhiChuan = (don) => {
    if (don?.shipping_fee !== undefined && don?.shipping_fee !== null && Number(don.shipping_fee) > 0) {
      return Number(don.shipping_fee);
    }
    return 15000;
  };

  const updateShopLocationFromMap = async (lat, lng) => {
    setForm((prev) => ({ ...prev, shop_lat: lat, shop_lng: lng }));

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'vi' }
      });
      const data = await res.json();
      const detail = data?.display_name || 'Địa điểm đã chọn trên bản đồ';
      setForm((prev) => ({ ...prev, shop_address: detail, shop_lat: lat, shop_lng: lng, shop_location_verified: true }));
      setShopMapSearch(detail);
    } catch (error) {
      console.error('Không lấy được địa chỉ từ bản đồ:', error);
    }
  };

  const searchShopLocation = async (query) => {
    const cleanQuery = query.trim();
    setShopMapSearch(query);
    if (!cleanQuery || cleanQuery.length < 2) {
      setShopSuggestions([]);
      return;
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=vn&viewbox=${HCMC_NOMINATIM_VIEWBOX}&bounded=1&q=${encodeURIComponent(`${cleanQuery}, TP. Hồ Chí Minh, Việt Nam`)}`, {
        headers: { 'Accept-Language': 'vi' }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const options = Array.isArray(data) ? data.filter((place) => isWithinHcmcBoundary(place.lat, place.lon)) : [];
      setShopSuggestions(options);
    } catch (error) {
      console.error('Lỗi tìm kiếm địa điểm:', error);
      setShopSuggestions([]);
    }
  };

  const selectSuggestedLocation = (place) => {
    const lat = Number(place.lat);
    const lng = Number(place.lon);
    if (!isWithinHcmcBoundary(lat, lng)) {
      setShopSuggestions([]);
      return alert('Chỉ được chọn vị trí trong phạm vi TP. Hồ Chí Minh.');
    }
    const displayName = place.display_name || 'Địa điểm đã chọn';
    setForm((prev) => ({ ...prev, shop_address: displayName, shop_lat: lat, shop_lng: lng, shop_location_verified: !String(place.place_id).startsWith('fallback-') }));
    setShopMapSearch(displayName);
    setShopSuggestions([]);
    setShowShopMap(true);
  };

  const updateReceiverLocationFromMap = async (lat, lng) => {
    setForm((prev) => ({ ...prev, receiver_lat: lat, receiver_lng: lng, receiver_location_verified: true }));

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'vi' }
      });
      const data = await res.json();
      const detail = data?.display_name || 'Địa điểm giao hàng đã chọn';
      setForm((prev) => ({ ...prev, receiver_address: detail, receiver_lat: lat, receiver_lng: lng, receiver_location_verified: true }));
      setReceiverMapSearch(detail);
    } catch (error) {
      console.error('Không lấy được địa chỉ giao hàng từ bản đồ:', error);
    }
  };

  const searchReceiverLocation = async (query) => {
    const cleanQuery = query.trim();
    setReceiverMapSearch(query);
    if (!cleanQuery || cleanQuery.length < 2) {
      setReceiverSuggestions([]);
      return;
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=vn&viewbox=${HCMC_NOMINATIM_VIEWBOX}&bounded=1&q=${encodeURIComponent(`${cleanQuery}, ${form.destination_province}, TP. Hồ Chí Minh, Việt Nam`)}`, {
        headers: { 'Accept-Language': 'vi' }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const options = Array.isArray(data) ? data.filter((place) => isWithinHcmcBoundary(place.lat, place.lon)) : [];
      setReceiverSuggestions(options);
    } catch (error) {
      console.error('Lỗi tìm kiếm địa chỉ giao hàng:', error);
      setReceiverSuggestions([]);
    }
  };

  const selectSuggestedReceiverLocation = (place) => {
    const lat = Number(place.lat);
    const lng = Number(place.lon);
    if (!isWithinHcmcBoundary(lat, lng)) {
      setReceiverSuggestions([]);
      return alert('Chỉ được chọn vị trí trong phạm vi TP. Hồ Chí Minh.');
    }
    const displayName = place.display_name || 'Địa điểm giao hàng đã chọn';
    setForm((prev) => ({ ...prev, receiver_address: displayName, receiver_lat: lat, receiver_lng: lng, receiver_location_verified: !String(place.place_id).startsWith('fallback-') }));
    setReceiverMapSearch(displayName);
    setReceiverSuggestions([]);
    setShowReceiverMap(true);
  };

  const taoDonMoi = async (e) => {
    e.preventDefault();
    if (!form.shop_location_verified || !form.receiver_location_verified) {
      return alert('Vui lòng chọn đúng vị trí Shop và điểm giao trên bản đồ để hệ thống định tuyến qua kho con.');
    }
    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          shop_address: form.shop_address,
          shop_province: form.shop_province,
          shop_lat: form.shop_lat,
          shop_lng: form.shop_lng,
          receiver_name: form.receiver_name,
          receiver_phone: form.receiver_phone,
          receiver_address: form.receiver_address,
          receiver_lat: form.receiver_lat,
          receiver_lng: form.receiver_lng,
          destination_province: form.destination_province,
          cod_amount: form.cod_amount,
          customer_email: form.customer_email,
          shipping_fee: shippingFee,
          weight_kg: chargeableWeight,
          length: form.length,
          width: form.width,
          height: form.height,
          item_value: form.item_value,
          service_fee: form.service_fee,
          distance_km: form.distance_km,
          is_remote_area: form.is_remote_area,
          service_type: form.service_type,
          is_fragile: form.is_fragile,
          fee_payer: form.fee_payer,
          vehicle_type: vehicleSelectionMode === 'automatic' ? determineVehicleType({
            weight_kg: chargeableWeight,
            length: form.length,
            width: form.width,
            height: form.height,
            distance_km: form.distance_km
          }) : form.vehicle_type,
          shop_id: shopId
        })
      });
      const data = await res.json();
      
      if (data.success) {
        const trackingCode = data.tracking_code;
        const confirmedFee = Number(data.shipping_fee ?? shippingFee);
        setShippingFee(confirmedFee);
        alert(`Tạo đơn thành công! Mã vận đơn: ${trackingCode} | Cước phí: ${confirmedFee.toLocaleString()} đ`);
        setForm({ 
          shop_address: '', shop_province: 'Thành phố Hồ Chí Minh', shop_lat: 10.762622, shop_lng: 106.660172, shop_location_verified: false, receiver_name: '', receiver_phone: '', receiver_address: '', receiver_lat: null, receiver_lng: null, receiver_location_verified: false, destination_province: 'Quận 1', cod_amount: '',
          customer_email: '',
          weight_kg: '1', length: '10', width: '10', height: '10', item_value: '0', service_fee: '0',
          distance_km: '5', is_remote_area: false, service_type: 'standard', vehicle_type: 'motorbike', fee_payer: 'sender', is_fragile: false
        });
        setSelectedOrderIds([]);
        taiDuLieu();
        setTabHienTai('danhsach');
      } else {
        alert("Lỗi: " + (data.message || 'Không thể tạo đơn hàng.'));
      }
    } catch {
      alert("Lỗi kết nối máy chủ!");
    }
  };

  const dangXuat = () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      localStorage.clear();
      window.location.href = '/'; 
    }
  };

  const xacNhanInPhieu = () => {
    window.print();
  };

  const hienThiTrangThai = (status) => {
    switch(status) {
      case 'pending': return <span className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><Clock size={14}/> Chờ xử lý</span>;
      case 'picking': return <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><PackageSearch size={14}/> Lấy hàng</span>;
      case 'picked_up': return <span className="bg-cyan-100 text-cyan-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><PackageSearch size={14}/> Đã lấy, chờ nhập kho</span>;
      case 'at_origin_warehouse': return <span className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><Box size={14}/> Đã về kho con nguồn</span>;
      case 'transferring_to_central': return <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><Truck size={14}/> Đang về kho tổng</span>;
      case 'at_central_warehouse': return <span className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><Box size={14}/> Đang phân luồng tại kho tổng</span>;
      case 'transferring_to_destination': return <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><Truck size={14}/> Đang về kho con đích</span>;
      case 'at_destination_warehouse': return <span className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><Box size={14}/> Đã tới kho con đích</span>;
      case 'in_warehouse': return <span className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><Box size={14}/> Đã nhập kho</span>;
      case 'delivering': return <span className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><Truck size={14}/> Đang giao</span>;
      case 'completed': return <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><CheckCircle size={14}/> Thành công</span>;
      case 'returning': return <span className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><AlertCircle size={14}/> Đang Hoàn</span>;
      case 'cancelled': return <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 w-fit"><X size={14}/> Đã hủy</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase">{status}</span>;
    }
  };

  const renderChiTietTienDo = (status) => {
    const cacBuoc = [
      { id: 'pending', name: 'Chờ Xử Lý', desc: 'Đơn hàng mới tạo từ Cửa hàng', icon: <Clock size={18} /> },
      { id: 'picking', name: 'Đang Lấy Hàng', desc: 'Tài xế đã nhận việc và đang đến lấy', icon: <PackageSearch size={18} /> },
      { id: 'picked_up', name: 'Đã Lấy Hàng', desc: 'Tài xế đang bàn giao kiện hàng cho kho', icon: <PackageSearch size={18} /> },
      { id: 'at_origin_warehouse', name: 'Kho Con Nguồn', desc: 'Hàng đã được nhận tại kho con theo phường lấy', icon: <Box size={18} /> },
      { id: 'transferring_to_central', name: 'Về Kho Tổng', desc: 'Tài xế trung chuyển đưa hàng về kho tổng', icon: <Truck size={18} /> },
      { id: 'at_central_warehouse', name: 'Phân Luồng Tại Kho Tổng', desc: 'Hàng được tổng hợp và phân về kho con đích', icon: <Box size={18} /> },
      { id: 'transferring_to_destination', name: 'Về Kho Con Đích', desc: 'Tài xế trung chuyển đưa hàng tới kho con giao', icon: <Truck size={18} /> },
      { id: 'at_destination_warehouse', name: 'Kho Con Đích', desc: 'Hàng chờ tài xế giao nhận tại phường đích', icon: <Box size={18} /> },
      { id: 'delivering', name: 'Đang Giao Hàng', desc: 'Shipper đang mang hàng đến khách', icon: <Truck size={18} /> },
      { id: 'completed', name: 'Giao Thành Công', desc: 'Khách đã nhận và thanh toán COD', icon: <CheckCircle size={18} /> }
    ];

    const mucHienTai = cacBuoc.findIndex((buoc) => buoc.id === status);

    if (status === 'cancelled' || status === 'returning') {
      return (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold flex items-center gap-2 border border-red-100 my-4">
          <AlertCircle size={20} /> Đơn hàng giao thất bại.
        </div>
      );
    }

    return (
      <div className="space-y-6 my-6 relative pl-6 border-l-2 border-blue-100 ml-2">
        {cacBuoc.map((buoc, index) => {
          const daQua = index <= mucHienTai;
          const dangChay = index === mucHienTai;
          
          return (
            <div key={buoc.id} className="relative group">
              <div className={`absolute -left-[31px] top-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                daQua ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-100 text-slate-400 border border-slate-200'
              } ${dangChay ? 'ring-4 ring-blue-100 scale-110' : ''}`}>
                {buoc.icon}
              </div>
              <div className="pl-4">
                <p className={`font-bold text-base ${daQua ? 'text-slate-800' : 'text-slate-400'}`}>{buoc.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{buoc.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const safeDonHang = Array.isArray(donHang) ? donHang : [];
  const tongDon = safeDonHang.length;
  const tongCOD = safeDonHang.reduce((sum, item) => sum + Number(item?.cod_amount || 0), 0);
  const donThanhCong = safeDonHang.filter(d => d?.status === 'completed').length;

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-[#F0F7FF] font-sans text-slate-700 print:hidden">
        
        {/* SIDEBAR */}
        <div className="sticky top-0 z-10 flex h-screen w-72 shrink-0 flex-col justify-between border-r border-blue-50 bg-white shadow-[0_0_20px_rgba(0,0,0,0.02)]">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="p-8 border-b border-blue-50 flex items-center gap-3">
              <div className="bg-gradient-to-tr from-blue-600 to-blue-400 p-2.5 rounded-xl shadow-blue-200 shadow-lg">
                <Store className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Cổng Đối Tác</h2>
                <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mt-0.5">Quản lý Cửa Hàng</p>
                <p className="mt-1 max-w-40 truncate text-sm font-bold text-slate-700" title={shopName}>{shopName}</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 p-5 mt-2">
              <button 
                onClick={() => setTabHienTai('taodon')}
                className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'taodon' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-200' : 'bg-transparent text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
              >
                <PackagePlus size={20} className={tabHienTai === 'taodon' ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'} />
                Tạo Đơn Giao Hàng
              </button>
              
              <button 
                onClick={() => setTabHienTai('danhsach')}
                className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'danhsach' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-200' : 'bg-transparent text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
              >
                <ListOrdered size={20} className={tabHienTai === 'danhsach' ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'} />
                Quản Lý Vận Đơn
              </button>

              <button
                onClick={() => setTabHienTai('import')}
                className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'import' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-200' : 'bg-transparent text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
              >
                <FileSpreadsheet size={20} className={tabHienTai === 'import' ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'} />
                Import đơn hàng
              </button>

              <button
                onClick={() => setTabHienTai('rma')}
                className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'rma' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-200' : 'bg-transparent text-slate-500 hover:bg-orange-50 hover:text-orange-600'}`}
              >
                <RotateCw size={20} className={tabHienTai === 'rma' ? 'text-white' : 'text-slate-400 group-hover:text-orange-500'} />
                <span className="flex-1">Hàng hoàn / RMA</span>
                {rmaOrders.length > 0 && <span className={`rounded-full px-2 py-0.5 text-xs font-black ${tabHienTai === 'rma' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'}`}>{rmaOrders.length}</span>}
              </button>

              <button
                onClick={() => setTabHienTai('integrations')}
                className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'integrations' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-200' : 'bg-transparent text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
              >
                <KeyRound size={20} className={tabHienTai === 'integrations' ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'} />
                API & Webhook
              </button>

              <button
                onClick={() => setTabHienTai('thongbao')}
                className={`px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group ${tabHienTai === 'thongbao' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-200' : 'bg-transparent text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
              >
                <Bell size={20} />
                <span className="flex-1">Thông Báo</span>
                {thongBaoShop.some((item) => !item.is_read) && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-black text-white">{thongBaoShop.filter((item) => !item.is_read).length}</span>}
              </button>
            </div>
          </div>

          <div className="shrink-0 border-t border-blue-50 p-5">
            <button 
              onClick={dangXuat}
              className="w-full px-5 py-4 rounded-2xl font-bold text-left transition-all duration-300 flex items-center gap-4 group bg-transparent text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={20} className="text-red-400 group-hover:text-red-500" />
              Đăng Xuất
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="min-w-0 flex-1 overflow-y-auto p-10">
          <div className="mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                {tabHienTai === 'taodon' ? 'Khởi Tạo Vận Đơn Mới' : tabHienTai === 'thongbao' ? 'Thông Báo Vận Đơn' : tabHienTai === 'import' ? 'Import Đơn Hàng Hàng Loạt' : tabHienTai === 'integrations' ? 'API & Webhook' : tabHienTai === 'rma' ? 'Quản Lý Hàng Hoàn · RMA' : 'Danh Sách Vận Đơn'}
              </h1>
              <p className="text-slate-500 mt-2">
                {tabHienTai === 'taodon' ? 'Lựa chọn gói dịch vụ và nhập thông tin để tính cước tự động.' : tabHienTai === 'thongbao' ? 'Cập nhật mới nhất về các vận đơn của cửa hàng.' : tabHienTai === 'import' ? 'Tải Excel/CSV, xem trước lỗi từng dòng và chỉ gửi đơn hợp lệ.' : tabHienTai === 'integrations' ? 'Quản lý khóa tích hợp riêng của Shop và webhook cập nhật đơn.' : tabHienTai === 'rma' ? 'Theo dõi lý do giao thất bại, bằng chứng tài xế và gửi yêu cầu giao lại.' : 'Theo dõi tiến độ giao hàng và in mã vạch vận chuyển.'}
              </p>
            </div>
          </div>

          {tabHienTai === 'integrations' && (
            <section className="max-w-6xl space-y-5">
              {(integrationError || integrationMessage) && (
                <p role={integrationError ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm font-semibold ${integrationError ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {integrationError || integrationMessage}
                </p>
              )}
              {revealedCredential && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-black text-amber-900">{revealedCredential.label}</h2>
                      <p className="mt-1 text-sm text-amber-800">Thông tin này chỉ hiển thị một lần. Hãy lưu ở kho bí mật an toàn.</p>
                    </div>
                    <button type="button" onClick={copyCredential} className="inline-flex items-center gap-2 rounded-lg border border-amber-400 px-3 py-2 text-sm font-black text-amber-900 hover:bg-amber-100">
                      <Copy size={16} /> Sao chép
                    </button>
                  </div>
                  <code className="mt-3 block select-all break-all rounded-lg bg-white p-3 text-sm text-slate-800">{revealedCredential.value}</code>
                </div>
              )}

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start gap-3">
                    <KeyRound className="mt-1 text-blue-700" />
                    <div>
                      <h2 className="text-lg font-black">API key riêng của Shop</h2>
                      <p className="mt-1 text-sm text-slate-500">Dùng để đẩy đơn từ website hoặc nền tảng bán hàng. Mỗi Shop tối đa 10 khóa đang hoạt động.</p>
                    </div>
                  </div>
                  <form onSubmit={createShopApiKey} className="mt-5 flex flex-wrap gap-2">
                    <input required maxLength={100} value={apiKeyName} onChange={(event) => setApiKeyName(event.target.value)} placeholder="Tên tích hợp, ví dụ WooCommerce" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
                    <button disabled={integrationBusy} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50">Tạo API key</button>
                  </form>
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[430px] text-left text-sm">
                      <thead className="border-b text-xs uppercase text-slate-400"><tr><th className="py-2">Tên / Prefix</th><th className="py-2">Sử dụng gần nhất</th><th className="py-2">Thao tác</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {shopApiKeys.map((key) => (
                          <tr key={key.id}>
                            <td className="py-3"><span className="block font-bold">{key.name}</span><code className="text-xs text-slate-500">{key.key_prefix}...</code></td>
                            <td className="py-3 text-xs text-slate-500">{key.last_used_at ? new Date(key.last_used_at).toLocaleString('vi-VN') : 'Chưa sử dụng'}</td>
                            <td className="py-3"><button type="button" disabled={integrationBusy} onClick={() => revokeShopApiKey(key)} className="font-bold text-rose-700 hover:underline disabled:opacity-50">Thu hồi</button></td>
                          </tr>
                        ))}
                        {!integrationBusy && !shopApiKeys.length && <tr><td colSpan="3" className="py-6 text-center text-slate-400">Chưa có API key.</td></tr>}
                      </tbody>
                    </table>
                    {integrationBusy && <p role="status" className="mt-3 text-xs text-slate-500">Đang xử lý...</p>}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Webhook className="mt-1 text-emerald-700" />
                    <div>
                      <h2 className="text-lg font-black">Webhook trạng thái đơn</h2>
                      <p className="mt-1 text-sm text-slate-500">Hệ thống gửi sự kiện `order.delivered` qua HTTPS khi đơn được giao thành công.</p>
                    </div>
                  </div>
                  <form onSubmit={saveShopWebhook} className="mt-5 space-y-3">
                    <label className="block text-sm font-bold text-slate-700">Endpoint HTTPS công khai
                      <input type="url" value={shopWebhook.target_url} onChange={(event) => setShopWebhook((current) => ({ ...current, target_url: event.target.value }))} placeholder="https://shop.example.com/webhooks/logistics" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                    </label>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className={`text-sm font-bold ${shopWebhook.enabled ? 'text-emerald-700' : 'text-slate-500'}`}>{shopWebhook.enabled ? 'Webhook đang bật' : 'Webhook đang tắt'}</span>
                      <button type="submit" disabled={integrationBusy} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-black hover:bg-slate-50 disabled:opacity-50">Lưu endpoint</button>
                    </div>
                  </form>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-500">{shopWebhook.secret_configured ? 'Đã có signing secret; tạo lại sẽ vô hiệu secret cũ.' : 'Chưa có signing secret.'}</p>
                    <button type="button" disabled={integrationBusy || !shopWebhook.target_url} onClick={createWebhookSecret} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-50">
                      <RotateCw size={15} /> {shopWebhook.secret_configured ? 'Tạo lại secret' : 'Tạo secret'}
                    </button>
                  </div>
                </section>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black">Tích hợp API tạo đơn</h2>
                <p className="mt-1 text-sm text-slate-500">Gửi `POST {API_URL}/api/v1/orders`, header `x-api-key`. Chủ Shop được xác định từ API key; không cần gửi shop_id.</p>
                <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-emerald-100">{`{
  "shop_address": "12 Nguyễn Huệ, Quận 1",
  "shop_lat": 10.7731,
  "shop_lng": 106.703,
  "receiver_name": "Nguyễn Văn A",
  "receiver_phone": "0901234567",
  "receiver_address": "1 Lê Duẩn, Quận 1",
  "receiver_lat": 10.7798,
  "receiver_lng": 106.699,
  "weight_kg": 1,
  "length": 10,
  "width": 10,
  "height": 10,
  "service_type": "standard",
  "fee_payer": "sender"
}`}</pre>
                <p className="mt-3 text-xs text-slate-500">
                  Webhook ký HMAC-SHA256 trên raw request body, gửi trong header <code>X-SmartLogistics-Signature: sha256=&lt;hex&gt;</code>.
                  Dùng HTTPS và xác minh chữ ký ở hệ thống nhận trước khi xử lý.
                </p>
                {integrationBusy && <p role="status" className="mt-3 text-xs text-slate-500">Đang tải cấu hình...</p>}
              </section>
            </section>
          )}

          {tabHienTai === 'rma' && (
            <section className="max-w-6xl space-y-5">
              {(rmaError || rmaMessage) && (
                <p role={rmaError ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm font-semibold ${rmaError ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {rmaError || rmaMessage}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Đơn đang hoàn</p>
                  <p className="mt-2 text-3xl font-black text-orange-600">{rmaOrders.length}</p>
                </div>
                <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Tỷ lệ đơn đang hoàn</p>
                  <p className="mt-2 text-3xl font-black text-rose-600">{donHang.length ? `${((rmaOrders.length / donHang.length) * 100).toFixed(1)}%` : '0%'}</p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Chờ duyệt giao lại</p>
                  <p className="mt-2 text-3xl font-black text-amber-600">{rmaOrders.filter((order) => order.redelivery_status === 'pending').length}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Đã yêu cầu giao lại</p>
                  <p className="mt-2 text-3xl font-black text-emerald-600">{rmaOrders.filter((order) => ['pending', 'approved'].includes(order.redelivery_status)).length}</p>
                </div>
              </div>
              {rmaLoading ? (
                <div role="status" className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-semibold text-slate-500">Đang tải hồ sơ hàng hoàn...</div>
              ) : rmaOrders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                  <CheckCircle className="mx-auto text-emerald-500" size={36} />
                  <p className="mt-3 font-black text-slate-800">Chưa có đơn hàng hoàn</p>
                  <p className="mt-1 text-sm text-slate-500">Đơn giao thất bại sẽ xuất hiện tại đây cùng lý do và bằng chứng.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rmaOrders.map((order) => (
                    <article key={order.id} className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Mã vận đơn</p>
                          <h2 className="mt-1 text-xl font-black text-slate-800">{order.tracking_code}</h2>
                          <p className="mt-1 text-sm text-slate-500">Cập nhật {new Date(order.updated_at).toLocaleString('vi-VN')}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1.5 text-xs font-black ${order.redelivery_status === 'pending' ? 'bg-amber-100 text-amber-800' : order.redelivery_status === 'approved' ? 'bg-emerald-100 text-emerald-800' : order.redelivery_status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-orange-100 text-orange-800'}`}>
                          {order.redelivery_status === 'pending' ? 'Yêu cầu chờ duyệt' : order.redelivery_status === 'approved' ? 'Đã duyệt yêu cầu' : order.redelivery_status === 'rejected' ? 'Yêu cầu bị từ chối' : 'Đang hoàn hàng'}
                        </span>
                      </div>
                      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1fr]">
                        <div className="space-y-4">
                          <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                            <p className="flex items-center gap-2 text-sm font-black text-rose-800"><AlertCircle size={16} /> Lý do giao thất bại</p>
                            <p className="mt-2 text-sm text-rose-700">{order.fail_reason || 'Chưa có ghi chú lý do.'}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-4 text-sm">
                            <p><span className="font-bold text-slate-500">Người nhận:</span> {order.receiver_name} · {order.receiver_phone}</p>
                            <p className="mt-1"><span className="font-bold text-slate-500">Địa chỉ:</span> {order.receiver_address}</p>
                            <p className="mt-1"><span className="font-bold text-slate-500">COD:</span> {Number(order.cod_amount || 0).toLocaleString('vi-VN')} đ</p>
                          </div>
                          {order.redelivery_status === 'rejected' && order.redelivery_review_note && (
                            <p className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700"><strong>Phản hồi điều phối:</strong> {order.redelivery_review_note}</p>
                          )}
                          {order.redelivery_status === 'pending' && (
                            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                              <p className="font-semibold">Yêu cầu đã gửi điều phối. Đơn chưa được tự động chuyển sang lượt giao mới.</p>
                              {order.redelivery_note && <p className="mt-2"><strong>Ghi chú Shop:</strong> {order.redelivery_note}</p>}
                            </div>
                          )}
                          {order.redelivery_status === 'approved' && order.redelivery_note && (
                            <p className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800"><strong>Yêu cầu đã được duyệt.</strong> Ghi chú Shop: {order.redelivery_note}</p>
                          )}
                          {(!order.redelivery_status || order.redelivery_status === 'rejected') && (
                            <form onSubmit={(event) => guiYeuCauGiaoLai(event, order)} className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                              <label className="block text-sm font-black text-slate-700" htmlFor={`rma-note-${order.id}`}>Ghi chú yêu cầu giao lại</label>
                              <textarea id={`rma-note-${order.id}`} name="note" required minLength={8} maxLength={1000} rows={3} className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm" placeholder="Ví dụ: Đã liên hệ khách, khách xác nhận nhận hàng sau 18:00..." />
                              <label className="flex items-start gap-2 text-xs font-semibold text-slate-600">
                                <input name="customer_confirmed" type="checkbox" required className="mt-0.5 accent-blue-700" />
                                Tôi xác nhận đã trao đổi và khách đồng ý nhận lại đơn.
                              </label>
                              <button disabled={rmaBusy} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50">
                                <RotateCw size={16} /> {rmaBusy ? 'Đang gửi...' : 'Yêu cầu giao lại'}
                              </button>
                            </form>
                          )}
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-800"><Camera size={16} className="text-orange-600" /> Bằng chứng và lịch sử xử lý</p>
                            <div className="space-y-3">
                              {(order.status_history || []).length === 0 ? (
                                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Chưa có lịch sử bằng chứng.</p>
                              ) : order.status_history.map((entry) => (
                                <div key={`${entry.order_id}-${entry.created_at}`} className="rounded-xl border border-slate-100 p-3">
                                  <p className="text-xs font-bold text-slate-500">{entry.to_status === 'returning' ? 'Giao thất bại' : entry.to_status} · {new Date(entry.created_at).toLocaleString('vi-VN')}</p>
                                  {entry.note && <p className="mt-1 text-sm text-slate-700">{entry.note}</p>}
                                  {entry.proof_image && <a href={`${API_URL}${entry.proof_image}`} target="_blank" rel="noreferrer" className="mt-2 block"><img src={`${API_URL}${entry.proof_image}`} alt={`Bằng chứng ${order.tracking_code}`} className="max-h-52 w-full rounded-lg border border-slate-200 object-contain" /></a>}
                                  {entry.signature_image && <a href={`${API_URL}${entry.signature_image}`} target="_blank" rel="noreferrer" className="mt-2 block"><img src={`${API_URL}${entry.signature_image}`} alt={`Chữ ký người nhận ${order.tracking_code}`} className="max-h-32 w-full rounded-lg border border-slate-200 bg-white object-contain" /><span className="mt-1 block text-xs font-bold text-emerald-700">Chữ ký người nhận</span></a>}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {tabHienTai === 'import' && (
            <section className="max-w-7xl space-y-5">
              <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-800">Tải file đơn hàng</h2>
                    <p className="mt-1 max-w-3xl text-sm text-slate-500">
                      Hỗ trợ Excel/CSV, tối đa {BULK_ORDER_LIMIT} đơn và 10 MB mỗi file. Mỗi dòng được kiểm tra số điện thoại,
                      địa chỉ, tọa độ trong TP.HCM, khối lượng, kích thước và thông tin cước trước khi tạo.
                    </p>
                  </div>
                  <button type="button" onClick={downloadBulkTemplate} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-50">
                    <Download size={17} /> Tải file mẫu
                  </button>
                </div>
                <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center hover:border-blue-400 hover:bg-blue-50/50">
                  <Upload size={26} className="text-blue-600" />
                  <span className="mt-2 font-bold text-slate-700">{bulkFileName || 'Chọn file Excel hoặc CSV'}</span>
                  <span className="mt-1 text-xs text-slate-500">Không đổi tên các cột trong file mẫu</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    disabled={bulkBusy}
                    onChange={(event) => {
                      parseBulkFile(event.target.files?.[0]);
                      event.target.value = '';
                    }}
                    className="sr-only"
                  />
                </label>
                {bulkError && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{bulkError}</p>}
              </div>

              {bulkRows.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                    <div>
                      <h3 className="font-black text-slate-800">Kiểm tra {bulkRows.length} dòng dữ liệu</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {bulkRows.filter((row) => row.status === 'ready').length} hợp lệ · {bulkRows.filter((row) => row.status === 'invalid').length} lỗi cần sửa · {bulkRows.filter((row) => row.status === 'success').length} đã tạo
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={bulkBusy || !bulkRows.some((row) => row.status === 'ready')}
                      onClick={importBulkOrders}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Upload size={17} /> {bulkBusy ? 'Đang tạo đơn...' : `Tạo ${bulkRows.filter((row) => row.status === 'ready').length} đơn hợp lệ`}
                    </button>
                  </div>
                  <div className="max-h-[65vh] overflow-auto">
                    <table className="w-full min-w-[850px] text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Dòng</th>
                          <th className="px-4 py-3">Người nhận</th>
                          <th className="px-4 py-3">Số điện thoại</th>
                          <th className="px-4 py-3">Địa chỉ</th>
                          <th className="px-4 py-3">Kết quả kiểm tra</th>
                          <th className="px-4 py-3">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bulkRows.map((row) => (
                          <tr key={row.rowNumber} className={row.errors.length || row.status === 'failed' ? 'bg-rose-50' : row.status === 'success' ? 'bg-emerald-50/60' : ''}>
                            <td className="px-4 py-3 font-bold">{row.rowNumber}</td>
                            <td className="px-4 py-3">{row.order.receiver_name || '—'}</td>
                            <td className="px-4 py-3">{row.order.receiver_phone || '—'}</td>
                            <td className="max-w-xs truncate px-4 py-3" title={row.order.receiver_address}>{row.order.receiver_address || '—'}</td>
                            <td className="max-w-md px-4 py-3 text-xs">
                              {row.errors.length ? <span className="font-semibold text-rose-700">{row.errors.join(' · ')}</span> : row.result || <span className="text-emerald-700">Dữ liệu hợp lệ</span>}
                            </td>
                            <td className="px-4 py-3 font-bold">
                              {row.status === 'invalid' ? <span className="text-rose-700">Lỗi dữ liệu</span>
                                : row.status === 'creating' ? <span className="text-blue-700">Đang tạo...</span>
                                  : row.status === 'success' ? <span className="text-emerald-700">Đã tạo</span>
                                    : row.status === 'failed' ? <span className="text-rose-700">Tạo thất bại</span>
                                      : <span className="text-slate-600">Sẵn sàng</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {tabHienTai === 'thongbao' && (
            <div className="max-w-4xl divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
              {thongBaoShop.length === 0 ? (
                <p className="p-8 text-center text-sm font-medium text-slate-500">Chưa có thông báo vận đơn.</p>
              ) : thongBaoShop.map((notification) => (
                <button key={notification.id} onClick={() => danhDauDaDoc(notification)} className={`flex w-full items-start gap-4 p-5 text-left hover:bg-blue-50/60 ${notification.is_read ? 'bg-white' : 'bg-blue-50/50'}`}>
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.is_read ? 'bg-slate-300' : 'bg-blue-600'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-slate-800">{notification.title}</span>
                    <span className="mt-1 block text-sm text-slate-600">{notification.message}</span>
                    <span className="mt-2 block text-xs text-slate-400">{new Date(notification.created_at).toLocaleString('vi-VN')}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {tabHienTai === 'taodon' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl">
              <div className="lg:col-span-2 space-y-6">
                
                {/* BLOCK 1: CHỌN GÓI DỊCH VỤ */}
                <div className="bg-white p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-50">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                    <Zap className="text-amber-500" /> Gói Dịch Vụ Vận Chuyển
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <label className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${form.service_type === 'economy' ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'}`}>
                      <input type="radio" name="service" className="hidden" checked={form.service_type === 'economy'} onChange={() => setForm({...form, service_type: 'economy'})}/>
                      <p className="font-black text-slate-800 mb-1">Giao Tiết Kiệm</p>
                      <p className="text-xs text-slate-500">3 - 5 ngày làm việc</p>
                    </label>
                    <label className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${form.service_type === 'standard' ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'}`}>
                      <input type="radio" name="service" className="hidden" checked={form.service_type === 'standard'} onChange={() => setForm({...form, service_type: 'standard'})}/>
                      <p className="font-black text-slate-800 mb-1">Chuyển Phát Nhanh</p>
                      <p className="text-xs text-slate-500">1 - 2 ngày làm việc</p>
                    </label>
                    <label className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${form.service_type === 'express' ? 'border-red-500 bg-red-50' : 'border-slate-100 hover:border-red-200'}`}>
                      <input type="radio" name="service" className="hidden" checked={form.service_type === 'express'} onChange={() => setForm({...form, service_type: 'express'})}/>
                      <p className="font-black text-red-600 mb-1 flex items-center gap-1">Hỏa Tốc <Zap size={14}/></p>
                      <p className="text-xs text-slate-500">Trong vòng 24h</p>
                    </label>
                  </div>

                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <Truck className="text-blue-500" /> Phương Tiện Giao Hàng
                  </h3>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                    <span>
                      {vehicleSelectionMode === 'automatic'
                        ? 'Gợi ý hệ thống: tự chọn theo hàng hóa và tuyến vận chuyển.'
                        : 'Bạn đang tự chọn phương tiện cho đơn hàng.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setVehicleSelectionMode(vehicleSelectionMode === 'automatic' ? 'manual' : 'automatic')}
                      className="font-black underline underline-offset-2"
                    >
                      {vehicleSelectionMode === 'automatic' ? 'Tự chọn xe' : 'Dùng gợi ý hệ thống'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {[
                      { value: 'motorbike', label: 'Xe máy', note: 'Giao nhanh trong thành phố' },
                      { value: 'van', label: 'Xe van', note: 'Phù hợp hàng vừa' },
                      { value: 'truck', label: 'Xe tải', note: 'Giao hàng nặng / xa' },
                    ].map((vehicle) => (
                      <button
                        key={vehicle.value}
                        type="button"
                        aria-pressed={form.vehicle_type === vehicle.value}
                        disabled={requiresTruck && vehicle.value !== 'truck'}
                        onClick={() => {
                          setVehicleSelectionMode('manual');
                          setForm((currentForm) => ({ ...currentForm, vehicle_type: vehicle.value }));
                        }}
                        className={`w-full rounded-xl border-2 p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40 ${form.vehicle_type === vehicle.value ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:border-blue-200'}`}
                      >
                        <p className="font-black text-slate-800 mb-1">{vehicle.label}</p>
                        <p className="text-[11px] text-slate-500">{vehicle.note}</p>
                      </button>
                    ))}
                  </div>
                  {requiresTruck && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">Hàng vượt 100 kg hoặc 1 m³: hệ thống bắt buộc chọn xe tải.</p>}
                </div>

                {/* BLOCK 2: FORM THÔNG TIN */}
                <form id="form-tao-don" onSubmit={taoDonMoi} className="bg-white p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-50 space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-blue-50 p-3 rounded-xl text-blue-500"><PackagePlus size={24} /></div>
                    <h3 className="text-xl font-bold text-slate-800">Thông Tin Khách Nhận</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-2">Tên người nhận</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" required
                          className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium"
                          placeholder="VD: Nguyễn Văn A"
                          value={form.receiver_name} onChange={e => setForm({...form, receiver_name: e.target.value})} 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-2">Số điện thoại</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="tel" required
                          className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium"
                          placeholder="VD: 0901234567"
                          value={form.receiver_phone} onChange={e => setForm({...form, receiver_phone: e.target.value})} 
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-600 mb-2">Email người nhận để nhận cập nhật</label>
                      <input type="email" className="w-full px-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium" placeholder="ten@example.com" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-2">Địa chỉ cửa hàng / điểm lấy hàng</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-4 text-slate-400" size={18} />
                        <textarea rows="2" required
                          className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium resize-none"
                          placeholder="Số nhà, tên đường, quận/huyện..."
                          value={form.shop_address} onChange={e => setForm({...form, shop_address: e.target.value, shop_location_verified: false})}
                        ></textarea>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setShowShopMap((prev) => !prev)}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                        >
                          <MapPinned size={16} /> {showShopMap ? 'Ẩn bản đồ' : 'Chọn trên bản đồ'}
                        </button>
                        <span className="text-xs text-slate-500 font-medium">
                          {form.shop_location_verified ? `Đã xác nhận: ${form.shop_lat.toFixed(5)}, ${form.shop_lng.toFixed(5)}` : 'Chưa xác nhận vị trí Shop'}
                        </span>
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={shopMapSearch}
                            onChange={(e) => searchShopLocation(e.target.value)}
                            placeholder="Nhập tên địa điểm, đường, phường, quận..."
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400"
                          />
                          <button
                            type="button"
                            onClick={() => searchShopLocation(shopMapSearch)}
                            className="rounded-xl bg-slate-700 px-3 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                          >
                            Tìm
                          </button>
                        </div>

                        {shopSuggestions.length > 0 && (
                          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-2">
                            {shopSuggestions.map((place) => (
                              <button
                                key={`${place.place_id}-${place.display_name}`}
                                type="button"
                                onClick={() => selectSuggestedLocation(place)}
                                className="block w-full rounded-lg border border-transparent px-3 py-2 text-left text-sm text-slate-600 hover:border-blue-200 hover:bg-blue-50"
                              >
                                {place.display_name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {showShopMap && (
                        <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 p-2">
                          <ShopMapPicker value={{ lat: form.shop_lat, lng: form.shop_lng }} onSelect={updateShopLocationFromMap} />
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Khu vực lấy hàng</p>
                      <p className="mt-1 font-semibold text-slate-700">TP. Hồ Chí Minh</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Địa chỉ giao hàng chi tiết</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-4 text-slate-400" size={18} />
                      <textarea rows="2" required
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium resize-none"
                        placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                        value={form.receiver_address} onChange={e => setForm({...form, receiver_address: e.target.value, receiver_location_verified: false})} 
                      ></textarea>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setShowReceiverMap((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700"
                      >
                        <MapPinned size={16} /> {showReceiverMap ? 'Ẩn bản đồ' : 'Chọn điểm giao'}
                      </button>
                      <span className="text-xs text-slate-500 font-medium">
                        {form.receiver_location_verified ? `Đã xác nhận: ${form.receiver_lat.toFixed(5)}, ${form.receiver_lng.toFixed(5)}` : 'Chưa xác nhận điểm giao'}
                      </span>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={receiverMapSearch}
                          onChange={(e) => searchReceiverLocation(e.target.value)}
                          placeholder="Nhập tên đường, địa chỉ chi tiết, phường, quận..."
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400"
                        />
                        <button
                          type="button"
                          onClick={() => searchReceiverLocation(receiverMapSearch)}
                          className="rounded-xl bg-slate-700 px-3 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                        >
                          Tìm
                        </button>
                      </div>

                      {receiverSuggestions.length > 0 && (
                        <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-2">
                          {receiverSuggestions.map((place) => (
                            <button
                              key={`${place.place_id}-${place.display_name}`}
                              type="button"
                              onClick={() => selectSuggestedReceiverLocation(place)}
                              className="block w-full rounded-lg border border-transparent px-3 py-2 text-left text-sm text-slate-600 hover:border-indigo-200 hover:bg-indigo-50"
                            >
                              {place.display_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {showReceiverMap && (
                      <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 p-2">
                        <MapContainer center={[(form.receiver_lat ?? form.shop_lat ?? 10.762622), (form.receiver_lng ?? form.shop_lng ?? 106.660172)]} zoom={13} maxBounds={HCMC_MAP_BOUNDS} maxBoundsViscosity={1} scrollWheelZoom={true} className="h-64 w-full rounded-xl border border-slate-200">
                          <TileLayer
                            attribution='&copy; OpenStreetMap contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <HcmcBoundaryOverlay />
                          <Marker position={[(form.receiver_lat ?? form.shop_lat ?? 10.762622), (form.receiver_lng ?? form.shop_lng ?? 106.660172)]} icon={shopMarkerIcon} />
                          <MapClickHandlerReceiver onSelect={updateReceiverLocationFromMap} />
                        </MapContainer>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Quận / huyện TP. Hồ Chí Minh</label>
                    <select
                      value={form.destination_province}
                      onChange={(e) => setForm({ ...form, destination_province: e.target.value, receiver_location_verified: false })}
                      className="w-full px-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium"
                    >
                      {HCMC_DISTRICTS.map((district) => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>
                  </div>

                  <hr className="border-slate-100 my-2" />
                  
                  {/* PHẦN KÍCH THƯỚC VÀ CÂN NẶNG */}
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4"><Box size={20} className="text-blue-500" /> Kích thước & Trọng lượng</h3>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Kích thước gói hàng (Dài x Rộng x Cao) cm</label>
                    <div className="grid grid-cols-3 gap-4 mb-2">
                      <div className="relative"><input type="number" required className="w-full pl-4 pr-8 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:border-blue-400 text-center font-bold" value={form.length} onChange={e => setForm({...form, length: e.target.value})} /><span className="absolute right-3 top-4 text-xs text-slate-400 font-bold">L</span></div>
                      <div className="relative"><input type="number" required className="w-full pl-4 pr-8 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:border-blue-400 text-center font-bold" value={form.width} onChange={e => setForm({...form, width: e.target.value})} /><span className="absolute right-3 top-4 text-xs text-slate-400 font-bold">W</span></div>
                      <div className="relative"><input type="number" required className="w-full pl-4 pr-8 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:border-blue-400 text-center font-bold" value={form.height} onChange={e => setForm({...form, height: e.target.value})} /><span className="absolute right-3 top-4 text-xs text-slate-400 font-bold">H</span></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-2">Cân nặng thực tế (kg)</label>
                      <div className="relative">
                        <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="number" step="0.1" min="0.1" required
                          className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 font-medium"
                          value={form.weight_kg} onChange={e => setForm({...form, weight_kg: e.target.value})} 
                        />
                      </div>

                      <fieldset>
                        <legend className="mb-2 text-sm font-bold text-slate-600">Người trả cước vận chuyển</legend>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[
                            { value: 'sender', label: 'Người gửi trả cước' },
                            { value: 'receiver', label: 'Người nhận trả cước' }
                          ].map((payer) => (
                            <label key={payer.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 font-bold ${form.fee_payer === payer.value ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-100 bg-slate-50 text-slate-600'}`}>
                              <input
                                type="radio"
                                name="fee_payer"
                                value={payer.value}
                                checked={form.fee_payer === payer.value}
                                onChange={() => setForm((current) => ({ ...current, fee_payer: payer.value }))}
                                className="accent-blue-600"
                              />
                              {payer.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-2">Khoảng cách tự tính (km)</label>
                      <input type="number" min="1" readOnly
                        className="w-full px-4 py-3.5 bg-blue-50 border-2 border-blue-200 rounded-xl outline-none font-medium text-blue-800"
                        value={form.distance_km}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-2">Giá trị hàng hóa (đ) - Tính bảo hiểm</label>
                      <input type="number" min="0" required
                        className="w-full px-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 font-medium"
                        placeholder="0"
                        value={form.item_value} onChange={e => setForm({...form, item_value: e.target.value})} 
                      />
                      <p className="mt-1 text-xs font-semibold text-slate-500">Phí bảo hiểm tách riêng: {(Number(form.item_value) > 1000000 ? Number(form.item_value) * 0.005 : 0).toLocaleString()} đ (0,5% giá trị từ trên 1 triệu đồng).</p>
                    </div>
                    <div>
                      <label className="block text-sm font-black text-red-600 mb-2">Tiền thu hộ (COD) đ</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400" size={18} />
                        <input type="number" min="0" required
                          className="w-full pl-11 pr-4 py-3.5 bg-red-50 text-red-600 border-2 border-red-200 rounded-xl outline-none focus:bg-white focus:border-red-400 transition-all font-black text-lg"
                          placeholder="0"
                          value={form.cod_amount} onChange={e => setForm({...form, cod_amount: e.target.value})} 
                        />
                      </div>
                    </div>

                    <label className="block text-sm font-bold text-slate-600">Phí dịch vụ thu từ COD (đ)
                      <input type="number" min="0" step="1000" value={form.service_fee} onChange={(event) => setForm((current) => ({ ...current, service_fee: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
                      <span className="mt-1 block text-xs font-medium text-slate-500">Phí dịch vụ và bảo hiểm sẽ được khấu trừ minh bạch khi đối soát với Shop.</span>
                    </label>
                  </div>

                  {/* THÊM 2 CHECKBOX CẢNH BÁO */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${form.is_fragile ? 'border-orange-500 bg-orange-50' : 'border-slate-100 hover:border-orange-100'}`}>
                      <input type="checkbox" className="w-5 h-5 accent-orange-500 rounded" checked={form.is_fragile} onChange={e => setForm({...form, is_fragile: e.target.checked})} />
                      <div>
                        <p className="font-bold text-orange-700 flex items-center gap-1"><ShieldAlert size={16}/> Hàng Dễ Vỡ / Cẩn Thận</p>
                        <p className="text-xs text-orange-600/70">Phụ phí bọc chống sốc (+10.000đ)</p>
                      </div>
                    </label>
                    
                    <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${form.is_remote_area ? 'border-blue-500 bg-blue-50' : 'border-slate-100'}`}>
                      <input type="checkbox" className="w-5 h-5 accent-blue-600 rounded cursor-pointer" checked={Boolean(form.is_remote_area)} onChange={e => setForm({...form, is_remote_area: e.target.checked})}/>
                      <div>
                        <p className="font-bold text-slate-700">Khu Vực Vùng Sâu / Xa</p>
                        <p className="text-xs text-slate-500">Phụ phí giao hàng (+20.000đ)</p>
                      </div>
                    </label>
                  </div>
                </form>
              </div>

              {/* BẢNG TÍNH CƯỚC BÊN PHẢI */}
              <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-50 sticky top-8">
                  <div className="flex items-center gap-2 mb-6 text-blue-600">
                    <Calculator size={22} />
                    <h4 className="font-black text-lg">Dự Toán Chi Phí</h4>
                  </div>
                  
                  {/* Phân tích khối lượng */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 space-y-2">
                    <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-2">Phân tích khối lượng quy đổi</p>
                    <div className="flex justify-between text-sm"><span className="text-slate-500 font-medium">Khối lượng thực tế:</span><span className="font-bold text-slate-800">{form.weight_kg || 0} kg</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500 font-medium">K.Lượng quy đổi (VTP):</span><span className="font-bold text-slate-800">{((form.length * form.width * form.height) / 5000).toFixed(1)} kg</span></div>
                    <div className="flex justify-between text-sm pt-3 mt-1 border-t border-slate-200">
                      <span className="font-bold text-blue-600">Mức tính cước:</span>
                      <span className="font-black text-blue-600 text-base">{chargeableWeight.toFixed(1)} kg</span>
                    </div>
                  </div>

                  {/* Chi tiết phụ phí */}
                  <div className="space-y-4 text-sm font-medium text-slate-600 mb-6">
                    <div className="flex justify-between pb-2 border-b border-slate-50">
                      <span>Cước cơ sở ({form.service_type}):</span>
                      <span className="font-bold text-slate-800">
                        {(form.service_type === 'express' ? 45000 : form.service_type === 'standard' ? 28000 : 18000).toLocaleString()} đ
                      </span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-slate-50">
                      <span>Phụ phí vượt cân:</span>
                      <span className="font-bold text-slate-800">
                        {(chargeableWeight > 2 ? Math.ceil((chargeableWeight - 2) / 0.5) * 4500 : 0).toLocaleString()} đ
                      </span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-slate-50">
                      <span>Phụ phí khoảng cách:</span>
                      <span className="font-bold text-slate-800">
                        {(form.distance_km > 5 ? (form.distance_km - 5) * 1700 : 0).toLocaleString()} đ
                      </span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-slate-50">
                      <span>Phí bảo hiểm:</span>
                      <span className="font-bold text-slate-800">
                        {(form.item_value > 1000000 ? form.item_value * 0.005 : 0).toLocaleString()} đ
                      </span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-slate-50">
                      <span>Phí dịch vụ:</span>
                      <span className="font-bold text-slate-800">{Number(form.service_fee || 0).toLocaleString()} đ</span>
                    </div>
                    {form.is_fragile && (
                      <div className="flex justify-between pb-2 border-b border-slate-50">
                        <span className="text-orange-600">Phí bọc hàng dễ vỡ:</span>
                        <span className="font-bold text-orange-600">+ 12,000 đ</span>
                      </div>
                    )}
                    {form.is_remote_area && (
                      <div className="flex justify-between pb-2 border-b border-slate-50">
                        <span>Phụ phí vùng xa:</span>
                        <span className="font-bold text-slate-800">+ 22,000 đ</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex justify-between items-end mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <span className="font-black text-blue-800 text-sm mb-1">TỔNG CƯỚC:</span>
                    <span className="font-black text-3xl text-blue-600 leading-none">{shippingFee.toLocaleString()} đ</span>
                  </div>

                  <button form="form-tao-don" type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-200 transition-all flex justify-center items-center gap-2 text-lg">
                    Tạo Đơn Hàng
                  </button>
                </div>
              </div>
            </div>
          )}

          {tabHienTai === 'danhsach' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-white p-4">
                <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={safeDonHang.length > 0 && safeDonHang.every((order) => selectedOrderIds.includes(order.id))}
                    onChange={(event) => setSelectedOrderIds(event.target.checked ? safeDonHang.map((order) => order.id) : [])}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  Chọn tất cả ({selectedOrderIds.length} đã chọn)
                </label>
                <button
                  type="button"
                  disabled={!selectedOrderIds.length}
                  onClick={() => setPhieuIn(safeDonHang.filter((order) => selectedOrderIds.includes(order.id)))}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Printer size={17} /> In nhãn hàng loạt
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-50 flex items-center gap-4">
                  <div className="bg-blue-50 p-4 rounded-2xl text-blue-600"><ListOrdered size={28}/></div>
                  <div>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Tổng Vận Đơn</p>
                    <p className="text-2xl font-black text-slate-800">{tongDon}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-50 flex items-center gap-4">
                  <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600"><CheckCircle size={28}/></div>
                  <div>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Giao Thành Công</p>
                    <p className="text-2xl font-black text-slate-800">{donThanhCong}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-50 flex items-center gap-4">
                  <div className="bg-red-50 p-4 rounded-2xl text-red-500"><Wallet size={28}/></div>
                  <div>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Tổng Tiền COD</p>
                    <p className="text-2xl font-black text-red-500">{tongCOD.toLocaleString()} đ</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-50 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#F8FAFC] border-b border-slate-100">
                    <tr>
                      <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Mã VĐ</th>
                      <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Khách Hàng</th>
                      <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Trọng Lượng Cước</th>
                      <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Cước Phí</th>
                      <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider">Trạng Thái</th>
                      <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {safeDonHang.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-16 text-center">
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <PackagePlus size={48} className="mb-4 opacity-30" />
                            <p className="text-lg font-medium">Bạn chưa tạo đơn hàng nào.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      safeDonHang.map((don) => (
                        <tr key={don?.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-6">
                            <label className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500">
                              <input
                                type="checkbox"
                                checked={selectedOrderIds.includes(don.id)}
                                onChange={(event) => setSelectedOrderIds((current) => event.target.checked
                                  ? [...current, don.id]
                                  : current.filter((id) => id !== don.id))}
                                className="h-4 w-4 accent-indigo-600"
                                aria-label={`Chọn nhãn ${don.tracking_code}`}
                              />
                              Chọn nhãn
                            </label>
                            <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-black tracking-wide">
                              {don?.tracking_code}
                            </span>
                            {don?.is_fragile === 1 && (
                              <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-orange-600 uppercase">
                                <ShieldAlert size={12}/> Dễ vỡ
                              </div>
                            )}
                          </td>
                          <td className="p-6">
                            <p className="font-bold text-slate-700">{don?.receiver_name}</p>
                            <p className="text-xs text-slate-500 font-medium mt-1">{don?.receiver_phone}</p>
                          </td>
                          <td className="p-6 text-sm font-bold text-slate-500">{don?.weight_kg || 1} kg</td>
                          <td className="p-6 font-bold text-slate-600">{layCuocPhiChuan(don).toLocaleString()} đ</td>
                          <td className="p-6">{hienThiTrangThai(don?.status)}</td>
                          <td className="p-6 text-right flex justify-end gap-2">
                            <button 
                              onClick={() => { setDonHangDangChon(don); setModalMo(true); }}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
                            >
                              <Eye size={16} /> Xem
                            </button>
                            <button 
                              onClick={() => setPhieuIn([don])}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
                            >
                              <Printer size={16} /> In Phiếu
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL XEM CHI TIẾT */}
        {modalMo && donHangDangChon && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[28px] shadow-2xl max-w-lg w-full p-8 relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <button 
                onClick={() => setModalMo(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
                  <MapPinned size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mã Vận Đơn</p>
                  <h3 className="text-2xl font-black text-blue-600">{donHangDangChon?.tracking_code}</h3>
                </div>
              </div>

              {/* Cảnh báo hàng dễ vỡ trong Modal */}
              {donHangDangChon?.is_fragile === 1 && (
                 <div className="bg-orange-50 p-4 rounded-2xl mb-6 border border-orange-200 flex items-center gap-3">
                   <ShieldAlert className="text-orange-500" size={24}/>
                   <div>
                     <p className="font-bold text-orange-700 text-sm">Cảnh báo: Hàng Dễ Vỡ!</p>
                     <p className="text-xs text-orange-600 mt-0.5">Yêu cầu bưu tá nhẹ tay trong quá trình bốc xếp.</p>
                   </div>
                 </div>
              )}

              {/* KHU VỰC HIỂN THỊ LÝ DO BOM HÀNG (RMA) */}
              {donHangDangChon?.fail_reason && (
                <div className="bg-red-50 p-4 rounded-2xl mb-6 border border-red-100 animate-in slide-in-from-top-4">
                  <p className="font-bold text-red-600 flex items-center gap-2 mb-1 text-sm">
                    <AlertCircle size={16}/> Giao thất bại / Hoàn hàng:
                  </p>
                  <p className="text-red-700 text-sm font-medium ml-6">Lý do: {donHangDangChon.fail_reason}</p>
                </div>
              )}

              {/* KHU VỰC HIỂN THỊ ẢNH CHỤP MINH CHỨNG (PROOF OF DELIVERY) */}
              {donHangDangChon?.proof_image && (
                <div className="mb-6 animate-in zoom-in-95">
                  <p className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                    <Camera size={16} className="text-emerald-500"/> Ảnh chụp minh chứng giao hàng:
                  </p>
                  <div className="rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50 flex justify-center p-2 relative group">
                    <img 
                      src={`${API_URL}${donHangDangChon.proof_image}`}
                      alt="Minh chứng giao hàng" 
                      className="max-h-56 object-contain rounded-xl w-full"
                    />
                  </div>
                </div>
              )}
              {donHangDangChon?.signature_image && (
                <div className="mb-6">
                  <p className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800"><CheckCircle size={16} className="text-emerald-500" /> Chữ ký người nhận:</p>
                  <a href={`${API_URL}${donHangDangChon.signature_image}`} target="_blank" rel="noreferrer">
                    <img src={`${API_URL}${donHangDangChon.signature_image}`} alt="Chữ ký xác nhận nhận hàng" className="max-h-40 w-full rounded-xl border border-slate-200 bg-white object-contain" />
                  </a>
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-2xl mb-6 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Người nhận:</span>
                  <span className="font-bold text-slate-800">{donHangDangChon?.receiver_name} ({donHangDangChon?.receiver_phone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Địa chỉ:</span>
                  <span className="font-bold text-slate-800 text-right truncate max-w-[280px]">{donHangDangChon?.receiver_address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tiền COD:</span>
                  <span className="font-bold text-red-500">{Number(donHangDangChon?.cod_amount || 0).toLocaleString()} đ</span>
                </div>
              </div>

              {['picking', 'in_warehouse', 'delivering'].includes(donHangDangChon?.status) && (
                <div className="mb-6 overflow-hidden rounded-2xl border border-blue-100 bg-blue-50">
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-black text-blue-800"><Navigation size={16} /> Bản đồ theo dõi trực tiếp</p>
                      <p className="mt-1 text-xs font-medium text-blue-700">
                        {viTriTaiXe ? 'Vị trí tài xế đang được cập nhật theo thời gian thực.' : 'Đang chờ tài xế bật GPS, tuyến đường vẫn được hiển thị.'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${viTriTaiXe ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {viTriTaiXe ? 'Trực tuyến' : 'Chờ GPS'}
                    </span>
                  </div>
                  {routeTheoDoi ? (
                    <LiveTrackingMap route={routeTheoDoi} driverLocation={viTriTaiXe} />
                  ) : (
                    <div className="flex h-72 items-center justify-center bg-slate-100 text-sm font-semibold text-slate-500">Đang tải bản đồ...</div>
                  )}
                  <div className="grid grid-cols-1 gap-2 p-4 text-xs sm:grid-cols-2">
                    <div className="rounded-xl bg-white p-3">
                      <p className="font-bold text-slate-400">KHO ĐÍCH</p>
                      <p className="mt-1 font-black text-slate-800">{routeTheoDoi?.warehouse?.label || 'Kho trung tâm Smart Logistics'}</p>
                      <p className="mt-0.5 text-slate-500">{routeTheoDoi?.warehouse?.address || 'Kho trung tâm, TP. Hồ Chí Minh'}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="font-bold text-slate-400">ĐIỂM ĐANG THEO DÕI</p>
                      <p className="mt-1 font-black text-slate-800">{donHangDangChon?.status === 'picking' ? 'Tài xế đang đến lấy hàng' : 'Đang luân chuyển về điểm tiếp theo'}</p>
                      <p className="mt-0.5 text-slate-500">{routeTheoDoi?.pickup?.label || 'Điểm lấy hàng'} → {routeTheoDoi?.warehouse?.label || 'Kho đích'}</p>
                    </div>
                  </div>
                </div>
              )}

              <h4 className="font-bold text-slate-800 text-base mb-2">Tiến độ vận chuyển</h4>
              {renderChiTietTienDo(donHangDangChon?.status)}

              <button 
                onClick={() => setModalMo(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl transition-colors mt-4"
              >
                Đóng Cửa Sổ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =================================================================
          GIAO DIỆN PREVIEW IN (MÀU XANH PASTEL THANH LỊCH)
          ================================================================= */}
      {phieuIn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[50] flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-[28px] shadow-2xl max-w-lg w-full p-8 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setPhieuIn(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full transition-colors"><X size={20} /></button>
            
            <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2"><Printer className="text-blue-500"/> Xem trước bản in</h3>
            
            <div className="border-2 border-dashed border-blue-200 bg-blue-50/30 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
              <h1 className="text-3xl font-black tracking-tight text-slate-800 mb-2">SmartLogistics</h1>
              <div className="bg-white px-6 py-4 rounded-xl border border-blue-100 shadow-sm w-full relative overflow-hidden">
                
                {/* Nhãn dán hàng dễ vỡ trên bill in */}
                {phieuIn.is_fragile === 1 && (
                  <div className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                    Dễ vỡ
                  </div>
                )}

                <div className="flex justify-center mb-2 mt-4 scale-90">
                  <Barcode value={phieuIn.tracking_code} format="CODE128" width={2.5} height={60} displayValue={true} />
                </div>
                <div className="grid grid-cols-2 text-left gap-4 text-sm mt-4 pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-slate-500 font-bold text-xs mb-1">NGƯỜI GỬI:</p>
                    <p className="font-bold text-slate-800">{shopName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-bold text-xs mb-1">NGƯỜI NHẬN:</p>
                    <p className="font-bold text-slate-800">{phieuIn.receiver_name}</p>
                    <p className="text-slate-600">{phieuIn.receiver_phone}</p>
                  </div>
                </div>
              </div>
            </div>

            <button onClick={xacNhanInPhieu} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 mt-6">
              <Printer size={18} /> Xác nhận In (PDF / Máy in)
            </button>
          </div>
        </div>
      )}

      {/* =================================================================
          GIAO DIỆN DÀNH RIÊNG CHO MÁY IN (Chỉ hiển thị lên mặt giấy)
          ================================================================= */}
      {phieuIn && (
      <div className="thermal-print-root hidden print:block fixed inset-0 bg-white z-[99999] overflow-auto p-4 text-black">
        {phieuIn.map((labelOrder) => (
        <div key={labelOrder.id} className="thermal-label mx-auto mb-4 break-after-page border-2 border-black p-3 flex flex-col justify-between relative">
          <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
            <h1 className="text-2xl font-black uppercase">SmartLogistics</h1>
            <div className="text-right">
              <p className="font-bold text-lg">{new Date().toLocaleDateString('vi-VN')}</p>
              <p className="text-sm font-bold border border-black px-2 mt-1 rounded">{labelOrder.weight_kg || 1} KG</p>
            </div>
          </div>

          <div className="flex justify-center mb-6 py-4">
            <Barcode value={labelOrder.tracking_code} format="CODE128" width={3} height={80} displayValue={true} fontSize={20} />
          </div>

          {/* Chữ HÀNG DỄ VỠ in to trên máy in nhiệt */}
          {labelOrder.is_fragile === 1 && (
              <div className="absolute top-[35%] left-1/2 -translate-x-1/2 border-4 border-black p-2 bg-white -rotate-12 opacity-80">
                <h2 className="text-2xl font-black uppercase tracking-widest">Hàng Dễ Vỡ</h2>
              </div>
            )}

            <div className="flex flex-col gap-4 mb-6 relative z-10">
              <div className="border border-black p-3 rounded">
                <p className="font-bold text-xs mb-1">TỪ:</p>
                <p className="font-black text-lg">{shopName}</p>
                <p className="text-sm">Hotline: 1900 1234</p>
              </div>
              <div className="border border-black p-3 rounded bg-gray-100">
                <p className="font-bold text-xs mb-1">ĐẾN:</p>
                <p className="font-black text-xl">{labelOrder.receiver_name}</p>
                <p className="font-bold text-lg">{labelOrder.receiver_phone}</p>
                <p className="text-base font-medium leading-tight mt-1">{labelOrder.receiver_address}</p>
              </div>
            </div>

            <div className="mt-auto border-t-2 border-black pt-4">
              <p className="text-center font-bold text-lg uppercase tracking-widest mb-1">Tiền Thu Hộ (COD)</p>
              <p className="text-center font-black text-4xl">
                {Number(labelOrder.cod_amount).toLocaleString()} VNĐ
              </p>
            </div>
            
            <p className="text-center text-xs mt-4 italic font-medium">Lưu ý: Chỉ giao hàng giờ hành chính.</p>
          </div>
          ))}
        </div>
      )}
    </>
  );
}