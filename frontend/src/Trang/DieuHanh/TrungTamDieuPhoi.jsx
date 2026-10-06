import { apiFetch as fetch } from '../../utils/apiFetch.js';
import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Truck, MapPin, Navigation, Search, PackageSearch, CheckCircle, Clock, Map, FileText, Send, Zap, Users, Package, ShieldCheck, RotateCw, AlertCircle } from 'lucide-react';

// Fix lỗi mất icon mặc định của Leaflet trong React
import iconMarkerUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const normalizeAreaText = (value) => String(value || '')
  .toLocaleLowerCase('vi')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');
const shipperIcon = new L.Icon({
  iconUrl: iconMarkerUrl,
  shadowUrl: iconShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// Khởi tạo kết nối Socket.io tới Backend
const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('access_token') }
});

// HÀM FIX LỖI BẢN ĐỒ BỊ XÁM KHI CHUYỂN TAB
const UpdateMapSize = () => {
  const map = useMap();
  useEffect(() => {
    // Đợi giao diện render xong (200ms) rồi ép bản đồ tính toán lại kích thước
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

export default function TrungTamDieuPhoi() {
  const [donHang, setDonHang] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [taiXeList, setTaiXeList] = useState([]);
  const [driverProfiles, setDriverProfiles] = useState([]);
  const [profileDrafts, setProfileDrafts] = useState({});
  const [savingProfileId, setSavingProfileId] = useState(null);
  const [autoDispatchPlan, setAutoDispatchPlan] = useState([]);
  const [autoDispatchBusy, setAutoDispatchBusy] = useState(false);
  const [autoDispatchMessage, setAutoDispatchMessage] = useState('');
  const [tuKhoa, setTuKhoa] = useState('');
  const [modalMo, setModalMo] = useState(false);
  const [donDangChon, setDonDangChon] = useState(null);
  const [taiXeDuocChon, setTaiXeDuocChon] = useState('');
  const [loaiNhiemVu, setLoaiNhiemVu] = useState('pickup');
  const [driverTaskTab, setDriverTaskTab] = useState('pickup');
  
  const [viTriTaiXeMap, setViTriTaiXeMap] = useState({});
  const [tabHienTai, setTabHienTai] = useState('dieuphoan'); 
  const [rmaRequests, setRmaRequests] = useState([]);
  const [rmaLoading, setRmaLoading] = useState(false);
  const [rmaBusyOrderId, setRmaBusyOrderId] = useState(null);
  const [rmaReviewNotes, setRmaReviewNotes] = useState({});
  const [rmaError, setRmaError] = useState('');
  const [rmaMessage, setRmaMessage] = useState('');
  const [fleetTrucks, setFleetTrucks] = useState([]);
  const [fleetWarehouses, setFleetWarehouses] = useState([]);
  const [linehaulDrivers, setLinehaulDrivers] = useState([]);
  const [fleetBags, setFleetBags] = useState([]);
  const [fleetTrips, setFleetTrips] = useState([]);
  const [linehaulPositions, setLinehaulPositions] = useState([]);
  const [fleetError, setFleetError] = useState('');
  const [fleetMessage, setFleetMessage] = useState('');
  const [fleetBusy, setFleetBusy] = useState(false);
  const [truckDraft, setTruckDraft] = useState({ id: '', vehicle_plate: '', max_payload_kg: '', status: 'ready' });
  const [tripDraft, setTripDraft] = useState({ truck_id: '', driver_id: '', source_warehouse_id: '', destination_warehouse_id: '' });
  const [selectedTripId, setSelectedTripId] = useState('');
  const [selectedBagIds, setSelectedBagIds] = useState([]);

  const [formBaoCao, setFormBaoCao] = useState({ title: '', content: '' });
  const [fileBaoCao, setFileBaoCao] = useState(null);
  const [dangGuiBaoCao, setDangGuiBaoCao] = useState(false);

  const userId = localStorage.getItem('user_id');
  const userName = localStorage.getItem('full_name') || 'Điều Phối Viên';
  const selectedSourceWarehouse = fleetWarehouses.find((warehouse) => String(warehouse.id) === tripDraft.source_warehouse_id);
  const routeDestinations = fleetWarehouses.filter((warehouse) => selectedSourceWarehouse
    && warehouse.warehouse_type !== selectedSourceWarehouse.warehouse_type);

  const taiDuLieuFleet = useCallback(async () => {
    setFleetError('');
    try {
      const endpoints = [
        '/api/trucks',
        '/api/warehouses',
        '/api/shippers?type=linehaul',
        '/api/warehouse/bags',
        '/api/linehaul/trips',
        '/api/linehaul/positions'
      ];
      const responses = await Promise.all(endpoints.map((endpoint) => fetch(`${API_URL}${endpoint}`)));
      const results = await Promise.all(responses.map((response) => response.json()));
      const failedIndex = responses.findIndex((response, index) => !response.ok || !results[index].success);
      if (failedIndex >= 0) throw new Error(results[failedIndex].message || 'Không tải được dữ liệu điều phối vận tải.');
      setFleetTrucks(results[0].data || []);
      setFleetWarehouses((results[1].data || []).filter((warehouse) => warehouse.is_active));
      setLinehaulDrivers(results[2].data || []);
      setFleetBags((results[3].data || []).filter((bag) => bag.status === 'sealed'));
      setFleetTrips(results[4].data || []);
      setLinehaulPositions(results[5].data || []);
    } catch (error) {
      setFleetError(error.message || 'Không tải được dữ liệu điều phối vận tải.');
    }
  }, []);

  const luuXeTai = async (event) => {
    event.preventDefault();
    setFleetBusy(true);
    setFleetError('');
    setFleetMessage('');
    try {
      const editing = Boolean(truckDraft.id);
      const response = await fetch(`${API_URL}/api/trucks${editing ? `/${truckDraft.id}` : ''}`, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_plate: truckDraft.vehicle_plate,
          max_payload_kg: Number(truckDraft.max_payload_kg),
          status: truckDraft.status
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không lưu được xe tải.');
      setTruckDraft({ id: '', vehicle_plate: '', max_payload_kg: '', status: 'ready' });
      setFleetMessage(result.message || 'Đã lưu xe tải.');
      await taiDuLieuFleet();
    } catch (error) {
      setFleetError(error.message || 'Không lưu được xe tải.');
    } finally {
      setFleetBusy(false);
    }
  };

  const xoaXeTai = async (truckId) => {
    if (!window.confirm('Xóa xe tải này khỏi đội xe?')) return;
    setFleetBusy(true);
    setFleetError('');
    setFleetMessage('');
    try {
      const response = await fetch(`${API_URL}/api/trucks/${truckId}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không xóa được xe tải.');
      setFleetMessage(result.message);
      await taiDuLieuFleet();
    } catch (error) {
      setFleetError(error.message || 'Không xóa được xe tải.');
    } finally {
      setFleetBusy(false);
    }
  };

  const taoChuyenLinehaul = async (event) => {
    event.preventDefault();
    setFleetBusy(true);
    setFleetError('');
    setFleetMessage('');
    try {
      const response = await fetch(`${API_URL}/api/linehaul/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...tripDraft,
          truck_id: Number(tripDraft.truck_id),
          driver_id: Number(tripDraft.driver_id),
          source_warehouse_id: Number(tripDraft.source_warehouse_id),
          destination_warehouse_id: Number(tripDraft.destination_warehouse_id)
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không tạo được chuyến xe.');
      setSelectedTripId(String(result.data.id));
      setTripDraft({ truck_id: '', driver_id: '', source_warehouse_id: '', destination_warehouse_id: '' });
      setFleetMessage(`Đã tạo chuyến ${result.data.trip_code}. Chọn các bao niêm phong để gán.`);
      await taiDuLieuFleet();
    } catch (error) {
      setFleetError(error.message || 'Không tạo được chuyến xe.');
    } finally {
      setFleetBusy(false);
    }
  };

  const ganBaoVaoChuyen = async () => {
    if (!selectedTripId || !selectedBagIds.length || fleetBusy) return;
    setFleetBusy(true);
    setFleetError('');
    setFleetMessage('');
    try {
      for (const bagId of selectedBagIds) {
        const bag = fleetBags.find((item) => String(item.id) === String(bagId));
        if (!bag) continue;
        const response = await fetch(`${API_URL}/api/linehaul/trips/${selectedTripId}/bags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bag_code: bag.bag_code })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(`${bag.bag_code}: ${result.message || 'Không gán được bao.'}`);
      }
      setFleetMessage(`Đã gán ${selectedBagIds.length} bao lên chuyến.`);
      setSelectedBagIds([]);
      await taiDuLieuFleet();
    } catch (error) {
      setFleetError(error.message || 'Không thể gán bao vào chuyến.');
      await taiDuLieuFleet();
    } finally {
      setFleetBusy(false);
    }
  };

  useEffect(() => {
    if (tabHienTai !== 'fleet') return undefined;
    const timeoutId = window.setTimeout(taiDuLieuFleet, 0);
    const intervalId = window.setInterval(taiDuLieuFleet, 30000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [tabHienTai, taiDuLieuFleet]);

  const taiDuLieu = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/orders');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAllOrders(data.data);
        const donCanDieuPhoi = data.data.filter(d =>
          (d?.status === 'pending' && !d?.pickup_shipper_id) ||
          (d?.status === 'at_destination_warehouse' && !d?.delivery_shipper_id)
        );
        setDonHang(donCanDieuPhoi);
      }
    } catch (error) {
      console.error("Lỗi tải đơn hàng:", error);
    }
  };

  const taiDanhSachTaiXe = async (taskType = 'pickup') => {
    try {
      const res = await fetch(`http://localhost:5000/api/shippers?type=${taskType}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTaiXeList(data.data);
        return data.data;
      }
    } catch (error) {
      console.error("Lỗi tải tài xế:", error);
    }
    return [];
  };

  const taiHoSoTaiXe = async () => {
    try {
      const response = await fetch(`${API_URL}/api/dispatcher/driver-profiles`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không tải được cấu hình tài xế.');
      setDriverProfiles(result.data || []);
      setProfileDrafts(Object.fromEntries((result.data || []).map((profile) => [profile.id, {
        max_active_orders: profile.max_active_orders,
        max_payload_kg: profile.max_payload_kg,
        service_areas: profile.service_areas || ''
      }])));
    } catch (error) {
      setAutoDispatchMessage(error.message || 'Không tải được cấu hình tài xế.');
    }
  };

  const luuHoSoTaiXe = async (driverId) => {
    const profile = profileDrafts[driverId];
    if (!profile) return;
    setSavingProfileId(driverId);
    setAutoDispatchMessage('');
    try {
      const response = await fetch(`${API_URL}/api/dispatcher/driver-profiles/${driverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không lưu được cấu hình tài xế.');
      setAutoDispatchMessage(`${result.message} (${driverProfiles.find((item) => item.id === driverId)?.full_name || driverId})`);
      await taiHoSoTaiXe();
    } catch (error) {
      setAutoDispatchMessage(error.message || 'Không lưu được cấu hình tài xế.');
    } finally {
      setSavingProfileId(null);
    }
  };

  const taiYeuCauRma = async () => {
    setRmaLoading(true);
    setRmaError('');
    try {
      const response = await fetch(`${API_URL}/api/dispatcher/rma`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không tải được yêu cầu RMA.');
      setRmaRequests(result.data || []);
    } catch (error) {
      setRmaError(error.message || 'Không tải được yêu cầu RMA.');
    } finally {
      setRmaLoading(false);
    }
  };

  const xuLyYeuCauRma = async (request, status) => {
    const reviewNote = String(rmaReviewNotes[request.order_id] || '').trim();
    if (status === 'rejected' && reviewNote.length < 5) {
      setRmaError('Cần ghi lý do từ chối ít nhất 5 ký tự.');
      return;
    }
    setRmaBusyOrderId(request.order_id);
    setRmaError('');
    setRmaMessage('');
    try {
      const response = await fetch(`${API_URL}/api/dispatcher/rma/${request.order_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, review_note: reviewNote })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không cập nhật được yêu cầu RMA.');
      setRmaMessage(result.message);
      setRmaReviewNotes((current) => {
        const next = { ...current };
        delete next[request.order_id];
        return next;
      });
      await taiYeuCauRma();
    } catch (error) {
      setRmaError(error.message || 'Không cập nhật được yêu cầu RMA.');
    } finally {
      setRmaBusyOrderId(null);
    }
  };

  useEffect(() => {
    taiDuLieu();
    taiDanhSachTaiXe();
    taiHoSoTaiXe();
    fetch('http://localhost:5000/api/driver/live')
      .then((response) => response.json())
      .then((data) => {
        if (!data.success || !Array.isArray(data.data)) return;
        setViTriTaiXeMap((current) => {
          const next = { ...current };
          data.data.forEach((position) => {
            const previous = next[position.shipper_id];
            if (!previous || new Date(position.created_at) > new Date(previous.timestamp)) {
              next[position.shipper_id] = { lat: Number(position.lat), lng: Number(position.lng), timestamp: position.created_at };
            }
          });
          return next;
        });
      })
      .catch((error) => console.error('Lỗi tải vị trí tài xế:', error));

    socket.on('driver_location_changed', (data) => {
      setViTriTaiXeMap(prev => ({
        ...prev,
        [data.shipper_id]: {
          lat: data.lat,
          lng: data.lng,
          timestamp: data.timestamp
        }
      }));
    });
    socket.on('order_status_changed', taiDuLieu);

    return () => {
      socket.off('driver_location_changed');
      socket.off('order_status_changed', taiDuLieu);
    };
  }, []);

  const moModalPhanCong = async (don) => {
    const taskTypeByStatus = {
      pending: 'pickup',
      at_destination_warehouse: 'delivery'
    };
    const taskType = taskTypeByStatus[don?.status];
    if (!taskType) return;
    const driverGroup = taskType === 'delivery' ? 'delivery' : 'pickup';
    const taiXeTheoNhiemVu = await taiDanhSachTaiXe(driverGroup);
    setDonDangChon(don);
    setLoaiNhiemVu(taskType);
    setDriverTaskTab(taskType);
    setTaiXeDuocChon(taiXeTheoNhiemVu.length > 0 ? String(taiXeTheoNhiemVu[0].id) : '');
    setModalMo(true);
  };


  const phanCongTaiXe = async (e) => {
    e.preventDefault();
    if (!taiXeDuocChon) {
      alert("Vui lòng chọn một tài xế!");
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/orders/${donDangChon.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipper_id: parseInt(taiXeDuocChon), task_type: loaiNhiemVu })
      });
      const data = await res.json();

      if (data.success) {
        alert("✅ Đã phân công tuyến đường tối ưu thành công!");
        setModalMo(false);
        setTaiXeDuocChon('');
        taiDuLieu();
      } else {
        alert("Thao tác thất bại: " + (data.message || "Lỗi không xác định từ Server"));
      }
    } catch {
      alert("Lỗi kết nối đến máy chủ! Vui lòng kiểm tra lại mạng.");
    }
  };

  const guiBaoCao = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!formBaoCao.title.trim() || !formBaoCao.content.trim()) return alert("Nhập đủ thông tin!");
    
    setDangGuiBaoCao(true);
    try {
      const formData = new FormData();
      formData.append('created_by', userId);
      formData.append('department', 'Phòng Điều Phối');
      formData.append('title', formBaoCao.title);
      formData.append('content', formBaoCao.content);
      if (fileBaoCao) formData.append('attachment', fileBaoCao);
      const res = await fetch('http://localhost:5000/api/reports', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        alert("✅ Đã gửi báo cáo lên Ban Giám Đốc!");
        setFormBaoCao({ title: '', content: '' });
        setFileBaoCao(null);
        form.reset();
      } else alert("Lỗi: " + data.message);
    } catch {
      alert("Lỗi kết nối!");
    } finally {
      setDangGuiBaoCao(false);
    }
  };

  const dangXuat = () => {
    if (window.confirm("Đăng xuất khỏi hệ thống Điều phối?")) {
      localStorage.clear();
      window.location.href = '/'; 
    }
  };

  const safeDonHang = Array.isArray(donHang) ? donHang : [];
  const safeTaiXeList = Array.isArray(taiXeList) ? taiXeList : [];

  const donChoGom = allOrders.filter((order) => order.status === 'pending' && !order.pickup_shipper_id);
  const donDaLoc = safeDonHang.filter(d => {
    if (d.status === 'pending') return false;
    const kw = tuKhoa.toLowerCase();
    return (d?.tracking_code || '').toLowerCase().includes(kw) || (d?.receiver_address || '').toLowerCase().includes(kw);
  });
  const soDonTaiXeDangGiu = (driverId) => allOrders.filter((order) => (
    String(order.pickup_shipper_id) === String(driverId) && ['picking', 'picked_up'].includes(order.status)
    || String(order.delivery_shipper_id) === String(driverId) && ['at_destination_warehouse', 'delivering'].includes(order.status)
  )).length;
  const tinhKhoangCachKm = (lat1, lng1, lat2, lng2) => {
    const toRad = (value) => value * Math.PI / 180;
    const dLat = toRad(Number(lat2) - Number(lat1));
    const dLng = toRad(Number(lng2) - Number(lng1));
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const driverDistance = (driver) => {
    const position = viTriTaiXeMap[driver.id];
    const target = donDangChon;
    if (!position || !target || !Number.isFinite(Number(target.shop_lat)) || !Number.isFinite(Number(target.shop_lng))) return null;
    return tinhKhoangCachKm(position.lat, position.lng, target.shop_lat, target.shop_lng);
  };
  const danhSachTaiXeHienThi = [...safeTaiXeList].sort((a, b) => (
    (driverDistance(a) ?? Number.POSITIVE_INFINITY) - (driverDistance(b) ?? Number.POSITIVE_INFINITY)
  ));
  const driverNearest = danhSachTaiXeHienThi.find((driver) => driverDistance(driver) !== null);

  const donChoLay = safeDonHang.filter(d => d.status === 'pending').length;
  const donChoGiao = safeDonHang.filter(d => d.status === 'at_destination_warehouse').length;
  const taoKeHoachTuDong = () => {
    const candidates = allOrders.filter((order) => (
      driverTaskTab === 'pickup' && order.status === 'pending' && !order.pickup_shipper_id
      || driverTaskTab === 'delivery' && order.status === 'at_destination_warehouse' && !order.delivery_shipper_id
    )).sort((first, second) => Number(second.weight_kg || 0) - Number(first.weight_kg || 0));
    const driverRole = driverTaskTab === 'delivery' ? 'delivery_driver' : 'pickup_driver';
    const loads = new Map(driverProfiles.filter((profile) => profile.role === driverRole).map((profile) => [profile.id, {
      count: Number(profile.active_count || 0),
      weight: Number(profile.active_weight_kg || 0)
    }]));
    const plan = candidates.map((order) => {
      const taskType = order.status === 'pending' ? 'pickup'
        : 'delivery';
      const isPickupTask = taskType === 'pickup';
      const areaText = normalizeAreaText(isPickupTask
        ? `${order.shop_address || ''} ${order.shop_province || ''}`
        : `${order.receiver_address || ''} ${order.destination_province || ''}`);
      const rawLat = isPickupTask ? order.shop_lat : order.receiver_lat;
      const rawLng = isPickupTask ? order.shop_lng : order.receiver_lng;
      const hasCoordinates = rawLat !== null && rawLat !== undefined && rawLat !== ''
        && rawLng !== null && rawLng !== undefined && rawLng !== ''
        && Number.isFinite(Number(rawLat)) && Number.isFinite(Number(rawLng));
      const targetDistance = (driver) => {
        const position = viTriTaiXeMap[driver.id];
        if (!position || !hasCoordinates) return null;
        return tinhKhoangCachKm(position.lat, position.lng, rawLat, rawLng);
      };
      const weight = Number(order.weight_kg || 0);
      const eligible = driverProfiles.filter((profile) => {
        if (profile.role !== driverRole) return false;
        const load = loads.get(profile.id) || { count: 0, weight: 0 };
        if (load.count >= Number(profile.max_active_orders) || load.weight + weight > Number(profile.max_payload_kg)) return false;
        const zones = String(profile.service_areas || '').split(',').map((area) => normalizeAreaText(area.trim())).filter(Boolean);
        return !zones.length || zones.some((zone) => areaText.includes(zone));
      }).sort((first, second) => {
        const firstLoad = loads.get(first.id) || { count: 0, weight: 0 };
        const secondLoad = loads.get(second.id) || { count: 0, weight: 0 };
        const firstScore = firstLoad.count / Number(first.max_active_orders)
          + firstLoad.weight / Number(first.max_payload_kg)
          + (targetDistance(first) ?? 0) / 100;
        const secondScore = secondLoad.count / Number(second.max_active_orders)
          + secondLoad.weight / Number(second.max_payload_kg)
          + (targetDistance(second) ?? 0) / 100;
        return firstScore - secondScore;
      });
      const driver = eligible[0];
      if (!driver) return { order, taskType, driverId: null, state: 'blocked', message: 'Không có tài xế còn sức chứa hoặc phù hợp khu vực.' };
      const load = loads.get(driver.id);
      load.count += 1;
      load.weight += weight;
      return { order, taskType, driverId: driver.id, driverName: driver.full_name, distance: targetDistance(driver), state: 'pending' };
    });
    setAutoDispatchPlan(plan);
    setAutoDispatchMessage(plan.length ? `Tạo được ${plan.filter((item) => item.driverId).length}/${plan.length} đề xuất. Hãy rà soát rồi mới duyệt.` : 'Không có đơn phù hợp trong nhóm nhiệm vụ đang chọn.');
  };

  const duyetKeHoachTuDong = async () => {
    const pending = autoDispatchPlan.filter((item) => item.driverId && item.state === 'pending');
    if (!pending.length || autoDispatchBusy) return;
    setAutoDispatchBusy(true);
    setAutoDispatchMessage('');
    for (const item of pending) {
      try {
        const response = await fetch(`${API_URL}/api/orders/${item.order.id}/assign`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shipper_id: item.driverId, task_type: item.taskType })
        });
        const result = await response.json();
        setAutoDispatchPlan((current) => current.map((entry) => entry.order.id === item.order.id
          ? { ...entry, state: response.ok && result.success ? 'assigned' : 'failed', message: result.message || 'Không thể phân công.' }
          : entry));
      } catch {
        setAutoDispatchPlan((current) => current.map((entry) => entry.order.id === item.order.id
          ? { ...entry, state: 'failed', message: 'Lỗi kết nối khi phân công.' }
          : entry));
      }
    }
    setAutoDispatchBusy(false);
    setAutoDispatchMessage('Đã xử lý kế hoạch. Các đơn lỗi cần được kiểm tra và thử phân công lại.');
    await Promise.all([taiDuLieu(), taiHoSoTaiXe()]);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC] font-sans text-slate-700">
      
      {/* SIDEBAR */}
      <div className="sticky top-0 z-10 flex h-screen w-72 shrink-0 flex-col justify-between border-r border-slate-200 bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-8 border-b border-slate-100 flex items-center gap-3">
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-2.5 rounded-xl shadow-lg shadow-emerald-200">
              <Navigation className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Điều Hành</h2>
              <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mt-0.5">Trung tâm Điều Phối</p>
              <p className="mt-1 max-w-40 truncate text-sm font-bold text-slate-700" title={userName}>{userName}</p>
            </div>
          </div>
          
          <div className="p-5 mt-2 space-y-3">
            <button onClick={() => setTabHienTai('dieuphoan')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'dieuphoan' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'text-slate-500 hover:bg-slate-50'}`}><MapPin size={20} /> Phân Tuyến Tài Xế</button>
            <button onClick={() => { setTabHienTai('rma'); taiYeuCauRma(); }} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'rma' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'text-slate-500 hover:bg-slate-50'}`}><RotateCw size={20} /> Yêu Cầu Giao Lại <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs font-black text-orange-700">{rmaRequests.filter((request) => request.status === 'pending').length}</span></button>
            <button onClick={() => setTabHienTai('fleet')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'fleet' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-slate-500 hover:bg-slate-50'}`}><Truck size={20} /> Quản Lý Vận Tải</button>
            <button onClick={() => setTabHienTai('bandogiamsat')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'bandogiamsat' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'text-slate-500 hover:bg-slate-50'}`}><Map size={20} /> Giám Sát Bản Đồ GPS</button>
            <button onClick={() => setTabHienTai('baocao')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'baocao' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'text-slate-500 hover:bg-slate-50'}`}><FileText size={20} /> Báo Cáo Giám Đốc</button>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 p-5">
          <button onClick={dangXuat} className="w-full px-5 py-4 rounded-2xl font-bold text-left text-red-500 hover:bg-red-50 transition-colors">Đăng Xuất</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="min-w-0 flex-1 overflow-y-auto p-10 flex flex-col">

        {tabHienTai === 'fleet' && (
          <div className="space-y-6">
            <header>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">Hub & spoke · Line-haul</p>
              <h1 className="mt-2 text-3xl font-black text-slate-800">Quản lý vận tải liên kho</h1>
              <p className="mt-2 text-sm text-slate-500">Quản lý đội xe, tạo chuyến, gán bao đã niêm phong và theo dõi GPS tài xế xe tải.</p>
            </header>
            {fleetError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{fleetError}</p>}
            {fleetMessage && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">{fleetMessage}</p>}

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black">Đội xe tải</h2>
                <form onSubmit={luuXeTai} className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-bold text-slate-600">Biển số
                    <input required maxLength={30} value={truckDraft.vehicle_plate} onChange={(event) => setTruckDraft((current) => ({ ...current, vehicle_plate: event.target.value.toUpperCase() }))} className="mt-1 w-full rounded-lg border border-slate-200 p-3 uppercase" placeholder="51C-889.99" />
                  </label>
                  <label className="text-sm font-bold text-slate-600">Trọng tải tối đa (kg)
                    <input required min="1" type="number" step="0.1" value={truckDraft.max_payload_kg} onChange={(event) => setTruckDraft((current) => ({ ...current, max_payload_kg: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-3" />
                  </label>
                  {truckDraft.id && <label className="text-sm font-bold text-slate-600">Tình trạng
                    <select value={truckDraft.status} onChange={(event) => setTruckDraft((current) => ({ ...current, status: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3">
                      <option value="ready">Sẵn sàng</option><option value="maintenance">Bảo trì</option><option value="in_transit">Đang chạy</option>
                    </select>
                  </label>}
                  <div className="flex items-end gap-2">
                    <button disabled={fleetBusy} className="rounded-lg bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50">{truckDraft.id ? 'Lưu xe' : 'Thêm xe'}</button>
                    {truckDraft.id && <button type="button" onClick={() => setTruckDraft({ id: '', vehicle_plate: '', max_payload_kg: '', status: 'ready' })} className="rounded-lg bg-slate-100 px-4 py-3 font-bold text-slate-600">Hủy</button>}
                  </div>
                </form>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {fleetTrucks.map((truck) => <article key={truck.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                    <div><p className="font-black">{truck.vehicle_plate} · {Number(truck.max_payload_kg).toLocaleString()} kg</p><p className="text-xs text-slate-500">{truck.status === 'ready' ? 'Sẵn sàng' : truck.status === 'in_transit' ? 'Đang chạy' : 'Bảo trì'}</p></div>
                    <div className="flex gap-2"><button type="button" onClick={() => setTruckDraft({ id: truck.id, vehicle_plate: truck.vehicle_plate, max_payload_kg: truck.max_payload_kg, status: truck.status })} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">Sửa</button><button type="button" disabled={fleetBusy} onClick={() => xoaXeTai(truck.id)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Xóa</button></div>
                  </article>)}
                  {!fleetTrucks.length && <p className="text-sm text-slate-500">Chưa có xe tải trong đội xe.</p>}
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black">Tạo chuyến xe liên kho</h2>
                <form onSubmit={taoChuyenLinehaul} className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-bold text-slate-600">Xe tải
                    <select required value={tripDraft.truck_id} onChange={(event) => setTripDraft((current) => ({ ...current, truck_id: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3">
                      <option value="">Chọn xe sẵn sàng</option>{fleetTrucks.filter((truck) => truck.status === 'ready').map((truck) => <option key={truck.id} value={truck.id}>{truck.vehicle_plate} · {truck.max_payload_kg} kg</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-bold text-slate-600">Tài xế xe tải
                    <select required value={tripDraft.driver_id} onChange={(event) => setTripDraft((current) => ({ ...current, driver_id: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3">
                      <option value="">Chọn tài xế</option>{linehaulDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-bold text-slate-600">Kho đi
                    <select required value={tripDraft.source_warehouse_id} onChange={(event) => setTripDraft((current) => ({ ...current, source_warehouse_id: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3">
                      <option value="">Chọn kho đi</option>{fleetWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-bold text-slate-600">Kho đến
                    <select required value={tripDraft.destination_warehouse_id} onChange={(event) => setTripDraft((current) => ({ ...current, destination_warehouse_id: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3">
                      <option value="">Chọn kho đến</option>{routeDestinations.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                    </select>
                  </label>
                  <button disabled={fleetBusy} className="rounded-lg bg-indigo-600 px-4 py-3 font-bold text-white disabled:opacity-50 sm:col-span-2">Tạo chuyến xe</button>
                </form>
              </section>
            </div>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-black">Chuyến xe và gán bao</h2>
                  <select value={selectedTripId} onChange={(event) => setSelectedTripId(event.target.value)} className="rounded-lg border border-slate-200 bg-white p-2 text-sm">
                    <option value="">Chọn chuyến đang chờ</option>{fleetTrips.filter((trip) => ['planned', 'loading'].includes(trip.status)).map((trip) => <option key={trip.id} value={trip.id}>{trip.trip_code} · {trip.source_warehouse_name} → {trip.destination_warehouse_name}</option>)}
                  </select>
                </div>
                {selectedTripId && (() => {
                  const trip = fleetTrips.find((item) => String(item.id) === selectedTripId);
                  const availableBags = fleetBags.filter((bag) => trip
                    && Number(bag.source_warehouse_id) === Number(trip.source_warehouse_id)
                    && Number(bag.destination_warehouse_id) === Number(trip.destination_warehouse_id));
                  return <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-700">{trip?.trip_code}: chọn bao niêm phong đúng tuyến</p>
                    <div className="max-h-44 space-y-2 overflow-y-auto">
                      {availableBags.map((bag) => <label key={bag.id} className="flex items-center gap-3 rounded-lg bg-white p-3 text-sm">
                        <input type="checkbox" checked={selectedBagIds.includes(String(bag.id))} onChange={(event) => setSelectedBagIds((current) => event.target.checked ? [...current, String(bag.id)] : current.filter((id) => id !== String(bag.id)))} />
                        <span><strong className="font-mono">{bag.bag_code}</strong><span className="ml-2 text-slate-500">· {bag.order_count} đơn</span></span>
                      </label>)}
                      {!availableBags.length && <p className="text-sm text-slate-500">Không có bao niêm phong chờ xuất trên tuyến này.</p>}
                    </div>
                    <button type="button" onClick={ganBaoVaoChuyen} disabled={fleetBusy || !selectedBagIds.length} className="rounded-lg bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-50">Gán {selectedBagIds.length || ''} bao lên chuyến</button>
                  </div>;
                })()}
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {fleetTrips.map((trip) => <article key={trip.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex flex-wrap justify-between gap-2"><strong>{trip.trip_code} · {trip.vehicle_plate}</strong><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{trip.status}</span></div>
                    <p className="mt-1 text-sm text-slate-500">{trip.source_warehouse_name} → {trip.destination_warehouse_name} · {trip.driver_name || 'Chưa gán tài xế'}</p>
                    <p className="mt-1 text-xs text-slate-500">{trip.scanned_bag_count || 0}/{trip.bag_count || 0} bao đã quét lên xe</p>
                  </article>)}
                  {!fleetTrips.length && <p className="text-sm text-slate-500">Chưa có chuyến xe.</p>}
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><h2 className="font-black">GPS xe tải đang chạy</h2><button type="button" onClick={taiDuLieuFleet} className="rounded-lg bg-slate-100 p-2" aria-label="Làm mới vị trí"><RotateCw size={16} /></button></div>
                <div className="h-64 overflow-hidden rounded-xl">
                  <MapContainer center={[10.762622, 106.660172]} zoom={10} style={{ width: '100%', height: '100%' }}>
                    <UpdateMapSize /><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                    {linehaulPositions.map((position) => <Marker key={position.trip_id} position={[Number(position.lat), Number(position.lng)]} icon={shipperIcon}><Popup><strong>{position.trip_code} · {position.vehicle_plate}</strong><br />{position.driver_name}<br />{position.source_warehouse_name} → {position.destination_warehouse_name}</Popup></Marker>)}
                  </MapContainer>
                </div>
                {!linehaulPositions.length && <p className="text-sm text-slate-500">Chưa có xe tải đang truyền vị trí GPS.</p>}
              </div>
            </section>
          </div>
        )}

        {tabHienTai === 'dieuphoan' && (
          <div className="animate-in fade-in duration-300 flex-1 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-in fade-in slide-in-from-top-4">
              <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="bg-amber-50 p-4 rounded-2xl text-amber-600"><Clock size={28}/></div>
                <div>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Chờ Lấy Tại Shop</p>
                  <p className="text-3xl font-black text-slate-800">{donChoLay} <span className="text-sm font-medium text-slate-400">đơn</span></p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="bg-purple-50 p-4 rounded-2xl text-purple-600"><Package size={28}/></div>
                <div>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Chờ Giao Cho Khách</p>
                  <p className="text-3xl font-black text-slate-800">{donChoGiao} <span className="text-sm font-medium text-slate-400">đơn</span></p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="bg-blue-50 p-4 rounded-2xl text-blue-600"><Users size={28}/></div>
                <div>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Tài Xế Trực Tuyến</p>
                  <p className="text-3xl font-black text-slate-800">{safeTaiXeList.length} <span className="text-sm font-medium text-slate-400">nhân sự</span></p>
                </div>
              </div>
            </div>

            <section className="mb-8 overflow-hidden rounded-[24px] border-2 border-amber-300 bg-amber-50 shadow-sm">
              <div className="flex items-center justify-between border-b border-amber-200 px-6 py-4">
                <div><p className="text-xs font-black uppercase tracking-widest text-amber-700">Ưu tiên gom hàng</p><h2 className="mt-1 text-xl font-black text-slate-800">Đơn hàng chờ gom · {donChoGom.length}</h2></div>
                <Package size={28} className="text-amber-600" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="bg-white/70 text-xs uppercase text-slate-500"><tr><th className="p-4">Mã vận đơn</th><th className="p-4">Điểm lấy hàng</th><th className="p-4">Người nhận</th><th className="p-4">COD</th><th className="p-4">Thao tác</th></tr></thead>
                  <tbody className="divide-y divide-amber-100">
                    {donChoGom.map((order) => <tr key={order.id}><td className="p-4 font-mono font-black">{order.tracking_code}</td><td className="p-4">{order.shop_address}</td><td className="p-4">{order.receiver_name}</td><td className="p-4 font-bold">{Number(order.cod_amount || 0).toLocaleString()} đ</td><td className="p-4"><button onClick={() => moModalPhanCong(order)} className="rounded-lg bg-amber-600 px-3 py-2 font-bold text-white hover:bg-amber-700">Phân tài xế lấy hàng</button></td></tr>)}
                    {!donChoGom.length && <tr><td colSpan="5" className="p-6 text-center text-slate-500">Không có đơn pending chờ gom.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-8 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-black text-slate-800">Đội tài xế theo nhiệm vụ</h2>
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  { id: 'pickup', label: 'Xe máy lấy hàng' },
                  { id: 'linehaul', label: 'Xe tải trung chuyển liên kho' },
                  { id: 'delivery', label: 'Xe máy giao hàng' }
                ].map((task) => <button key={task.id} onClick={async () => { setDriverTaskTab(task.id); await taiDanhSachTaiXe(task.id); }} className={`rounded-lg px-4 py-2 text-sm font-bold ${driverTaskTab === task.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{task.label}</button>)}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {safeTaiXeList.map((driver) => {
                  const position = viTriTaiXeMap[driver.id];
                  const closestDistance = donChoGom.reduce((best, order) => {
                    if (!position || !Number.isFinite(Number(order.shop_lat)) || !Number.isFinite(Number(order.shop_lng))) return best;
                    const distance = tinhKhoangCachKm(position.lat, position.lng, order.shop_lat, order.shop_lng);
                    return !best || distance < best.distance ? { order, distance } : best;
                  }, null);
                  return <article key={driver.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="font-black text-slate-800">{driver.full_name}</p>{driverTaskTab === 'linehaul'
                    ? <p className="mt-1 text-xs text-indigo-700">Đội xe tải riêng · chỉ nhận chuyến liên kho</p>
                    : <p className="mt-1 text-xs text-slate-500">Đang giữ {soDonTaiXeDangGiu(driver.id)} đơn</p>}{closestDistance && driverTaskTab === 'pickup' && <p className="mt-2 text-xs font-bold text-emerald-700">Phù hợp nhất: {closestDistance.order.tracking_code} · {closestDistance.distance.toFixed(1)} km đến Shop</p>}</article>;
                })}
                {!safeTaiXeList.length && <p className="text-sm text-slate-500">Không có tài xế đang hoạt động trong nhóm này.</p>}
              </div>
              {driverTaskTab === 'linehaul' && <p className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-900">Tài xế này không được phân đơn lấy hàng Shop hoặc đơn lẻ. Vào <strong>Quản lý xe & chuyến</strong>, tạo chuyến, chọn tài xế xe tải rồi gán các bao hàng.</p>}
              <div className="mt-5 border-t border-slate-100 pt-5">
                <h3 className="mb-3 font-black text-slate-800">Sức chứa và khu vực phục vụ</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {driverProfiles.map((profile) => {
                    const draft = profileDrafts[profile.id] || profile;
                    return (
                      <form key={profile.id} onSubmit={(event) => { event.preventDefault(); luuHoSoTaiXe(profile.id); }} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="mb-3 flex justify-between gap-2"><strong>{profile.full_name}</strong><span className="text-xs text-slate-500">{profile.role === 'delivery_driver' ? 'Giao hàng' : profile.role === 'linehaul_driver' ? 'Trung chuyển liên kho' : 'Lấy hàng Shop'}</span></div>
                        <p className="mb-3 text-xs text-slate-500">Đang giữ {profile.active_count} đơn · {Number(profile.active_weight_kg || 0).toLocaleString()} kg</p>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs font-bold text-slate-600">Số đơn tối đa<input type="number" min="1" max="100" required value={draft.max_active_orders} onChange={(event) => setProfileDrafts((current) => ({ ...current, [profile.id]: { ...draft, max_active_orders: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" /></label>
                          <label className="text-xs font-bold text-slate-600">Tải trọng tối đa (kg)<input type="number" min="0.1" max="100000" step="0.1" required value={draft.max_payload_kg} onChange={(event) => setProfileDrafts((current) => ({ ...current, [profile.id]: { ...draft, max_payload_kg: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" /></label>
                          <label className="col-span-2 text-xs font-bold text-slate-600">Khu vực phụ trách, phân cách bằng dấu phẩy<input value={draft.service_areas || ''} maxLength={500} onChange={(event) => setProfileDrafts((current) => ({ ...current, [profile.id]: { ...draft, service_areas: event.target.value } }))} placeholder="Quận 1, Bình Thạnh · để trống nếu nhận mọi khu vực" className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" /></label>
                        </div>
                        <button type="submit" disabled={savingProfileId === profile.id} className="mt-3 rounded-lg bg-slate-800 px-3 py-2 text-xs font-black text-white disabled:opacity-50">{savingProfileId === profile.id ? 'Đang lưu...' : 'Lưu cấu hình tài xế'}</button>
                      </form>
                    );
                  })}
                </div>
              </div>
            </section>

            <div className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">AI Smart Dispatching</h1>
                <p className="text-slate-500 mt-2 font-medium">Đơn được phân công riêng cho nhóm tài xế lấy hàng hoặc nhóm tài xế giao hàng.</p>
              </div>
              <div className="relative w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Tìm mã đơn hoặc địa chỉ..." className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all font-medium" value={tuKhoa} onChange={(e) => setTuKhoa(e.target.value)} />
              </div>
            </div>

            <section className="mb-8 rounded-[24px] border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-lg font-black text-indigo-950">Tự động chia đơn · bản xem trước</h2><p className="mt-1 text-xs text-indigo-800">Cân theo số đơn, tải trọng, khu vực cấu hình và GPS gần nhất. Mỗi nhóm nhiệm vụ được lập kế hoạch riêng.</p></div>
                <button type="button" onClick={taoKeHoachTuDong} disabled={!driverProfiles.length} className="rounded-xl bg-indigo-700 px-4 py-3 font-black text-white disabled:opacity-50"><Zap size={16} className="mr-2 inline" />Tạo đề xuất</button>
              </div>
              {autoDispatchMessage && <p role="status" className="mt-3 rounded-lg bg-white p-3 text-sm font-bold text-indigo-800">{autoDispatchMessage}</p>}
              {autoDispatchPlan.length > 0 && (
                <>
                  <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-indigo-100 bg-white">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500"><tr><th className="p-3">Đơn</th><th className="p-3">Nhiệm vụ</th><th className="p-3">Tài xế đề xuất</th><th className="p-3">Tải</th><th className="p-3">Kết quả</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{autoDispatchPlan.map((item) => <tr key={item.order.id}>
                        <td className="p-3 font-mono font-bold">{item.order.tracking_code}</td>
                        <td className="p-3">{item.taskType.replace('_', ' ')}</td>
                        <td className="p-3">{item.driverName || '—'}{item.distance !== null && item.distance !== undefined && <span className="block text-xs text-slate-500">{item.distance.toFixed(1)} km GPS</span>}</td>
                        <td className="p-3">{Number(item.order.weight_kg || 0).toLocaleString()} kg</td>
                        <td className={`p-3 text-xs font-bold ${item.state === 'blocked' || item.state === 'failed' ? 'text-red-700' : item.state === 'assigned' ? 'text-emerald-700' : 'text-amber-700'}`}>{item.message || (item.state === 'assigned' ? 'Đã duyệt' : item.state === 'failed' ? 'Lỗi' : item.state === 'blocked' ? 'Không đủ điều kiện' : 'Chờ duyệt')}</td>
                      </tr>)}</tbody>
                    </table>
                  </div>
                  <button type="button" onClick={duyetKeHoachTuDong} disabled={autoDispatchBusy || !autoDispatchPlan.some((item) => item.driverId && item.state === 'pending')} className="mt-4 rounded-xl bg-emerald-700 px-5 py-3 font-black text-white disabled:opacity-50">{autoDispatchBusy ? 'Đang duyệt tuần tự...' : 'Duyệt và phân công đề xuất'}</button>
                </>
              )}
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {donDaLoc.length === 0 ? (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-[24px] border border-slate-200 border-dashed">
                  <CheckCircle size={48} className="mb-4 text-emerald-400 opacity-50"/>
                  <p className="text-lg font-bold text-slate-600">Tuyệt vời! Không còn đơn hàng nào tồn đọng.</p>
                </div>
              ) : (
                donDaLoc.map((don) => (
                  <div key={don.id} className="bg-white rounded-[24px] shadow-sm border border-slate-100 hover:shadow-md transition-all overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                      <span className="font-black text-slate-700 tracking-wide">{don?.tracking_code}</span>
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 ${
                        don.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {don.status === 'pending' ? <><Clock size={14}/> Shop → Kho con</> :
                          don.status === 'at_origin_warehouse' ? <><PackageSearch size={14}/> Chờ đóng bao Kho con → Kho tổng</> :
                          don.status === 'at_central_warehouse' ? <><PackageSearch size={14}/> Chờ đóng bao Kho tổng → Kho con đích</> :
                          <><PackageSearch size={14}/> Kho con → Người nhận</>}
                      </span>
                    </div>
                    
                    <div className="p-6 flex-1 space-y-4">
                      <div className="flex items-start gap-3">
                        <MapPin className="text-slate-400 mt-1 shrink-0" size={18} />
                        <div>
                          <p className="text-sm font-bold text-slate-800">{don?.receiver_name} ({don?.receiver_phone})</p>
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{don?.receiver_address}</p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tiền COD</span>
                        <span className="font-black text-red-500">{Number(don?.cod_amount || 0).toLocaleString()} đ</span>
                      </div>
                    </div>

                    <div className="p-5 pt-0 mt-auto">
                      <button 
                        onClick={() => moModalPhanCong(don)}
                        className="w-full bg-emerald-50 hover:bg-emerald-500 hover:text-white text-emerald-600 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Zap size={18} /> Quét & Điều Phối Tự Động
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tabHienTai === 'rma' && (
          <section className="animate-in fade-in duration-300 flex-1">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Duyệt yêu cầu giao lại</h1>
                <p className="mt-2 font-medium text-slate-500">Kiểm tra xác nhận của Shop và bằng chứng trước khi quyết định. Duyệt không tự phân tài xế.</p>
              </div>
              <button type="button" onClick={taiYeuCauRma} disabled={rmaLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <RotateCw size={16} className={rmaLoading ? 'animate-spin' : ''} /> Làm mới
              </button>
            </div>
            {(rmaError || rmaMessage) && <p role={rmaError ? 'alert' : 'status'} className={`mb-5 rounded-xl p-4 text-sm font-semibold ${rmaError ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{rmaError || rmaMessage}</p>}
            <div className="mb-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Chờ xử lý</p><p className="mt-2 text-3xl font-black text-amber-600">{rmaRequests.filter((request) => request.status === 'pending').length}</p></div>
              <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Đã duyệt</p><p className="mt-2 text-3xl font-black text-emerald-600">{rmaRequests.filter((request) => request.status === 'approved').length}</p></div>
              <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Đã từ chối</p><p className="mt-2 text-3xl font-black text-rose-600">{rmaRequests.filter((request) => request.status === 'rejected').length}</p></div>
            </div>
            {rmaLoading && rmaRequests.length === 0 ? (
              <div role="status" className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-semibold text-slate-500">Đang tải yêu cầu...</div>
            ) : rmaRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <CheckCircle className="mx-auto text-emerald-500" size={36} />
                <p className="mt-3 font-black text-slate-800">Chưa có yêu cầu giao lại</p>
                <p className="mt-1 text-sm text-slate-500">Các yêu cầu mới từ Shop sẽ xuất hiện ở đây.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rmaRequests.map((request) => (
                  <article key={request.order_id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Vận đơn · {request.shop_name || `Shop #${request.shop_id}`}</p>
                        <h2 className="mt-1 text-xl font-black text-slate-800">{request.tracking_code}</h2>
                        <p className="mt-1 text-xs text-slate-500">Gửi lúc {new Date(request.requested_at).toLocaleString('vi-VN')}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1.5 text-xs font-black ${request.status === 'pending' ? 'bg-amber-100 text-amber-800' : request.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {request.status === 'pending' ? 'Chờ xử lý' : request.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}
                      </span>
                    </header>
                    <div className="grid gap-5 p-5 lg:grid-cols-2">
                      <div className="space-y-3">
                        <div className="rounded-xl bg-slate-50 p-4 text-sm">
                          <p><strong>Khách nhận:</strong> {request.receiver_name} · {request.receiver_phone}</p>
                          <p className="mt-1"><strong>Địa chỉ:</strong> {request.receiver_address}</p>
                          <p className="mt-1"><strong>COD:</strong> {Number(request.cod_amount || 0).toLocaleString('vi-VN')} đ</p>
                        </div>
                        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                          <p className="flex items-center gap-2 text-sm font-black text-rose-800"><AlertCircle size={16} /> Lý do giao thất bại</p>
                          <p className="mt-1 text-sm text-rose-700">{request.fail_reason || 'Không có thông tin'}</p>
                        </div>
                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                          <p className="text-sm font-black text-blue-900">Shop xác nhận khách đồng ý nhận lại</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-blue-800">{request.request_note}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {request.proof_image ? (
                          <a href={`${API_URL}${request.proof_image}`} target="_blank" rel="noreferrer" className="block">
                            <img src={`${API_URL}${request.proof_image}`} alt={`Bằng chứng giao thất bại ${request.tracking_code}`} className="max-h-64 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain" />
                            <span className="mt-1 block text-xs font-semibold text-slate-500">Mở ảnh bằng chứng kích thước đầy đủ</span>
                          </a>
                        ) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Đơn chưa có ảnh bằng chứng.</p>}
                        {request.review_note && <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><strong>Ghi chú xử lý:</strong> {request.review_note}</p>}
                        {request.status === 'pending' && (
                          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                            <label htmlFor={`rma-review-${request.order_id}`} className="block text-sm font-black text-slate-700">Ghi chú duyệt / lý do từ chối</label>
                            <textarea
                              id={`rma-review-${request.order_id}`}
                              maxLength={1000}
                              rows={3}
                              value={rmaReviewNotes[request.order_id] || ''}
                              onChange={(event) => setRmaReviewNotes((current) => ({ ...current, [request.order_id]: event.target.value }))}
                              className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                              placeholder="Khi từ chối, ghi rõ lý do (tối thiểu 5 ký tự)."
                            />
                            <div className="flex flex-wrap gap-2">
                              <button type="button" disabled={rmaBusyOrderId === request.order_id} onClick={() => xuLyYeuCauRma(request, 'approved')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle size={16} /> Duyệt yêu cầu</button>
                              <button type="button" disabled={rmaBusyOrderId === request.order_id} onClick={() => xuLyYeuCauRma(request, 'rejected')} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-50"><AlertCircle size={16} /> Từ chối</button>
                              {rmaBusyOrderId === request.order_id && <span role="status" className="self-center text-xs font-semibold text-slate-500">Đang lưu...</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: BẢN ĐỒ GIÁM SÁT ĐÃ FIX LỖI XÁM */}
        {tabHienTai === 'bandogiamsat' && (
          <div className="animate-in fade-in duration-300 flex-1 flex flex-col h-[calc(100vh-120px)]">
            <div className="mb-4">
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">Bản Đồ Giám Sát Tài Xế</h1>
              <p className="text-slate-500 mt-1 font-medium">Theo dõi vị trí thời gian thực của các tài xế đang thực hiện đơn hàng.</p>
            </div>
            <div className="flex-1 w-full bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden relative z-0">
              <MapContainer center={[10.762622, 106.660172]} zoom={13} style={{ width: '100%', height: '100%' }}>
                {/* Thành phần bắt buộc để fix lỗi xám khung hình */}
                <UpdateMapSize /> 
                {/* Nâng cấp giao diện với Google Maps */}
                <TileLayer 
                  url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" 
                  attribution='&copy; Google Maps' 
                />
                {Object.entries(viTriTaiXeMap || {}).map(([orderId, pos]) => (
                  <Marker key={orderId} position={[pos.lat, pos.lng]} icon={shipperIcon}>
                    <Popup>
                      <div className="font-bold text-slate-800">Mã đơn: {pos?.tracking_code}</div>
                      <div className="text-xs text-slate-500 mt-1">Cập nhật: {new Date(pos?.timestamp).toLocaleTimeString()}</div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        )}

        {tabHienTai === 'baocao' && (
          <div className="animate-in fade-in duration-300 max-w-3xl">
            <div className="mb-8">
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">Soạn Báo Cáo Định Kỳ</h1>
              <p className="text-slate-500 mt-2 font-medium">Báo cáo hiệu suất điều phối, chi phí hoặc đề xuất lên Ban Giám Đốc.</p>
            </div>
            <form onSubmit={guiBaoCao} className="bg-white p-8 rounded-[24px] shadow-sm border border-slate-200 space-y-6">
              <div><label className="block text-sm font-bold text-slate-700 mb-2">Tiêu đề báo cáo</label><input type="text" required placeholder="VD: Báo cáo hiệu suất tài xế tuần 3..." className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all font-bold text-slate-800" value={formBaoCao?.title || ''} onChange={(e) => setFormBaoCao({...formBaoCao, title: e.target.value})} /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-2">Nội dung chi tiết</label><textarea required rows="8" placeholder="Nhập chi tiết các chỉ số..." className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all font-medium text-slate-700 resize-none leading-relaxed" value={formBaoCao?.content || ''} onChange={(e) => setFormBaoCao({...formBaoCao, content: e.target.value})}></textarea></div>
              <label className="block text-sm font-bold text-slate-700">Tệp đính kèm (tối đa 15 MB)
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.jpg,.jpeg,.png,.webp" onChange={(e) => setFileBaoCao(e.target.files?.[0] || null)} className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium file:mr-4 file:border-0 file:bg-emerald-100 file:px-4 file:py-2 file:font-bold file:text-emerald-700" />
                {fileBaoCao && <span className="mt-2 block text-xs font-medium text-slate-500">Đã chọn: {fileBaoCao.name}</span>}
              </label>
              <div className="pt-2 flex justify-end"><button type="submit" disabled={dangGuiBaoCao} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center gap-2 disabled:opacity-70">{dangGuiBaoCao ? 'Đang Gửi...' : <><Send size={18}/> Gửi Lên Ban Giám Đốc</>}</button></div>
            </form>
          </div>
        )}

      </div>

      {/* MODAL PHÂN CÔNG AI CÓ KHÓA KHU VỰC */}
      {modalMo && donDangChon && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] shadow-2xl max-w-md w-full p-8 relative animate-in fade-in zoom-in-95 duration-300">
            
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-400 to-teal-500 text-white px-6 py-2 rounded-full font-black shadow-lg flex items-center gap-2 text-sm border-4 border-white whitespace-nowrap">
              <ShieldCheck size={16} className="fill-white"/> PHÂN CÔNG THEO NHÓM TÀI XẾ
            </div>

            <h3 className="text-2xl font-black text-slate-800 mb-2 mt-4 text-center">{{ pickup: 'Shop → Kho con', delivery: 'Kho con → Người nhận' }[loaiNhiemVu]}</h3>
            <p className="text-slate-500 text-sm mb-4 text-center">Đơn hàng: <span className="font-bold text-slate-700">{donDangChon?.tracking_code}</span></p>

            <p className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">Danh sách chỉ gồm tài xế thuộc nhóm phù hợp. Đơn phù hợp nhất được xếp đầu theo khoảng cách GPS tới Shop.</p>

            <form onSubmit={phanCongTaiXe} className="space-y-4">
              <label className="block text-sm font-bold text-slate-700 mb-1">{loaiNhiemVu === 'delivery' ? 'Nhóm tài xế giao hàng' : 'Nhóm tài xế lấy hàng tại Shop'}:</label>
              
              <div className="space-y-3 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                {danhSachTaiXeHienThi.length === 0 ? (
                  <div className="text-center p-6 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-red-500 text-sm font-bold">Không có tài xế nào thuộc khu vực này!</p>
                    <p className="text-xs text-red-400 mt-1">Kiểm tra nhóm tài xế và bộ lọc khu vực đang chọn.</p>
                  </div>
                ) : (
                  danhSachTaiXeHienThi.map((tx) => (
                    <label key={tx.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      String(taiXeDuocChon) === String(tx.id) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:border-slate-200 bg-white'
                    }`}>
                      <input 
                        type="radio" 
                        name="shipper" 
                        value={tx.id}
                        className="hidden"
                        checked={String(taiXeDuocChon) === String(tx.id)}
                        onChange={() => setTaiXeDuocChon(String(tx.id))}
                      />
                      <div className="bg-slate-100 p-2.5 rounded-full text-slate-500 relative">
                        <Truck size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-800">{tx?.full_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{tx.role === 'delivery_driver' ? 'Tài xế giao hàng' : 'Tài xế lấy hàng tại Shop'} · đang giữ {soDonTaiXeDangGiu(tx.id)} đơn</p>
                        {tx.id === driverNearest?.id && <p className="mt-1 text-xs font-black text-emerald-700">✓ Phù hợp nhất · {driverDistance(tx).toFixed(1)} km tới Shop</p>}
                      </div>
                      {String(taiXeDuocChon) === String(tx.id) && <CheckCircle className="ml-auto text-emerald-500" size={20} />}
                    </label>
                  ))
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
                <button 
                  type="button"
                  onClick={() => setModalMo(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button 
                  type="submit"
                  disabled={danhSachTaiXeHienThi.length === 0}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                >
                  <Navigation size={18} /> Chốt Phân Tuyến
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}