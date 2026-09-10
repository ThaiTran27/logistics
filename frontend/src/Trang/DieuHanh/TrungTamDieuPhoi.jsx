import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Truck, MapPin, Navigation, Search, PackageSearch, CheckCircle, Clock, Map, FileText, Send, Zap, Star, Users, Package, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';

// Fix lỗi mất icon mặc định của Leaflet trong React
import iconMarkerUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
const shipperIcon = new L.Icon({
  iconUrl: iconMarkerUrl,
  shadowUrl: iconShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// Khởi tạo kết nối Socket.io tới Backend
const socket = io('http://localhost:5000');

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
  const [taiXeList, setTaiXeList] = useState([]);
  const [tuKhoa, setTuKhoa] = useState('');
  const [modalMo, setModalMo] = useState(false);
  const [donDangChon, setDonDangChon] = useState(null);
  const [taiXeDuocChon, setTaiXeDuocChon] = useState('');
  
  // State quản lý giới hạn khu vực phân quyền
  const [gioiHanKhuVuc, setGioiHanKhuVuc] = useState(true);
  const [khuVucDonHang, setKhuVucDonHang] = useState('');

  const [viTriTaiXeMap, setViTriTaiXeMap] = useState({});
  const [tabHienTai, setTabHienTai] = useState('dieuphoan'); 

  const [formBaoCao, setFormBaoCao] = useState({ title: '', content: '' });
  const [dangGuiBaoCao, setDangGuiBaoCao] = useState(false);

  const userId = localStorage.getItem('user_id');
  const userName = localStorage.getItem('full_name') || 'Điều Phối Viên';

  // [THUẬT TOÁN HAVERSINE] Tính khoảng cách đường chim bay
  const tinhKhoangCachHaversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1); 
  };

  const taiDuLieu = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/orders');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const donCanDieuPhoi = data.data.filter(d => 
          d?.status === 'pending' || d?.status === 'in_warehouse'
        );
        setDonHang(donCanDieuPhoi);
      }
    } catch (error) {
      console.error("Lỗi tải đơn hàng:", error);
    }
  };

  const taiDanhSachTaiXe = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/shippers');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const zones = ['Nội thành TP.HCM', 'Ngoại thành TP.HCM'];
        const taiXeGps = data.data.map((tx, i) => ({
          ...tx,
          lat: 10.762622 + (Math.random() - 0.5) * 0.1,
          lng: 106.660172 + (Math.random() - 0.5) * 0.1,
          zone: zones[i % 2] 
        }));
        setTaiXeList(taiXeGps);
      }
    } catch (error) {
      console.error("Lỗi tải tài xế:", error);
    }
  };

  useEffect(() => {
    taiDuLieu();
    taiDanhSachTaiXe();

    socket.on('driver_location_changed', (data) => {
      setViTriTaiXeMap(prev => ({
        ...prev,
        [data.order_id]: {
          lat: data.lat,
          lng: data.lng,
          tracking_code: data.tracking_code,
          timestamp: data.timestamp
        }
      }));
    });

    return () => socket.off('driver_location_changed');
  }, []);

  const moModalPhanCong = (don) => {
    const diaChi = don?.receiver_address || '';
    const isNgoaiThanh = diaChi.toLowerCase().includes('hóc môn') || 
                         diaChi.toLowerCase().includes('củ chi') || 
                         diaChi.toLowerCase().includes('bình chánh') ||
                         diaChi.toLowerCase().includes('quận 9');
    const kv = isNgoaiThanh ? 'Ngoại thành TP.HCM' : 'Nội thành TP.HCM';
    
    setKhuVucDonHang(kv);
    setGioiHanKhuVuc(true); 
    setDonDangChon(don);
    
    const orderLat = 10.762622;
    const orderLng = 106.660172;
    let danhSachHienThi = [...taiXeList].map(tx => ({
      ...tx, distance: parseFloat(tinhKhoangCachHaversine(orderLat, orderLng, tx.lat, tx.lng))
    })).filter(tx => tx.zone === kv).sort((a, b) => a.distance - b.distance);

    setTaiXeDuocChon(danhSachHienThi.length > 0 ? String(danhSachHienThi[0].id) : '');
    setModalMo(true);
  };

  const danhSachTaiXeHienThi = (() => {
    const orderLat = 10.762622; 
    const orderLng = 106.660172;
    let list = [...taiXeList].map(tx => ({
      ...tx, distance: parseFloat(tinhKhoangCachHaversine(orderLat, orderLng, tx.lat, tx.lng))
    }));
    
    if (gioiHanKhuVuc) {
      list = list.filter(tx => tx.zone === khuVucDonHang);
    }
    
    return list.sort((a, b) => a.distance - b.distance);
  })();

  const doiTrangThaiGioiHan = () => {
    const trangThaiMoi = !gioiHanKhuVuc;
    setGioiHanKhuVuc(trangThaiMoi);
    const orderLat = 10.762622;
    const orderLng = 106.660172;
    let list = [...taiXeList].map(tx => ({
      ...tx, distance: parseFloat(tinhKhoangCachHaversine(orderLat, orderLng, tx.lat, tx.lng))
    }));
    if (trangThaiMoi) list = list.filter(tx => tx.zone === khuVucDonHang);
    list.sort((a, b) => a.distance - b.distance);
    setTaiXeDuocChon(list.length > 0 ? String(list[0].id) : '');
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
        body: JSON.stringify({ shipper_id: parseInt(taiXeDuocChon) }) 
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
    } catch (error) {
      alert("Lỗi kết nối đến máy chủ! Vui lòng kiểm tra lại mạng.");
    }
  };

  const guiBaoCao = async (e) => {
    e.preventDefault();
    if (!formBaoCao.title.trim() || !formBaoCao.content.trim()) return alert("Nhập đủ thông tin!");
    
    setDangGuiBaoCao(true);
    try {
      const res = await fetch('http://localhost:5000/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ created_by: userId, department: 'Phòng Điều Phối', title: formBaoCao.title, content: formBaoCao.content })
      });
      const data = await res.json();
      
      if (data.success) {
        alert("✅ Đã gửi báo cáo lên Ban Giám Đốc!");
        setFormBaoCao({ title: '', content: '' }); 
      } else alert("Lỗi: " + data.message);
    } catch (error) {
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
  const safeUserName = userName || 'Điều Phối Viên';

  const donDaLoc = safeDonHang.filter(d => {
    const kw = tuKhoa.toLowerCase();
    return (d?.tracking_code || '').toLowerCase().includes(kw) || (d?.receiver_address || '').toLowerCase().includes(kw);
  });

  const donChoLay = safeDonHang.filter(d => d.status === 'pending').length;
  const donChoGiao = safeDonHang.filter(d => d.status === 'in_warehouse').length;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans text-slate-700">
      
      {/* SIDEBAR */}
      <div className="w-72 bg-white border-r border-slate-200 shadow-sm flex flex-col z-10 justify-between">
        <div>
          <div className="p-8 border-b border-slate-100 flex items-center gap-3">
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-2.5 rounded-xl shadow-lg shadow-emerald-200">
              <Navigation className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Điều Hành</h2>
              <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mt-0.5">Trung tâm Điều Phối</p>
            </div>
          </div>
          
          <div className="p-5 mt-2 space-y-3">
            <button onClick={() => setTabHienTai('dieuphoan')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'dieuphoan' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'text-slate-500 hover:bg-slate-50'}`}><MapPin size={20} /> Phân Tuyến Tài Xế</button>
            <button onClick={() => setTabHienTai('bandogiamsat')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'bandogiamsat' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'text-slate-500 hover:bg-slate-50'}`}><Map size={20} /> Giám Sát Bản Đồ GPS</button>
            <button onClick={() => setTabHienTai('baocao')} className={`w-full px-5 py-4 rounded-2xl font-bold flex items-center gap-4 transition-all ${tabHienTai === 'baocao' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'text-slate-500 hover:bg-slate-50'}`}><FileText size={20} /> Báo Cáo Giám Đốc</button>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100">
          <div className="flex items-center gap-3 px-5 py-4 mb-2 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-black text-emerald-600">{safeUserName.charAt(0)}</div>
            <div><p className="text-sm font-bold text-slate-700">{safeUserName}</p></div>
          </div>
          <button onClick={dangXuat} className="w-full px-5 py-4 rounded-2xl font-bold text-left text-red-500 hover:bg-red-50 transition-colors">Đăng Xuất</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-10 overflow-y-auto flex flex-col">
        
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

            <div className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">AI Smart Dispatching</h1>
                <p className="text-slate-500 mt-2 font-medium">Hệ thống áp dụng thuật toán Haversine để tự động gợi ý tài xế gần nhất.</p>
              </div>
              <div className="relative w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Tìm mã đơn hoặc địa chỉ..." className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all font-medium" value={tuKhoa} onChange={(e) => setTuKhoa(e.target.value)} />
              </div>
            </div>

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
                        {don.status === 'pending' ? <><Clock size={14}/> Cần Lấy Hàng</> : <><PackageSearch size={14}/> Cần Giao Hàng</>}
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
              <ShieldCheck size={16} className="fill-white"/> PHÂN QUYỀN VÀ GIỚI HẠN KHU VỰC
            </div>

            <h3 className="text-2xl font-black text-slate-800 mb-2 mt-4 text-center">Phân Tuyến Thông Minh</h3>
            <p className="text-slate-500 text-sm mb-4 text-center">Đơn hàng: <span className="font-bold text-slate-700">{donDangChon?.tracking_code}</span></p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 flex justify-between items-center cursor-pointer" onClick={doiTrangThaiGioiHan}>
              <div>
                <p className="font-bold text-sm text-slate-800">Khóa Tuyến: {khuVucDonHang}</p>
                <p className="text-xs text-slate-500 mt-0.5">Chỉ hiển thị tài xế đăng ký ở khu vực này</p>
              </div>
              <div>
                {gioiHanKhuVuc ? (
                  <ToggleRight size={36} className="text-emerald-500" />
                ) : (
                  <ToggleLeft size={36} className="text-slate-300" />
                )}
              </div>
            </div>

            <form onSubmit={phanCongTaiXe} className="space-y-4">
              <label className="block text-sm font-bold text-slate-700 mb-1">Tài xế trong bán kính gần nhất:</label>
              
              <div className="space-y-3 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                {danhSachTaiXeHienThi.length === 0 ? (
                  <div className="text-center p-6 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-red-500 text-sm font-bold">Không có tài xế nào thuộc khu vực này!</p>
                    <p className="text-xs text-red-400 mt-1">Vui lòng tắt "Khóa tuyến" ở trên để huy động tài xế tuyến khác.</p>
                  </div>
                ) : (
                  danhSachTaiXeHienThi.map((tx, index) => (
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
                        {index === 0 && <Star size={12} className="absolute -top-1 -right-1 text-amber-400 fill-amber-400" />}
                        <Truck size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 flex items-center gap-2">
                          {tx?.full_name} 
                          {index === 0 && <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded uppercase">Gần nhất</span>}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Khu vực: <span className="font-bold text-slate-700">{tx.zone}</span> 
                        </p>
                        <p className="text-[11px] font-bold text-emerald-600 mt-0.5">
                          Cách điểm giao: {tx.distance} km
                        </p>
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