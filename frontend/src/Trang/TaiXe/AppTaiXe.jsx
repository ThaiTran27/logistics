import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { MapPin, Package, CheckCircle, XCircle, LogOut, Navigation, Wallet, UserCircle, Bike, Map, Send, CalendarOff, Camera, AlertTriangle, X, ShieldCheck } from 'lucide-react';
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

const tinhTongTienCanThu = (order) => Number(order?.cod_amount || 0) + Number(order?.shipping_fee || 0);

const socket = io('http://localhost:5000');

export default function AppTaiXe() {
  const [donHang, setDonHang] = useState([]);
  const [tabHienTai, setTabHienTai] = useState('donhang'); 
  const [viTien, setViTien] = useState(5000000); 
  const [viTriHienTai, setViTriHienTai] = useState({ lat: 10.762622, lng: 106.660172 }); 
  const [routeInfo, setRouteInfo] = useState(null);
  
  // State cho form nghỉ phép
  const [lyDoNghi, setLyDoNghi] = useState('');
  const [dangGuiNghiPhep, setDangGuiNghiPhep] = useState(false);

  // State cho Modal Xử lý Đơn hàng (Thành công / Thất bại)
  const [modalXuLy, setModalXuLy] = useState({ mo: false, loai: '', don: null });
  const [anhMinhChung, setAnhMinhChung] = useState(null);
  const [anhPreview, setAnhPreview] = useState(null);
  const [lyDoHuy, setLyDoHuy] = useState('');
  const [xacNhanTien, setXacNhanTien] = useState(false);
  const [phuongThucCOD, setPhuongThucCOD] = useState('');
  const [dangCapNhat, setDangCapNhat] = useState(false);

  const driverId = localStorage.getItem('user_id');
  const driverRole = localStorage.getItem('role') || localStorage.getItem('user_role');
  const isPickupDriver = driverRole === 'pickup_driver';
  const driverName = localStorage.getItem('full_name') || 'Tài Xế Giao Nhận';
  const taskRoute = routeInfo?.task_route;
  const diemDi = taskRoute?.origin?.address || (taskRoute?.origin ? `${taskRoute.origin.lat},${taskRoute.origin.lng}` : '10.762622,106.660172');
  const tenKho = routeInfo?.warehouse?.address || 'Kho trung tâm Smart Logistics, TP. Hồ Chí Minh';
  const diemDen = taskRoute?.destination?.address || (taskRoute?.destination ? `${taskRoute.destination.lat},${taskRoute.destination.lng}` : tenKho);
  const urlChiDuong = routeInfo
    ? `https://www.google.com/maps/dir/?api=1&${new URLSearchParams({ origin: diemDi, destination: diemDen, travelmode: 'driving' })}`
    : '';

  const taiDuLieu = async () => {
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
  };

  useEffect(() => {
    taiDuLieu();
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setViTriHienTai({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }

    socket.on(`new_order_assigned_${driverId}`, (data) => {
      alert(data.message);
      taiDuLieu(); 
    });

    return () => socket.off(`new_order_assigned_${driverId}`);
  }, [driverId, isPickupDriver]);

  const xacNhanDaLayHang = async (orderId) => {
    if (!window.confirm('Xác nhận đã nhận kiện hàng từ Shop và mang về kho?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'picked_up', user_id: driverId })
      });
      const data = await res.json();
      if (!data.success) return alert(data.message || 'Không thể xác nhận lấy hàng.');
      const order = donHang.find((item) => String(item.id) === String(orderId));
      if (order) batDauPhatToaDo(orderId, order.tracking_code);
      const routeRes = await fetch(`http://localhost:5000/api/orders/${orderId}/route`);
      const routeData = await routeRes.json();
      if (routeData.success) setRouteInfo(routeData.data);
      alert('Đã xác nhận lấy hàng. Vui lòng bàn giao kiện hàng cho Thủ kho quét nhập.');
      taiDuLieu();
    } catch (error) {
      alert('Lỗi kết nối!');
    }
  };

  const batDauPhatToaDo = (orderId, trackingCode) => {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition((position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setViTriHienTai({ lat, lng });

        socket.emit('driver_update_location', {
          shipper_id: Number(driverId),
          order_id: orderId,
          tracking_code: trackingCode,
          lat: lat,
          lng: lng,
          route_status: 'moving',
          timestamp: new Date()
        });
      }, (error) => console.error("Lỗi GPS:", error), { enableHighAccuracy: true });
    }
  };

  const batDauGiaoHang = async (orderId, trackingCode) => {
    if (!window.confirm('Bắt đầu đi giao đơn này?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivering', user_id: driverId })
      });
      if ((await res.json()).success) {
        batDauPhatToaDo(orderId, trackingCode);
        const routeRes = await fetch(`http://localhost:5000/api/orders/${orderId}/route`);
        const routeData = await routeRes.json();
        if (routeData.success) setRouteInfo(routeData.data);
        alert("🚀 Đã bật GPS đồng bộ lộ trình!");
        taiDuLieu();
      }
    } catch (error) {
      alert('Lỗi cập nhật!');
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
      if (!anhMinhChung) return alert("BẮT BUỘC: Vui lòng chụp ảnh minh chứng đã giao hàng!");
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
        if (loai === 'completed') {
          setViTien(prev => prev - tinhTongTienCanThu(don));
        }
        alert(loai === 'completed' ? 'Đã xác nhận giao hàng và thu đủ COD + cước.' : 'Đã ghi nhận chuyển hoàn hàng!');
        dongModal();
        taiDuLieu();
      } else {
        alert("Lỗi: " + data.message);
      }
    } catch (error) {
      alert('Lỗi kết nối máy chủ!');
    } finally {
      setDangCapNhat(false);
    }
  };

  const dongModal = () => {
    setModalXuLy({ mo: false, loai: '', don: null });
    setAnhMinhChung(null);
    setAnhPreview(null);
    setLyDoHuy('');
    setXacNhanTien(false);
    setPhuongThucCOD('');
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
    } catch (error) {
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
  const tongTienThuHo = donThanhCong.reduce((sum, item) => sum + tinhTongTienCanThu(item), 0);
  const donDangChay = donHang.filter(d => isPickupDriver
    ? ['picking', 'picked_up', 'transferring_to_central', 'transferring_to_destination'].includes(d.status)
    : ['at_destination_warehouse', 'delivering'].includes(d.status));

  return (
    <div className="bg-slate-100 min-h-screen flex justify-center font-sans text-slate-800">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-b-[32px] shadow-lg text-white sticky top-0 z-50">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-full backdrop-blur-sm">
                <Bike size={22} />
              </div>
              <div>
                <p className="text-blue-100 text-[10px] font-bold uppercase tracking-wider">{isPickupDriver ? 'TÀI XẾ LẤY HÀNG' : 'TÀI XẾ GIAO HÀNG'}</p>
                <h2 className="font-black text-base">{driverName}</h2>
              </div>
            </div>
            <button onClick={dangXuat} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
              <LogOut size={18} />
            </button>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between text-slate-800">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase">SỐ DƯ VÍ (KÝ QUỸ)</p>
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
          
          {tabHienTai === 'donhang' && (
            <div className="p-5 space-y-4">
              <h3 className="font-black text-base text-slate-800 flex items-center gap-2 mb-1">
                <Navigation className="text-blue-600" size={18} /> {isPickupDriver ? 'Đơn cần lấy' : 'Đơn cần giao'} ({donDangChay.length})
              </h3>

              {donDangChay.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center mt-10">
                  <Package size={48} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-700 font-bold">Bạn đã hoàn thành tuyến đường.</p>
                  <p className="text-xs text-slate-400 mt-1">Đang chờ Điều phối viên chia đơn mới...</p>
                </div>
              ) : (
                donDangChay.map((don) => (
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
                          <button onClick={() => xacNhanDaLayHang(don.id)} className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md shadow-blue-200">
                            Xác nhận đã lấy hàng
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
        <div className="absolute bottom-0 left-0 w-full bg-white border-t border-slate-100 flex justify-around items-center py-3 px-2 z-50">
          <button onClick={() => setTabHienTai('donhang')} className={`flex flex-col items-center gap-1 w-20 ${tabHienTai === 'donhang' ? 'text-blue-600 font-bold' : 'text-slate-400 font-medium'}`}>
            <Navigation size={20} /><span className="text-[10px] uppercase">Đơn Hàng</span>
          </button>
          <button onClick={() => setTabHienTai('bando')} className={`flex flex-col items-center gap-1 w-20 ${tabHienTai === 'bando' ? 'text-blue-600 font-bold' : 'text-slate-400 font-medium'}`}>
            <Map size={20} /><span className="text-[10px] uppercase">Bản Đồ</span>
          </button>
          <button onClick={() => setTabHienTai('canhan')} className={`flex flex-col items-center gap-1 w-20 ${tabHienTai === 'canhan' ? 'text-blue-600 font-bold' : 'text-slate-400 font-medium'}`}>
            <UserCircle size={20} /><span className="text-[10px] uppercase">Cá Nhân</span>
          </button>
        </div>

        {/* ========================================================= 
            MODAL XỬ LÝ (CHỤP ẢNH & BÁO CÁO) DÀNH CHO APP TÀI XẾ 
            ========================================================= */}
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
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="checkTien"
                        className="w-6 h-6 mt-0.5 accent-emerald-500 rounded"
                        checked={xacNhanTien}
                        onChange={(e) => setXacNhanTien(e.target.checked)}
                      />
                      <label htmlFor="checkTien" className="text-sm">
                        <p className="font-bold text-emerald-800">Xác nhận đã thu đủ COD</p>
                        <p className="font-black text-red-600 text-lg">{Number(modalXuLy.don?.cod_amount || 0).toLocaleString()} VNĐ</p>
                      </label>
                    </div>
                    <div className="ml-9 mt-2 space-y-1 text-xs text-emerald-800">
                      <div className="flex justify-between"><span>COD hàng</span><span>{Number(modalXuLy.don?.cod_amount || 0).toLocaleString()} VNĐ</span></div>
                      <div className="flex justify-between"><span>Phí vận chuyển</span><span>{Number(modalXuLy.don?.shipping_fee || 0).toLocaleString()} VNĐ</span></div>
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