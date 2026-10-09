import { apiFetch as fetch } from '../../utils/apiFetch.js';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ScanLine, Barcode, LogOut, Box, ArrowRightLeft, CheckCircle, AlertCircle, PackageSearch, Camera, ImagePlus, X, MapPin, Save, Plus, Truck } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import BarcodeLabel from 'react-barcode';

const supportedBarcodeFormats = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.AZTEC,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.PDF_417
];

export default function QuetMaVach() {
  const [maVanDon, setMaVanDon] = useState('');
  const [tonKho, setTonKho] = useState([]);
  const [thongBao, setThongBao] = useState({ loai: '', thongDiep: '' });
  const [maVuaDoc, setMaVuaDoc] = useState('');
  const [trangThaiCamera, setTrangThaiCamera] = useState('');
  const [dangXuLy, setDangXuLy] = useState(false);
  const [tabKho, setTabKho] = useState(() => localStorage.getItem('warehouse_type') === 'central' ? 'overview' : 'scan');
  const [wrongWarehouseAlarm, setWrongWarehouseAlarm] = useState(false);
  const [danhSachKho, setDanhSachKho] = useState([]);
  const [khoDrafts, setKhoDrafts] = useState({});
  const [phuongMoi, setPhuongMoi] = useState('');
  const [diaChiKhoMoi, setDiaChiKhoMoi] = useState('');
  const [viDoKhoMoi, setViDoKhoMoi] = useState('');
  const [kinhDoKhoMoi, setKinhDoKhoMoi] = useState('');
  const [warehouseId, setWarehouseId] = useState(() => localStorage.getItem('warehouse_id') || '');
  const [binLocations, setBinLocations] = useState([]);
  const [selectedBinCode, setSelectedBinCode] = useState('');
  const [crossDockMode, setCrossDockMode] = useState(false);
  const [binCodeDraft, setBinCodeDraft] = useState('');
  const [binNameDraft, setBinNameDraft] = useState('');
  const [creatingBin, setCreatingBin] = useState(false);
  const [auditId, setAuditId] = useState(null);
  const [auditScanCode, setAuditScanCode] = useState('');
  const [auditScannedCount, setAuditScannedCount] = useState(0);
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditReport, setAuditReport] = useState(null);
  const [bags, setBags] = useState([]);
  const [bagDestinationId, setBagDestinationId] = useState('');
  const [selectedBagId, setSelectedBagId] = useState('');
  const [bagScanCode, setBagScanCode] = useState('');
  const [bagScanBusy, setBagScanBusy] = useState(false);
  const [bagScanNotice, setBagScanNotice] = useState({ loai: '', thongDiep: '' });
  const [linehaulScanCode, setLinehaulScanCode] = useState('');
  const [receivedBag, setReceivedBag] = useState(null);
  const [deliveryDrivers, setDeliveryDrivers] = useState([]);
  const [deliveryDriverId, setDeliveryDriverId] = useState('');
  const [assigningReceivedBag, setAssigningReceivedBag] = useState(false);
  const [deliveryAssignments, setDeliveryAssignments] = useState({});
  const [assigningDeliveryOrderId, setAssigningDeliveryOrderId] = useState(null);
  const [deliveryOrdersLoading, setDeliveryOrdersLoading] = useState(false);
  const [deliveryAssignmentError, setDeliveryAssignmentError] = useState('');
  const [deliveryAssignmentNotice, setDeliveryAssignmentNotice] = useState('');
  const [linehaulTrucks, setLinehaulTrucks] = useState([]);
  const [linehaulDrivers, setLinehaulDrivers] = useState([]);
  const [linehaulTrips, setLinehaulTrips] = useState([]);
  const [linehaulDataError, setLinehaulDataError] = useState('');
  const [linehaulTripDraft, setLinehaulTripDraft] = useState({ truck_id: '', driver_id: '', destination_warehouse_id: '' });
  const [selectedLinehaulTripId, setSelectedLinehaulTripId] = useState('');
  const [selectedLinehaulBagIds, setSelectedLinehaulBagIds] = useState([]);
  const [linehaulDispatchBusy, setLinehaulDispatchBusy] = useState(false);
  
  // State quản lý việc bật/tắt Camera
  const [moCamera, setMoCamera] = useState(false);
  
  const inputRef = useRef(null);
  const imageInputRef = useRef(null);
  const warehouseName = localStorage.getItem('full_name') || 'Thủ Kho';
  const isWarehouseManager = (localStorage.getItem('role') || localStorage.getItem('user_role')) === 'warehouse_manager';
  const selectedWarehouse = danhSachKho.find((warehouse) => String(warehouse.id) === String(warehouseId));
  const isCentralWarehouse = selectedWarehouse
    ? selectedWarehouse.warehouse_type === 'central'
    : localStorage.getItem('warehouse_type') === 'central';
  const canRunInventoryAudit = !isWarehouseManager || isCentralWarehouse;
  const pendingDeliveryOrders = (Array.isArray(tonKho) ? tonKho : []).filter((order) => (
    order.status === 'at_destination_warehouse' && !order.delivery_shipper_id
  ));
  const availableOutboundBags = bags.filter((bag) => Number(bag.source_warehouse_id) === Number(warehouseId)
    && bag.status === 'sealed' && !Number(bag.is_assigned_to_trip));
  const isLinehaulDriverAssigned = (driver) => linehaulTrips.some((trip) =>
    Number(trip.driver_id) === Number(driver.id) && !['completed', 'cancelled'].includes(trip.status));
  const availableLinehaulDrivers = linehaulDrivers.filter((driver) => !isLinehaulDriverAssigned(driver));

  const taiTonKho = async (selectedWarehouseId = warehouseId) => {
    try {
      if (!selectedWarehouseId) return setTonKho([]);
      const res = await fetch(`http://localhost:5000/api/warehouse/inventory?warehouse_id=${selectedWarehouseId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTonKho(data.data);
      }
    } catch (error) {
      console.error("Lỗi tải tồn kho:", error);
    }
  };

  const taiDanhSachKho = async () => {
    try {
      const assignedWarehouseId = localStorage.getItem('warehouse_id');
      const warehousesResponse = await fetch('http://localhost:5000/api/warehouses');
      const warehousesData = await warehousesResponse.json();
      if (!warehousesResponse.ok || !warehousesData.success) throw new Error(warehousesData.message || 'Không tải được danh sách kho.');
      const warehouseRows = warehousesData.data || [];
      if (isWarehouseManager && assignedWarehouseId) {
        const routesResponse = await fetch(`http://localhost:5000/api/warehouse/routes?warehouse_id=${assignedWarehouseId}`);
        const routesData = await routesResponse.json();
        if (!routesResponse.ok || !routesData.success) throw new Error(routesData.message || 'Không tải được các kho trên tuyến.');
        const availableWarehouses = [...warehouseRows, ...(routesData.data || [])];
        setDanhSachKho(availableWarehouses);
        setWarehouseId(assignedWarehouseId);
        const assignedWarehouse = availableWarehouses.find((warehouse) => String(warehouse.id) === String(assignedWarehouseId));
        if (assignedWarehouse?.warehouse_type) localStorage.setItem('warehouse_type', assignedWarehouse.warehouse_type);
      } else {
        setDanhSachKho(warehouseRows);
        const activeWarehouses = warehouseRows.filter((warehouse) => warehouse.is_configured && warehouse.is_active);
        setWarehouseId((current) => {
          const nextWarehouseId = current || (activeWarehouses.length === 1 ? String(activeWarehouses[0].id) : '');
          const activeWarehouse = activeWarehouses.find((warehouse) => String(warehouse.id) === String(nextWarehouseId));
          if (activeWarehouse?.warehouse_type) localStorage.setItem('warehouse_type', activeWarehouse.warehouse_type);
          return nextWarehouseId;
        });
      }
    } catch (error) {
      console.error('Lỗi tải danh mục kho:', error);
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không tải được danh sách kho.' });
    }
  };

  const taiViTriKe = async (selectedWarehouseId = warehouseId) => {
    if (!selectedWarehouseId) {
      setBinLocations([]);
      setSelectedBinCode('');
      return;
    }
    try {
      const response = await fetch(`http://localhost:5000/api/warehouse/bin-locations?warehouse_id=${selectedWarehouseId}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không tải được vị trí kệ.');
      setBinLocations(data.data || []);
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không tải được vị trí kệ.' });
    }
  };

  useEffect(() => {
    taiDanhSachKho();
    // Focus vào input trừ khi camera đang mở
    if (inputRef.current && !moCamera) inputRef.current.focus();
  }, [moCamera]);

  useEffect(() => {
    taiTonKho(warehouseId);
    taiViTriKe(warehouseId);
  }, [warehouseId]);

  const taiDonChoGiao = useCallback(async () => {
    if (!warehouseId) return;
    setDeliveryOrdersLoading(true);
    setDeliveryAssignmentError('');
    try {
      const [inventoryResponse, driversResponse] = await Promise.all([
        fetch(`http://localhost:5000/api/warehouse/inventory?warehouse_id=${warehouseId}`),
        fetch('http://localhost:5000/api/shippers?type=delivery')
      ]);
      const [inventoryData, driversData] = await Promise.all([
        inventoryResponse.json(),
        driversResponse.json()
      ]);
      if (!inventoryResponse.ok || !inventoryData.success) {
        throw new Error(inventoryData.message || 'Không tải được danh sách đơn tại kho.');
      }
      if (!driversResponse.ok || !driversData.success) {
        throw new Error(driversData.message || 'Không tải được danh sách tài xế giao hàng.');
      }
      setTonKho(inventoryData.data || []);
      setDeliveryDrivers(driversData.data || []);
      setDeliveryDriverId((current) => driversData.data?.some((driver) => String(driver.id) === current)
        ? current : String(driversData.data?.[0]?.id || ''));
    } catch (error) {
      setDeliveryAssignmentError(error.message || 'Không tải được danh sách phân giao.');
    } finally {
      setDeliveryOrdersLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    if (tabKho === 'delivery' && !isCentralWarehouse) taiDonChoGiao();
  }, [tabKho, isCentralWarehouse, taiDonChoGiao]);

  const taoViTriKe = async (event) => {
    event.preventDefault();
    if (!warehouseId || creatingBin) return;
    setCreatingBin(true);
    try {
      const response = await fetch('http://localhost:5000/api/warehouse/bin-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouse_id: Number(warehouseId), bin_code: binCodeDraft, bin_name: binNameDraft })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không tạo được vị trí kệ.');
      setBinCodeDraft('');
      setBinNameDraft('');
      setSelectedBinCode(data.data.bin_code);
      setThongBao({ loai: 'thanhcong', thongDiep: `Đã tạo vị trí kệ ${data.data.bin_code}.` });
      await taiViTriKe();
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không tạo được vị trí kệ.' });
    } finally {
      setCreatingBin(false);
    }
  };

  const batDauKiemKe = async () => {
    if (!warehouseId || auditBusy) return;
    setAuditBusy(true);
    try {
      const response = await fetch('http://localhost:5000/api/warehouse/inventory-audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouse_id: Number(warehouseId) })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể mở phiếu kiểm kê.');
      setAuditId(data.data.id);
      setAuditScannedCount(0);
      setAuditReport(null);
      setThongBao({ loai: 'thanhcong', thongDiep: data.message });
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không thể mở phiếu kiểm kê.' });
    } finally {
      setAuditBusy(false);
    }
  };

  const quetKiemKe = async (event) => {
    event.preventDefault();
    if (!auditId || !auditScanCode.trim() || auditBusy) return;
    setAuditBusy(true);
    try {
      const response = await fetch(`http://localhost:5000/api/warehouse/inventory-audits/${auditId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_code: auditScanCode.trim() })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể ghi nhận mã kiểm kê.');
      setAuditScannedCount((count) => count + 1);
      setAuditScanCode('');
      inputRef.current?.focus();
      setThongBao({ loai: 'thanhcong', thongDiep: data.message });
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không thể ghi nhận mã kiểm kê.' });
    } finally {
      setAuditBusy(false);
    }
  };

  const chotKiemKe = async () => {
    if (!auditId || auditBusy || !window.confirm('Chốt phiếu kiểm kê? Danh sách kiện thiếu và mã dư sẽ được hiển thị.')) return;
    setAuditBusy(true);
    try {
      const response = await fetch(`http://localhost:5000/api/warehouse/inventory-audits/${auditId}/complete`, { method: 'PUT' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể chốt phiếu kiểm kê.');
      setAuditReport(data.data);
      setAuditId(null);
      setThongBao({ loai: 'thanhcong', thongDiep: 'Đã chốt phiếu và đối chiếu tồn kho.' });
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không thể chốt phiếu kiểm kê.' });
    } finally {
      setAuditBusy(false);
    }
  };

  const taiDuLieuLinehaul = async () => {
    try {
      const requests = [
        fetch(`http://localhost:5000/api/warehouse/bags?warehouse_id=${warehouseId}`),
        fetch('http://localhost:5000/api/shippers?type=delivery')
      ];
      if (isWarehouseManager && isCentralWarehouse) {
        requests.push(
          fetch('http://localhost:5000/api/trucks'),
          fetch('http://localhost:5000/api/shippers?type=linehaul'),
          fetch('http://localhost:5000/api/linehaul/trips')
        );
      }
      const responses = await Promise.all(requests);
      const results = await Promise.all(responses.map((response) => response.json()));
      const failedIndex = responses.findIndex((response, index) => !response.ok || !results[index].success);
      if (failedIndex >= 0) throw new Error(results[failedIndex].message || 'Không tải được dữ liệu trung chuyển.');
      const bagsData = results[0];
      setBags(bagsData.data || []);
      setDeliveryDrivers(results[1].data || []);
      setDeliveryDriverId((current) => results[1].data?.some((driver) => String(driver.id) === current)
        ? current : String(results[1].data?.[0]?.id || ''));
      if (isWarehouseManager && isCentralWarehouse) {
        setLinehaulTrucks(results[2].data || []);
        setLinehaulDrivers(results[3].data || []);
        setLinehaulTrips(results[4].data || []);
      }
      setLinehaulDataError('');
    } catch (error) {
      setLinehaulDataError(error.message || 'Không thể tải dữ liệu điều phối.');
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không thể tải dữ liệu trung chuyển.' });
    }
  };

  useEffect(() => {
    if (!['linehaul', 'overview'].includes(tabKho) || !warehouseId) return undefined;
    taiDuLieuLinehaul();
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') taiDuLieuLinehaul();
    };
    const intervalId = window.setInterval(taiDuLieuLinehaul, 30000);
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [tabKho, warehouseId]);

  const taoBaoHang = async (event) => {
    event.preventDefault();
    if (!warehouseId || !bagDestinationId) return setThongBao({ loai: 'loi', thongDiep: 'Chọn kho nguồn và kho đích cho bao.' });
    try {
      const response = await fetch('http://localhost:5000/api/warehouse/bags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_warehouse_id: Number(warehouseId), destination_warehouse_id: Number(bagDestinationId), created_by: localStorage.getItem('user_id') })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không tạo được bao hàng.');
      setSelectedBagId(String(data.data.id));
      setThongBao({ loai: 'thanhcong', thongDiep: `Đã tạo bao ${data.data.bag_code}.` });
      await taiDuLieuLinehaul();
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không thể tạo bao hàng.' });
    }
  };

  const quetDonVaoBao = async (event) => {
    event.preventDefault();
    const selectedBag = bags.find((bag) => String(bag.id) === selectedBagId);
    const trackingCode = bagScanCode.trim().toUpperCase();
    if (!selectedBag || !trackingCode || bagScanBusy) return;
    setBagScanBusy(true);
    setBagScanNotice({ loai: '', thongDiep: '' });
    try {
      const response = await fetch(`http://localhost:5000/api/warehouse/bags/${selectedBag.id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_code: trackingCode })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể thêm đơn vào bao.');
      setBagScanCode('');
      setBagScanNotice({ loai: 'thanhcong', thongDiep: `${data.message} Bao có ${data.data.order_count} đơn.` });
      await taiDuLieuLinehaul();
    } catch (error) {
      setBagScanNotice({ loai: 'loi', thongDiep: error.message || 'Không thể quét đơn vào bao.' });
    } finally {
      setBagScanBusy(false);
    }
  };

  const niemPhongBao = async (bag) => {
    try {
      const response = await fetch(`http://localhost:5000/api/warehouse/bags/${bag.id}/seal`, { method: 'PUT' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể niêm phong bao.');
      setThongBao({ loai: 'thanhcong', thongDiep: data.message });
      await taiDuLieuLinehaul();
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không thể niêm phong bao.' });
    }
  };

  const nhapBaoTrungChuyen = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/warehouse/linehaul/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bag_code: linehaulScanCode, warehouse_id: Number(warehouseId) })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể nhập bao vào kho.');
      setReceivedBag(data.data || null);
      setLinehaulScanCode('');
      setThongBao({ loai: 'thanhcong', thongDiep: data.message });
      await taiDuLieuLinehaul();
      await taiTonKho();
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không thể nhập bao trung chuyển.' });
    }
  };

  const phanCongDonTrongBao = async () => {
    if (!receivedBag || !deliveryDriverId || assigningReceivedBag) return;
    const eligibleOrders = (receivedBag.orders || []).filter((order) => (
      order.status === 'at_destination_warehouse' && !order.delivery_shipper_id
    ));
    if (!eligibleOrders.length) {
      setThongBao({ loai: 'loi', thongDiep: 'Bao này không có đơn nào đang chờ phân tài xế giao tại kho hiện tại.' });
      return;
    }
    setAssigningReceivedBag(true);
    const assignedIds = [];
    const failures = [];
    try {
      for (const order of eligibleOrders) {
        try {
          const response = await fetch(`http://localhost:5000/api/orders/${order.id}/assign`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shipper_id: Number(deliveryDriverId), task_type: 'delivery' })
          });
          const result = await response.json();
          if (!response.ok || !result.success) throw new Error(result.message || 'Không thể phân công.');
          assignedIds.push(order.id);
        } catch (error) {
          failures.push(`${order.tracking_code}: ${error.message || 'Không thể phân công.'}`);
        }
      }
      setReceivedBag((current) => current && ({
        ...current,
        orders: current.orders.map((order) => assignedIds.includes(order.id)
          ? { ...order, delivery_shipper_id: Number(deliveryDriverId) }
          : order)
      }));
      await taiTonKho();
      if (failures.length) {
        setThongBao({
          loai: 'loi',
          thongDiep: `Đã phân ${assignedIds.length}/${eligibleOrders.length} đơn. ${failures[0]}`
        });
      } else {
        setThongBao({ loai: 'thanhcong', thongDiep: `Đã phân ${assignedIds.length} đơn trong bao cho tài xế giao hàng.` });
      }
    } finally {
      setAssigningReceivedBag(false);
    }
  };

  const phanCongDonTaiKho = async (order) => {
    const driverId = Number(deliveryAssignments[order.id] || deliveryDriverId);
    if (!driverId || assigningDeliveryOrderId !== null) return;
    setAssigningDeliveryOrderId(order.id);
    setDeliveryAssignmentError('');
    setDeliveryAssignmentNotice('');
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${order.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipper_id: driverId, task_type: 'delivery' })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể phân tài xế giao đơn.');
      setTonKho((current) => current.map((item) => Number(item.id) === Number(order.id)
        ? { ...item, delivery_shipper_id: driverId }
        : item));
      setDeliveryAssignmentNotice(`Đã phân tài xế cho vận đơn ${order.tracking_code}.`);
    } catch (error) {
      setDeliveryAssignmentError(error.message || 'Không thể phân tài xế giao đơn.');
    } finally {
      setAssigningDeliveryOrderId(null);
    }
  };

  const taoChuyenVeKhoCon = async (event) => {
    event.preventDefault();
    if (!warehouseId || !linehaulTripDraft.truck_id || !linehaulTripDraft.driver_id || !linehaulTripDraft.destination_warehouse_id) {
      setThongBao({ loai: 'loi', thongDiep: 'Chọn xe tải, tài xế và kho con nhận hàng.' });
      return;
    }
    setLinehaulDispatchBusy(true);
    try {
      const response = await fetch('http://localhost:5000/api/linehaul/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          truck_id: Number(linehaulTripDraft.truck_id),
          driver_id: Number(linehaulTripDraft.driver_id),
          source_warehouse_id: Number(warehouseId),
          destination_warehouse_id: Number(linehaulTripDraft.destination_warehouse_id)
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không tạo được chuyến xe.');
      setSelectedLinehaulTripId(String(data.data.id));
      setLinehaulTripDraft({ truck_id: '', driver_id: '', destination_warehouse_id: '' });
      setThongBao({ loai: 'thanhcong', thongDiep: `Đã tạo chuyến ${data.data.trip_code}. Chọn bao niêm phong để giao đến kho con.` });
      await taiDuLieuLinehaul();
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không tạo được chuyến xe.' });
    } finally {
      setLinehaulDispatchBusy(false);
    }
  };

  const ganBaoVaoChuyenKhoTong = async () => {
    if (!selectedLinehaulTripId || !selectedLinehaulBagIds.length || linehaulDispatchBusy) return;
    setLinehaulDispatchBusy(true);
    try {
      for (const bagId of selectedLinehaulBagIds) {
        const bag = availableOutboundBags.find((item) => String(item.id) === String(bagId));
        if (!bag) continue;
        const response = await fetch(`http://localhost:5000/api/linehaul/trips/${selectedLinehaulTripId}/bags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bag_code: bag.bag_code })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(`${bag.bag_code}: ${data.message || 'Không gán được bao.'}`);
      }
      setSelectedLinehaulBagIds([]);
      setThongBao({ loai: 'thanhcong', thongDiep: `Đã phân ${selectedLinehaulBagIds.length} bao lên chuyến xe.` });
      await taiDuLieuLinehaul();
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không thể phân bao lên chuyến xe.' });
      await taiDuLieuLinehaul();
    } finally {
      setLinehaulDispatchBusy(false);
    }
  };

  const taoKhoPhuong = async (event) => {
    event.preventDefault();
    const wardName = phuongMoi.trim();
    if (!wardName || !diaChiKhoMoi.trim() || !viDoKhoMoi || !kinhDoKhoMoi) {
      setThongBao({ loai: 'loi', thongDiep: 'Nhập tên phường, địa chỉ và tọa độ đầy đủ để tạo kho con.' });
      return;
    }
    const res = await fetch('http://localhost:5000/api/warehouses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ward_name: wardName,
        address: diaChiKhoMoi.trim(),
        lat: Number(viDoKhoMoi),
        lng: Number(kinhDoKhoMoi)
      })
    });
    const data = await res.json();
    setThongBao({ loai: data.success ? 'thanhcong' : 'loi', thongDiep: data.message });
    if (data.success) {
      setPhuongMoi('');
      setDiaChiKhoMoi('');
      setViDoKhoMoi('');
      setKinhDoKhoMoi('');
      taiDanhSachKho();
    }
  };

  const luuKhoPhuong = async (warehouse) => {
    const draft = khoDrafts[warehouse.id] || warehouse;
    const res = await fetch(`http://localhost:5000/api/warehouses/${warehouse.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    });
    const data = await res.json();
    setThongBao({ loai: data.success ? 'thanhcong' : 'loi', thongDiep: data.message });
    if (data.success) taiDanhSachKho();
  };

  // HÀM XỬ LÝ CHUNG CHO CẢ SÚNG QUÉT, NHẬP TAY VÀ CAMERA
  const xuLyQuetMa = async (e, maTuCamera = null) => {
    if (e) e.preventDefault();
    
    // Lấy mã từ Camera hoặc từ ô Input
    const maCanXuly = String(maTuCamera || maVanDon).trim().replace(/\s+/g, '').toUpperCase();
    if (!maCanXuly) return;
    if (!warehouseId) {
      setThongBao({ loai: 'loi', thongDiep: 'Vui lòng chọn đúng kho đang thao tác trước khi quét.' });
      return;
    }

    setDangXuLy(true);
    setThongBao({ loai: '', thongDiep: '' });

    try {
      if (!crossDockMode) {
        const lookupParams = new URLSearchParams({ warehouse_id: warehouseId, bin_code: maCanXuly });
        const binResponse = await fetch(`http://localhost:5000/api/warehouse/bin-locations/lookup?${lookupParams}`);
        const binData = await binResponse.json();
        if (!binResponse.ok || !binData.success) throw new Error(binData.message || 'Không thể xác thực mã kệ.');
        if (binData.matched) {
          setSelectedBinCode(binData.data.bin_code);
          setMaVuaDoc(binData.data.bin_code);
          setThongBao({ loai: 'thanhcong', thongDiep: `Đã nhận diện kệ ${binData.data.bin_code} · ${binData.data.bin_name}. Bây giờ quét mã vận đơn.` });
          return;
        }
      }
      if (!crossDockMode && !selectedBinCode) {
        setThongBao({ loai: 'loi', thongDiep: 'Quét mã vạch vị trí kệ trước, sau đó mới quét mã vận đơn.' });
        return;
      }
      const res = await fetch('http://localhost:5000/api/warehouse/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_code: maCanXuly, warehouse_id: Number(warehouseId), bin_code: selectedBinCode, cross_dock: crossDockMode })
      });
      const data = await res.json();

      if (data.success) {
        setWrongWarehouseAlarm(false);
        setThongBao({ loai: 'thanhcong', thongDiep: data.message });
        taiTonKho(); 
      } else {
        if (res.status === 409) {
          setWrongWarehouseAlarm(true);
          try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
              const audioContext = new AudioContextClass();
              [0, 0.22].forEach((delay) => {
                const oscillator = audioContext.createOscillator();
                const gain = audioContext.createGain();
                oscillator.frequency.value = 880;
                gain.gain.setValueAtTime(0.15, audioContext.currentTime + delay);
                gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + delay + 0.12);
                oscillator.connect(gain);
                gain.connect(audioContext.destination);
                oscillator.start(audioContext.currentTime + delay);
                oscillator.stop(audioContext.currentTime + delay + 0.12);
              });
              window.setTimeout(() => audioContext.close(), 600);
            }
          } catch (audioError) {
            console.warn('Trình duyệt không phát được âm báo quét sai kho:', audioError);
          }
          window.setTimeout(() => setWrongWarehouseAlarm(false), 2500);
        }
        setThongBao({ loai: 'loi', thongDiep: data.message });
      }
    } catch {
      setThongBao({ loai: 'loi', thongDiep: 'Lỗi kết nối đến máy chủ!' });
    } finally {
      setDangXuLy(false);
      setMaVanDon(''); 
      if (inputRef.current && !moCamera) inputRef.current.focus();
      
      // Ẩn thông báo sau 3 giây
      setTimeout(() => setThongBao({ loai: '', thongDiep: '' }), 3000);
    }
  };

  const xuLyQuetAnh = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setDangXuLy(true);
    setThongBao({ loai: '', thongDiep: '' });
    const imageScanner = new Html5Qrcode('barcode-image-reader', {
      formatsToSupport: supportedBarcodeFormats,
      verbose: false
    });

    try {
      const decodedText = await imageScanner.scanFile(file, false);
      const trackingCode = decodedText.trim().replace(/\s+/g, '').toUpperCase();
      setMaVuaDoc(trackingCode);
      setThongBao({ loai: 'thanhcong', thongDiep: `Đã đọc mã ${trackingCode}. Đang kiểm tra đơn hàng...` });
      await xuLyQuetMa(null, trackingCode);
    } catch (error) {
      console.error('Không đọc được mã từ ảnh:', error);
      setThongBao({ loai: 'loi', thongDiep: 'Ảnh chưa đọc được mã. Hãy chụp thẳng, đủ sáng và để toàn bộ mã vạch rõ nét trong ảnh.' });
    } finally {
      imageScanner.clear().catch(() => {});
      setDangXuLy(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  // HOOK QUẢN LÝ THƯ VIỆN CAMERA (HTML5-QRCODE)
  useEffect(() => {
    if (moCamera) {
      setTrangThaiCamera('Đang khởi động camera...');
      const laMoiTruongAnToan = window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname);
      if (!laMoiTruongAnToan) {
        setThongBao({
          loai: 'loi',
          thongDiep: 'Camera bị trình duyệt chặn vì trang đang chạy bằng HTTP. Hãy dùng HTTPS hoặc mở hệ thống trực tiếp trên máy chủ.'
        });
        setTrangThaiCamera('Camera bị chặn do trang chưa an toàn');
        return undefined;
      }

      const scanner = new Html5QrcodeScanner('camera-reader', {
        fps: 5,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const width = Math.max(120, Math.min(viewfinderWidth - 20, 420));
          const height = Math.min(viewfinderHeight - 20, Math.max(80, Math.round(width / 3)));
          return { width, height };
        },
        aspectRatio: 1.777778,
        formatsToSupport: supportedBarcodeFormats,
        disableFlip: false,
        rememberLastUsedCamera: false
      });

      try {
        setTrangThaiCamera('Đang tìm mã vạch...');
        scanner.render((decodedText) => {
          scanner.clear().catch(() => {});
          setMoCamera(false);
          setMaVuaDoc(decodedText.trim().toUpperCase());
          setThongBao({ loai: 'thanhcong', thongDiep: `Đã đọc mã ${decodedText.trim().toUpperCase()}. Đang kiểm tra đơn hàng...` });
          setMaVanDon(decodedText);
          xuLyQuetMa(null, decodedText);
          const audio = new Audio('https://www.soundjay.com/button/beep-07.wav');
          audio.play().catch(() => {});
        }, () => {});
      } catch (error) {
        console.error('Không thể mở camera:', error);
        setMoCamera(false);
        setThongBao({
          loai: 'loi',
          thongDiep: 'Không thể mở camera. Hãy cấp quyền Camera hoặc dùng ô nhập mã vận đơn.'
        });
        setTrangThaiCamera('Không thể khởi động camera');
      }

      const reminder = window.setTimeout(() => {
        setThongBao({
          loai: 'loi',
          thongDiep: 'Chưa nhận được mã. Hãy đưa phần vạch đen trắng vào giữa khung, đủ sáng và giữ yên 2-3 giây.'
        });
      }, 12000);

      return () => {
        window.clearTimeout(reminder);
        scanner.clear().catch(() => {});
        setTrangThaiCamera('');
      };
    }
  }, [moCamera]);

  const dangXuat = () => {
    if (window.confirm("Bạn muốn kết thúc ca trực Kho?")) {
      localStorage.clear();
      window.location.href = '/'; 
    }
  };

  const anToanTonKho = Array.isArray(tonKho) ? tonKho : [];

  return (
    <div className={`flex min-h-screen font-sans text-slate-800 transition-colors ${wrongWarehouseAlarm ? 'bg-red-100' : 'bg-[#F1F5F9]'}`}>
      <div id="barcode-image-reader" className="fixed left-[-10000px] top-0 h-px w-px overflow-hidden" aria-hidden="true" />
      
      {/* SIDEBAR */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 shadow-xl flex flex-col z-10 justify-between text-slate-300">
        <div>
          <div className="p-8 border-b border-slate-800 flex items-center gap-3 bg-slate-950/50">
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <Barcode className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Kho Bãi</h2>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">Quản lý Xuất Nhập</p>
              <p className="mt-1 max-w-40 truncate text-sm font-bold text-white" title={warehouseName}>{warehouseName}</p>
              {selectedWarehouse?.address && <p className="mt-2 max-w-48 text-xs leading-5 text-slate-300" title={selectedWarehouse.address}><MapPin size={12} className="mr-1 inline-block align-[-1px]" />{selectedWarehouse.address}</p>}
            </div>
          </div>
          
          <div className="p-5 mt-2 space-y-2">
            {isWarehouseManager && isCentralWarehouse && <button onClick={() => setTabKho('overview')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabKho === 'overview' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
              <PackageSearch size={20} /> Tổng Quan Kho Tổng
            </button>}
            <button onClick={() => setTabKho('scan')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabKho === 'scan' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
              <ScanLine size={20} /> Máy Quét Mã Vạch
            </button>
            <button onClick={() => setTabKho('linehaul')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabKho === 'linehaul' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
              <ArrowRightLeft size={20} /> Nhập / Xuất Bao Liên Kho
            </button>
            {!isCentralWarehouse && <button onClick={() => setTabKho('delivery')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabKho === 'delivery' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
              <Truck size={20} /> Phân Tài Xế Giao Hàng
              {pendingDeliveryOrders.length > 0 && <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-xs font-black text-white">{pendingDeliveryOrders.length}</span>}
            </button>}
            {canRunInventoryAudit && <button onClick={() => setTabKho('kiem-ke')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabKho === 'kiem-ke' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
              <Box size={20} /> Kiểm Kê Định Kỳ
            </button>}
            {(!isWarehouseManager || (isWarehouseManager && isCentralWarehouse)) && <button onClick={() => setTabKho('warehouses')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabKho === 'warehouses' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
              <MapPin size={20} /> Danh Mục Kho
            </button>}
          </div>
        </div>

        <div className="p-5 border-t border-slate-800 bg-slate-950/30">
          <button onClick={dangXuat} className="w-full px-5 py-4 rounded-2xl font-bold text-left text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-3">
            <LogOut size={18}/> Đăng Xuất
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <>
        {tabKho === 'overview' && isWarehouseManager && isCentralWarehouse ? (
          <div className="flex-1 overflow-y-auto p-6 md:p-10">
            <header className="mb-8">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600">Trung tâm Hub · Điều hành kho</p>
              <h1 className="mt-3 text-3xl font-black text-slate-800">Quản lý Kho Tổng</h1>
              <p className="mt-2 text-sm text-slate-500">{selectedWarehouse?.name || 'Kho tổng Smart Logistics'} · Nhận bao từ kho con, phân loại tồn và đóng bao theo kho đích.</p>
            </header>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Đơn đang lưu tại kho tổng', value: anToanTonKho.length, tone: 'text-indigo-700 bg-indigo-50' },
                { label: 'Bao đang trên đường về Hub', value: bags.filter((bag) => Number(bag.destination_warehouse_id) === Number(warehouseId) && bag.status === 'in_transit').length, tone: 'text-blue-700 bg-blue-50' },
                { label: 'Bao đã nhập, sẵn sàng phân loại', value: bags.filter((bag) => Number(bag.destination_warehouse_id) === Number(warehouseId) && bag.status === 'received').length, tone: 'text-emerald-700 bg-emerald-50' },
                { label: 'Bao chờ chuyển về kho con', value: bags.filter((bag) => Number(bag.source_warehouse_id) === Number(warehouseId) && bag.status === 'sealed').length, tone: 'text-amber-700 bg-amber-50' }
              ].map((item) => (
                <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-bold text-slate-500">{item.label}</p>
                  <p className={`mt-4 inline-flex rounded-xl px-4 py-2 text-3xl font-black ${item.tone}`}>{item.value}</p>
                </article>
              ))}
            </section>
            <section className="mt-8 grid gap-5 lg:grid-cols-3">
              <button onClick={() => setTabKho('linehaul')} className="rounded-2xl border border-indigo-200 bg-white p-6 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md">
                <ArrowRightLeft className="text-indigo-600" size={26} />
                <h2 className="mt-4 font-black text-slate-800">Nhận bao & phân loại</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Quét nhận bao từ kho nguồn, cập nhật đơn vào tồn Hub, rồi đóng bao mới theo kho đích.</p>
              </button>
              <button onClick={() => setTabKho('scan')} className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md">
                <ScanLine className="text-indigo-600" size={26} />
                <h2 className="mt-4 font-black text-slate-800">Quét và xử lý đơn lẻ</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Tra cứu mã vận đơn, xác nhận kiện và vị trí lưu kho theo quy trình hiện tại.</p>
              </button>
              <button onClick={() => setTabKho('warehouses')} className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md">
                <MapPin className="text-indigo-600" size={26} />
                <h2 className="mt-4 font-black text-slate-800">Tạo và quản lý kho con</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Khai báo kho con mới cùng địa chỉ và tọa độ để có thể điều phối chuyến đến kho.</p>
              </button>
              <button onClick={() => setTabKho('kiem-ke')} className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md">
                <Box className="text-indigo-600" size={26} />
                <h2 className="mt-4 font-black text-slate-800">Kiểm kê Hub</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Mở phiếu kiểm kê mù và đối chiếu kiện thiếu / mã dư tại Kho Tổng.</p>
              </button>
            </section>
          </div>
        ) : tabKho === 'warehouses' ? (
          <div className="flex-1 p-6 md:p-10">
            <div className="mb-8">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600">Mạng lưới kho TP.HCM</p>
              <h1 className="mt-3 text-3xl font-black text-slate-800">Kho tổng và kho theo phường</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">Kho tổng đã đặt tại 10.762622, 106.660172. Chỉ kho con có địa chỉ và tọa độ thật mới được dùng để định tuyến.</p>
            </div>
            <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
              <p className="font-bold text-indigo-900">Kho tổng Smart Logistics</p>
              <p className="mt-1 text-sm text-indigo-700">10.762622, 106.660172 · TP. Hồ Chí Minh</p>
            </div>
            <form onSubmit={taoKhoPhuong} className="mb-6 grid gap-3 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm md:grid-cols-2">
              <h2 className="text-lg font-black text-slate-800 md:col-span-2">Tạo kho con mới</h2>
              <label className="text-sm font-bold text-slate-600">Tên phường / quận
                <input value={phuongMoi} onChange={(event) => setPhuongMoi(event.target.value)} required maxLength={120} placeholder="Ví dụ: Gò Vấp" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-400" />
              </label>
              <label className="text-sm font-bold text-slate-600 md:col-span-2">Địa chỉ kho
                <input value={diaChiKhoMoi} onChange={(event) => setDiaChiKhoMoi(event.target.value)} required maxLength={1000} placeholder="Số nhà, tên đường, phường/quận, TP. Hồ Chí Minh" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-400" />
              </label>
              <label className="text-sm font-bold text-slate-600">Vĩ độ
                <input type="number" step="any" min="-90" max="90" value={viDoKhoMoi} onChange={(event) => setViDoKhoMoi(event.target.value)} required placeholder="10.8231" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-400" />
              </label>
              <label className="text-sm font-bold text-slate-600">Kinh độ
                <input type="number" step="any" min="-180" max="180" value={kinhDoKhoMoi} onChange={(event) => setKinhDoKhoMoi(event.target.value)} required placeholder="106.6881" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-400" />
              </label>
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700 md:col-span-2"><Plus size={18} /> Tạo và kích hoạt kho con</button>
            </form>
            <div className="space-y-4">
              {danhSachKho.filter((warehouse) => warehouse.warehouse_type === 'ward').map((warehouse) => {
                const draft = khoDrafts[warehouse.id] || warehouse;
                return (
                  <div key={warehouse.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-black text-slate-800">{warehouse.name}</h2>
                      <span className={`text-xs font-bold ${warehouse.is_configured && warehouse.is_active ? 'text-emerald-700' : 'text-amber-700'}`}>{warehouse.is_configured && warehouse.is_active ? 'Đang hoạt động' : 'Chờ cấu hình vị trí'}</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-xs font-bold text-slate-500">Tên kho<input value={draft.name || ''} onChange={(event) => setKhoDrafts((current) => ({ ...current, [warehouse.id]: { ...draft, name: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800" /></label>
                      <label className="text-xs font-bold text-slate-500 md:col-span-2">Địa chỉ thực tế<input value={draft.address || ''} onChange={(event) => setKhoDrafts((current) => ({ ...current, [warehouse.id]: { ...draft, address: event.target.value } }))} placeholder="Số nhà, đường, phường, TP.HCM" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800" /></label>
                      <label className="text-xs font-bold text-slate-500">Vĩ độ<input type="number" step="any" value={draft.lat ?? ''} onChange={(event) => setKhoDrafts((current) => ({ ...current, [warehouse.id]: { ...draft, lat: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800" /></label>
                      <label className="text-xs font-bold text-slate-500">Kinh độ<input type="number" step="any" value={draft.lng ?? ''} onChange={(event) => setKhoDrafts((current) => ({ ...current, [warehouse.id]: { ...draft, lng: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800" /></label>
                    </div>
                    <button onClick={() => luuKhoPhuong(warehouse)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"><Save size={16} /> Lưu và kích hoạt</button>
                  </div>
                );
              })}
              {danhSachKho.filter((warehouse) => warehouse.warehouse_type === 'ward').length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Chưa tạo kho con nào. Thêm từng phường và nhập vị trí thật để kích hoạt.</p>}
            </div>
          </div>
        ) : tabKho === 'delivery' && !isCentralWarehouse ? (
          <div className="flex-1 space-y-6 overflow-y-auto p-6 md:p-10">
            <header>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600">Kho con · Giao hàng chặng cuối</p>
              <h1 className="mt-3 text-3xl font-black text-slate-800">Phân tài xế giao hàng</h1>
              <p className="mt-2 text-sm text-slate-500">Các đơn đã nhập kho đích và chưa có tài xế được hiển thị riêng tại đây. Chọn tài xế cho từng đơn rồi bấm phân công.</p>
            </header>
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-black text-slate-800">Đơn chờ phân tài xế ({pendingDeliveryOrders.length})</h2>
                <button type="button" onClick={taiDonChoGiao} disabled={deliveryOrdersLoading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{deliveryOrdersLoading ? 'Đang tải...' : 'Làm mới'}</button>
              </div>
              {deliveryAssignmentError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{deliveryAssignmentError}</p>}
              {deliveryAssignmentNotice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{deliveryAssignmentNotice}</p>}
              {deliveryOrdersLoading ? <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Đang tải danh sách đơn và tài xế...</p>
                : pendingDeliveryOrders.length ? <div className="space-y-3">
                  {pendingDeliveryOrders.map((order) => (
                    <article key={order.id} className="grid gap-3 rounded-xl border border-slate-100 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,auto)_auto] sm:items-center">
                      <div>
                        <p className="font-mono font-black text-slate-800">{order.tracking_code}</p>
                        <p className="mt-1 text-sm text-slate-500">{order.receiver_name || 'Khách hàng'}{order.receiver_address ? ` · ${order.receiver_address}` : ''}</p>
                      </div>
                      <select aria-label={`Chọn tài xế giao cho đơn ${order.tracking_code}`} value={deliveryAssignments[order.id] || deliveryDriverId} onChange={(event) => setDeliveryAssignments((current) => ({ ...current, [order.id]: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm">
                        <option value="">Chọn tài xế giao hàng</option>
                        {deliveryDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}</option>)}
                      </select>
                      <button type="button" onClick={() => phanCongDonTaiKho(order)} disabled={assigningDeliveryOrderId !== null || !(deliveryAssignments[order.id] || deliveryDriverId)} className="rounded-lg bg-indigo-700 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                        {assigningDeliveryOrderId === order.id ? 'Đang phân công...' : 'Phân công đơn'}
                      </button>
                    </article>
                  ))}
                </div> : <p className="rounded-xl bg-emerald-50 p-5 text-sm font-bold text-emerald-800">Hiện không có đơn nào chờ phân tài xế giao tại kho này.</p>}
              {!deliveryDrivers.length && !deliveryOrdersLoading && <p className="text-sm font-semibold text-amber-700">Chưa có tài xế giao hàng đang hoạt động. Hãy tạo hoặc kích hoạt tài xế giao hàng rồi tải lại danh sách.</p>}
            </section>
          </div>
        ) : tabKho === 'linehaul' ? (
          <div className="flex-1 space-y-8 p-6 md:p-10">
            <header>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600">Hub & spoke · Line-haul</p>
              <h1 className="mt-3 text-3xl font-black text-slate-800">Nhập / xuất bao liên kho</h1>
              <p className="mt-2 text-sm text-slate-500">Mọi kho dùng cùng mục này: quét mã vận đơn để đóng bao gửi đi, hoặc quét mã bao đến để nhập toàn bộ đơn vào kho.</p>
            </header>
            {!warehouseId ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 font-bold text-amber-800">Chọn kho đang thao tác để đóng hoặc nhận bao.</p>
            ) : (
              <>
                {isWarehouseManager && isCentralWarehouse && (
                  <section className="space-y-5 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 md:p-6">
                    <div>
                      <h2 className="text-xl font-black text-indigo-950">Điều phối xe tải đến kho con</h2>
                      <p className="mt-1 text-sm text-indigo-800">Chọn xe và tài xế, tạo chuyến từ Kho Tổng đến kho con, sau đó phân các bao đã niêm phong đúng tuyến.</p>
                    </div>
                    <button type="button" onClick={taiDuLieuLinehaul} className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-bold text-indigo-800 hover:bg-indigo-50">Làm mới danh sách xe và tài xế</button>
                    {linehaulDataError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{linehaulDataError}</p>}
                    <form onSubmit={taoChuyenVeKhoCon} className="grid gap-3 rounded-xl bg-white p-4 md:grid-cols-3">
                      <label className="text-sm font-bold text-slate-600">Xe tải
                        <select required value={linehaulTripDraft.truck_id} onChange={(event) => setLinehaulTripDraft((current) => ({ ...current, truck_id: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3">
                          <option value="">Chọn xe sẵn sàng</option>
                          {linehaulTrucks.map((truck) => <option key={truck.id} value={truck.id}>{truck.vehicle_plate} · {truck.max_payload_kg} kg</option>)}
                        </select>
                      </label>
                      <label className="text-sm font-bold text-slate-600">Tài xế xe tải
                        <select required value={linehaulTripDraft.driver_id} onChange={(event) => setLinehaulTripDraft((current) => ({ ...current, driver_id: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3">
                          <option value="">Chọn tài xế</option>
                          {linehaulDrivers.map((driver) => {
                            const assigned = isLinehaulDriverAssigned(driver);
                            return <option key={driver.id} value={driver.id} disabled={assigned}>{driver.full_name}{assigned ? ' · Đang có chuyến chưa hoàn tất' : ''}</option>;
                          })}
                        </select>
                        {!linehaulDrivers.length
                          ? <small className="mt-1 block text-amber-700">Danh sách chưa nhận được tài xế Line-haul đang hoạt động. Kiểm tra lại chức vụ và trạng thái tài khoản, rồi bấm làm mới.</small>
                          : !availableLinehaulDrivers.length && <small className="mt-1 block text-amber-700">Các tài xế đang có chuyến chưa hoàn tất; tên vẫn hiện ở trên nhưng chưa thể chọn.</small>}
                      </label>
                      <label className="text-sm font-bold text-slate-600">Kho con nhận
                        <select required value={linehaulTripDraft.destination_warehouse_id} onChange={(event) => setLinehaulTripDraft((current) => ({ ...current, destination_warehouse_id: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3">
                          <option value="">Chọn kho con</option>
                          {danhSachKho.filter((warehouse) => warehouse.warehouse_type === 'ward' && warehouse.is_active && warehouse.is_configured)
                            .map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} · {warehouse.address}</option>)}
                        </select>
                      </label>
                      <button type="submit" disabled={linehaulDispatchBusy || !linehaulTrucks.length || !availableLinehaulDrivers.length} className="rounded-lg bg-indigo-700 px-4 py-3 font-black text-white disabled:opacity-50 md:col-span-3">
                        {linehaulDispatchBusy ? 'Đang xử lý...' : 'Tạo chuyến Kho Tổng → Kho con'}
                      </button>
                    </form>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-xl bg-white p-4">
                        <label className="block text-sm font-bold text-slate-600">Chuyến đang nhận bao
                          <select value={selectedLinehaulTripId} onChange={(event) => {
                            setSelectedLinehaulTripId(event.target.value);
                            setSelectedLinehaulBagIds([]);
                          }} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3">
                            <option value="">Chọn chuyến Kho Tổng → kho con</option>
                            {linehaulTrips.filter((trip) => Number(trip.source_warehouse_id) === Number(warehouseId)
                              && ['planned', 'loading'].includes(trip.status))
                              .map((trip) => <option key={trip.id} value={trip.id}>{trip.trip_code} · {trip.destination_warehouse_name} · {trip.bag_count} bao</option>)}
                          </select>
                        </label>
                        <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                          {availableOutboundBags.filter((bag) => {
                            const trip = linehaulTrips.find((item) => String(item.id) === selectedLinehaulTripId);
                            return !trip || Number(bag.destination_warehouse_id) === Number(trip.destination_warehouse_id);
                          }).map((bag) => <label key={bag.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 p-3 text-sm hover:border-indigo-200">
                            <input type="checkbox" checked={selectedLinehaulBagIds.includes(String(bag.id))} onChange={(event) => setSelectedLinehaulBagIds((current) => event.target.checked
                              ? [...current, String(bag.id)] : current.filter((id) => id !== String(bag.id)))} className="mt-1 accent-indigo-600" />
                            <span><strong className="font-mono">{bag.bag_code}</strong><small className="mt-1 block text-slate-500">{bag.destination_warehouse_name} · {bag.order_count} đơn</small></span>
                          </label>)}
                          {!availableOutboundBags.length && <p className="text-sm text-slate-500">Chưa có bao niêm phong chưa được phân chuyến tại Kho Tổng.</p>}
                        </div>
                        {(!linehaulTrucks.length || !availableLinehaulDrivers.length) && <p className="mt-3 text-sm font-semibold text-amber-700">Cần có xe tải sẵn sàng và tài xế xe tải chưa được phân chuyến để tạo chuyến mới.</p>}
                        <button type="button" onClick={ganBaoVaoChuyenKhoTong} disabled={linehaulDispatchBusy || !selectedLinehaulTripId || !selectedLinehaulBagIds.length} className="mt-3 w-full rounded-lg bg-indigo-700 px-4 py-3 font-black text-white disabled:opacity-50">
                          Phân {selectedLinehaulBagIds.length || ''} bao lên chuyến xe
                        </button>
                      </div>
                      <div className="rounded-xl bg-white p-4">
                        <h3 className="font-black text-slate-800">Chuyến đã lập</h3>
                        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                          {linehaulTrips.filter((trip) => Number(trip.source_warehouse_id) === Number(warehouseId)).map((trip) => <article key={trip.id} className="rounded-lg border border-slate-100 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2"><strong className="font-mono">{trip.trip_code}</strong><span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">{trip.status}</span></div>
                            <p className="mt-1 text-sm text-slate-600">{trip.destination_warehouse_name} · {trip.vehicle_plate} · {trip.driver_name || 'Chưa gán tài xế'}</p>
                            <p className="mt-1 text-xs text-slate-500">{trip.bag_count} bao · {trip.scanned_bag_count || 0} đã quét lên xe</p>
                          </article>)}
                          {!linehaulTrips.some((trip) => Number(trip.source_warehouse_id) === Number(warehouseId)) && <p className="text-sm text-slate-500">Chưa có chuyến xuất từ Kho Tổng.</p>}
                        </div>
                      </div>
                    </div>
                  </section>
                )}
                <section className="grid gap-6 xl:grid-cols-2">
                  <form onSubmit={taoBaoHang} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-black">1. Tạo bao và quét đơn</h2>
                    <p className="text-sm text-slate-500">Kho nguồn: <strong>{selectedWarehouse?.name}</strong></p>
                    <label className="block text-sm font-bold text-slate-600">Kho đích
                      <select required value={bagDestinationId} onChange={(event) => setBagDestinationId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3">
                        <option value="">Chọn kho đích</option>
                        {danhSachKho.filter((warehouse) => warehouse.is_active && String(warehouse.id) !== String(warehouseId)
                          && (selectedWarehouse?.warehouse_type === 'central' ? warehouse.warehouse_type === 'ward' : warehouse.warehouse_type === 'central'))
                          .map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                      </select>
                    </label>
                    <button type="submit" className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-black text-white hover:bg-indigo-700">Tạo mã bao niêm phong</button>
                    <label className="block text-sm font-bold text-slate-600">Bao đang đóng
                      <select value={selectedBagId} onChange={(event) => {
                        const bag = bags.find((item) => String(item.id) === event.target.value);
                        setSelectedBagId(event.target.value);
                        if (bag) setBagDestinationId(String(bag.destination_warehouse_id));
                      }} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3">
                        <option value="">Chọn bao mở</option>
                        {bags.filter((bag) => bag.status === 'open' && Number(bag.source_warehouse_id) === Number(warehouseId))
                          .map((bag) => <option key={bag.id} value={bag.id}>{bag.bag_code} · đến {bag.destination_warehouse_name} · {bag.order_count} đơn</option>)}
                      </select>
                    </label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input value={bagScanCode} onChange={(event) => {
                          setBagScanCode(event.target.value);
                          setBagScanNotice({ loai: '', thongDiep: '' });
                        }} onKeyDown={(event) => {
                          if (event.key === 'Enter') quetDonVaoBao(event);
                        }} placeholder="Quét hoặc nhập mã vận đơn" aria-label="Mã vận đơn cần thêm vào bao" autoComplete="off" className="min-w-0 flex-1 rounded-lg border border-slate-200 p-3 font-mono uppercase" />
                        <button type="button" onClick={quetDonVaoBao} disabled={bagScanBusy || !selectedBagId || !bagScanCode.trim()} className="min-w-24 rounded-lg bg-slate-900 px-4 font-bold text-white disabled:opacity-50">{bagScanBusy ? 'Đang quét...' : 'Quét đơn'}</button>
                      </div>
                      {bagScanNotice.thongDiep && <p role={bagScanNotice.loai === 'loi' ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm font-bold ${bagScanNotice.loai === 'loi' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{bagScanNotice.thongDiep}</p>}
                    </div>
                    {selectedBagId && <button type="button" onClick={() => {
                      const bag = bags.find((item) => String(item.id) === selectedBagId);
                      if (bag) niemPhongBao(bag);
                    }} className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-black text-emerald-800">Niêm phong bao đã quét đủ</button>}
                  </form>

                  <aside className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-6">
                    <h2 className="text-lg font-black text-indigo-950">2. Quy trình bao tải</h2>
                    <ol className="list-inside list-decimal space-y-3 text-sm leading-6 text-indigo-900">
                      <li>Quét từng vận đơn hợp lệ thuộc kho hiện tại vào bao đang mở.</li>
                      <li>Kiểm tra số đơn rồi niêm phong bao để khóa danh sách hàng.</li>
                      <li>Điều phối viên sẽ gán bao niêm phong lên chuyến xe tải.</li>
                      <li>Khi bao đến kho này, quét mã bao ở phần nhập kho bên dưới.</li>
                    </ol>
                    <p className="border-t border-indigo-200 pt-4 text-xs font-semibold leading-5 text-indigo-800">
                      Thủ kho chỉ thao tác với kho được phân công; tạo xe và chuyến xe thuộc quyền của điều phối vận tải.
                    </p>
                  </aside>
                </section>

                <form onSubmit={nhapBaoTrungChuyen} className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-end">
                  <label className="flex-1 text-sm font-bold text-emerald-900">3. Nhập bao đến kho hiện tại ({selectedWarehouse?.name})
                    <input value={linehaulScanCode} onChange={(event) => setLinehaulScanCode(event.target.value)} placeholder="Quét mã bao tải" className="mt-2 w-full rounded-lg border border-emerald-200 bg-white p-3 font-mono uppercase" />
                  </label>
                  <button type="submit" disabled={!linehaulScanCode.trim()} className="rounded-xl bg-emerald-700 px-5 py-3 font-black text-white disabled:opacity-50">Quét nhập kho</button>
                </form>

                {receivedBag && (
                  <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="font-black text-slate-800">Các đơn vừa nhận trong bao {receivedBag.bag_code}</h2>
                        <p className="mt-1 text-sm text-slate-500">{receivedBag.orders?.length || 0} đơn đã nhập vào {selectedWarehouse?.name}.</p>
                      </div>
                      {!isCentralWarehouse && receivedBag.orders?.some((order) => order.status === 'at_destination_warehouse' && !order.delivery_shipper_id) && (
                        <div className="flex flex-wrap items-center gap-2">
                          <select value={deliveryDriverId} onChange={(event) => setDeliveryDriverId(event.target.value)} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                            <option value="">Chọn tài xế giao</option>
                            {deliveryDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}</option>)}
                          </select>
                          <button type="button" onClick={phanCongDonTrongBao} disabled={!deliveryDriverId || assigningReceivedBag} className="rounded-lg bg-indigo-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                            {assigningReceivedBag ? 'Đang phân công...' : 'Phân các đơn chờ giao'}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {(receivedBag.orders || []).map((order) => (
                        <div key={order.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
                          <span className="font-mono text-sm font-bold">{order.tracking_code}</span>
                          <span className={`text-xs font-bold ${order.delivery_shipper_id ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {order.delivery_shipper_id ? 'Đã phân tài xế' : order.status === 'at_destination_warehouse' ? 'Chờ giao' : 'Chờ trung chuyển'}
                          </span>
                        </div>
                      ))}
                      {!receivedBag.orders?.length && <p className="text-sm text-slate-500">Bao không có vận đơn nào.</p>}
                    </div>
                  </section>
                )}

                <section className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h2 className="mb-3 font-black">Bao hàng ({bags.length})</h2>
                    <div className="space-y-2">
                      {bags.map((bag) => <button key={bag.id} type="button" onClick={() => setSelectedBagId(String(bag.id))} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-left hover:border-indigo-200">
                        <span><strong className="font-mono">{bag.bag_code}</strong><small className="mt-1 block text-slate-500">{bag.source_warehouse_name} → {bag.destination_warehouse_name} · {bag.order_count} đơn</small></span>
                        <span className={`rounded-full px-2 py-1 text-xs font-black ${bag.status === 'received' ? 'bg-emerald-100 text-emerald-700' : bag.status === 'in_transit' ? 'bg-blue-100 text-blue-700' : bag.status === 'sealed' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{bag.status}</span>
                      </button>)}
                      {!bags.length && <p className="text-sm text-slate-500">Chưa có bao hàng ở kho này.</p>}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h2 className="mb-3 font-black">Ghi chú nhập bao</h2>
                    <p className="text-sm leading-6 text-slate-600">Chỉ quét bao đã niêm phong và đang được điều phối đến kho hiện tại. Khi xác nhận nhập, hệ thống cập nhật toàn bộ vận đơn trong bao.</p>
                  </div>
                </section>
              </>
            )}
          </div>
        ) : tabKho === 'kiem-ke' ? (
          <div className="flex-1 p-10">
            <div className="mb-8">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600">Kiểm kê mù</p>
              <h1 className="mt-3 text-4xl font-black text-slate-800">Kiểm kê tồn kho bằng máy quét</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">Hệ thống chụp danh sách tồn đầu kỳ nhưng không hiển thị cho người kiểm kê. Quét tất cả mã kiện, sau đó chốt để xem kiện thiếu và mã dư.</p>
            </div>
            <section className="max-w-4xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <label className="block text-sm font-bold text-slate-700">Kho kiểm kê
                <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} disabled={isWarehouseManager || Boolean(auditId)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <option value="">-- Chọn kho --</option>
                  {danhSachKho.filter((warehouse) => warehouse.is_configured && warehouse.is_active).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                </select>
              </label>
              {!auditId && !auditReport && <button type="button" onClick={batDauKiemKe} disabled={!warehouseId || auditBusy} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white disabled:opacity-50">{auditBusy ? 'Đang mở phiếu...' : 'Bắt đầu kiểm kê mù'}</button>}
              {auditId && (
                <div className="mt-5 space-y-4">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                    <p className="font-black text-indigo-900">Phiếu #{auditId} đang mở · Đã quét {auditScannedCount} mã</p>
                    <p className="mt-1 text-xs text-indigo-700">Không hiển thị trạng thái đúng/sai khi quét để giữ chế độ kiểm kê mù.</p>
                  </div>
                  <form onSubmit={quetKiemKe} className="flex flex-col gap-3 sm:flex-row">
                    <input ref={inputRef} autoFocus value={auditScanCode} onChange={(event) => setAuditScanCode(event.target.value.toUpperCase())} placeholder="Quét mã vận đơn hoặc nhập tay" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 font-mono text-lg uppercase" />
                    <button type="submit" disabled={auditBusy || !auditScanCode.trim()} className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-50">Ghi nhận mã</button>
                  </form>
                  <button type="button" onClick={chotKiemKe} disabled={auditBusy} className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 font-black text-red-700 disabled:opacity-50">Chốt kiểm kê và đối chiếu</button>
                </div>
              )}
              {auditReport && (
                <div className="mt-6 space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <p className="rounded-xl bg-slate-50 p-4 text-sm">Tồn đầu kỳ: <strong>{auditReport.expected_count}</strong></p>
                    <p className="rounded-xl bg-slate-50 p-4 text-sm">Mã đã quét: <strong>{auditReport.scanned_count}</strong></p>
                    <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">Thiếu: <strong>{auditReport.missing_count}</strong> · Dư: <strong>{auditReport.extra_count}</strong></p>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div><h3 className="mb-2 font-black text-red-700">Kiện thiếu</h3>{auditReport.missing.length ? auditReport.missing.map((item) => <p key={item.order_id} className="border-b border-slate-100 py-2 font-mono text-sm">{item.tracking_code}</p>) : <p className="text-sm text-slate-500">Không thiếu kiện.</p>}</div>
                    <div><h3 className="mb-2 font-black text-amber-700">Mã dư / không thuộc tồn đầu kỳ</h3>{auditReport.extra.length ? auditReport.extra.map((item) => <p key={item.scan_code} className="border-b border-slate-100 py-2 font-mono text-sm">{item.scan_code}</p>) : <p className="text-sm text-slate-500">Không có mã dư.</p>}</div>
                  </div>
                  <button type="button" onClick={() => { setAuditReport(null); setAuditScannedCount(0); }} className="rounded-xl bg-indigo-600 px-5 py-3 font-black text-white">Mở phiếu kiểm kê khác</button>
                </div>
              )}
              <button onClick={() => setTabKho('scan')} className="ml-3 mt-5 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200">Quay lại quét kho</button>
              {thongBao.thongDiep && <p role="status" className={`mt-4 rounded-xl p-3 text-sm font-bold ${thongBao.loai === 'loi' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{thongBao.thongDiep}</p>}
            </section>
          </div>
        ) : (
          <div className="flex-1 p-10 overflow-y-auto flex flex-col xl:flex-row gap-8">
            
            {/* CỘT TRÁI: MÁY QUÉT */}
            <div className="xl:w-1/3 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full mb-6">
              <ScanLine size={36} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Quét Mã Vận Đơn</h2>
            <p className="text-slate-500 text-sm mb-6 font-medium">Đưa trọn mã vạch vào khung quét. Có thể dùng ảnh mã rõ nét, súng quét hoặc nhập mã tay.</p>

            <label className="mb-5 block text-left text-sm font-bold text-slate-700">Kho đang thao tác
              <select value={warehouseId} onChange={(event) => { setSelectedBinCode(''); setWarehouseId(event.target.value); }} disabled={isWarehouseManager} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-75">
                <option value="">-- Chọn kho thực tế --</option>
                {danhSachKho.filter((warehouse) => warehouse.is_configured && warehouse.is_active).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
            </label>
            {warehouseId && (
              <div className="mb-5 space-y-3 text-left">
                {(!isWarehouseManager || isCentralWarehouse) && <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
                  <input type="checkbox" checked={crossDockMode} onChange={(event) => setCrossDockMode(event.target.checked)} className="mt-0.5 accent-indigo-600" />
                  <span><strong>Chuyển tải nhanh (cross-docking)</strong><br />Bỏ qua kệ, chuyển kiện thẳng đến khu xuất để Điều phối gán xe.</span>
                </label>}
                {!crossDockMode && (
                <>
                <div className={`rounded-xl border p-3 ${selectedBinCode ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                  <p className="text-xs font-black uppercase text-slate-600">Vị trí lưu kho</p>
                  {selectedBinCode ? (
                    <>
                      <p className="mt-1 text-sm font-bold text-emerald-800">Đang nhập vào {selectedBinCode} · {binLocations.find((bin) => bin.bin_code === selectedBinCode)?.bin_name}</p>
                      <div className="mt-2 overflow-hidden rounded-lg bg-white p-2"><BarcodeLabel value={selectedBinCode} format="CODE128" height={42} margin={2} /></div>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-amber-800">Quét mã vạch kệ bằng camera hoặc máy quét trước khi quét kiện hàng.</p>
                  )}
                </div>
                <form onSubmit={taoViTriKe} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3">
                  <p className="col-span-2 text-xs font-black uppercase text-slate-600">Tạo nhãn vị trí kệ mới</p>
                  <input required maxLength={80} pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,79}" value={binCodeDraft} onChange={(event) => setBinCodeDraft(event.target.value.toUpperCase())} placeholder="Mã kệ (A1-03)" className="min-w-0 rounded-lg border border-slate-200 p-2 text-sm uppercase" />
                  <input required maxLength={120} value={binNameDraft} onChange={(event) => setBinNameDraft(event.target.value)} placeholder="Tên vị trí" className="min-w-0 rounded-lg border border-slate-200 p-2 text-sm" />
                  <button type="submit" disabled={creatingBin} className="col-span-2 flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-black text-white disabled:opacity-50"><Plus size={14} /> {creatingBin ? 'Đang tạo...' : 'Tạo mã và nhãn mã vạch'}</button>
                </form>
                </>
                )}
              </div>
            )}

            {/* VÙNG CHỨA CAMERA / NÚT BẬT CAMERA */}
            {!moCamera ? (
              <button 
                onClick={() => setMoCamera(true)}
                className="w-full mb-6 bg-slate-100 hover:bg-slate-200 text-indigo-600 font-bold py-3.5 rounded-2xl transition-all flex justify-center items-center gap-2 border border-slate-200"
              >
                <Camera size={18} /> Mở Camera Quét Mã
              </button>
            ) : (
              <div className="mb-6 bg-slate-900 rounded-2xl overflow-hidden relative border-4 border-indigo-100">
                <button 
                  onClick={() => setMoCamera(false)} 
                  className="absolute top-2 right-2 z-50 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600"
                >
                  <X size={16} />
                </button>
                <div id="camera-reader" className="w-full">
                  <p className="px-3 py-3 text-center text-sm font-bold text-white">Đưa mã vạch đen trắng vào giữa khung và giữ yên</p>
                </div>
                {trangThaiCamera && <p className="border-t border-slate-700 px-3 py-2 text-center text-sm font-bold text-amber-300">{trangThaiCamera}</p>}
              </div>
            )}

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={xuLyQuetAnh}
            />
            <button
              type="button"
              disabled={dangXuLy}
              onClick={() => imageInputRef.current?.click()}
              className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              <ImagePlus size={18} /> Chụp / chọn ảnh mã vạch
            </button>

            <div className="relative flex items-center py-2 mb-6">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">Hoặc Súng quét / Nhập tay</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {maVuaDoc && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm">
                <p className="font-bold text-emerald-700">Mã vừa đọc được</p>
                <p className="mt-1 font-black tracking-wide text-emerald-900">{maVuaDoc}</p>
              </div>
            )}

            <form onSubmit={(e) => xuLyQuetMa(e, null)} className="space-y-4">
              <input 
                ref={inputRef}
                type="text" 
                placeholder="SL123456VN..." 
                className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)] transition-all text-center text-2xl font-black text-slate-700 tracking-wider uppercase"
                value={maVanDon}
                onChange={(e) => setMaVanDon(e.target.value)}
                autoComplete="off"
                disabled={moCamera}
              />
              <button 
                type="submit" 
                disabled={dangXuLy || moCamera}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4.5 rounded-2xl shadow-lg shadow-indigo-200 transition-all text-lg disabled:opacity-50 disabled:scale-100 active:scale-[0.98]"
              >
                {dangXuLy ? 'Đang Xử Lý...' : 'Xác Nhận Quét (Enter)'}
              </button>
            </form>

            {/* HIỂN THỊ KẾT QUẢ QUÉT */}
            {thongBao.thongDiep && (
              <div className={`mt-6 p-5 rounded-2xl text-left flex gap-4 items-start animate-in zoom-in-95 duration-200 border ${
                thongBao.loai === 'thanhcong' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
              }`}>
                {thongBao.loai === 'thanhcong' ? <CheckCircle size={24} className="shrink-0 mt-0.5 text-emerald-500"/> : <AlertCircle size={24} className="shrink-0 mt-0.5 text-red-500"/>}
                <div>
                  <p className="font-black text-base">{thongBao.loai === 'thanhcong' ? 'Xử Lý Thành Công!' : 'Quét Thất Bại'}</p>
                  <p className="text-sm mt-1 font-medium opacity-90">{thongBao.thongDiep}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 flex items-center gap-5">
            <div className="bg-amber-50 p-4 rounded-2xl text-amber-600"><PackageSearch size={32}/></div>
            <div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Đang Lưu Kho</p>
              <p className="text-3xl font-black text-slate-800">{anToanTonKho.length} <span className="text-base text-slate-400 font-bold">đơn</span></p>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: LƯỚI TỒN KHO */}
        <div className="xl:w-2/3 flex flex-col">
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-[#F8FAFC]">
              <h3 className="font-black text-slate-800 text-xl flex items-center gap-3">
                <Box className="text-indigo-600" size={24} /> 
                Danh Sách Tồn Kho Hiện Tại
              </h3>
            </div>

            <div className="flex-1 overflow-auto p-2">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white sticky top-0 z-10">
                  <tr>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Mã Vận Đơn</th>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Khách Hàng</th>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Vị trí kệ</th>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Cân Nặng</th>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 text-right">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {anToanTonKho.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-20 text-center text-slate-400 font-medium">
                        Kho đang trống. Không có đơn hàng nào đang lưu kho.
                      </td>
                    </tr>
                  ) : (
                    anToanTonKho.map((item) => (
                      <tr key={item?.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-5">
                          <p className="font-black text-slate-700 tracking-wide">{item?.tracking_code}</p>
                        </td>
                        <td className="p-5">
                          <p className="font-bold text-slate-800 text-sm">{item?.receiver_name}</p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1 max-w-[200px]">{item?.receiver_address}</p>
                        </td>
                        <td className="p-5">
                          <span className={`rounded-md px-3 py-1 font-mono text-xs font-black ${item?.cross_docked ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>{item?.cross_docked ? 'Cross-docking · khu xuất' : item?.storage_bin_code || 'Chưa gán kệ'}</span>
                          {item?.storage_bin_name && <p className="mt-1 text-xs text-slate-500">{item.storage_bin_name}</p>}
                        </td>
                        <td className="p-5">
                          <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-md font-bold text-xs">
                            {item?.weight_kg || 1} kg
                          </span>
                        </td>
                        <td className="p-5 text-right">
                          <span className="bg-amber-50 text-amber-600 border border-amber-100 px-4 py-2 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-sm">
                            <ArrowRightLeft size={14} /> Chờ Xuất Kho
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
          </div>
        )}
      </>
    </div>
  );
}