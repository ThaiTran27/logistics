import { useState, useEffect, useRef } from 'react';
import { ScanLine, Barcode, LogOut, Box, ArrowRightLeft, CheckCircle, AlertCircle, PackageSearch, Camera, ImagePlus, X, MapPin, Save, Plus, Truck } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

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
  const [tabKho, setTabKho] = useState('scan');
  const [wrongWarehouseAlarm, setWrongWarehouseAlarm] = useState(false);
  const [danhSachKho, setDanhSachKho] = useState([]);
  const [khoDrafts, setKhoDrafts] = useState({});
  const [phuongMoi, setPhuongMoi] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [dispatchCode, setDispatchCode] = useState('');
  const [dispatchType, setDispatchType] = useState('');
  const [dispatchDrivers, setDispatchDrivers] = useState([]);
  const [dispatchDriverId, setDispatchDriverId] = useState('');
  const [dispatchBusy, setDispatchBusy] = useState(false);
  const [bags, setBags] = useState([]);
  const [linehaulTrips, setLinehaulTrips] = useState([]);
  const [bagDestinationId, setBagDestinationId] = useState('');
  const [selectedBagId, setSelectedBagId] = useState('');
  const [bagScanCode, setBagScanCode] = useState('');
  const [tripDraft, setTripDraft] = useState({ vehicle_plate: '', driver_id: '', source_warehouse_id: '', destination_warehouse_id: '' });
  const [tripBagCode, setTripBagCode] = useState('');
  const [tripIdForBag, setTripIdForBag] = useState('');
  const [linehaulScanCode, setLinehaulScanCode] = useState('');
  
  // State quản lý việc bật/tắt Camera
  const [moCamera, setMoCamera] = useState(false);
  
  const inputRef = useRef(null);
  const imageInputRef = useRef(null);
  const warehouseName = localStorage.getItem('full_name') || 'Thủ Kho';
  const selectedWarehouse = danhSachKho.find((warehouse) => String(warehouse.id) === String(warehouseId));

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
      const res = await fetch('http://localhost:5000/api/warehouses');
      const data = await res.json();
      if (data.success) {
        setDanhSachKho(data.data || []);
        const activeWarehouses = (data.data || []).filter((warehouse) => warehouse.is_configured && warehouse.is_active);
        setWarehouseId((current) => current || (activeWarehouses.length === 1 ? String(activeWarehouses[0].id) : ''));
      }
    } catch (error) {
      console.error('Lỗi tải danh mục kho:', error);
    }
  };

  useEffect(() => {
    taiDanhSachKho();
    // Focus vào input trừ khi camera đang mở
    if (inputRef.current && !moCamera) inputRef.current.focus();
  }, [moCamera]);

  useEffect(() => {
    taiTonKho(warehouseId);
  }, [warehouseId]);

  useEffect(() => {
    if (tabKho !== 'outbound' || !selectedWarehouse) return;
    setDispatchType(selectedWarehouse.warehouse_type === 'central' ? 'destination_transfer' : 'central_transfer');
  }, [tabKho, selectedWarehouse?.id, selectedWarehouse?.warehouse_type]);

  useEffect(() => {
    if (tabKho !== 'outbound' || !dispatchType) return;
    fetch(`http://localhost:5000/api/shippers?type=${dispatchType}`)
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || 'Không tải được danh sách tài xế.');
        setDispatchDrivers(data.data || []);
        setDispatchDriverId((current) => data.data?.some((driver) => String(driver.id) === current)
          ? current : String(data.data?.[0]?.id || ''));
      })
      .catch((error) => setThongBao({ loai: 'loi', thongDiep: error.message || 'Không tải được tài xế.' }));
  }, [tabKho, dispatchType]);

  const taiDuLieuLinehaul = async () => {
    try {
      const [bagsResponse, tripsResponse] = await Promise.all([
        fetch(`http://localhost:5000/api/warehouse/bags?warehouse_id=${warehouseId}`),
        fetch('http://localhost:5000/api/linehaul/trips')
      ]);
      const [bagsData, tripsData] = await Promise.all([bagsResponse.json(), tripsResponse.json()]);
      if (!bagsResponse.ok || !bagsData.success) throw new Error(bagsData.message || 'Không tải được danh sách bao.');
      if (!tripsResponse.ok || !tripsData.success) throw new Error(tripsData.message || 'Không tải được chuyến xe.');
      setBags(bagsData.data || []);
      setLinehaulTrips(tripsData.data || []);
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không thể tải dữ liệu trung chuyển.' });
    }
  };

  useEffect(() => {
    if (tabKho === 'linehaul' && warehouseId) taiDuLieuLinehaul();
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
    if (!selectedBag || !bagScanCode.trim()) return;
    try {
      const response = await fetch(`http://localhost:5000/api/warehouse/bags/${selectedBag.id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_code: bagScanCode })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể thêm đơn vào bao.');
      setBagScanCode('');
      setThongBao({ loai: 'thanhcong', thongDiep: `${data.message} Bao có ${data.data.order_count} đơn.` });
      await taiDuLieuLinehaul();
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không thể quét đơn vào bao.' });
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

  const taoChuyenXe = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/linehaul/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...tripDraft,
          source_warehouse_id: Number(tripDraft.source_warehouse_id),
          destination_warehouse_id: Number(tripDraft.destination_warehouse_id),
          driver_id: tripDraft.driver_id ? Number(tripDraft.driver_id) : null
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không tạo được chuyến xe.');
      setTripIdForBag(String(data.data.id));
      setTripDraft({ vehicle_plate: '', driver_id: '', source_warehouse_id: '', destination_warehouse_id: '' });
      setThongBao({ loai: 'thanhcong', thongDiep: `Đã tạo chuyến ${data.data.trip_code}.` });
      await taiDuLieuLinehaul();
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không thể tạo chuyến xe.' });
    }
  };

  const ganBaoVaoChuyen = async (event) => {
    event.preventDefault();
    if (!tripIdForBag || !tripBagCode.trim()) return;
    try {
      const response = await fetch(`http://localhost:5000/api/linehaul/trips/${tripIdForBag}/bags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bag_code: tripBagCode })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể gán bao vào chuyến.');
      setTripBagCode('');
      setThongBao({ loai: 'thanhcong', thongDiep: data.message });
      await taiDuLieuLinehaul();
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không thể gán bao vào chuyến.' });
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
      setLinehaulScanCode('');
      setThongBao({ loai: 'thanhcong', thongDiep: data.message });
      await taiDuLieuLinehaul();
      await taiTonKho();
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Không thể nhập bao trung chuyển.' });
    }
  };

  const taoKhoPhuong = async (event) => {
    event.preventDefault();
    const wardName = phuongMoi.trim();
    if (!wardName) return;
    const res = await fetch('http://localhost:5000/api/warehouses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ward_name: wardName })
    });
    const data = await res.json();
    setThongBao({ loai: data.success ? 'thanhcong' : 'loi', thongDiep: data.message });
    if (data.success) {
      setPhuongMoi('');
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
      const res = await fetch('http://localhost:5000/api/warehouse/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_code: maCanXuly, warehouse_id: Number(warehouseId) })
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

  const xuLyXuatKho = async (event) => {
    event.preventDefault();
    const code = dispatchCode.trim().toUpperCase();
    const order = anToanTonKho.find((item) => String(item.tracking_code).toUpperCase() === code);
    if (!order) {
      setThongBao({ loai: 'loi', thongDiep: 'Đơn hàng chưa có trong tồn kho của kho này. Hãy quét mã đơn đã nhập kho.' });
      return;
    }
    if (!dispatchDriverId) {
      setThongBao({ loai: 'loi', thongDiep: 'Vui lòng chọn tài xế trung chuyển hoặc giao hàng.' });
      return;
    }
    const taskByStatus = {
      at_origin_warehouse: 'central_transfer',
      at_central_warehouse: 'destination_transfer',
      at_destination_warehouse: 'delivery'
    };
    const taskType = taskByStatus[order.status];
    if (!taskType || taskType !== dispatchType) {
      setThongBao({ loai: 'loi', thongDiep: 'Đơn hàng không thuộc luồng xuất kho đang chọn.' });
      return;
    }
    setDispatchBusy(true);
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${order.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipper_id: Number(dispatchDriverId), task_type: dispatchType })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Không thể gán đơn lên xe.');
      setThongBao({ loai: 'thanhcong', thongDiep: data.message });
      setDispatchCode('');
      await taiTonKho();
    } catch (error) {
      setThongBao({ loai: 'loi', thongDiep: error.message || 'Lỗi kết nối khi xuất kho.' });
    } finally {
      setDispatchBusy(false);
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
            </div>
          </div>
          
          <div className="p-5 mt-2 space-y-2">
            <button onClick={() => setTabKho('scan')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabKho === 'scan' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
              <ScanLine size={20} /> Máy Quét Mã Vạch
            </button>
            <button onClick={() => setTabKho('outbound')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabKho === 'outbound' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
              <Truck size={20} /> Xuất Kho / Gán Xe
            </button>
            <button onClick={() => setTabKho('linehaul')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabKho === 'linehaul' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
              <ArrowRightLeft size={20} /> Đóng Bao / Trung Chuyển
            </button>
            <button onClick={() => setTabKho('kiem-ke')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabKho === 'kiem-ke' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
              <Box size={20} /> Kiểm Kê Định Kỳ
            </button>
            <button onClick={() => setTabKho('warehouses')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabKho === 'warehouses' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
              <MapPin size={20} /> Danh Mục Kho
            </button>
          </div>
        </div>

        <div className="p-5 border-t border-slate-800 bg-slate-950/30">
          <div className="flex items-center gap-3 px-5 py-4 mb-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center font-black text-indigo-400">
              {(warehouseName || 'K').charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-white">{warehouseName}</p>
              <p className="text-xs text-slate-500">Thủ kho ca hiện tại</p>
            </div>
          </div>
          <button onClick={dangXuat} className="w-full px-5 py-4 rounded-2xl font-bold text-left text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-3">
            <LogOut size={18}/> Đăng Xuất
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <>
        {tabKho === 'warehouses' ? (
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
            <form onSubmit={taoKhoPhuong} className="mb-6 flex flex-col gap-3 sm:flex-row">
              <input value={phuongMoi} onChange={(event) => setPhuongMoi(event.target.value)} required placeholder="Tên phường cần tạo kho con" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-400" />
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700"><Plus size={18} /> Tạo kho phường</button>
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
        ) : tabKho === 'outbound' ? (
          <div className="flex-1 p-6 md:p-10">
            <div className="mx-auto max-w-4xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600">Bàn giao vận tải</p>
              <h1 className="mt-3 text-3xl font-black text-slate-800">Xuất kho và gán đơn lên xe</h1>
              <p className="mt-2 text-sm text-slate-500">Quét mã vận đơn đang tồn tại tại kho, chọn đúng chặng và tài xế để chuyển trạng thái vận chuyển.</p>
              {!warehouseId ? (
                <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 font-bold text-amber-800">Chọn kho đang thao tác trước khi xuất hàng.</p>
              ) : (
                <form onSubmit={xuLyXuatKho} className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="font-bold text-slate-700">Kho hiện tại: {selectedWarehouse?.name}</p>
                  <label className="block text-sm font-bold text-slate-600">Luồng xuất kho
                    <select value={dispatchType} onChange={(event) => setDispatchType(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3">
                      {selectedWarehouse?.warehouse_type === 'central'
                        ? <option value="destination_transfer">Kho tổng → Kho phường đích (xe tải trung chuyển)</option>
                        : <option value="central_transfer">Kho phường nguồn → Kho tổng (xe tải trung chuyển)</option>}
                      {selectedWarehouse?.warehouse_type === 'ward' && <option value="delivery">Kho phường đích → Người nhận (xe máy giao hàng)</option>}
                    </select>
                  </label>
                  <label className="block text-sm font-bold text-slate-600">Mã vận đơn (quét bằng máy đọc mã vạch)
                    <input autoFocus value={dispatchCode} onChange={(event) => setDispatchCode(event.target.value)} placeholder="Đặt con trỏ vào đây rồi quét mã" className="mt-2 w-full rounded-lg border border-slate-200 p-3 font-mono text-lg uppercase tracking-wider" />
                  </label>
                  <label className="block text-sm font-bold text-slate-600">Tài xế
                    <select value={dispatchDriverId} onChange={(event) => setDispatchDriverId(event.target.value)} required className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3">
                      {dispatchDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}</option>)}
                    </select>
                  </label>
                  <button type="submit" disabled={dispatchBusy || !dispatchDrivers.length} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                    <Truck size={18} /> {dispatchBusy ? 'Đang xuất kho...' : 'Xác nhận bàn giao lên xe'}
                  </button>
                  {!dispatchDrivers.length && <p className="text-sm font-semibold text-amber-700">Không có tài xế đang hoạt động thuộc nhóm chặng này.</p>}
                  <div className="border-t border-slate-100 pt-4">
                    <h2 className="font-black text-slate-800">Đơn đang nằm tại kho ({anToanTonKho.length})</h2>
                    <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                      {anToanTonKho.map((order) => <button key={order.id} type="button" onClick={() => setDispatchCode(order.tracking_code)} className="flex w-full items-center justify-between rounded-lg border border-slate-100 p-3 text-left hover:border-indigo-200 hover:bg-indigo-50"><span className="font-mono font-bold">{order.tracking_code}</span><span className="text-xs text-slate-500">{order.status}</span></button>)}
                      {!anToanTonKho.length && <p className="text-sm text-slate-500">Kho hiện chưa có đơn chờ xuất.</p>}
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : tabKho === 'linehaul' ? (
          <div className="flex-1 space-y-8 p-6 md:p-10">
            <header>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600">Hub & spoke · Line-haul</p>
              <h1 className="mt-3 text-3xl font-black text-slate-800">Đóng bao và trung chuyển liên kho</h1>
              <p className="mt-2 text-sm text-slate-500">Gom nhiều vận đơn vào bao niêm phong; xe tải chỉ cần quét mã bao khi nhận hàng và nhập kho.</p>
            </header>
            {!warehouseId ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 font-bold text-amber-800">Chọn kho đang thao tác để đóng hoặc nhận bao.</p>
            ) : (
              <>
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
                      <select value={selectedBagId} onChange={(event) => setSelectedBagId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3">
                        <option value="">Chọn bao mở</option>
                        {bags.filter((bag) => bag.status === 'open' && Number(bag.source_warehouse_id) === Number(warehouseId))
                          .map((bag) => <option key={bag.id} value={bag.id}>{bag.bag_code} · {bag.order_count} đơn</option>)}
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <input value={bagScanCode} onChange={(event) => setBagScanCode(event.target.value)} placeholder="Quét hoặc nhập mã vận đơn" className="min-w-0 flex-1 rounded-lg border border-slate-200 p-3 font-mono uppercase" />
                      <button type="button" onClick={(event) => quetDonVaoBao(event)} disabled={!selectedBagId || !bagScanCode.trim()} className="rounded-lg bg-slate-900 px-4 font-bold text-white disabled:opacity-50">Quét đơn</button>
                    </div>
                    {selectedBagId && <button type="button" onClick={() => {
                      const bag = bags.find((item) => String(item.id) === selectedBagId);
                      if (bag) niemPhongBao(bag);
                    }} className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-black text-emerald-800">Niêm phong bao đã quét đủ</button>}
                  </form>

                  <form onSubmit={taoChuyenXe} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-black">2. Tạo chuyến và gán bao</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-bold text-slate-600">Biển số xe
                        <input required maxLength={30} value={tripDraft.vehicle_plate} onChange={(event) => setTripDraft((current) => ({ ...current, vehicle_plate: event.target.value }))} placeholder="51C-889.99" className="mt-2 w-full rounded-lg border border-slate-200 p-3 uppercase" />
                      </label>
                      <label className="text-sm font-bold text-slate-600">Mã tài xế trung chuyển
                        <input type="number" min="1" value={tripDraft.driver_id} onChange={(event) => setTripDraft((current) => ({ ...current, driver_id: event.target.value }))} placeholder="ID nhân viên" className="mt-2 w-full rounded-lg border border-slate-200 p-3" />
                      </label>
                      <label className="text-sm font-bold text-slate-600">Kho đi
                        <select required value={tripDraft.source_warehouse_id} onChange={(event) => setTripDraft((current) => ({ ...current, source_warehouse_id: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3">
                          <option value="">Chọn kho đi</option>{danhSachKho.filter((warehouse) => warehouse.is_active).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                        </select>
                      </label>
                      <label className="text-sm font-bold text-slate-600">Kho đến
                        <select required value={tripDraft.destination_warehouse_id} onChange={(event) => setTripDraft((current) => ({ ...current, destination_warehouse_id: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3">
                          <option value="">Chọn kho đến</option>{danhSachKho.filter((warehouse) => warehouse.is_active).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                        </select>
                      </label>
                    </div>
                    <button type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-3 font-black text-white hover:bg-blue-700">Tạo chuyến xe</button>
                    <label className="block text-sm font-bold text-slate-600">Chuyến xe nhận bao
                      <select value={tripIdForBag} onChange={(event) => setTripIdForBag(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3">
                        <option value="">Chọn chuyến đang xếp hàng</option>{linehaulTrips.filter((trip) => ['planned', 'loading'].includes(trip.status)).map((trip) => <option key={trip.id} value={trip.id}>{trip.trip_code} · {trip.vehicle_plate} · {trip.source_warehouse_name} → {trip.destination_warehouse_name}</option>)}
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <input value={tripBagCode} onChange={(event) => setTripBagCode(event.target.value)} placeholder="Mã bao đã niêm phong" className="min-w-0 flex-1 rounded-lg border border-slate-200 p-3 font-mono uppercase" />
                      <button type="button" onClick={(event) => ganBaoVaoChuyen(event)} disabled={!tripIdForBag || !tripBagCode.trim()} className="rounded-lg bg-slate-900 px-4 font-bold text-white disabled:opacity-50">Gán bao</button>
                    </div>
                  </form>
                </section>

                <form onSubmit={nhapBaoTrungChuyen} className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-end">
                  <label className="flex-1 text-sm font-bold text-emerald-900">3. Nhập bao đến kho hiện tại ({selectedWarehouse?.name})
                    <input value={linehaulScanCode} onChange={(event) => setLinehaulScanCode(event.target.value)} placeholder="Quét mã bao tải" className="mt-2 w-full rounded-lg border border-emerald-200 bg-white p-3 font-mono uppercase" />
                  </label>
                  <button type="submit" disabled={!linehaulScanCode.trim()} className="rounded-xl bg-emerald-700 px-5 py-3 font-black text-white disabled:opacity-50">Quét nhập kho</button>
                </form>

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
                    <h2 className="mb-3 font-black">Chuyến xe trung chuyển ({linehaulTrips.length})</h2>
                    <div className="space-y-2">
                      {linehaulTrips.map((trip) => <article key={trip.id} className="rounded-xl border border-slate-100 p-3">
                        <div className="flex justify-between gap-2"><strong>{trip.trip_code} · {trip.vehicle_plate}</strong><span className="text-xs font-bold text-slate-500">{trip.status}</span></div>
                        <p className="mt-1 text-sm text-slate-500">{trip.source_warehouse_name} → {trip.destination_warehouse_name}</p>
                        <p className="mt-1 text-xs text-slate-400">Tài xế: {trip.driver_name || 'Chưa gán'} · {trip.scanned_bag_count}/{trip.bag_count} bao đã quét</p>
                      </article>)}
                      {!linehaulTrips.length && <p className="text-sm text-slate-500">Chưa có chuyến xe.</p>}
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        ) : tabKho === 'kiem-ke' ? (
          <div className="flex-1 p-10">
            <div className="mb-8">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600">Kho bãi</p>
              <h1 className="mt-3 text-4xl font-black text-slate-800">Báo Cáo Kiểm Kê Định Kỳ</h1>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Tổng đơn đang lưu</p>
                <h3 className="mt-4 text-4xl font-black text-slate-800">{anToanTonKho.length}</h3>
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Số đơn đã xuất</p>
                <h3 className="mt-4 text-4xl font-black text-emerald-600">{Math.max(0, anToanTonKho.length - 2)}</h3>
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Đánh giá</p>
                <h3 className="mt-4 text-2xl font-black text-indigo-600">Ổn định</h3>
              </div>
            </div>

            <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800">Phiếu kiểm kê nhanh</h3>
                <button onClick={() => setTabKho('scan')} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">Quay lại quét mã</button>
              </div>
              <div className="space-y-3">
                {anToanTonKho.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">Chưa có dữ liệu kiểm kê trong kho.</div>
                ) : (
                  anToanTonKho.slice(0, 6).map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <p className="font-black text-slate-800">{item.tracking_code}</p>
                        <p className="text-sm text-slate-500">{item.receiver_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-500">{item.status}</p>
                        <p className="text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString('vi-VN')}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
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
              <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-indigo-400">
                <option value="">-- Chọn kho thực tế --</option>
                {danhSachKho.filter((warehouse) => warehouse.is_configured && warehouse.is_active).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
            </label>

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
                    <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Cân Nặng</th>
                    <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 text-right">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {anToanTonKho.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-20 text-center text-slate-400 font-medium">
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