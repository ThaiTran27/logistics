import { useState, useEffect } from 'react';
import { Store, PackagePlus, ListOrdered, Wallet, LogOut, User, Phone, MapPin, DollarSign, Clock, Truck, CheckCircle, AlertCircle, PackageSearch, Scale, Calculator, Eye, X, Box, MapPinned, Printer, Camera, Zap, ShieldAlert } from 'lucide-react';
import Barcode from 'react-barcode';

export default function QuanLyDonHang() {
  const [donHang, setDonHang] = useState([]);
  const [form, setForm] = useState({ 
    receiver_name: '', 
    receiver_phone: '', 
    receiver_address: '', 
    cod_amount: '',
    weight_kg: '1',
    length: '10',  // Chiều dài
    width: '10',   // Chiều rộng
    height: '10',  // Chiều cao
    item_value: '0',
    distance_km: '5',
    is_remote_area: false,
    service_type: 'standard', // economy, standard, express
    is_fragile: false // THÊM TRƯỜNG HÀNG DỄ VỠ
  });
  
  const [shippingFee, setShippingFee] = useState(0);
  const [chargeableWeight, setChargeableWeight] = useState(0); // Trọng lượng tính cước cuối cùng
  const [tabHienTai, setTabHienTai] = useState('taodon');
  
  const [donHangDangChon, setDonHangDangChon] = useState(null);
  const [modalMo, setModalMo] = useState(false);
  
  // State quản lý việc in phiếu
  const [phieuIn, setPhieuIn] = useState(null);
  
  const shopId = localStorage.getItem('user_id');
  const shopName = localStorage.getItem('full_name') || 'Cửa Hàng Đối Tác';

  const taiDuLieu = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/orders');
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

  useEffect(() => { taiDuLieu(); }, []);

  // [LOGIC MỚI CHUẨN VIETTEL POST] Thuật toán tính phí ship tự động
  useEffect(() => {
    const dist = parseFloat(form.distance_km) || 0;
    const actualWeight = parseFloat(form.weight_kg) || 0;
    const l = parseFloat(form.length) || 0;
    const w = parseFloat(form.width) || 0;
    const h = parseFloat(form.height) || 0;
    const value = parseFloat(form.item_value) || 0;
    const isRemote = form.is_remote_area;
    const isFragile = form.is_fragile;

    // 1. Tính trọng lượng quy đổi theo thể tích (Chuẩn bưu chính Việt Nam chia 5000)
    const volumetricWeight = (l * w * h) / 5000;
    
    // Lấy trọng lượng lớn hơn để tính cước
    const finalWeight = Math.max(actualWeight, volumetricWeight);
    setChargeableWeight(finalWeight);

    // 2. Xác định cước cơ sở theo Gói dịch vụ
    let baseFee = 15000; // Tiết kiệm (economy)
    if (form.service_type === 'standard') baseFee = 22000; // Chuyển phát nhanh
    if (form.service_type === 'express') baseFee = 40000; // Hỏa tốc

    // 3. Phụ phí Khoảng cách (Phát sinh sau 5km)
    let distanceFee = 0;
    if (dist > 5) distanceFee = (dist - 5) * 1500; // Mỗi km vượt thêm 1.500đ

    // 4. Phụ phí Cân nặng (Phát sinh sau 2kg)
    let weightFee = 0;
    if (finalWeight > 2) {
      weightFee = Math.ceil((finalWeight - 2) / 0.5) * 4000; // Vượt 0.5kg cộng 4k
    }

    // 5. Phụ phí Bảo hiểm (Hàng giá trị cao > 1 triệu thu 0.5%)
    let insuranceFee = 0;
    if (value > 1000000) insuranceFee = value * 0.005;

    // 6. Phụ phí Vùng sâu vùng xa
    let remoteFee = isRemote ? 20000 : 0;

    // 7. PHỤ PHÍ HÀNG DỄ VỠ (+10.000đ đóng gói cẩn thận)
    let fragileFee = isFragile ? 10000 : 0; 

    const total = baseFee + distanceFee + weightFee + insuranceFee + remoteFee + fragileFee;
    setShippingFee(Math.round(total));
  }, [form.distance_km, form.weight_kg, form.length, form.width, form.height, form.item_value, form.is_remote_area, form.service_type, form.is_fragile]);

  const layCuocPhiChuan = (don) => {
    if (don?.shipping_fee !== undefined && don?.shipping_fee !== null && Number(don.shipping_fee) > 0) {
      return Number(don.shipping_fee);
    }
    return 15000;
  };

  const taoDonMoi = async (e) => {
    e.preventDefault();
    const tracking_code = 'VTP' + Math.floor(100000 + Math.random() * 900000) + 'VN'; // Dùng VTP cho chuẩn style
    
    try {
      const res = await fetch('http://localhost:5000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          receiver_name: form.receiver_name,
          receiver_phone: form.receiver_phone,
          receiver_address: form.receiver_address,
          cod_amount: form.cod_amount,
          shipping_fee: shippingFee,
          weight_kg: chargeableWeight, // Lưu trọng lượng tính cước cuối cùng vào DB
          is_fragile: form.is_fragile, // GỬI TRẠNG THÁI HÀNG DỄ VỠ XUỐNG DB
          tracking_code, 
          shop_id: shopId 
        })
      });
      const data = await res.json();
      
      if (data.success) {
        alert(`🎉 Tạo đơn thành công! Mã vận đơn của bạn là: ${tracking_code} | Cước phí: ${shippingFee.toLocaleString()} đ`);
        setForm({ 
          receiver_name: '', receiver_phone: '', receiver_address: '', cod_amount: '', 
          weight_kg: '1', length: '10', width: '10', height: '10', item_value: '0', 
          distance_km: '5', is_remote_area: false, service_type: 'standard', is_fragile: false 
        });
        taiDuLieu();
        setTabHienTai('danhsach');
      } else {
        alert("Lỗi: " + data.message);
      }
    } catch (error) {
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
      { id: 'in_warehouse', name: 'Đã Nhập Kho', desc: 'Hàng đã về hệ thống kho bãi', icon: <Box size={18} /> },
      { id: 'delivering', name: 'Đang Giao Hàng', desc: 'Shipper đang mang hàng đến khách', icon: <Truck size={18} /> },
      { id: 'completed', name: 'Giao Thành Công', desc: 'Khách đã nhận và thanh toán COD', icon: <CheckCircle size={18} /> }
    ];

    let mucHienTai = 0;
    if (status === 'picking') mucHienTai = 1;
    if (status === 'in_warehouse') mucHienTai = 2;
    if (status === 'delivering') mucHienTai = 3;
    if (status === 'completed') mucHienTai = 4;

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
      <div className="flex min-h-screen bg-[#F0F7FF] font-sans text-slate-700 print:hidden">
        
        {/* SIDEBAR */}
        <div className="w-72 bg-white border-r border-blue-50 shadow-[0_0_20px_rgba(0,0,0,0.02)] flex flex-col z-10 justify-between">
          <div>
            <div className="p-8 border-b border-blue-50 flex items-center gap-3">
              <div className="bg-gradient-to-tr from-blue-600 to-blue-400 p-2.5 rounded-xl shadow-blue-200 shadow-lg">
                <Store className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Cổng Đối Tác</h2>
                <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mt-0.5">Quản lý Cửa Hàng</p>
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
            </div>
          </div>

          <div className="p-5 border-t border-blue-50">
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
        <div className="flex-1 p-10 overflow-y-auto">
          <div className="mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                {tabHienTai === 'taodon' ? 'Khởi Tạo Vận Đơn Mới' : 'Danh Sách Vận Đơn'}
              </h1>
              <p className="text-slate-500 mt-2">
                {tabHienTai === 'taodon' ? 'Lựa chọn gói dịch vụ và nhập thông tin để tính cước tự động.' : 'Theo dõi tiến độ giao hàng và in mã vạch vận chuyển.'}
              </p>
            </div>
          </div>

          {tabHienTai === 'taodon' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl">
              <div className="lg:col-span-2 space-y-6">
                
                {/* BLOCK 1: CHỌN GÓI DỊCH VỤ */}
                <div className="bg-white p-8 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-50">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                    <Zap className="text-amber-500" /> Gói Dịch Vụ Vận Chuyển
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Địa chỉ giao hàng chi tiết</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-4 text-slate-400" size={18} />
                      <textarea rows="2" required
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 transition-all font-medium resize-none"
                        placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                        value={form.receiver_address} onChange={e => setForm({...form, receiver_address: e.target.value})} 
                      ></textarea>
                    </div>
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
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-2">Khoảng cách dự kiến (km)</label>
                      <input type="number" min="1" required
                        className="w-full px-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-400 font-medium"
                        value={form.distance_km} onChange={e => setForm({...form, distance_km: e.target.value})} 
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
                      <input type="checkbox" className="w-5 h-5 accent-blue-600 rounded cursor-pointer" checked={form.is_remote_area} onChange={e => setForm({...form, is_remote_area: e.target.checked})}/>
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
                        {(form.service_type === 'express' ? 40000 : form.service_type === 'standard' ? 22000 : 15000).toLocaleString()} đ
                      </span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-slate-50">
                      <span>Phụ phí vượt cân:</span>
                      <span className="font-bold text-slate-800">
                        {(chargeableWeight > 2 ? Math.ceil((chargeableWeight - 2) / 0.5) * 4000 : 0).toLocaleString()} đ
                      </span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-slate-50">
                      <span>Phụ phí khoảng cách:</span>
                      <span className="font-bold text-slate-800">
                        {(form.distance_km > 5 ? (form.distance_km - 5) * 1500 : 0).toLocaleString()} đ
                      </span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-slate-50">
                      <span>Phí bảo hiểm:</span>
                      <span className="font-bold text-slate-800">
                        {(form.item_value > 1000000 ? form.item_value * 0.005 : 0).toLocaleString()} đ
                      </span>
                    </div>
                    {form.is_fragile && (
                      <div className="flex justify-between pb-2 border-b border-slate-50">
                        <span className="text-orange-600">Phí bọc hàng dễ vỡ:</span>
                        <span className="font-bold text-orange-600">+ 10,000 đ</span>
                      </div>
                    )}
                    {form.is_remote_area && (
                      <div className="flex justify-between pb-2 border-b border-slate-50">
                        <span>Phụ phí vùng xa:</span>
                        <span className="font-bold text-slate-800">+ 20,000 đ</span>
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
                              onClick={() => setPhieuIn(don)} 
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
                      src={`http://localhost:5000${donHangDangChon.proof_image}`} 
                      alt="Minh chứng giao hàng" 
                      className="max-h-56 object-contain rounded-xl w-full"
                    />
                  </div>
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
        <div className="hidden print:flex fixed inset-0 bg-white z-[99999] flex-col items-center p-8 text-black">
          <div className="w-[10cm] h-[15cm] border-2 border-black p-4 flex flex-col justify-between relative">
            <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
              <h1 className="text-2xl font-black uppercase">SmartLogistics</h1>
              <div className="text-right">
                <p className="font-bold text-lg">{new Date().toLocaleDateString('vi-VN')}</p>
                <p className="text-sm font-bold border border-black px-2 mt-1 rounded">{phieuIn.weight_kg || 1} KG</p>
              </div>
            </div>

            <div className="flex justify-center mb-6 py-4">
              <Barcode value={phieuIn.tracking_code} format="CODE128" width={3} height={80} displayValue={true} fontSize={20} />
            </div>

            {/* Chữ HÀNG DỄ VỠ in to trên máy in nhiệt */}
            {phieuIn.is_fragile === 1 && (
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
                <p className="font-black text-xl">{phieuIn.receiver_name}</p>
                <p className="font-bold text-lg">{phieuIn.receiver_phone}</p>
                <p className="text-base font-medium leading-tight mt-1">{phieuIn.receiver_address}</p>
              </div>
            </div>

            <div className="mt-auto border-t-2 border-black pt-4">
              <p className="text-center font-bold text-lg uppercase tracking-widest mb-1">Tiền Thu Hộ (COD)</p>
              <p className="text-center font-black text-4xl">
                {Number(phieuIn.cod_amount).toLocaleString()} VNĐ
              </p>
            </div>
            
            <p className="text-center text-xs mt-4 italic font-medium">Lưu ý: Chỉ giao hàng giờ hành chính.</p>
          </div>
        </div>
      )}
    </>
  );
}